import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function parseArgs(argv) {
    if (argv.length === 0) {
        throw new Error("Pfad zu symbol-validation-results.json fehlt.");
    }

    const result = {
        filePath: argv[0],
        write: false,
        provider: "yfinance",
        promoteBest: false,
    };

    const args = argv.slice(1);
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--write") {
            result.write = true;
            continue;
        }

        if (token === "--provider") {
            result.provider = String(args.shift() ?? "yfinance").trim().toLowerCase() || "yfinance";
            continue;
        }

        if (token === "--promote-best") {
            result.promoteBest = true;
            continue;
        }
    }

    return result;
}

function safeMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Unbekannter Fehler";
}

function normalizeSymbol(value) {
    return String(value ?? "").trim().toUpperCase();
}

function isValidationSuccess(row) {
    const hasHistory = row?.hasHistory === true;
    const pointCount = Number(row?.pointCount ?? 0);
    const latestClose = Number(row?.latestClose ?? NaN);
    const error = row?.error;

    return hasHistory && pointCount >= 20 && Number.isFinite(latestClose) && (error === null || error === undefined || error === "");
}

function toSummaryNote(row, status) {
    const pointCount = Number(row?.pointCount ?? 0);
    const latestClose = row?.latestClose ?? null;
    const currency = row?.currency ?? null;
    const div = Number(row?.dividendsCount ?? 0);
    const spl = Number(row?.splitsCount ?? 0);

    if (status === "success") {
        return `validated:yfinance; status=success; pointCount=${pointCount}; latestClose=${latestClose}; currency=${currency ?? "-"}; dividends=${div}; splits=${spl}`;
    }

    const error = String(row?.error ?? "validation_failed").slice(0, 300);
    return `validated:yfinance; status=failed; pointCount=${pointCount}; error=${error}`;
}

function mergeNotes(existingNotes, nextNote) {
    const left = String(existingNotes ?? "").trim();
    const right = String(nextNote ?? "").trim();
    if (!left) return right;
    if (!right) return left;
    return `${left} | ${right}`.slice(0, 2000);
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const filePath = path.resolve(process.cwd(), options.filePath);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
        throw new Error("Validation-Resultat muss ein JSON-Array sein.");
    }

    const {
        getSymbolMappingByProviderSymbol,
        updateSymbolMappingValidation,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    let total = 0;
    let success = 0;
    let failed = 0;
    let missingMapping = 0;
    let wouldWrite = 0;
    let didWrite = 0;

    for (const row of parsed) {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) {
            continue;
        }
        total += 1;

        const mapping = await getSymbolMappingByProviderSymbol(options.provider, symbol);
        if (!mapping) {
            missingMapping += 1;
            continue;
        }

        const ok = isValidationSuccess(row);
        if (ok) {
            success += 1;
        } else {
            failed += 1;
        }

        const note = toSummaryNote(row, ok ? "success" : "failed");
        const mergedNotes = mergeNotes(mapping.notes, note);

        if (!options.write) {
            wouldWrite += 1;
            continue;
        }

        if (ok) {
            await updateSymbolMappingValidation({
                provider: options.provider,
                symbol,
                verifiedAt: new Date().toISOString(),
                notes: mergedNotes,
                isActive: true,
            });
        } else {
            await updateSymbolMappingValidation({
                provider: options.provider,
                symbol,
                verifiedAt: mapping.verifiedAt,
                notes: mergedNotes,
                isActive: mapping.isActive,
            });
        }

        didWrite += 1;
    }

    if (options.promoteBest) {
        console.log("Hinweis: --promote-best ist in dieser Version noch nicht implementiert. Es wurde keine Primary-Promotion durchgeführt.");
    }

    console.log(`Validierungen gelesen: ${total}`);
    console.log(`Erfolgreich: ${success}`);
    console.log(`Fehlgeschlagen: ${failed}`);
    console.log(`Kein Mapping gefunden: ${missingMapping}`);
    console.log(`DB writes: ${options.write ? didWrite : `übersprungen (dry-run, wouldWrite=${wouldWrite})`}`);
}

run()
    .catch((error) => {
        console.error(`Validation-Import fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
