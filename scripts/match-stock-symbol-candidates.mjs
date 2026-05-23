import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
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

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeProvider(value) {
    return String(value ?? "yfinance").trim().toLowerCase() || "yfinance";
}

function parseCliArgs(argv) {
    const result = {
        filePath: null,
        write: false,
        isin: null,
        provider: "yfinance",
        preferCurrency: null,
        maxCandidates: 5,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (!token.startsWith("--") && !result.filePath) {
            result.filePath = token;
            continue;
        }

        if (token === "--write") {
            result.write = true;
            continue;
        }

        if (token === "--isin") {
            result.isin = normalizeIsin(args.shift() ?? "");
            continue;
        }

        if (token === "--provider") {
            result.provider = normalizeProvider(args.shift() ?? "yfinance");
            continue;
        }

        if (token === "--prefer-currency") {
            result.preferCurrency = String(args.shift() ?? "").trim().toUpperCase() || null;
            continue;
        }

        if (token === "--max-candidates") {
            const parsed = Number(args.shift());
            if (Number.isFinite(parsed) && parsed > 0) {
                result.maxCandidates = Math.max(1, Math.min(20, Math.floor(parsed)));
            }
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

async function readJsonFile(filePath) {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error("companies.json muss ein JSON-Array sein.");
    }
    return parsed;
}

function collectCompaniesByIsin(entries) {
    const map = new Map();

    for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;

        const isins = Array.isArray(entry.isins) ? entry.isins : [];
        const normalizedIsins = isins.map((isin) => normalizeIsin(isin)).filter((isin) => /^[A-Z0-9]{12}$/.test(isin));
        if (normalizedIsins.length === 0) continue;

        for (const isin of normalizedIsins) {
            const list = map.get(isin) ?? [];
            list.push(entry);
            map.set(isin, list);
        }
    }

    return map;
}

function isinPrefix(isin) {
    return normalizeIsin(isin).slice(0, 2);
}

function looksOtc(exchange, symbol) {
    const e = String(exchange ?? "").toUpperCase();
    const s = String(symbol ?? "").toUpperCase();
    return e.includes("OTC") || s.includes("OTC");
}

function getSymbolSuffix(symbol) {
    const upper = symbol.toUpperCase();
    const dotIndex = upper.lastIndexOf(".");
    if (dotIndex < 0) {
        return "";
    }
    return upper.slice(dotIndex);
}

function hasPreferredSuffix(symbol, preferredSuffixes) {
    const suffix = getSymbolSuffix(symbol);
    return preferredSuffixes.includes(suffix);
}

function exchangeMatchesHome(exchange, homeExchangeKeywords) {
    const e = String(exchange ?? "").toUpperCase();
    return homeExchangeKeywords.some((keyword) => e.includes(keyword));
}

function scoreCandidate({ candidate, isin, instrumentCurrency, preferCurrency }) {
    const symbol = String(candidate.symbol ?? "").trim().toUpperCase();
    const exchange = String(candidate.exchange ?? "").trim() || null;
    const currency = String(candidate.currency ?? "").trim().toUpperCase() || null;
    const sourceIsSymbolsArray = Boolean(candidate.fromSymbolsArray);

    const reasons = [];
    let score = 0;

    if (sourceIsSymbolsArray) {
        score += 30;
        reasons.push("symbols[]-Treffer");
    } else {
        score -= 30;
        reasons.push("Top-level Fallback-Abzug");
    }

    const prefix = isinPrefix(isin);
    const homeHints = HOME_MARKET_HINTS_BY_ISIN_PREFIX[prefix];
    const homeCurrency = HOME_CURRENCY_BY_ISIN_PREFIX[prefix] ?? null;

    if (homeHints) {
        if (hasPreferredSuffix(symbol, homeHints.suffixes)) {
            score += 80;
            reasons.push(`Home-Suffix ${getSymbolSuffix(symbol) || "(ohne)"}`);
        }

        if (exchangeMatchesHome(exchange, homeHints.exchangeKeywords)) {
            score += 45;
            reasons.push("Home-Exchange passt");
        }
    }

    if (prefix === "US" && getSymbolSuffix(symbol) === "") {
        score += 55;
        reasons.push("US ohne Suffix bevorzugt");
    }

    if (!exchange && !currency) {
        score -= 15;
        reasons.push("ohne Exchange/Währung");
    }

    if (looksOtc(exchange, symbol)) {
        score -= 80;
        reasons.push("starker OTC-Abzug");
    } else {
        score += 10;
        reasons.push("nicht OTC");
    }

    if (homeCurrency && currency && homeCurrency === currency) {
        score += 20;
        reasons.push(`Home-Währung ${homeCurrency}`);
    }

    if (instrumentCurrency && currency && instrumentCurrency === currency) {
        score += 15;
        reasons.push("Instrument-Währung passt");
    }

    if (preferCurrency && currency && preferCurrency === currency) {
        score += 12;
        reasons.push("--prefer-currency passt");
    }

    return {
        symbol,
        exchange,
        currency,
        score,
        reason: reasons.join(", "),
        sourceCompanyName: String(candidate.sourceCompanyName ?? "").trim() || null,
        fromSymbolsArray: sourceIsSymbolsArray,
    };
}

function buildCandidates({ companies, isin, instrumentCurrency, preferCurrency }) {
    const bySymbol = new Map();

    for (const company of companies) {
        const symbols = Array.isArray(company.symbols) ? company.symbols : [];

        for (const candidate of symbols) {
            if (!candidate || typeof candidate !== "object") continue;
            const symbol = String(candidate.symbol ?? "").trim().toUpperCase();
            if (!symbol) continue;

            const scored = scoreCandidate({
                candidate: {
                    symbol,
                    exchange: candidate.exchange ?? null,
                    currency: candidate.currency ?? null,
                    fromSymbolsArray: true,
                    sourceCompanyName: company.name ?? null,
                },
                isin,
                instrumentCurrency,
                preferCurrency,
            });

            const existing = bySymbol.get(symbol);
            if (!existing || scored.score > existing.score) {
                bySymbol.set(symbol, scored);
            }
        }

        const fallbackSymbol = String(company.symbol ?? "").trim().toUpperCase();
        if (!fallbackSymbol) continue;

        const scoredFallback = scoreCandidate({
            candidate: {
                symbol: fallbackSymbol,
                exchange: null,
                currency: null,
                fromSymbolsArray: false,
                sourceCompanyName: company.name ?? null,
            },
            isin,
            instrumentCurrency,
            preferCurrency,
        });

        const existing = bySymbol.get(fallbackSymbol);
        if (!existing || scoredFallback.score > existing.score) {
            bySymbol.set(fallbackSymbol, scoredFallback);
        }
    }

    return [...bySymbol.values()].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.symbol.localeCompare(b.symbol);
    });
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
    if (!options.filePath) {
        throw new Error("Pfad zu companies.json fehlt. Beispiel: node scripts/match-stock-symbol-candidates.mjs .market-data/companies.json");
    }

    const resolvedPath = path.resolve(process.cwd(), options.filePath);
    if (!existsSync(resolvedPath)) {
        throw new Error(`Datei nicht gefunden: ${options.filePath}`);
    }

    const { listMarketInstruments, getSymbolMappingsByIsin, getSymbolMappingByProviderSymbol, upsertSymbolMapping } =
        await import("../src/lib/market-data/db/repository-core.ts");

    const companies = await readJsonFile(resolvedPath);
    const companiesByIsin = collectCompaniesByIsin(companies);

    const allInstruments = await listMarketInstruments();
    const instruments = options.isin
        ? allInstruments.filter((instrument) => normalizeIsin(instrument.isin) === options.isin)
        : allInstruments;

    let matchedCount = 0;
    let noMatchCount = 0;
    let totalCandidates = 0;
    let writesDone = 0;

    console.log(`Instruments gescannt: ${instruments.length}`);

    for (const instrument of instruments) {
        const isin = normalizeIsin(instrument.isin);
        const matches = companiesByIsin.get(isin) ?? [];

        if (matches.length === 0) {
            noMatchCount += 1;
            console.log(`\n[${isin}] ${instrument.name ?? "(ohne Namen)"}`);
            console.log("  Kein Match in companies.json");
            continue;
        }

        matchedCount += 1;

        const candidates = buildCandidates({
            companies: matches,
            isin,
            instrumentCurrency: instrument.currency?.toUpperCase() ?? null,
            preferCurrency: options.preferCurrency,
        }).slice(0, options.maxCandidates);

        totalCandidates += candidates.length;

        console.log(`\n[${isin}] ${instrument.name ?? "(ohne Namen)"}`);
        console.log(`  Quelltreffer: ${matches.map((entry) => entry.name).filter(Boolean).join(" | ") || "(ohne Namen)"}`);
        console.log(`  Kandidaten: ${candidates.length}`);

        for (const candidate of candidates) {
            console.log(`   - ${candidate.symbol} | exchange=${candidate.exchange ?? "-"} | currency=${candidate.currency ?? "-"} | score=${candidate.score} | ${candidate.reason}`);
        }

        if (!options.write || candidates.length === 0) {
            continue;
        }

        const existingForIsin = await getSymbolMappingsByIsin(isin, options.provider);

        for (const candidate of candidates) {
            const globalExisting = await getSymbolMappingByProviderSymbol(options.provider, candidate.symbol);

            if (globalExisting && globalExisting.instrumentId !== instrument.id) {
                continue;
            }

            const existingSameIsin = existingForIsin.find((item) => item.symbol.toUpperCase() === candidate.symbol.toUpperCase());
            if (existingSameIsin?.verifiedAt) {
                continue;
            }

            await upsertSymbolMapping({
                isin,
                provider: options.provider,
                symbol: candidate.symbol,
                exchange: candidate.exchange,
                currency: candidate.currency,
                isPrimary: existingSameIsin?.isPrimary ?? false,
                isActive: true,
                verifiedAt: null,
                notes: `candidate from stock-symbols companies.json; score=${candidate.score}`,
            });
            writesDone += 1;
        }
    }

    console.log("\nZusammenfassung:");
    console.log(`- Instruments gescannt: ${instruments.length}`);
    console.log(`- ISINs gematcht: ${matchedCount}`);
    console.log(`- ISINs ohne Match: ${noMatchCount}`);
    console.log(`- Kandidaten gefunden: ${totalCandidates}`);
    console.log(`- DB writes: ${options.write ? writesDone : "übersprungen (dry-run)"}`);
}

run()
    .catch((error) => {
        console.error(`Symbol-Matching fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
