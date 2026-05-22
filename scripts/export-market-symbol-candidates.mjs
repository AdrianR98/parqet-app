import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const DEFAULT_EXCLUSIONS_FILE = ".market-data/market-symbol-exclusions.json";

const HOME_CURRENCY_BY_ISIN_PREFIX = {
    US: "USD",
    DE: "EUR",
    FR: "EUR",
    NL: "EUR",
    GB: "GBP",
    AU: "AUD",
    CA: "CAD",
};

const HOME_MARKET_HINTS_BY_ISIN_PREFIX = {
    US: {
        suffixes: [""],
        exchangeKeywords: ["NYSE", "NASDAQ", "NASDAQGS", "NASDAQGM", "NASDAQCM", "NMS"],
    },
    DE: {
        suffixes: [".DE", ".F"],
        exchangeKeywords: ["XETRA", "FRANKFURT", "FWB"],
    },
    GB: {
        suffixes: [".L"],
        exchangeKeywords: ["LSE", "LONDON"],
    },
    FR: {
        suffixes: [".PA"],
        exchangeKeywords: ["PARIS", "EURONEXT"],
    },
    AU: {
        suffixes: [".AX"],
        exchangeKeywords: ["ASX", "AUSTRALIAN"],
    },
    CA: {
        suffixes: [".TO"],
        exchangeKeywords: ["TSX", "TORONTO"],
    },
    NL: {
        suffixes: [".AS"],
        exchangeKeywords: ["AMSTERDAM", "EURONEXT"],
    },
};

function parseLimit(value, fallback) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Ungültiger --limit Wert.");
    }
    return parsed;
}

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSymbol(value) {
    return String(value ?? "").trim().toUpperCase();
}

function parseListArg(targetSet, rawValue, normalizer) {
    if (!rawValue) {
        return;
    }
    const values = String(rawValue)
        .split(",")
        .map((value) => normalizer(value))
        .filter(Boolean);

    for (const value of values) {
        targetSet.add(value);
    }
}

async function loadExclusionsFile(filePath) {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!existsSync(resolvedPath)) {
        return { isins: new Set(), symbols: new Set(), exists: false };
    }

    const raw = await readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(raw);

    const isins = new Set();
    const symbols = new Set();

    const fileIsins = Array.isArray(parsed?.isins) ? parsed.isins : [];
    const fileSymbols = Array.isArray(parsed?.symbols) ? parsed.symbols : [];

    for (const isin of fileIsins) {
        const normalized = normalizeIsin(isin);
        if (normalized) {
            isins.add(normalized);
        }
    }

    for (const symbol of fileSymbols) {
        const normalized = normalizeSymbol(symbol);
        if (normalized) {
            symbols.add(normalized);
        }
    }

    return { isins, symbols, exists: true };
}

async function parseArgs(argv) {
    const result = {
        limit: 20,
        provider: "yfinance",
        isin: null,
        out: ".market-data/symbol-candidates.json",
        topPerIsin: false,
        excludeOtc: false,
        includeVerifiedIsins: false,
        excludeIsins: new Set(),
        excludeSymbols: new Set(),
        exclusionsFile: DEFAULT_EXCLUSIONS_FILE,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--limit") {
            result.limit = parseLimit(args.shift(), result.limit);
            continue;
        }

        if (token === "--provider") {
            result.provider = String(args.shift() ?? "yfinance").trim().toLowerCase() || "yfinance";
            continue;
        }

        if (token === "--isin") {
            result.isin = normalizeIsin(args.shift() ?? "") || null;
            continue;
        }

        if (token === "--out") {
            result.out = String(args.shift() ?? "").trim() || result.out;
            continue;
        }

        if (token === "--top-per-isin") {
            result.topPerIsin = true;
            continue;
        }

        if (token === "--exclude-otc") {
            result.excludeOtc = true;
            continue;
        }

        if (token === "--include-verified-isins") {
            result.includeVerifiedIsins = true;
            continue;
        }

        if (token === "--exclude-isin") {
            parseListArg(result.excludeIsins, args.shift(), normalizeIsin);
            continue;
        }

        if (token === "--exclude-symbol") {
            parseListArg(result.excludeSymbols, args.shift(), normalizeSymbol);
            continue;
        }

        if (token === "--exclusions-file") {
            result.exclusionsFile = String(args.shift() ?? "").trim() || DEFAULT_EXCLUSIONS_FILE;
            continue;
        }
    }

    const fileExclusions = await loadExclusionsFile(result.exclusionsFile);
    for (const isin of fileExclusions.isins) {
        result.excludeIsins.add(isin);
    }
    for (const symbol of fileExclusions.symbols) {
        result.excludeSymbols.add(symbol);
    }

    result.exclusionsFileExists = fileExclusions.exists;
    return result;
}

function isinPrefix(isin) {
    return normalizeIsin(isin).slice(0, 2);
}

function getSymbolSuffix(symbol) {
    const upper = String(symbol ?? "").toUpperCase();
    const dotIndex = upper.lastIndexOf(".");
    if (dotIndex < 0) {
        return "";
    }
    return upper.slice(dotIndex);
}

function looksOtc(exchange, symbol, notes) {
    const e = String(exchange ?? "").toUpperCase();
    const s = String(symbol ?? "").toUpperCase();
    const n = String(notes ?? "").toUpperCase();
    return e.includes("OTC") || s.includes("OTC") || n.includes("OTC");
}

function extractScore(notes) {
    if (!notes) return null;
    const raw = String(notes);
    const match = raw.match(/(?:candidate_score|score)=(\-?\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function exchangeMatchesHome(exchange, keywords) {
    const e = String(exchange ?? "").toUpperCase();
    return keywords.some((keyword) => e.includes(keyword));
}

function homeHeuristicScore(row) {
    const prefix = isinPrefix(row.isin);
    const hints = HOME_MARKET_HINTS_BY_ISIN_PREFIX[prefix];
    const homeCurrency = HOME_CURRENCY_BY_ISIN_PREFIX[prefix] ?? null;

    let score = 0;

    if (hints) {
        if (hints.suffixes.includes(getSymbolSuffix(row.symbol))) {
            score += 80;
        }

        if (exchangeMatchesHome(row.exchange, hints.exchangeKeywords)) {
            score += 45;
        }
    }

    if (prefix === "US" && getSymbolSuffix(row.symbol) === "") {
        score += 55;
    }

    if (!row.exchange && !row.currency) {
        score -= 15;
    }

    if (homeCurrency && row.currency && String(row.currency).toUpperCase() === homeCurrency) {
        score += 20;
    }

    if (looksOtc(row.exchange, row.symbol, row.notes)) {
        score -= 80;
    } else {
        score += 10;
    }

    return score;
}

function compareCandidates(left, right) {
    const leftScore = left.score ?? left.heuristicScore;
    const rightScore = right.score ?? right.heuristicScore;
    if (rightScore !== leftScore) {
        return rightScore - leftScore;
    }

    const leftOtc = left.isOtc ? 1 : 0;
    const rightOtc = right.isOtc ? 1 : 0;
    if (leftOtc !== rightOtc) {
        return leftOtc - rightOtc;
    }

    return left.symbol.localeCompare(right.symbol);
}

function toExportCandidate(row) {
    const score = extractScore(row.notes);
    const isOtc = looksOtc(row.exchange, row.symbol, row.notes);
    const heuristicScore = homeHeuristicScore(row);

    return {
        isin: row.isin,
        name: row.name,
        provider: row.provider,
        symbol: row.symbol,
        exchange: row.exchange,
        currency: row.currency,
        score,
        heuristicScore,
        isOtc,
        isPrimary: row.isPrimary,
        verifiedAt: row.verifiedAt,
    };
}

function safeMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Unbekannter Fehler";
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
    const options = await parseArgs(process.argv.slice(2));
    const { listUnverifiedSymbolMappings, listIsinsWithVerifiedMappings } = await import("../src/lib/market-data/db/repository-core.ts");

    const fetchLimit = options.topPerIsin ? Math.max(options.limit * 20, 1000) : options.limit;

    const rows = await listUnverifiedSymbolMappings({
        provider: options.provider,
        limit: fetchLimit,
        isin: options.isin,
    });

    const rawCandidates = rows.map(toExportCandidate);
    const verifiedIsins = options.includeVerifiedIsins
        ? new Set()
        : new Set(await listIsinsWithVerifiedMappings({ provider: options.provider }));

    const candidatesAfterVerifiedSkip = rawCandidates.filter((row) => !verifiedIsins.has(row.isin));
    const skippedByVerifiedIsin = rawCandidates.length - candidatesAfterVerifiedSkip.length;

    const candidatesAfterManualExclusions = candidatesAfterVerifiedSkip.filter(
        (row) => !options.excludeIsins.has(normalizeIsin(row.isin)) && !options.excludeSymbols.has(normalizeSymbol(row.symbol)),
    );
    const skippedByManualExclusions = candidatesAfterVerifiedSkip.length - candidatesAfterManualExclusions.length;

    let exported = [];
    let skippedByOtc = 0;

    if (options.topPerIsin) {
        const grouped = new Map();
        for (const row of candidatesAfterManualExclusions) {
            const list = grouped.get(row.isin) ?? [];
            list.push(row);
            grouped.set(row.isin, list);
        }

        for (const [, list] of grouped.entries()) {
            const sorted = [...list].sort(compareCandidates);
            const hasNonOtc = sorted.some((item) => !item.isOtc);

            const filtered = options.excludeOtc && hasNonOtc
                ? sorted.filter((item) => !item.isOtc)
                : sorted;

            skippedByOtc += sorted.length - filtered.length;

            if (filtered.length > 0) {
                exported.push(filtered[0]);
            }
        }

        exported = exported.sort((a, b) => a.isin.localeCompare(b.isin)).slice(0, options.limit);
    } else {
        let ordered = [...candidatesAfterManualExclusions].sort(compareCandidates);
        if (options.excludeOtc) {
            const nonOtc = ordered.filter((item) => !item.isOtc);
            skippedByOtc = ordered.length - nonOtc.length;
            ordered = nonOtc;
        }
        exported = ordered.slice(0, options.limit);
    }

    const payload = exported.map((row) => ({
        isin: row.isin,
        name: row.name,
        provider: row.provider,
        symbol: row.symbol,
        exchange: row.exchange,
        currency: row.currency,
        score: row.score ?? row.heuristicScore,
        isPrimary: row.isPrimary,
        verifiedAt: row.verifiedAt,
    }));

    const outPath = path.resolve(process.cwd(), options.out);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const isinGroupCount = new Set(candidatesAfterManualExclusions.map((item) => item.isin)).size;

    console.log(`Raw unverified candidates loaded: ${rawCandidates.length}`);
    console.log(`ISIN groups: ${isinGroupCount}`);
    console.log(`ISINs skipped because already verified: ${new Set(rawCandidates.filter((item) => verifiedIsins.has(item.isin)).map((item) => item.isin)).size}`);
    console.log(`Candidates skipped because already verified: ${skippedByVerifiedIsin}`);
    console.log(`Excluded ISINs count: ${options.excludeIsins.size}`);
    console.log(`Excluded symbols count: ${options.excludeSymbols.size}`);
    console.log(`Candidates skipped by manual exclusions: ${skippedByManualExclusions}`);
    console.log(`Candidates exported: ${payload.length}`);
    console.log(`Candidates skipped by OTC filter: ${skippedByOtc}`);
    console.log(`Datei: ${options.out}`);
    if (options.exclusionsFileExists) {
        console.log(`Exclusions-Datei angewendet: ${options.exclusionsFile}`);
    }

    if (payload.length > 0) {
        console.log("Sample:");
        for (const row of payload.slice(0, 10)) {
            console.log(`- ${row.isin} | ${row.symbol} | ${row.exchange ?? "-"} | ${row.currency ?? "-"} | score=${row.score ?? "-"}`);
        }
    }
}

run()
    .catch((error) => {
        console.error(`Kandidaten-Export fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
