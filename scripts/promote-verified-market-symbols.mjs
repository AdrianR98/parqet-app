import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

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
    US: { suffixes: [""], exchangeKeywords: ["NYSE", "NASDAQ", "NASDAQGS", "NASDAQGM", "NASDAQCM", "NMS"] },
    DE: { suffixes: [".DE", ".F"], exchangeKeywords: ["XETRA", "FRANKFURT", "FWB"] },
    GB: { suffixes: [".L"], exchangeKeywords: ["LSE", "LONDON"] },
    FR: { suffixes: [".PA"], exchangeKeywords: ["PARIS", "EURONEXT"] },
    AU: { suffixes: [".AX"], exchangeKeywords: ["ASX", "AUSTRALIAN"] },
    CA: { suffixes: [".TO"], exchangeKeywords: ["TSX", "TORONTO"] },
    NL: { suffixes: [".AS"], exchangeKeywords: ["AMSTERDAM", "EURONEXT"] },
};

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSymbol(value) {
    return String(value ?? "").trim().toUpperCase();
}

function parseListArg(targetSet, rawValue, normalizer) {
    if (!rawValue) return;
    for (const item of String(rawValue).split(",")) {
        const normalized = normalizer(item);
        if (normalized) targetSet.add(normalized);
    }
}

function parseLimit(value, fallback) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Ungültiger --limit Wert.");
    }
    return parsed;
}

function parseArgs(argv) {
    const result = {
        provider: "yfinance",
        isin: null,
        excludeIsins: new Set(),
        force: false,
        onlyWithoutPrimary: true,
        write: false,
        limit: null,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--provider") {
            result.provider = String(args.shift() ?? "yfinance").trim().toLowerCase() || "yfinance";
            continue;
        }

        if (token === "--isin") {
            result.isin = normalizeIsin(args.shift() ?? "") || null;
            continue;
        }

        if (token === "--exclude-isin") {
            parseListArg(result.excludeIsins, args.shift(), normalizeIsin);
            continue;
        }

        if (token === "--force") {
            result.force = true;
            continue;
        }

        if (token === "--only-without-primary") {
            result.onlyWithoutPrimary = true;
            continue;
        }

        if (token === "--write") {
            result.write = true;
            continue;
        }

        if (token === "--limit") {
            result.limit = parseLimit(args.shift(), null);
            continue;
        }
    }

    return result;
}

function looksOtc(exchange, symbol, notes) {
    const e = String(exchange ?? "").toUpperCase();
    const s = String(symbol ?? "").toUpperCase();
    const n = String(notes ?? "").toUpperCase();
    return e.includes("OTC") || s.includes("OTC") || n.includes("OTC");
}

function isinPrefix(isin) {
    return normalizeIsin(isin).slice(0, 2);
}

function getSymbolSuffix(symbol) {
    const upper = normalizeSymbol(symbol);
    const dotIndex = upper.lastIndexOf(".");
    return dotIndex < 0 ? "" : upper.slice(dotIndex);
}

function extractScore(notes) {
    if (!notes) return null;
    const match = String(notes).match(/(?:candidate_score|score)=(\-?\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function exchangeMatchesHome(exchange, keywords) {
    const e = String(exchange ?? "").toUpperCase();
    return keywords.some((keyword) => e.includes(keyword));
}

function heuristic(row) {
    const prefix = isinPrefix(row.isin);
    const hints = HOME_MARKET_HINTS_BY_ISIN_PREFIX[prefix];
    const homeCurrency = HOME_CURRENCY_BY_ISIN_PREFIX[prefix] ?? null;
    let score = 0;

    if (hints) {
        if (hints.suffixes.includes(getSymbolSuffix(row.symbol))) score += 80;
        if (exchangeMatchesHome(row.exchange, hints.exchangeKeywords)) score += 45;
    }

    if (prefix === "US" && getSymbolSuffix(row.symbol) === "") score += 55;
    if (homeCurrency && row.currency && String(row.currency).toUpperCase() === homeCurrency) score += 20;
    if (looksOtc(row.exchange, row.symbol, row.notes)) score -= 80;
    else score += 10;

    return score;
}

function compareMappings(left, right) {
    const leftScore = extractScore(left.notes) ?? heuristic(left);
    const rightScore = extractScore(right.notes) ?? heuristic(right);
    if (rightScore !== leftScore) return rightScore - leftScore;

    const leftOtc = looksOtc(left.exchange, left.symbol, left.notes) ? 1 : 0;
    const rightOtc = looksOtc(right.exchange, right.symbol, right.notes) ? 1 : 0;
    if (leftOtc !== rightOtc) return leftOtc - rightOtc;

    return left.symbol.localeCompare(right.symbol);
}

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unbekannter Fehler";
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {}
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const { listVerifiedMappingsForPromotion, setPrimarySymbolMappingByIsin } = await import("../src/lib/market-data/db/repository-core.ts");

    const rows = await listVerifiedMappingsForPromotion(options.provider, options.isin ?? undefined);

    const grouped = new Map();
    for (const row of rows) {
        if (options.excludeIsins.has(normalizeIsin(row.isin))) {
            continue;
        }
        const list = grouped.get(row.isin) ?? [];
        list.push(row);
        grouped.set(row.isin, list);
    }

    const decisions = [];
    let scanned = 0;
    let eligible = 0;
    let excluded = 0;
    let noVerified = 0;
    let alreadyPrimarySkipped = 0;

    const allIsins = [...grouped.keys()].sort();
    for (const isin of allIsins) {
        scanned += 1;
        const list = grouped.get(isin) ?? [];

        if (options.excludeIsins.has(normalizeIsin(isin))) {
            excluded += 1;
            continue;
        }

        if (list.length === 0) {
            noVerified += 1;
            continue;
        }

        const existingPrimary = list.find((item) => item.isPrimary);
        if (existingPrimary && options.onlyWithoutPrimary && !options.force) {
            alreadyPrimarySkipped += 1;
            continue;
        }

        const sorted = [...list].sort(compareMappings);
        const best = sorted[0];

        eligible += 1;
        decisions.push({
            isin,
            symbol: best.symbol,
            exchange: best.exchange,
            currency: best.currency,
            score: extractScore(best.notes) ?? heuristic(best),
            reason: existingPrimary ? "replace_existing_primary" : "no_primary_set",
            wouldWrite: true,
        });
    }

    const limitedDecisions = options.limit ? decisions.slice(0, options.limit) : decisions;

    for (const item of limitedDecisions) {
        console.log(`- ${item.isin} | ${item.symbol} | ${item.exchange ?? "-"} | ${item.currency ?? "-"} | score=${item.score} | reason=${item.reason} | wouldWrite=${item.wouldWrite}`);
    }

    if (options.write) {
        for (const item of limitedDecisions) {
            await setPrimarySymbolMappingByIsin(
                item.isin,
                options.provider,
                item.symbol,
                `promoted_primary_at=${new Date().toISOString()}; promotion_reason=verified_best_score`,
            );
        }
    }

    console.log("Summary:");
    console.log(`- ISINs scanned: ${scanned}`);
    console.log(`- eligible ISINs: ${eligible}`);
    console.log(`- already primary skipped: ${alreadyPrimarySkipped}`);
    console.log(`- no verified candidate skipped: ${noVerified}`);
    console.log(`- excluded skipped: ${excluded}`);
    console.log(`- promotions planned: ${limitedDecisions.length}`);
    console.log(`- DB writes: ${options.write ? limitedDecisions.length : "übersprungen (dry-run)"}`);
}

run()
    .catch((error) => {
        console.error(`Promotion fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
