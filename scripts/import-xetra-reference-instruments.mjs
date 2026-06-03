import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SOURCE_KEY = "xetra_all_tradable_instruments";
const SOURCE_NAME = "Xetra allTradableInstruments";
const SOURCE_TYPE = "csv";
const DEFAULT_FILE_PATH = ".market-data/t7-xetr-allTradableInstruments.csv";

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeCode(value) {
    const normalized = String(value ?? "").replace(/\s+/g, "").toUpperCase();
    return normalized || null;
}

function parseCliArgs(argv) {
    const options = {
        filePath: DEFAULT_FILE_PATH,
        write: false,
        limit: null,
        isin: null,
        activeOnly: true,
        enrichInstruments: false,
        generateCandidates: false,
        out: null,
    };

    const args = [...argv];
    if (args[0] && !args[0].startsWith("--")) {
        options.filePath = args.shift();
    }

    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;
        if (token === "--write") options.write = true;
        if (token === "--limit") options.limit = Number(args.shift() ?? "0");
        if (token === "--isin") options.isin = normalizeIsin(args.shift() ?? "");
        if (token === "--active-only") options.activeOnly = true;
        if (token === "--include-inactive") options.activeOnly = false;
        if (token === "--enrich-instruments") options.enrichInstruments = true;
        if (token === "--generate-candidates") options.generateCandidates = true;
        if (token === "--out") options.out = args.shift() ?? null;
    }

    if (options.limit != null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
        throw new Error("Invalid --limit value.");
    }

    if (options.isin && !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Invalid --isin value.");
    }

    return options;
}

function splitSemicolonCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ";" && !inQuotes) {
            values.push(current);
            current = "";
            continue;
        }
        current += char;
    }
    values.push(current);
    return values.map((value) => value.trim());
}

function normalizeHeader(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function findHeaderIndex(lines) {
    for (let i = 0; i < lines.length; i += 1) {
        const cells = splitSemicolonCsvLine(lines[i]).map(normalizeHeader);
        const hasIsin = cells.includes("isin");
        const hasMnemonic = cells.includes("mnemonic");
        if (hasIsin && hasMnemonic) {
            return i;
        }
    }
    return -1;
}

function findColumnValue(row, headers, names) {
    for (const name of names) {
        const index = headers.findIndex((header) => header === normalizeHeader(name));
        if (index >= 0) {
            const value = row[index];
            if (typeof value === "string" && value.trim()) return value.trim();
        }
    }
    return null;
}

function looksActive(value) {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes("active") ||
        normalized.includes("tradable") ||
        normalized.includes("open") ||
        normalized === "yes" ||
        normalized === "true"
    );
}

function isRowActive(row, headers) {
    const productStatus = findColumnValue(row, headers, ["Product Status"]);
    const instrumentStatus = findColumnValue(row, headers, ["Instrument Status"]);
    return looksActive(productStatus) && looksActive(instrumentStatus);
}

function toAssetTypeHint(typeValue) {
    const normalized = String(typeValue ?? "").trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes("etf")) return "etf";
    if (normalized.includes("fund")) return "fund";
    if (normalized.includes("bond")) return "bond";
    if (normalized.includes("note")) return "bond";
    if (normalized.includes("share") || normalized.includes("stock") || normalized.includes("equity")) return "stock";
    return null;
}

function nameNeedsEnrichment(name, isin) {
    if (!name) return true;
    const normalized = String(name).trim();
    return !normalized || normalized.toUpperCase() === isin;
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
    const resolvedPath = path.resolve(process.cwd(), options.filePath);
    const rawFile = await readFile(resolvedPath, "utf8");
    const withoutBom = rawFile.charCodeAt(0) === 0xfeff ? rawFile.slice(1) : rawFile;
    const lines = withoutBom.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const headerIndex = findHeaderIndex(lines);
    if (headerIndex < 0) {
        throw new Error("CSV header row with ISIN and Mnemonic not found.");
    }

    const headers = splitSemicolonCsvLine(lines[headerIndex]).map(normalizeHeader);
    const parsedRows = [];
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
        const cells = splitSemicolonCsvLine(lines[i]);
        if (cells.every((value) => !value)) continue;
        const rowObject = {};
        for (let j = 0; j < headers.length; j += 1) {
            rowObject[headers[j]] = cells[j] ?? "";
        }
        parsedRows.push({ cells, raw: rowObject });
    }

    const { listMarketInstruments, upsertReferenceSource, upsertReferenceInstrument, enrichMarketInstrumentsFromReferences } =
        await import("../src/lib/market-data/db/repository-core.ts");
    const instruments = await listMarketInstruments({ limit: 50000 });
    const instrumentByIsin = new Map(instruments.map((item) => [normalizeIsin(item.isin), item]));

    const summary = {
        file: options.filePath,
        headerRowIndex: headerIndex + 1,
        rowsParsed: parsedRows.length,
        validIsinRows: 0,
        activeRowsIncluded: 0,
        matchedExistingMarketInstruments: 0,
        possibleEnrichments: {
            nameUpdates: 0,
            wknUpdates: 0,
            currencyUpdates: 0,
            assetTypeUpdates: 0,
        },
        possibleYfinanceCandidates: 0,
        samples: [],
        candidatePreview: [],
    };

    const referenceRows = [];

    for (const row of parsedRows) {
        const isin = normalizeIsin(findColumnValue(row.cells, headers, ["ISIN"]));
        if (!/^[A-Z0-9]{12}$/.test(isin)) continue;
        summary.validIsinRows += 1;
        if (options.isin && isin !== options.isin) continue;
        if (options.activeOnly && !isRowActive(row.cells, headers)) continue;
        summary.activeRowsIncluded += 1;

        const mnemonic = normalizeCode(findColumnValue(row.cells, headers, ["Mnemonic"]));
        const wkn = normalizeCode(findColumnValue(row.cells, headers, ["WKN"]));
        const name = findColumnValue(row.cells, headers, ["Instrument"]);
        const currency = normalizeCode(findColumnValue(row.cells, headers, ["Currency"]));
        const instrumentType = findColumnValue(row.cells, headers, ["Instrument Type"]);
        const marketSegment = findColumnValue(row.cells, headers, ["Market Segment"]);
        const micCode = findColumnValue(row.cells, headers, ["MIC Code"]);
        const primaryMicCode = findColumnValue(row.cells, headers, ["Primary Market MIC Code"]);
        const productCategory = findColumnValue(row.cells, headers, ["Product Status"]);
        const symbol = mnemonic ? `${mnemonic}.DE` : null;

        const matchedInstrument = instrumentByIsin.get(isin) ?? null;
        if (matchedInstrument) {
            summary.matchedExistingMarketInstruments += 1;
            if (!matchedInstrument.wkn && wkn) summary.possibleEnrichments.wknUpdates += 1;
            if (!matchedInstrument.currency && currency) summary.possibleEnrichments.currencyUpdates += 1;
            if (nameNeedsEnrichment(matchedInstrument.name, isin) && name) summary.possibleEnrichments.nameUpdates += 1;
            if ((!matchedInstrument.assetType || ["unknown", "other"].includes(matchedInstrument.assetType.toLowerCase())) && toAssetTypeHint(instrumentType)) {
                summary.possibleEnrichments.assetTypeUpdates += 1;
            }
            if (mnemonic) {
                summary.possibleYfinanceCandidates += 1;
                summary.candidatePreview.push({
                    isin,
                    name: matchedInstrument.name ?? name ?? isin,
                    candidate: symbol,
                    exchange: "XETRA",
                    currency,
                });
            }
        }

        referenceRows.push({
            sourceKey: SOURCE_KEY,
            isin,
            wkn,
            name: name ?? null,
            symbol,
            mnemonic,
            exchange: "XETRA",
            micCode: micCode ?? null,
            primaryMarketMicCode: primaryMicCode ?? null,
            currency,
            instrumentType: instrumentType ?? null,
            productCategory: productCategory ?? null,
            marketSegment: marketSegment ?? null,
            rawPayload: row.raw,
        });

        if (summary.samples.length < 10) {
            summary.samples.push({
                isin,
                wkn,
                instrument: name ?? null,
                mnemonic,
                yfinanceCandidate: symbol,
                currency,
                instrumentType: instrumentType ?? null,
                marketSegment: marketSegment ?? null,
            });
        }
    }

    if (options.limit != null) {
        referenceRows.splice(options.limit);
    }

    let writes = { sourceUpserted: false, referenceUpserts: 0, enrichment: null };
    if (options.write) {
        await upsertReferenceSource({
            sourceKey: SOURCE_KEY,
            displayName: SOURCE_NAME,
            sourceType: SOURCE_TYPE,
            fileName: path.basename(options.filePath),
            rowCount: referenceRows.length,
            notes: "Imported by scripts/import-xetra-reference-instruments.mjs",
        });
        writes.sourceUpserted = true;

        for (const row of referenceRows) {
            await upsertReferenceInstrument(row);
            writes.referenceUpserts += 1;
        }

        if (options.enrichInstruments) {
            writes.enrichment = await enrichMarketInstrumentsFromReferences({
                sourceKey: SOURCE_KEY,
                isin: options.isin ?? undefined,
                limit: options.limit ?? undefined,
            });
        }
    }

    console.log(`file read: ${options.filePath}`);
    console.log(`header detected: row ${summary.headerRowIndex}`);
    console.log(`rows parsed: ${summary.rowsParsed}`);
    console.log(`valid ISIN rows: ${summary.validIsinRows}`);
    console.log(`active rows included: ${summary.activeRowsIncluded}`);
    console.log(`matched existing assets count: ${summary.matchedExistingMarketInstruments}`);
    console.log(`rows that could enrich assets:`);
    console.log(`  name updates: ${summary.possibleEnrichments.nameUpdates}`);
    console.log(`  wkn updates: ${summary.possibleEnrichments.wknUpdates}`);
    console.log(`  currency updates: ${summary.possibleEnrichments.currencyUpdates}`);
    console.log(`  asset_type updates: ${summary.possibleEnrichments.assetTypeUpdates}`);
    console.log(`possible yfinance candidates count: ${summary.possibleYfinanceCandidates}`);
    console.log("sample rows:");
    for (const sample of summary.samples) {
        console.log(
            `  ${sample.isin} | ${sample.wkn ?? "-"} | ${sample.instrument ?? "-"} | ${sample.mnemonic ?? "-"} | ${sample.yfinanceCandidate ?? "-"} | ${sample.currency ?? "-"} | ${sample.instrumentType ?? "-"} | ${sample.marketSegment ?? "-"}`,
        );
    }

    if (options.generateCandidates) {
        console.log("candidate preview:");
        for (const preview of summary.candidatePreview.slice(0, 100)) {
            console.log(`  ${preview.isin} | ${preview.name} | ${preview.candidate} | exchange=${preview.exchange} | ${preview.currency ?? "-"}`);
        }
    }

    if (options.write) {
        console.log(`write summary: source_upserted=${writes.sourceUpserted} reference_rows_upserted=${writes.referenceUpserts}`);
        if (writes.enrichment) {
            console.log(
                `instrument enrichment: matched=${writes.enrichment.matched} updated=${writes.enrichment.updated} name=${writes.enrichment.nameUpdates} wkn=${writes.enrichment.wknUpdates} currency=${writes.enrichment.currencyUpdates} asset_type=${writes.enrichment.assetTypeUpdates}`,
            );
        }
    } else {
        console.log("write summary: skipped (dry-run)");
    }

    if (options.out) {
        const outPath = path.resolve(process.cwd(), options.out);
        await writeFile(
            outPath,
            JSON.stringify(
                {
                    summary,
                    writeEnabled: options.write,
                    writes,
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
        console.error(`Xetra import failed: ${message}`);
        process.exit(1);
    })
    .finally(async () => {
        await closeDbPool();
    });
