import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
const DEFAULT_CATEGORY = "likely_us_stock_missing_candidate";

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parsePositiveInt(raw, name) {
    const value = Number(raw ?? "");
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
        throw new Error(`Invalid ${name} value.`);
    }
    return value;
}

function parseNumber(raw, name) {
    const value = Number(raw ?? "");
    if (!Number.isFinite(value)) throw new Error(`Invalid ${name} value.`);
    return value;
}

function parseBooleanToken(raw, label) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`Invalid ${label} value. Use true|false.`);
}

function parseCsvList(value) {
    return String(value ?? "")
        .split(",")
        .map((part) => normalizeIsin(part))
        .filter(Boolean);
}

function parseArgs(argv) {
    const options = {
        write: false,
        limit: 30,
        isins: new Set(),
        category: DEFAULT_CATEGORY,
        includeAllOpen: false,
        onlyUs: true,
        market: "us",
        apiKey: process.env.OPENFIGI_API_KEY?.trim() || null,
        out: null,
        batchSize: null,
        sleepMs: null,
        minScore: 70,
        includeLowScore: false,
        noWriteCandidates: false,
        verbose: false,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--no-write-candidates") {
            options.noWriteCandidates = true;
            options.write = false;
            continue;
        }
        if (token === "--limit") {
            options.limit = parsePositiveInt(args.shift(), "--limit");
            continue;
        }
        if (token === "--isin") {
            for (const isin of parseCsvList(args.shift())) {
                if (!/^[A-Z0-9]{12}$/.test(isin)) throw new Error("Invalid --isin value.");
                options.isins.add(isin);
            }
            continue;
        }
        if (token === "--category") {
            const value = String(args.shift() ?? "").trim();
            if (!value) throw new Error("Invalid --category value.");
            options.category = value;
            continue;
        }
        if (token === "--include-all-open") {
            options.includeAllOpen = true;
            continue;
        }
        if (token === "--only-us") {
            const maybeValue = args[0];
            if (maybeValue && !maybeValue.startsWith("--")) {
                options.onlyUs = parseBooleanToken(args.shift(), "--only-us");
            } else {
                options.onlyUs = true;
            }
            continue;
        }
        if (token === "--include-non-us") {
            options.onlyUs = false;
            options.market = "all";
            continue;
        }
        if (token === "--market") {
            const value = String(args.shift() ?? "").trim().toLowerCase();
            if (value !== "us" && value !== "all") {
                throw new Error("Invalid --market value. Use us|all.");
            }
            options.market = value;
            options.onlyUs = value !== "all";
            continue;
        }
        if (token === "--api-key") {
            const value = String(args.shift() ?? "").trim();
            options.apiKey = value || null;
            continue;
        }
        if (token === "--out") {
            const value = String(args.shift() ?? "").trim();
            if (!value) throw new Error("Invalid --out value.");
            options.out = value;
            continue;
        }
        if (token === "--batch-size") {
            options.batchSize = parsePositiveInt(args.shift(), "--batch-size");
            continue;
        }
        if (token === "--sleep-ms") {
            options.sleepMs = parsePositiveInt(args.shift(), "--sleep-ms");
            continue;
        }
        if (token === "--min-score") {
            options.minScore = parseNumber(args.shift(), "--min-score");
            continue;
        }
        if (token === "--include-low-score") {
            options.includeLowScore = true;
            continue;
        }
        if (token === "--verbose") {
            options.verbose = true;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    const hasApiKey = Boolean(options.apiKey);
    if (!options.batchSize) options.batchSize = hasApiKey ? 100 : 5;
    if (!options.sleepMs) options.sleepMs = hasApiKey ? 300 : 2600;

    if (options.batchSize <= 0) throw new Error("--batch-size must be positive.");
    if (!hasApiKey && options.batchSize > 5) throw new Error("Without API key, --batch-size must be <= 5.");
    if (hasApiKey && options.batchSize > 100) throw new Error("With API key, --batch-size must be <= 100.");
    if (options.category === "likely_china_hk") {
        options.onlyUs = false;
    }

    return options;
}

function hasUsFundTrustLikeTerms(text) {
    return /\b(etf|ucits|fund|fonds|trust|bdc|reit)\b/i.test(text);
}

function isUsLikelyCommonStock(text, assetType) {
    if (hasUsFundTrustLikeTerms(text)) return false;
    if (/\b(warrant|discount warrant|optionsschein|zertifikat)\b/i.test(text)) return false;
    const normalizedAssetType = String(assetType || "").toLowerCase();
    if (/\b(stock|equity|share|common)\b/.test(normalizedAssetType)) return true;
    return true;
}

function shouldPreferXetraCandidate(row, hasFundLike) {
    if (!row.has_xetra_hit || !row.xetra_mnemonic || row.has_verified_primary) return false;
    const isin = String(row.isin || "");
    if (/^US/i.test(isin)) return false;
    if (/^DE/i.test(isin)) return true;
    if (/^(IE|LU)/i.test(isin) && hasFundLike) return true;
    if (hasFundLike && /^(DE|AT|CH|FR|NL|BE|IT|ES|PT|IE|LU|SE|NO|DK|FI|GB)/i.test(isin)) return true;
    return /^(DE|AT|CH|FR|NL|BE|IT|ES|PT|IE|LU|SE|NO|DK|FI|GB)/i.test(isin);
}

function classifyRow(row) {
    const name = String(row.display_name || row.name || "");
    const assetType = String(row.asset_type || "");
    const isin = String(row.isin || "");

    const text = `${name} ${assetType}`.toLowerCase();
    const hasFundLike = /\b(etf|ucits|fund|fonds)\b/i.test(text);
    const hasDerivativeLike = /\b(warrant|discount warrant|optionsschein|zertifikat)\b/i.test(text);
    const hasLegacyLike = /\b(alt|old|legacy|corporate action|royal dutch shell b alt)\b/i.test(text);
    const isinChinaHk = /^(CNE|HK|KYG)/i.test(isin);
    const isinUs = /^US/i.test(isin);
    const hasUsFundTrustLike = hasUsFundTrustLikeTerms(text);

    if (row.has_failed_validation) {
        return { suggested_category: "failed_or_excluded", suggested_next_action: "inspect_instrument" };
    }
    if (isinUs) {
        if (isUsLikelyCommonStock(text, assetType) || row.has_trading_universe_hit) {
            return { suggested_category: "likely_us_stock_missing_candidate", suggested_next_action: "search_home_market_symbol" };
        }
        if (hasUsFundTrustLike) {
            return { suggested_category: "manual_review", suggested_next_action: "search_home_market_symbol" };
        }
    }
    if (shouldPreferXetraCandidate(row, hasFundLike)) {
        return { suggested_category: "xetra_candidate_available", suggested_next_action: "create_xetra_candidate" };
    }
    if (hasDerivativeLike) {
        return {
            suggested_category: "likely_derivative_or_warrant",
            suggested_next_action: row.has_primary_mapping ? "exclude_or_archive" : "manual_mapping_required",
        };
    }
    if (hasLegacyLike) {
        return { suggested_category: "likely_legacy_or_corporate_action", suggested_next_action: "inspect_instrument" };
    }
    if (hasFundLike) {
        return {
            suggested_category: "likely_etf_or_fund",
            suggested_next_action: row.has_candidate_symbols ? "validate_existing_candidate" : "manual_mapping_required",
        };
    }
    if (isinChinaHk && !row.xetra_candidate_symbol) {
        return { suggested_category: "likely_china_hk", suggested_next_action: "search_home_market_symbol" };
    }

    return {
        suggested_category: "manual_review",
        suggested_next_action: row.has_candidate_symbols ? "validate_existing_candidate" : "manual_mapping_required",
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTicker(raw) {
    return String(raw ?? "").trim().toUpperCase();
}

function inferYfinanceSymbol(instrument, ticker, exchCode) {
    const rawTicker = normalizeTicker(ticker);
    const normalizedExch = normalizeTicker(exchCode);
    if (!rawTicker) return null;

    if (normalizedExch === "HK" || normalizedExch === "HKEX") {
        if (/^\d{1,5}$/.test(rawTicker)) {
            const core = rawTicker.length < 4 ? rawTicker.padStart(4, "0") : rawTicker;
            return `${core}.HK`;
        }
        if (/^\d{1,5}\.HK$/.test(rawTicker)) {
            const [num] = rawTicker.split(".");
            const core = num.length < 4 ? num.padStart(4, "0") : num;
            return `${core}.HK`;
        }
        return null;
    }

    if (normalizedExch === "US") {
        return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(rawTicker) ? rawTicker : null;
    }

    if (normalizedExch === "SH" || normalizedExch === "SHA") {
        if (/^\d{6}$/.test(rawTicker)) return `${rawTicker}.SS`;
        return null;
    }
    if (normalizedExch === "SZ" || normalizedExch === "SHE") {
        if (/^\d{6}$/.test(rawTicker)) return `${rawTicker}.SZ`;
        return null;
    }

    if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(rawTicker)) return rawTicker;
    return null;
}

function scoreCandidate(instrument, candidate) {
    let score = 0;
    const reasons = [];
    const rawTicker = normalizeTicker(candidate.ticker);
    const secType = String(candidate.securityType ?? "");
    const secType2 = String(candidate.securityType2 ?? "");
    const marketSector = String(candidate.marketSector ?? "");
    const exchCode = String(candidate.exchCode ?? "").toUpperCase();
    const selectedYfinanceSymbol = inferYfinanceSymbol(instrument, rawTicker, exchCode);
    const name = String(candidate.name ?? "");
    const dbName = `${instrument.display_name ?? ""} ${instrument.name ?? ""}`.trim();

    if (!rawTicker) {
        score -= 60;
        reasons.push("no_ticker");
    } else {
        score += 20;
        reasons.push("has_raw_ticker");
    }

    if (!selectedYfinanceSymbol) {
        score -= 20;
        reasons.push("no_safe_yfinance_symbol");
    } else {
        score += 20;
        reasons.push("has_yfinance_symbol");
    }

    if (marketSector.toLowerCase() === "equity") {
        score += 18;
        reasons.push("equity_sector");
    }

    if (secType2.toLowerCase() === "common stock") {
        score += 24;
        reasons.push("common_stock_type2");
    } else if (/common stock/i.test(secType)) {
        score += 16;
        reasons.push("common_stock_type");
    }

    if (/option|warrant|fund|bond|note|preferred/i.test(`${secType} ${secType2}`)) {
        score -= 35;
        reasons.push("penalty_non_common_equity");
    }

    if (/^US/i.test(instrument.isin) && exchCode === "US") {
        score += 16;
        reasons.push("us_exchange_match");
    }

    if (rawTicker.includes(" ")) {
        score -= 20;
        reasons.push("penalty_space_in_ticker");
    }

    if (/\d{6,}|\b[CP]\d{4,}\b/.test(rawTicker)) {
        score -= 20;
        reasons.push("penalty_option_like_ticker");
    }

    if (/\.(F|PK|L|HK|DE|PA|TO|SW|AX)$/.test(rawTicker)) {
        score -= 10;
        reasons.push("penalty_foreign_suffix");
    }

    if (/OTC|PINK|GREY/i.test(exchCode)) {
        score -= 15;
        reasons.push("penalty_otc_like_exchange");
    }

    if (/^(CNE|HK|KYG)/i.test(instrument.isin)) {
        if (exchCode === "HK" || exchCode === "HKEX") {
            score += 20;
            reasons.push("hk_home_market_preferred");
        }
        if (exchCode === "US") {
            score += 8;
            reasons.push("us_adr_allowed");
        }
    }

    if (dbName && name) {
        const a = dbName.toLowerCase();
        const b = name.toLowerCase();
        const words = new Set(a.split(/[^a-z0-9]+/i).filter((w) => w.length >= 4));
        let overlap = 0;
        for (const w of words) {
            if (b.includes(w)) overlap += 1;
        }
        if (overlap >= 2) {
            score += 12;
            reasons.push("name_overlap_high");
        } else if (overlap === 1) {
            score += 6;
            reasons.push("name_overlap_low");
        }
    }

    return { score, reasons, rawTicker, selectedYfinanceSymbol, exchCode };
}

function buildNotes(candidate) {
    const parts = [
        "source=openfigi",
        `rawOpenFigiTicker=${candidate.rawOpenFigiTicker ?? ""}`,
        `selectedYfinanceSymbol=${candidate.selectedYfinanceSymbol ?? ""}`,
        `figi=${candidate.figi ?? ""}`,
        `compositeFIGI=${candidate.compositeFIGI ?? ""}`,
        `shareClassFIGI=${candidate.shareClassFIGI ?? ""}`,
        `exchCode=${candidate.exchCode ?? ""}`,
        `securityType=${candidate.securityType ?? ""}`,
        `securityType2=${candidate.securityType2 ?? ""}`,
        `marketSector=${candidate.marketSector ?? ""}`,
        `score=${candidate.score}`,
    ];
    return parts.join("; ");
}

function mapInstrumentRows(rows) {
    return rows.map((raw) => {
        const row = {
            ...raw,
            has_any_mapping: Boolean(raw.has_any_mapping),
            has_primary_mapping: Boolean(raw.has_primary_mapping),
            has_verified_mapping: Boolean(raw.has_verified_mapping),
            has_verified_primary: Boolean(raw.has_verified_primary),
            has_verified_non_primary: Boolean(raw.has_verified_non_primary),
            has_failed_validation: Boolean(raw.has_failed_validation),
            has_xetra_hit: Boolean(raw.has_xetra_hit),
            has_trading_universe_hit: Boolean(raw.has_trading_universe_hit),
        };
        return { ...row, ...classifyRow(row) };
    });
}

function printSummaryTable(rows) {
    console.log("ISIN         | dbDisplayName                 | rawTicker   | selectedSymbol | exchCode | score | reason | status");
    console.log("-------------+-------------------------------+-------------+----------------+----------+-------+--------+--------");
    for (const row of rows) {
        const name = String(row.dbDisplayName ?? "").slice(0, 29).padEnd(29, " ");
        const raw = String(row.rawTicker ?? "-").slice(0, 11).padEnd(11, " ");
        const sym = String(row.selectedSymbol ?? "-").slice(0, 14).padEnd(14, " ");
        const exch = String(row.exchCode ?? "-").slice(0, 8).padEnd(8, " ");
        const score = String(row.score ?? "-").padStart(5, " ");
        console.log(`${row.isin} | ${name} | ${raw} | ${sym} | ${exch} | ${score} | ${row.reason} | ${row.status}`);
    }
}

async function closeDbPool() {
    try {
        const postgresCore = await import("../src/lib/db/postgres-core.ts");
        if (typeof postgresCore.endPostgresPool === "function") {
            await postgresCore.endPostgresPool();
        }
    } catch {}
}

async function fetchMappingJobs(jobs, apiKey, retry = 0) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-OPENFIGI-APIKEY"] = apiKey;

    const response = await fetch(OPENFIGI_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(jobs),
    });

    if (response.status === 429) {
        const reset = response.headers.get("ratelimit-reset") ?? response.headers.get("x-ratelimit-reset");
        const remain = response.headers.get("ratelimit-remaining") ?? response.headers.get("x-ratelimit-remaining");
        throw new Error(`OpenFIGI rate limit hit (429). remaining=${remain ?? "unknown"} reset=${reset ?? "unknown"}`);
    }

    if ((response.status === 500 || response.status === 503) && retry < 2) {
        await sleep(500 * 2 ** retry);
        return fetchMappingJobs(jobs, apiKey, retry + 1);
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenFIGI request failed (${response.status}): ${text.slice(0, 240)}`);
    }

    return response.json();
}

async function loadOpenInstruments(options) {
    const { queryPostgres } = await import("../src/lib/db/postgres-core.ts");
    const result = await queryPostgres(
        `with mapping as (
            select
                i.id as instrument_id,
                bool_or(m.provider = 'yfinance' and m.is_active = true) as has_any_mapping,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true) as has_primary_mapping,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.verified_at is not null) as has_verified_mapping,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true and m.verified_at is not null) as has_verified_primary,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true and m.verified_at is not null) as has_verified_primary_yfinance,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = false and m.verified_at is not null) as has_verified_non_primary,
                bool_or(m.provider = 'yfinance' and m.notes ilike '%validated:yfinance; status=failed%') as has_failed_validation,
                string_agg(distinct case when m.provider = 'yfinance' then m.symbol else null end, ', ' order by case when m.provider = 'yfinance' then m.symbol else null end) as candidate_symbols
            from market_instruments i
            left join market_symbol_mappings m on m.instrument_id = i.id
            group by i.id
        ),
        xetra as (
            select
                i.id as instrument_id,
                bool_or(r.source_key = 'xetra_all_tradable_instruments') as has_xetra_hit,
                max(case when r.source_key = 'xetra_all_tradable_instruments' then r.mnemonic else null end) as xetra_mnemonic,
                max(case when r.source_key = 'xetra_all_tradable_instruments' and r.mnemonic is not null and r.mnemonic <> '' then upper(r.mnemonic) || '.DE' else null end) as xetra_candidate_symbol
            from market_instruments i
            left join market_reference_instruments r on r.isin = i.isin and r.source_key = 'xetra_all_tradable_instruments'
            group by i.id
        ),
        tu as (
            select
                i.id as instrument_id,
                bool_or(r.source_key = 'trading_universe') as has_trading_universe_hit
            from market_instruments i
            left join market_reference_instruments r on r.isin = i.isin and r.source_key = 'trading_universe'
            group by i.id
        )
        select
            i.id as instrument_id,
            i.isin,
            i.display_name,
            i.name,
            i.asset_type,
            coalesce(m.has_any_mapping, false) as has_any_mapping,
            coalesce(m.has_primary_mapping, false) as has_primary_mapping,
            coalesce(m.has_verified_mapping, false) as has_verified_mapping,
            coalesce(m.has_verified_primary, false) as has_verified_primary,
            coalesce(m.has_verified_primary_yfinance, false) as has_verified_primary_yfinance,
            coalesce(m.has_verified_non_primary, false) as has_verified_non_primary,
            coalesce(m.has_failed_validation, false) as has_failed_validation,
            coalesce(m.candidate_symbols, '') as candidate_symbols,
            coalesce(x.has_xetra_hit, false) as has_xetra_hit,
            x.xetra_mnemonic,
            x.xetra_candidate_symbol,
            coalesce(tu.has_trading_universe_hit, false) as has_trading_universe_hit
        from market_instruments i
        left join mapping m on m.instrument_id = i.id
        left join xetra x on x.instrument_id = i.id
        left join tu on tu.instrument_id = i.id
        where ($1::boolean = true or coalesce(m.has_verified_primary_yfinance, false) = false)
          and (cardinality($2::text[]) = 0 or i.isin = any($2::text[]))
        order by i.isin asc`,
        [options.includeAllOpen, [...options.isins]],
    );

    let rows = mapInstrumentRows(result.rows);
    if (options.isins.size === 0 && options.category) {
        rows = rows.filter((row) => row.suggested_category === options.category);
    }
    if (options.onlyUs) {
        rows = rows.filter((row) => /^US/i.test(row.isin));
    }
    return rows.slice(0, options.limit);
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const { insertSymbolMappingCandidate } = await import("../src/lib/market-data/db/repository-core.ts");

    const instruments = await loadOpenInstruments(options);
    const stats = {
        requestedIsinCount: instruments.length,
        openfigiCallsMade: 0,
        hits: 0,
        noHits: 0,
        errors: 0,
        plannedCandidateCount: 0,
        skippedLowScoreCount: 0,
        skippedExistingMappingCount: 0,
        writesInserted: 0,
    };

    const reportRows = [];
    const detailed = [];

    for (let i = 0; i < instruments.length; i += options.batchSize) {
        const batch = instruments.slice(i, i + options.batchSize);
        const jobs = batch.map((instrument) => ({ idType: "ID_ISIN", idValue: instrument.isin }));

        let payload;
        try {
            payload = await fetchMappingJobs(jobs, options.apiKey);
            stats.openfigiCallsMade += 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown OpenFIGI error";
            stats.errors += batch.length;
            for (const instrument of batch) {
                reportRows.push({
                    isin: instrument.isin,
                    dbDisplayName: instrument.display_name || instrument.name || "",
                    rawTicker: null,
                    selectedSymbol: null,
                    exchCode: null,
                    score: null,
                    reason: "openfigi_error",
                    status: message,
                });
            }
            continue;
        }

        for (let j = 0; j < batch.length; j += 1) {
            const instrument = batch[j];
            let item = payload[j] ?? {};
            let candidates = Array.isArray(item.data) ? item.data : [];

            if (candidates.length === 0 && /^US/i.test(instrument.isin)) {
                try {
                    const fallback = await fetchMappingJobs(
                        [{ idType: "ID_ISIN", idValue: instrument.isin, marketSecDes: "Equity" }],
                        options.apiKey,
                    );
                    stats.openfigiCallsMade += 1;
                    item = fallback[0] ?? item;
                    candidates = Array.isArray(item.data) ? item.data : [];
                } catch {
                    // keep primary result
                }
            }

            const scored = candidates
                .map((candidate) => {
                    const scoreResult = scoreCandidate(instrument, candidate);
                    return {
                        rawOpenFigiTicker: scoreResult.rawTicker,
                        selectedYfinanceSymbol: scoreResult.selectedYfinanceSymbol,
                        exchCode: scoreResult.exchCode,
                        name: String(candidate.name ?? ""),
                        securityType: String(candidate.securityType ?? ""),
                        securityType2: String(candidate.securityType2 ?? ""),
                        marketSector: String(candidate.marketSector ?? ""),
                        figi: String(candidate.figi ?? ""),
                        compositeFIGI: String(candidate.compositeFIGI ?? ""),
                        shareClassFIGI: String(candidate.shareClassFIGI ?? ""),
                        score: scoreResult.score,
                        scoreReasons: scoreResult.reasons,
                    };
                })
                .sort((a, b) => b.score - a.score || String(a.selectedYfinanceSymbol ?? "").localeCompare(String(b.selectedYfinanceSymbol ?? "")));

            const best = scored[0] ?? null;
            const dbDisplayName = instrument.display_name || instrument.name || "";

            if (!best) {
                stats.noHits += 1;
                reportRows.push({
                    isin: instrument.isin,
                    dbDisplayName,
                    rawTicker: null,
                    selectedSymbol: null,
                    exchCode: null,
                    score: null,
                    reason: item.warning || "no_identifier_found",
                    status: "no_hit",
                });
                detailed.push({ isin: instrument.isin, dbDisplayName, dbName: instrument.name ?? null, openfigiResultCount: 0, warning: item.warning ?? null });
                continue;
            }

            stats.hits += 1;
            let status = "planned";
            if (!options.includeLowScore && best.score < options.minScore) {
                status = "skipped_low_score";
                stats.skippedLowScoreCount += 1;
            }

            if (status === "planned") {
                stats.plannedCandidateCount += 1;
            }

            if (status === "planned" && options.write && !options.noWriteCandidates) {
                if (!best.selectedYfinanceSymbol) {
                    status = "skipped_ambiguous_symbol";
                    stats.skippedLowScoreCount += 1;
                } else {
                const inserted = await insertSymbolMappingCandidate({
                    instrumentId: instrument.instrument_id,
                    provider: "yfinance",
                    symbol: best.selectedYfinanceSymbol,
                    exchange: best.exchCode || null,
                    currency: /^US/i.test(instrument.isin) && best.exchCode === "US" ? "USD" : null,
                    notes: buildNotes(best),
                });
                if (inserted) {
                    stats.writesInserted += 1;
                    status = "written";
                } else {
                    stats.skippedExistingMappingCount += 1;
                    status = "skipped_existing_mapping";
                }
                }
            }

            reportRows.push({
                isin: instrument.isin,
                dbDisplayName,
                rawTicker: best.rawOpenFigiTicker,
                selectedSymbol: best.selectedYfinanceSymbol,
                exchCode: best.exchCode,
                score: best.score,
                reason: best.scoreReasons.join(","),
                status,
            });

            detailed.push({
                isin: instrument.isin,
                dbDisplayName,
                dbName: instrument.name ?? null,
                openfigiResultCount: candidates.length,
                selectedCandidate: best,
                rejectedCandidates: options.verbose ? scored.slice(1) : undefined,
                warning: item.warning ?? null,
            });
        }

        if (i + options.batchSize < instruments.length) {
            await sleep(options.sleepMs);
        }
    }

    console.log(`requested ISIN count: ${stats.requestedIsinCount}`);
    console.log(`OpenFIGI calls made: ${stats.openfigiCallsMade}`);
    console.log(`hits/no hits/errors: ${stats.hits}/${stats.noHits}/${stats.errors}`);
    console.log(`planned candidate count: ${stats.plannedCandidateCount}`);
    console.log(`skipped low score count: ${stats.skippedLowScoreCount}`);
    console.log(`skipped existing mapping count: ${stats.skippedExistingMappingCount}`);
    printSummaryTable(reportRows);

    if (!options.write || options.noWriteCandidates) {
        console.log("DB write mode: dry-run");
    } else {
        console.log(`DB write mode: --write (inserted=${stats.writesInserted})`);
    }

    if (options.out) {
        const resolved = path.resolve(process.cwd(), options.out);
        await mkdir(path.dirname(resolved), { recursive: true });
        await writeFile(
            resolved,
            JSON.stringify(
                {
                    options: {
                        ...options,
                        apiKey: options.apiKey ? "provided" : "not_provided",
                        isins: [...options.isins],
                    },
                    summary: stats,
                    rows: detailed,
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
        console.error(`OpenFIGI lookup failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
