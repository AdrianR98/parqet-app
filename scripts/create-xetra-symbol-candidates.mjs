import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parseCsvList(value, normalizer = (item) => String(item ?? "").trim()) {
    return String(value ?? "")
        .split(",")
        .map((item) => normalizer(item))
        .filter(Boolean);
}

function parseCliArgs(argv) {
    const options = {
        write: false,
        limit: 100,
        isin: null,
        sourceKey: "xetra_all_tradable_instruments",
        skipVerifiedPrimary: true,
        onlyUnmapped: true,
        excludeIsins: new Set(),
        instrumentTypes: new Set(),
        preferEtfs: false,
        out: null,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;
        if (token === "--write") options.write = true;
        if (token === "--limit") options.limit = Number(args.shift() ?? "0");
        if (token === "--isin") options.isin = normalizeIsin(args.shift() ?? "");
        if (token === "--source-key") options.sourceKey = String(args.shift() ?? "").trim() || options.sourceKey;
        if (token === "--skip-verified-primary") options.skipVerifiedPrimary = true;
        if (token === "--include-verified-primary") options.skipVerifiedPrimary = false;
        if (token === "--only-unmapped") options.onlyUnmapped = true;
        if (token === "--include-mapped") options.onlyUnmapped = false;
        if (token === "--exclude-isin") {
            for (const isin of parseCsvList(args.shift(), normalizeIsin)) options.excludeIsins.add(isin);
        }
        if (token === "--instrument-type") {
            for (const type of parseCsvList(args.shift(), (item) => String(item ?? "").trim().toLowerCase())) options.instrumentTypes.add(type);
        }
        if (token === "--prefer-etfs") options.preferEtfs = true;
        if (token === "--out") options.out = String(args.shift() ?? "").trim() || null;
    }

    if (!Number.isInteger(options.limit) || options.limit <= 0) {
        throw new Error("Invalid --limit value.");
    }
    if (options.isin && !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Invalid --isin value.");
    }

    return options;
}

function buildNotes(row, sourceKey) {
    const fields = [
        "source=xetra_reference",
        `source_key=${sourceKey}`,
        `mnemonic=${row.mnemonic}`,
        `mic_code=${row.micCode ?? ""}`,
        `primary_market_mic_code=${row.primaryMarketMicCode ?? ""}`,
        `instrument_type=${row.instrumentType ?? ""}`,
        `market_segment=${row.marketSegment ?? ""}`,
    ];
    return fields.join("; ");
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
    const options = parseCliArgs(process.argv.slice(2));
    const { listXetraReferenceCandidates, insertSymbolMappingCandidate } = await import("../src/lib/market-data/db/repository-core.ts");

    const rows = await listXetraReferenceCandidates({
        sourceKey: options.sourceKey,
        isin: options.isin ?? undefined,
        limit: Math.max(options.limit * 20, 200),
        excludeIsins: [...options.excludeIsins],
        instrumentTypes: [...options.instrumentTypes],
        preferEtfs: options.preferEtfs,
    });

    const counters = {
        referenceRowsScanned: rows.length,
        matchedInstruments: rows.length,
        skippedVerifiedPrimary: 0,
        skippedMapped: 0,
        skippedExistingCandidateDuplicate: 0,
        skippedByFilters: 0,
        plannedCandidates: 0,
        inserted: 0,
        duplicatesSkippedOnWrite: 0,
    };

    const planned = [];

    for (const row of rows) {
        if (options.skipVerifiedPrimary && row.hasVerifiedPrimary) {
            counters.skippedVerifiedPrimary += 1;
            continue;
        }
        if (options.onlyUnmapped && row.hasVerifiedYfinance) {
            counters.skippedMapped += 1;
            continue;
        }
        if (row.hasExistingCandidate) {
            counters.skippedExistingCandidateDuplicate += 1;
            continue;
        }

        planned.push(row);
        if (planned.length >= options.limit) {
            break;
        }
    }

    counters.skippedByFilters =
        counters.referenceRowsScanned -
        counters.skippedVerifiedPrimary -
        counters.skippedMapped -
        counters.skippedExistingCandidateDuplicate -
        planned.length;
    counters.plannedCandidates = planned.length;

    if (options.write) {
        for (const row of planned) {
            const inserted = await insertSymbolMappingCandidate({
                instrumentId: row.instrumentId,
                provider: "yfinance",
                symbol: row.candidateSymbol,
                exchange: "XETRA",
                currency: row.currency,
                notes: buildNotes(row, options.sourceKey),
            });
            if (inserted) counters.inserted += 1;
            else counters.duplicatesSkippedOnWrite += 1;
        }
    }

    console.log(`reference rows scanned: ${counters.referenceRowsScanned}`);
    console.log(`matched instruments: ${counters.matchedInstruments}`);
    console.log(`skipped existing verified primary: ${counters.skippedVerifiedPrimary}`);
    console.log(`skipped existing candidate duplicates: ${counters.skippedExistingCandidateDuplicate}`);
    console.log(`skipped by filters: ${counters.skippedByFilters + counters.skippedMapped}`);
    console.log(`planned candidates: ${counters.plannedCandidates}`);
    console.log("sample:");
    for (const row of planned.slice(0, 10)) {
        console.log(
            `  ${row.isin} | ${row.name ?? "-"} | ${row.hasAnyPrimary ? "yes" : "no"} | ${row.candidateSymbol} | ${row.currency ?? "-"} | ${row.instrumentType ?? "-"} | ${row.marketSegment ?? "-"}`,
        );
    }

    if (options.write) {
        console.log(`candidates inserted/upserted: ${counters.inserted}`);
        console.log(`duplicates skipped: ${counters.duplicatesSkippedOnWrite}`);
        console.log("verified/primary changes: none");
    } else {
        console.log("write summary: skipped (dry-run)");
    }

    if (options.out) {
        const outPath = path.resolve(process.cwd(), options.out);
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(
            outPath,
            JSON.stringify(
                {
                    options: {
                        ...options,
                        excludeIsins: [...options.excludeIsins],
                        instrumentTypes: [...options.instrumentTypes],
                    },
                    counters,
                    sample: planned.slice(0, 50),
                },
                null,
                2,
            ),
            "utf8",
        );
        console.log(`report written: ${options.out}`);
    }
}

run()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Xetra candidate creation failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
