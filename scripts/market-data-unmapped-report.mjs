import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const VALID_FORMATS = new Set(["table", "json", "csv"]);
const VALID_SORT = new Set(["priority", "isin", "name", "category"]);
const VALID_STATUS = new Set(["active", "excluded", "legacy", "derivative", "unknown"]);

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unknown error";
}

function parsePositiveInt(raw, label) {
    const value = Number(raw ?? "");
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
        throw new Error(`Invalid ${label} value.`);
    }
    return value;
}

function parseArgs(argv) {
    const options = {
        limit: 100,
        isin: null,
        category: null,
        out: null,
        format: "table",
        includeVerified: false,
        includeExcluded: false,
        sort: "priority",
        status: null,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--limit") {
            options.limit = parsePositiveInt(args.shift(), "--limit");
            continue;
        }
        if (token === "--isin") {
            const normalized = String(args.shift() ?? "").replace(/\s+/g, "").toUpperCase();
            if (!/^[A-Z0-9]{12}$/.test(normalized)) {
                throw new Error("Invalid --isin value.");
            }
            options.isin = normalized;
            continue;
        }
        if (token === "--category") {
            const category = String(args.shift() ?? "").trim();
            if (!category) throw new Error("Invalid --category value.");
            options.category = category;
            continue;
        }
        if (token === "--out") {
            const out = String(args.shift() ?? "").trim();
            if (!out) throw new Error("Invalid --out value.");
            options.out = out;
            continue;
        }
        if (token === "--format") {
            const format = String(args.shift() ?? "table").trim().toLowerCase();
            if (!VALID_FORMATS.has(format)) {
                throw new Error("Invalid --format value. Use table|json|csv.");
            }
            options.format = format;
            continue;
        }
        if (token === "--include-verified") {
            options.includeVerified = true;
            continue;
        }
        if (token === "--include-excluded") {
            options.includeExcluded = true;
            continue;
        }
        if (token === "--sort") {
            const sort = String(args.shift() ?? "priority").trim().toLowerCase();
            if (!VALID_SORT.has(sort)) {
                throw new Error("Invalid --sort value. Use priority|isin|name|category.");
            }
            options.sort = sort;
            continue;
        }
        if (token === "--status") {
            const status = String(args.shift() ?? "").trim().toLowerCase();
            if (!VALID_STATUS.has(status)) {
                throw new Error("Invalid --status value. Use active|excluded|legacy|derivative|unknown.");
            }
            options.status = status;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    return options;
}

function boolToYesNo(value) {
    return value ? "yes" : "no";
}

function includesAny(value, patterns) {
    const normalized = String(value ?? "").toLowerCase();
    return patterns.some((pattern) => normalized.includes(pattern));
}

function hasExcludedNote(...values) {
    const joined = values
        .map((value) => String(value ?? "").toLowerCase())
        .join(" | ");
    return includesAny(joined, ["exclude", "excluded", "archive", "archiv", "delist", "inactive", "ignore"]);
}

function isEuropeanIsin(isin) {
    return /^(DE|AT|CH|FR|NL|BE|IT|ES|PT|IE|LU|SE|NO|DK|FI|GB)/i.test(String(isin || ""));
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
    if (hasFundLike && isEuropeanIsin(isin)) return true;
    if (isEuropeanIsin(isin)) return true;
    return false;
}

function classifyRow(row) {
    const explicitStatus = String(row.market_data_status || "").toLowerCase();
    if (explicitStatus === "excluded") {
        return {
            suggested_category: "failed_or_excluded",
            suggested_next_action: "inspect_instrument",
        };
    }
    if (explicitStatus === "legacy") {
        return {
            suggested_category: "likely_legacy_or_corporate_action",
            suggested_next_action: "inspect_instrument",
        };
    }
    if (explicitStatus === "derivative") {
        return {
            suggested_category: "likely_derivative_or_warrant",
            suggested_next_action: "manual_mapping_required",
        };
    }
    if (explicitStatus === "unknown") {
        return {
            suggested_category: "manual_review",
            suggested_next_action: "manual_mapping_required",
        };
    }

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
    const hasRevTerexEvidence =
        isin === "US7495271071" ||
        /\brev group\b/i.test(name) ||
        /\bterex\b/i.test(`${row.mapping_notes || ""} ${row.trading_universe_names || ""} ${name}`);

    if (row.has_failed_validation) {
        return {
            suggested_category: "failed_or_excluded",
            suggested_next_action: "inspect_instrument",
        };
    }

    if (hasRevTerexEvidence) {
        return {
            suggested_category: "likely_legacy_or_corporate_action",
            suggested_next_action: "inspect_instrument",
            suggested_note:
                "REV Group merged with Terex; combined company trades under TEX. Do not map old REV ISIN directly to TEX.",
        };
    }

    if (isinUs) {
        if (isUsLikelyCommonStock(text, assetType) || row.has_trading_universe_hit) {
            return {
                suggested_category: "likely_us_stock_missing_candidate",
                suggested_next_action: "search_home_market_symbol",
            };
        }
        if (hasUsFundTrustLike) {
            return {
                suggested_category: "manual_review",
                suggested_next_action: "search_home_market_symbol",
            };
        }
    }

    if (shouldPreferXetraCandidate(row, hasFundLike)) {
        return {
            suggested_category: "xetra_candidate_available",
            suggested_next_action: "create_xetra_candidate",
        };
    }

    if (hasDerivativeLike) {
        return {
            suggested_category: "likely_derivative_or_warrant",
            suggested_next_action: row.has_primary_mapping ? "exclude_or_archive" : "manual_mapping_required",
        };
    }

    if (hasLegacyLike) {
        return {
            suggested_category: "likely_legacy_or_corporate_action",
            suggested_next_action: "inspect_instrument",
        };
    }

    if (hasFundLike) {
        return {
            suggested_category: "likely_etf_or_fund",
            suggested_next_action: row.has_candidate_symbols ? "validate_existing_candidate" : "manual_mapping_required",
        };
    }

    if (isinChinaHk && !row.xetra_candidate_symbol) {
        return {
            suggested_category: "likely_china_hk",
            suggested_next_action: "search_home_market_symbol",
        };
    }

    if (row.has_trading_universe_hit && !row.has_candidate_symbols && (row.asset_type || "").toLowerCase().includes("stock")) {
        return {
            suggested_category: "trading_universe_stock_no_symbol",
            suggested_next_action: "search_home_market_symbol",
        };
    }

    return {
        suggested_category: "manual_review",
        suggested_next_action: row.has_candidate_symbols ? "validate_existing_candidate" : "manual_mapping_required",
    };
}

function deriveMappingStatus(row) {
    if (row.has_failed_validation) return "failed_validation";
    if (!row.has_any_mapping) return "no_mapping";
    if (row.has_primary_mapping && !row.has_prices) return "primary_without_prices";
    if (row.has_verified_non_primary && !row.has_verified_primary) return "verified_non_primary";
    if (row.has_any_mapping && !row.has_verified_mapping) return "unverified_mapping";
    if (!row.has_primary_mapping) return "no_mapping";
    return "unverified_mapping";
}

function computePriority(row, mappedStatus, classification) {
    let score = 10;

    if (mappedStatus === "failed_validation") score += 50;
    if (mappedStatus === "no_mapping") score += 40;
    if (mappedStatus === "unverified_mapping") score += 30;
    if (mappedStatus === "verified_non_primary") score += 25;
    if (mappedStatus === "primary_without_prices") score += 35;

    if (classification.suggested_category === "xetra_candidate_available") score += 25;
    if (classification.suggested_category === "likely_us_stock_missing_candidate") score += 15;
    if (classification.suggested_category === "likely_china_hk") score += 10;
    if (classification.suggested_category === "failed_or_excluded") score += 20;
    if (classification.suggested_category === "manual_review") score += 5;

    if (!row.display_name) score += 5;
    if (!row.wkn) score += 3;

    return score;
}

function toCsv(rows) {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value) => {
        const raw = value === null || value === undefined ? "" : String(value);
        if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
            return `\"${raw.replace(/\"/g, "\"\"")}\"`;
        }
        return raw;
    };

    const lines = [headers.join(",")];
    for (const row of rows) {
        lines.push(headers.map((header) => escape(row[header])).join(","));
    }
    return `${lines.join("\n")}\n`;
}

function pad(value, width) {
    const str = String(value ?? "");
    if (str.length >= width) return str;
    return `${str}${" ".repeat(width - str.length)}`;
}

function truncate(value, max) {
    const str = String(value ?? "");
    if (str.length <= max) return str;
    return `${str.slice(0, Math.max(0, max - 1))}…`;
}

function printTable(rows) {
    const columns = [
        { key: "priority_score", label: "prio", width: 4 },
        { key: "mapping_status", label: "status", width: 22 },
        { key: "isin", label: "isin", width: 12 },
        { key: "market_data_status", label: "md_status", width: 10 },
        { key: "display_name", label: "display_name", width: 28 },
        { key: "primary_symbol", label: "primary", width: 14 },
        { key: "candidate_symbols", label: "candidates", width: 20 },
        { key: "suggested_category", label: "category", width: 30 },
        { key: "suggested_next_action", label: "action", width: 26 },
        { key: "market_data_status_reason", label: "status_reason", width: 32 },
    ];

    const header = columns.map((col) => pad(col.label, col.width)).join(" | ");
    const divider = columns.map((col) => "-".repeat(col.width)).join("-+-");

    console.log(header);
    console.log(divider);
    for (const row of rows) {
        const line = columns
            .map((col) => pad(truncate(row[col.key] ?? "", col.width), col.width))
            .join(" | ");
        console.log(line);
    }
}

function countBy(rows, key) {
    const map = new Map();
    for (const row of rows) {
        const value = String(row[key] ?? "-");
        map.set(value, (map.get(value) ?? 0) + 1);
    }
    return Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function sortRows(rows, sort) {
    const next = [...rows];
    if (sort === "isin") {
        next.sort((a, b) => a.isin.localeCompare(b.isin));
        return next;
    }
    if (sort === "name") {
        next.sort((a, b) => String(a.display_name || a.name || "").localeCompare(String(b.display_name || b.name || "")) || a.isin.localeCompare(b.isin));
        return next;
    }
    if (sort === "category") {
        next.sort((a, b) => a.suggested_category.localeCompare(b.suggested_category) || b.priority_score - a.priority_score || a.isin.localeCompare(b.isin));
        return next;
    }

    next.sort((a, b) => b.priority_score - a.priority_score || a.isin.localeCompare(b.isin));
    return next;
}

function toPublicRow(row) {
    const xetraCandidateRole = row.xetra_candidate_symbol
        ? row.suggested_category === "xetra_candidate_available"
            ? "primary_candidate"
            : "fallback_candidate"
        : null;

    return {
        isin: row.isin,
        wkn: row.wkn,
        display_name: row.display_name,
        name: row.name,
        asset_type: row.asset_type,
        currency: row.currency,
        market_data_status: row.market_data_status ?? null,
        market_data_status_reason: row.market_data_status_reason ?? null,
        market_data_successor_isin: row.market_data_successor_isin ?? null,
        market_data_successor_symbol: row.market_data_successor_symbol ?? null,
        mapping_status: row.mapping_status,
        candidate_symbols: row.candidate_symbols,
        primary_symbol: row.primary_symbol,
        xetra_hit: boolToYesNo(row.has_xetra_hit),
        xetra_mnemonic: row.xetra_mnemonic,
        xetra_candidate: row.xetra_candidate_symbol,
        xetraCandidate: row.xetra_candidate_symbol,
        xetraCandidateRole: xetraCandidateRole,
        xetra_instrument_type: row.xetra_instrument_type,
        xetra_market_segment: row.xetra_market_segment,
        trading_universe_hit: boolToYesNo(row.has_trading_universe_hit),
        trading_universe_name: row.trading_universe_name,
        suggested_category: row.suggested_category,
        suggested_next_action: row.suggested_next_action,
        suggested_note: row.suggested_note ?? null,
        priority_score: row.priority_score,
    };
}

async function closeDbPool() {
    try {
        const postgresCore = await import("../src/lib/db/postgres-core.ts");
        if (typeof postgresCore.endPostgresPool === "function") {
            await postgresCore.endPostgresPool();
        }
    } catch {}
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const { queryPostgres } = await import("../src/lib/db/postgres-core.ts");

    const result = await queryPostgres(
        `with mapping as (
            select
                i.id as instrument_id,
                bool_or(m.provider = 'yfinance' and m.is_active = true) as has_any_mapping,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true) as has_primary_mapping,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.verified_at is not null) as has_verified_mapping,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true and m.verified_at is not null) as has_verified_primary,
                bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = false and m.verified_at is not null) as has_verified_non_primary,
                bool_or(m.provider = 'yfinance' and m.notes ilike '%validated:yfinance; status=failed%') as has_failed_validation,
                bool_or(m.provider = 'yfinance' and m.notes ilike '%exclude%' or m.provider = 'yfinance' and m.notes ilike '%archive%') as has_excluded_note,
                string_agg(distinct case when m.provider = 'yfinance' then m.symbol else null end, ', ' order by case when m.provider = 'yfinance' then m.symbol else null end) as candidate_symbols,
                max(case when m.provider = 'yfinance' and m.is_primary = true then m.symbol else null end) as primary_symbol,
                string_agg(distinct coalesce(m.notes, ''), ' | ') filter (where m.provider = 'yfinance' and m.notes is not null) as mapping_notes
            from assets i
            left join asset_symbol_mappings m on m.instrument_id = i.id
            group by i.id
        ),
        price_flags as (
            select i.id as instrument_id, true as has_prices
            from assets i
            join assets a
              on a.asset_key_type = 'isin'
             and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
            join asset_daily_prices p on p.asset_id = a.id
            group by i.id
        ),
        xetra as (
            select
                i.id as instrument_id,
                bool_or(r.source_key = 'xetra_all_tradable_instruments') as has_xetra_hit,
                max(case when r.source_key = 'xetra_all_tradable_instruments' then r.mnemonic else null end) as xetra_mnemonic,
                max(case when r.source_key = 'xetra_all_tradable_instruments' then r.instrument_type else null end) as xetra_instrument_type,
                max(case when r.source_key = 'xetra_all_tradable_instruments' then r.market_segment else null end) as xetra_market_segment,
                max(case when r.source_key = 'xetra_all_tradable_instruments' and r.mnemonic is not null and r.mnemonic <> '' then upper(r.mnemonic) || '.DE' else null end) as xetra_candidate_symbol
            from assets i
            left join reference_data_asset_candidates r
              on r.isin = i.isin
             and r.source_key = 'xetra_all_tradable_instruments'
            group by i.id
        ),
        tu as (
            select
                i.id as instrument_id,
                bool_or(r.source_key = 'trading_universe') as has_trading_universe_hit,
                max(case when r.source_key = 'trading_universe' then r.name else null end) as trading_universe_name,
                string_agg(distinct coalesce(r.name, ''), ' | ') filter (where r.source_key = 'trading_universe' and r.name is not null) as trading_universe_names
            from assets i
            left join reference_data_asset_candidates r
              on r.isin = i.isin
             and r.source_key = 'trading_universe'
            group by i.id
        )
        select
            i.isin,
            i.wkn,
            i.display_name,
            i.name,
            i.asset_type,
            i.currency,
            i.market_data_status,
            i.market_data_status_reason,
            i.market_data_successor_isin,
            i.market_data_successor_symbol,
            coalesce(m.has_any_mapping, false) as has_any_mapping,
            coalesce(m.has_primary_mapping, false) as has_primary_mapping,
            coalesce(m.has_verified_mapping, false) as has_verified_mapping,
            coalesce(m.has_verified_primary, false) as has_verified_primary,
            coalesce(m.has_verified_non_primary, false) as has_verified_non_primary,
            coalesce(m.has_failed_validation, false) as has_failed_validation,
            coalesce(m.has_excluded_note, false) as has_excluded_note,
            coalesce(m.candidate_symbols, '') as candidate_symbols,
            m.primary_symbol,
            coalesce(m.mapping_notes, '') as mapping_notes,
            coalesce(p.has_prices, false) as has_prices,
            coalesce(x.has_xetra_hit, false) as has_xetra_hit,
            x.xetra_mnemonic,
            x.xetra_candidate_symbol,
            x.xetra_instrument_type,
            x.xetra_market_segment,
            coalesce(tu.has_trading_universe_hit, false) as has_trading_universe_hit,
            tu.trading_universe_name,
            coalesce(tu.trading_universe_names, '') as trading_universe_names
        from assets i
        left join mapping m on m.instrument_id = i.id
        left join price_flags p on p.instrument_id = i.id
        left join xetra x on x.instrument_id = i.id
        left join tu on tu.instrument_id = i.id
        where ($1::text is null or i.isin = $1)
          and (
            coalesce(m.has_verified_primary, false) = false
            or coalesce(m.has_primary_mapping, false) = false
            or coalesce(m.has_failed_validation, false) = true
            or (coalesce(m.has_primary_mapping, false) = true and coalesce(p.has_prices, false) = false)
            or coalesce(i.market_data_status, '') in ('excluded', 'legacy', 'derivative', 'unknown')
          )
        order by i.isin asc`,
        [options.isin],
    );

    const enrichedRows = result.rows
        .map((raw) => {
            const row = {
                ...raw,
                has_any_mapping: Boolean(raw.has_any_mapping),
                has_primary_mapping: Boolean(raw.has_primary_mapping),
                has_verified_mapping: Boolean(raw.has_verified_mapping),
                has_verified_primary: Boolean(raw.has_verified_primary),
                has_verified_non_primary: Boolean(raw.has_verified_non_primary),
                has_failed_validation: Boolean(raw.has_failed_validation),
                has_excluded_note: Boolean(raw.has_excluded_note),
                has_prices: Boolean(raw.has_prices),
                has_xetra_hit: Boolean(raw.has_xetra_hit),
                has_trading_universe_hit: Boolean(raw.has_trading_universe_hit),
            };

            const mappingStatus = deriveMappingStatus(row);
            const classification = classifyRow(row);
            const priorityScore = computePriority(row, mappingStatus, classification);

            return {
                ...row,
                mapping_status: mappingStatus,
                ...classification,
                priority_score: priorityScore,
            };
        })
        .filter((row) => {
            if (!options.includeVerified && row.has_verified_primary && row.has_prices && !row.has_failed_validation) {
                return false;
            }
            if (!options.includeExcluded && !options.status && (row.has_excluded_note || hasExcludedNote(row.mapping_notes, row.trading_universe_names))) {
                return false;
            }
            const status = String(row.market_data_status ?? "").toLowerCase();
            if (options.status === "active" && status && status !== "active") {
                return false;
            }
            if (options.status && options.status !== "active" && status !== options.status) {
                return false;
            }
            if (!options.includeExcluded && !options.status && (status === "excluded" || status === "legacy" || status === "derivative")) {
                return false;
            }
            if (options.category && row.suggested_category !== options.category) {
                return false;
            }
            return true;
        });

    const sortedRows = sortRows(enrichedRows, options.sort);
    const limitedRows = sortedRows.slice(0, options.limit);
    const publicRows = limitedRows.map((row) => toPublicRow(row));

    if (options.format === "table") {
        console.log("Unmapped Market Data Report");
        console.log(`total_open=${enrichedRows.length} | shown=${publicRows.length} | sort=${options.sort}`);
        console.log("");
        printTable(publicRows);
        console.log("");

        const categorySummary = countBy(enrichedRows.map((row) => toPublicRow(row)), "suggested_category");
        console.log("Summary by category:");
        for (const item of categorySummary) {
            console.log(`- ${item.value}: ${item.count}`);
        }
        console.log("");

        const actionSummary = countBy(enrichedRows.map((row) => toPublicRow(row)), "suggested_next_action");
        console.log("Summary by action:");
        for (const item of actionSummary) {
            console.log(`- ${item.value}: ${item.count}`);
        }
        console.log("");

        const topPriority = sortRows(enrichedRows, "priority").slice(0, Math.min(10, enrichedRows.length)).map((row) => toPublicRow(row));
        console.log("Top priority rows:");
        for (const row of topPriority) {
            console.log(`- [${row.priority_score}] ${row.isin} | ${row.mapping_status} | ${row.suggested_category} | ${row.suggested_next_action}`);
        }
        return;
    }

    const output = options.format === "json" ? `${JSON.stringify(publicRows, null, 2)}\n` : toCsv(publicRows);

    if (options.out) {
        const resolved = path.resolve(process.cwd(), options.out);
        await mkdir(path.dirname(resolved), { recursive: true });
        await writeFile(resolved, output, "utf8");
        console.log(`Report written to ${resolved}`);
        return;
    }

    process.stdout.write(output);
}

run()
    .catch((error) => {
        console.error(`Unmapped report failed: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
