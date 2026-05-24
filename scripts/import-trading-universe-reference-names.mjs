import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const SOURCE_KEY = "trading_universe";
const SOURCE_NAME = "Trading Universe";
const DEFAULT_FILE_PATH = ".market-data/trading-universe.csv";

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeName(value) {
    const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
    return normalized || null;
}

function parsePositiveInt(raw, label) {
    const parsed = Number(raw ?? "0");
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        throw new Error(`Invalid ${label} value.`);
    }
    return parsed;
}

function parseArgs(argv) {
    const options = {
        filePath: DEFAULT_FILE_PATH,
        write: false,
        limit: null,
        isin: null,
        format: "auto",
        delimiter: "auto",
        enrichInstruments: false,
        setDisplayName: false,
        forceName: false,
        forceDisplayName: false,
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
        if (token === "--limit") options.limit = parsePositiveInt(args.shift(), "--limit");
        if (token === "--isin") options.isin = normalizeIsin(args.shift() ?? "");
        if (token === "--format") options.format = String(args.shift() ?? "auto").trim().toLowerCase();
        if (token === "--delimiter") options.delimiter = args.shift() ?? "auto";
        if (token === "--enrich-instruments") options.enrichInstruments = true;
        if (token === "--set-display-name") options.setDisplayName = true;
        if (token === "--force-name") options.forceName = true;
        if (token === "--force-display-name") options.forceDisplayName = true;
        if (token === "--out") options.out = args.shift() ?? null;
    }

    if (options.isin && !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Invalid --isin value.");
    }
    if (!["auto", "csv", "txt"].includes(options.format)) {
        throw new Error("Invalid --format value. Use auto|csv|txt.");
    }
    if (!(options.delimiter === "auto" || [",", ";", "\t", "|"].includes(options.delimiter))) {
        throw new Error("Invalid --delimiter value.");
    }

    return options;
}

function detectFormat(filePath, requestedFormat) {
    if (requestedFormat !== "auto") return requestedFormat;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".txt") return "txt";
    return "csv";
}

function parseDelimitedLine(line, delimiter) {
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
        if (char === delimiter && !inQuotes) {
            values.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    values.push(current.trim());
    return values;
}

function detectDelimiter(lines) {
    const candidates = [";", ",", "\t", "|"];
    let best = { delimiter: ";", score: -1 };
    for (const delimiter of candidates) {
        let score = 0;
        for (const line of lines.slice(0, 20)) {
            const parts = parseDelimitedLine(line, delimiter);
            if (parts.length >= 2) score += parts.length;
        }
        if (score > best.score) best = { delimiter, score };
    }
    return best.delimiter;
}

function normalizeHeader(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, " ");
}

function isHeaderLine(cells) {
    const normalized = cells.map((cell) => normalizeHeader(cell));
    return normalized.some((value) => ["isin", "instrument isin"].includes(value)) &&
        normalized.some((value) => ["name", "instrument", "company", "company name", "instrument name"].includes(value));
}

function findColumns(headerCells) {
    const normalized = headerCells.map((cell) => normalizeHeader(cell));
    let isinIndex = -1;
    let nameIndex = -1;

    for (let i = 0; i < normalized.length; i += 1) {
        if (isinIndex < 0 && ["isin", "instrument isin"].includes(normalized[i])) isinIndex = i;
        if (nameIndex < 0 && ["name", "instrument", "company", "company name", "instrument name"].includes(normalized[i])) nameIndex = i;
    }

    if (isinIndex < 0 && nameIndex < 0 && normalized.length >= 2) {
        return { isinIndex: 0, nameIndex: 1 };
    }

    return { isinIndex, nameIndex };
}

function parseCsvRecords(lines, forcedDelimiter) {
    const nonEmpty = lines.filter((line) => line.trim());
    const delimiter = forcedDelimiter === "auto" ? detectDelimiter(nonEmpty) : forcedDelimiter;
    let headerDetected = false;
    let headers = [];
    let columnIndexes = { isinIndex: 0, nameIndex: 1 };
    const records = [];

    for (const line of nonEmpty) {
        const cells = parseDelimitedLine(line, delimiter);
        if (!headerDetected && isHeaderLine(cells)) {
            headerDetected = true;
            headers = cells;
            columnIndexes = findColumns(cells);
            continue;
        }

        const rawIsin = cells[columnIndexes.isinIndex] ?? cells[0] ?? "";
        const rawName = cells[columnIndexes.nameIndex] ?? cells[1] ?? "";
        records.push({
            isin: normalizeIsin(rawIsin),
            name: normalizeName(rawName),
            rawPayload: headerDetected
                ? Object.fromEntries(headers.map((header, index) => [normalizeHeader(header) || `col_${index + 1}`, cells[index] ?? ""]))
                : { rawLine: line, col1: cells[0] ?? "", col2: cells[1] ?? "" },
        });
    }

    return { records, delimiter, headerDetected };
}

function parseTxtRecords(lines) {
    const records = [];
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const isinMatch = line.match(/\b[A-Z]{2}[A-Z0-9]{10}\b/i);
        if (!isinMatch) continue;
        const isin = normalizeIsin(isinMatch[0]);
        const before = line.slice(0, isinMatch.index).replace(/[|;,\t]/g, " ").trim();
        const after = line.slice((isinMatch.index ?? 0) + isinMatch[0].length).replace(/^[\s|;,:-]+/, "").trim();
        const candidate = normalizeName(after || before);
        records.push({
            isin,
            name: candidate,
            rawPayload: { rawLine: line },
        });
    }
    return { records };
}

function isValidIsin(value) {
    return /^[A-Z0-9]{12}$/.test(value);
}

function isPlaceholderName(value, isin) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return true;
    if (normalized === isin.toLowerCase()) return true;
    return ["unknown", "n/a", "na", "undefined", "null"].includes(normalized);
}

function hasLetters(value) {
    return /[a-zA-Z]/.test(value);
}

function selectBetterName(currentName, candidateName) {
    if (!currentName) return candidateName;
    const current = currentName.trim();
    const candidate = candidateName.trim();
    if (candidate.length > current.length + 2) return candidate;
    if (hasLetters(candidate) && !hasLetters(current)) return candidate;
    if (/[a-z]/.test(candidate) && !/[a-z]/.test(current)) return candidate;
    return current;
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {}
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const resolvedPath = path.resolve(process.cwd(), options.filePath);
    const raw = await readFile(resolvedPath, "utf8");
    const withoutBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const lines = withoutBom.split(/\r?\n/);

    const detectedFormat = detectFormat(options.filePath, options.format);
    const parsed = detectedFormat === "txt"
        ? parseTxtRecords(lines)
        : parseCsvRecords(lines, options.delimiter);

    const byIsin = new Map();
    let rowsParsed = parsed.records.length;
    let validRows = 0;
    let duplicateCollapsed = 0;

    for (const row of parsed.records) {
        const isin = normalizeIsin(row.isin);
        const name = normalizeName(row.name);
        if (!isValidIsin(isin)) continue;
        if (!name || isPlaceholderName(name, isin) || !hasLetters(name)) continue;
        if (options.isin && isin !== options.isin) continue;

        validRows += 1;
        const existing = byIsin.get(isin);
        if (!existing) {
            byIsin.set(isin, { isin, name, rawPayload: row.rawPayload });
            continue;
        }

        duplicateCollapsed += 1;
        const better = selectBetterName(existing.name, name);
        if (better !== existing.name) {
            byIsin.set(isin, { isin, name: better, rawPayload: row.rawPayload });
        }
    }

    let normalizedRows = Array.from(byIsin.values());
    if (options.limit != null) {
        normalizedRows = normalizedRows.slice(0, options.limit);
    }

    const {
        listMarketInstruments,
        upsertReferenceSource,
        upsertReferenceInstrument,
        compareInstrumentNameQuality,
        isMeaningfulInstrumentName,
        enrichMarketInstrumentsFromTradingUniverse,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    const instruments = await listMarketInstruments({ limit: 50000 });
    const instrumentByIsin = new Map(instruments.map((item) => [normalizeIsin(item.isin), item]));

    let matchedExisting = 0;
    let skippedNoMatch = 0;
    const sampleRows = [];
    let plannedNameUpdates = 0;
    let plannedDisplayNameUpdates = 0;
    let skippedExistingBetter = 0;
    for (const row of normalizedRows) {
        const matched = instrumentByIsin.get(row.isin) ?? null;
        if (matched) matchedExisting += 1;
        else skippedNoMatch += 1;

        const currentName = matched?.name ?? null;
        const currentDisplayName = matched?.displayName ?? null;
        const meaningfulRef = isMeaningfulInstrumentName(row.name, row.isin);
        const currentNameWeak = !isMeaningfulInstrumentName(currentName, row.isin);
        const currentDisplayNameWeak = !isMeaningfulInstrumentName(currentDisplayName, row.isin);
        const nameQuality = compareInstrumentNameQuality(currentName, row.name, row.isin);
        const displayQuality = compareInstrumentNameQuality(currentDisplayName, row.name, row.isin);
        const plannedNameUpdate = Boolean(
            matched &&
            meaningfulRef &&
            (options.forceName || currentNameWeak || nameQuality > 0),
        );
        const plannedDisplayNameUpdate = Boolean(
            matched &&
            options.setDisplayName &&
            meaningfulRef &&
            (options.forceDisplayName || currentDisplayNameWeak || displayQuality > 0),
        );
        if (plannedNameUpdate) plannedNameUpdates += 1;
        if (plannedDisplayNameUpdate) plannedDisplayNameUpdates += 1;
        if (matched && !plannedNameUpdate && !plannedDisplayNameUpdate) skippedExistingBetter += 1;

        if (sampleRows.length < 20) {
            sampleRows.push({
                isin: row.isin,
                currentName: currentDisplayName ?? currentName,
                referenceName: row.name,
                plannedNameUpdate,
                plannedDisplayNameUpdate,
            });
        }
    }

    const sourceType = detectedFormat === "txt" ? "txt" : "csv";

    const mergedSamples = sampleRows;

    let writes = {
        sourceUpserted: false,
        referenceRowsUpserted: 0,
        enrichment: null,
    };

    if (options.write) {
        await upsertReferenceSource({
            sourceKey: SOURCE_KEY,
            displayName: SOURCE_NAME,
            sourceType,
            fileName: path.basename(options.filePath),
            rowCount: normalizedRows.length,
            notes: "Imported by scripts/import-trading-universe-reference-names.mjs",
        });
        writes.sourceUpserted = true;

        for (const row of normalizedRows) {
            await upsertReferenceInstrument({
                sourceKey: SOURCE_KEY,
                isin: row.isin,
                name: row.name,
                rawPayload: row.rawPayload,
            });
            writes.referenceRowsUpserted += 1;
        }

        if (options.enrichInstruments) {
            writes.enrichment = await enrichMarketInstrumentsFromTradingUniverse({
                sourceKey: SOURCE_KEY,
                isin: options.isin ?? undefined,
                limit: options.limit ?? undefined,
                forceName: options.forceName,
                setDisplayName: options.setDisplayName,
                forceDisplayName: options.forceDisplayName,
            });
        }
    }

    const opportunities = {
        nameUpdates: plannedNameUpdates,
        displayNameUpdates: plannedDisplayNameUpdates,
        skippedExistingBetter,
        skippedNoMatchingInstrument: skippedNoMatch,
    };

    console.log(`file read: ${options.filePath}`);
    console.log(`format detected: ${detectedFormat}`);
    if (detectedFormat === "csv") {
        console.log(`delimiter detected: ${parsed.delimiter}`);
        console.log(`header detected: ${parsed.headerDetected ? "yes" : "no"}`);
    }
    console.log(`rows parsed: ${rowsParsed}`);
    console.log(`valid ISIN/name rows: ${validRows}`);
    console.log(`duplicate ISINs collapsed: ${duplicateCollapsed}`);
    console.log(`matched existing market_instruments: ${matchedExisting}`);
    console.log(`reference rows planned/upserted: ${normalizedRows.length}`);
    console.log("enrichment opportunities:");
    console.log(`  name updates: ${opportunities.nameUpdates}`);
    console.log(`  display_name updates: ${opportunities.displayNameUpdates}`);
    console.log(`  skipped existing better: ${opportunities.skippedExistingBetter}`);
    console.log(`  skipped no matching market_instrument: ${opportunities.skippedNoMatchingInstrument}`);
    console.log("sample:");
    for (const sample of mergedSamples.slice(0, 20)) {
        console.log(
            `  ${sample.isin} | ${sample.currentName ?? "-"} | ${sample.referenceName ?? "-"} | name=${sample.plannedNameUpdate} | display_name=${sample.plannedDisplayNameUpdate}`,
        );
    }

    if (options.write) {
        console.log(`source upserted: ${writes.sourceUpserted}`);
        console.log(`reference rows upserted: ${writes.referenceRowsUpserted}`);
        if (writes.enrichment) {
            console.log(
                `instrument enrich summary: matched=${writes.enrichment.matched} updated=${writes.enrichment.updated} name=${writes.enrichment.nameUpdates} display_name=${writes.enrichment.displayNameUpdates} skipped_existing_better=${writes.enrichment.skippedExistingBetter}`,
            );
        } else {
            console.log("instrument enrich summary: skipped");
        }
        console.log("mapping writes: none");
    } else {
        console.log("write summary: skipped (dry-run)");
    }

    if (options.out) {
        const outPath = path.resolve(process.cwd(), options.out);
        await writeFile(
            outPath,
            JSON.stringify(
                {
                    options,
                    detectedFormat,
                    delimiter: parsed.delimiter ?? null,
                    rowsParsed,
                    validRows,
                    duplicateCollapsed,
                    matchedExisting,
                    plannedReferenceRows: normalizedRows.length,
                    opportunities,
                    sample: mergedSamples,
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
        console.error(`Trading Universe import failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
