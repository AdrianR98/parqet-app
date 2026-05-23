import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import pg from "pg";

const { Pool } = pg;
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const ENV_PRIORITY = [
    "SUPABASE_POSTGRES_URL",
    "SUPABASE_POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
];
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_STATEMENT_TIMEOUT = "60s";

function resolveConnectionString() {
    for (const key of ENV_PRIORITY) {
        const value = process.env[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function readBooleanFalseEnv(rawValue) {
    if (typeof rawValue !== "string") {
        return false;
    }

    return rawValue.trim().toLowerCase() === "false";
}

function normalizePostgresConnectionString(connectionString) {
    try {
        const parsed = new URL(connectionString);
        if (parsed.searchParams.get("sslmode") === "require" && !parsed.searchParams.has("uselibpqcompat")) {
            parsed.searchParams.set("uselibpqcompat", "true");
        }
        return parsed.toString();
    } catch {
        return connectionString;
    }
}

function resolvePostgresSsl(connectionString) {
    let hostname = "";
    try {
        hostname = new URL(connectionString).hostname.toLowerCase();
    } catch {
        hostname = "";
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return false;
    }

    const shouldSkipVerification =
        readBooleanFalseEnv(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED) ||
        readBooleanFalseEnv(process.env.SUPABASE_POSTGRES_SSL_REJECT_UNAUTHORIZED);

    if (shouldSkipVerification) {
        return { rejectUnauthorized: false };
    }

    const configuredCa = process.env.POSTGRES_CA_CERT ?? process.env.SUPABASE_POSTGRES_CA_CERT;
    if (typeof configuredCa === "string" && configuredCa.trim()) {
        return {
            ca: configuredCa.replace(/\\n/g, "\n"),
            rejectUnauthorized: true,
        };
    }

    if (hostname.includes("supabase.com") || hostname.includes("supabase.co")) {
        return { rejectUnauthorized: false };
    }

    return { rejectUnauthorized: true };
}

function normalizeIsin(isin) {
    return String(isin ?? "").replace(/\s+/g, "").toUpperCase();
}

function toDateString(value) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString().slice(0, 10);
}

function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function validatePayload(payload) {
    if (!payload || typeof payload !== "object") {
        throw new Error("Ungültige JSON-Struktur.");
    }

    const instrument = payload.instrument;
    const mapping = payload.mapping;

    if (!instrument || typeof instrument !== "object") {
        throw new Error("Instrumentdaten fehlen.");
    }

    if (!mapping || typeof mapping !== "object") {
        throw new Error("Mappingdaten fehlen.");
    }

    const isin = normalizeIsin(instrument.isin);
    if (!/^[A-Z0-9]{12}$/.test(isin)) {
        throw new Error("Ungültige ISIN im Import.");
    }

    const provider = String(mapping.provider ?? "").trim();
    const symbol = String(mapping.symbol ?? "").trim().toUpperCase();
    if (!provider || !symbol) {
        throw new Error("Provider oder Symbol fehlt im Import.");
    }

    return { isin, provider, symbol };
}

function parsePositiveInteger(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Ungültiger numerischer Parameter: ${value}`);
    }

    return parsed;
}

function parseCliArgs(argv) {
    if (argv.length === 0) {
        throw new Error("Bitte Importdatei angeben: node scripts/import-market-data-json.mjs <datei.json>");
    }

    const importPath = argv[0];
    const options = {
        batchSize: DEFAULT_BATCH_SIZE,
        limitPrices: null,
        limitActions: null,
    };

    for (let index = 1; index < argv.length; index += 1) {
        const token = argv[index];
        const next = argv[index + 1];

        if (token === "--batch-size") {
            options.batchSize = parsePositiveInteger(next, DEFAULT_BATCH_SIZE);
            index += 1;
            continue;
        }

        if (token === "--limit-prices") {
            options.limitPrices = parsePositiveInteger(next, null);
            index += 1;
            continue;
        }

        if (token === "--limit-actions") {
            options.limitActions = parsePositiveInteger(next, null);
            index += 1;
            continue;
        }
    }

    return {
        importPath,
        ...options,
    };
}

function chunkArray(items, chunkSize) {
    const chunks = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
}

function buildValuesPlaceholders(rowCount, columnCount, startIndex = 1) {
    const values = [];
    let placeholderIndex = startIndex;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const row = [];
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            row.push(`$${placeholderIndex}`);
            placeholderIndex += 1;
        }
        values.push(`(${row.join(", ")})`);
    }

    return values.join(", ");
}

function sanitizeErrorMessage(error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return message.slice(0, 1000);
}

function formatDateRange(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return "-";
    }

    const first = rows[0]?.date ?? "-";
    const last = rows[rows.length - 1]?.date ?? "-";
    return `${first} to ${last}`;
}

async function markRunFailed(client, runId, input) {
    if (!runId) {
        return;
    }

    if (input.instrumentId) {
        await client.query(
            `insert into market_data_run_items
                (run_id, instrument_id, provider, symbol, status, points_imported, actions_imported, error_message)
             values
                ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [runId, input.instrumentId, input.provider, input.symbol, "failed", 0, 0, input.errorMessage],
        );
    }

    await client.query(
        `update market_data_runs
         set status = $2,
             finished_at = now(),
             successful_symbols = 0,
             failed_symbols = 1,
             error_message = $3
         where id = $1`,
        [runId, "failed", input.errorMessage],
    );
}

async function main() {
    const { importPath, batchSize, limitPrices, limitActions } = parseCliArgs(process.argv.slice(2));

    const connectionString = resolveConnectionString();
    if (!connectionString) {
        throw new Error("Postgres-Verbindung ist nicht konfiguriert.");
    }

    const normalizedConnectionString = normalizePostgresConnectionString(connectionString);
    const raw = await readFile(importPath, "utf8");
    const payload = JSON.parse(raw);
    const { isin, provider, symbol } = validatePayload(payload);

    const instrument = payload.instrument;
    const mapping = payload.mapping;
    const rawPrices = Array.isArray(payload.prices) ? payload.prices : [];
    const rawActions = Array.isArray(payload.actions) ? payload.actions : [];

    let prices = rawPrices
        .map((point) => ({
            date: toDateString(point?.date),
            open: toNullableNumber(point?.open),
            high: toNullableNumber(point?.high),
            low: toNullableNumber(point?.low),
            close: toNullableNumber(point?.close),
            adjClose: toNullableNumber(point?.adjClose),
            volume: toNullableNumber(point?.volume),
            currency: point?.currency ? String(point.currency) : null,
        }))
        .filter((point) => point.date && point.close !== null);
    prices.sort((left, right) => left.date.localeCompare(right.date));
    if (limitPrices != null) {
        prices = prices.slice(0, limitPrices);
    }

    let actions = rawActions
        .map((action) => ({
            actionType: String(action?.actionType ?? "").trim().toLowerCase(),
            date: toDateString(action?.date),
            amount: toNullableNumber(action?.amount),
            ratio: action?.ratio ? String(action.ratio) : null,
            currency: action?.currency ? String(action.currency) : null,
        }))
        .filter((action) => action.actionType && action.date);
    actions.sort((left, right) => {
        const dateCmp = left.date.localeCompare(right.date);
        if (dateCmp !== 0) return dateCmp;
        const typeCmp = left.actionType.localeCompare(right.actionType);
        if (typeCmp !== 0) return typeCmp;
        const leftAmount = left.amount ?? Number.NEGATIVE_INFINITY;
        const rightAmount = right.amount ?? Number.NEGATIVE_INFINITY;
        if (leftAmount !== rightAmount) return leftAmount - rightAmount;
        return String(left.ratio ?? "").localeCompare(String(right.ratio ?? ""));
    });
    if (limitActions != null) {
        actions = actions.slice(0, limitActions);
    }

    const skippedPrices = rawPrices.length - prices.length;
    const skippedActions = rawActions.length - actions.length;

    console.log(`Parsed import file: ISIN ${isin}, provider ${provider}, symbol ${symbol}`);
    console.log(`Prices: ${prices.length}, Actions: ${actions.length}`);
    console.log(`Price date range: ${formatDateRange(prices)}`);
    console.log(`Batch size: ${batchSize}`);

    const pool = new Pool({
        connectionString: normalizedConnectionString,
        ssl: resolvePostgresSsl(normalizedConnectionString),
    });

    let client = null;
    let runId = null;
    let instrumentId = null;
    let failedPhase = null;
    let failedBatch = null;

    try {
        client = await pool.connect();
        await client.query(`set statement_timeout = '${DEFAULT_STATEMENT_TIMEOUT}'`);

        failedPhase = "run_create";
        const runResult = await client.query(
            `insert into market_data_runs (provider, run_type, status, requested_symbols)
             values ($1, $2, $3, $4)
             returning id`,
            [provider, "backfill", "running", 1],
        );
        runId = runResult.rows[0]?.id ?? null;

        console.log("Upserting instrument...");
        failedPhase = "instrument_upsert";
        const instrumentResult = await client.query(
            `insert into market_instruments (isin, name, asset_type, currency)
             values ($1, $2, $3, $4)
             on conflict (isin)
             do update set
                name = excluded.name,
                asset_type = excluded.asset_type,
                currency = excluded.currency,
                updated_at = now()
             returning id`,
            [isin, instrument?.name ?? null, instrument?.assetType ?? null, instrument?.currency ?? null],
        );
        instrumentId = instrumentResult.rows[0]?.id ?? null;

        console.log("Upserting mapping...");
        failedPhase = "mapping_upsert";
        await client.query(
            `insert into market_symbol_mappings
                (instrument_id, provider, symbol, exchange, currency, is_primary, is_active, notes)
             values
                ($1, $2, $3, $4, $5, $6, $7, $8)
             on conflict (provider, symbol)
             do update set
                instrument_id = excluded.instrument_id,
                exchange = excluded.exchange,
                currency = excluded.currency,
                is_primary = excluded.is_primary,
                is_active = excluded.is_active,
                notes = excluded.notes,
                updated_at = now()`,
            [
                instrumentId,
                provider,
                symbol,
                mapping?.exchange ?? null,
                mapping?.currency ?? null,
                true,
                true,
                "Imported via JSON",
            ],
        );

        const priceBatches = chunkArray(prices, batchSize);
        console.log(`Importing prices: ${prices.length} rows in ${priceBatches.length} batches of size ${batchSize}...`);
        for (let index = 0; index < priceBatches.length; index += 1) {
            const batch = priceBatches[index];
            const batchStartedAt = Date.now();
            failedPhase = "prices_upsert";
            failedBatch = {
                table: "market_prices_daily",
                index: index + 1,
                total: priceBatches.length,
                rowCount: batch.length,
                range: formatDateRange(batch),
            };

            const params = [];
            for (const point of batch) {
                params.push(
                    instrumentId,
                    provider,
                    symbol,
                    point.date,
                    point.open,
                    point.high,
                    point.low,
                    point.close,
                    point.adjClose,
                    point.volume,
                    point.currency,
                    payload.source ?? "yfinance",
                );
            }

            const valuesSql = buildValuesPlaceholders(batch.length, 12);
            await client.query(
                `insert into market_prices_daily
                    (instrument_id, provider, symbol, date, open, high, low, close, adj_close, volume, currency, source)
                 values ${valuesSql}
                 on conflict (instrument_id, provider, date)
                 do update set
                    symbol = excluded.symbol,
                    open = excluded.open,
                    high = excluded.high,
                    low = excluded.low,
                    close = excluded.close,
                    adj_close = excluded.adj_close,
                    volume = excluded.volume,
                    currency = excluded.currency,
                    source = excluded.source,
                    imported_at = now()
                 where
                    market_prices_daily.symbol is distinct from excluded.symbol
                    or market_prices_daily.open is distinct from excluded.open
                    or market_prices_daily.high is distinct from excluded.high
                    or market_prices_daily.low is distinct from excluded.low
                    or market_prices_daily.close is distinct from excluded.close
                    or market_prices_daily.adj_close is distinct from excluded.adj_close
                    or market_prices_daily.volume is distinct from excluded.volume
                    or market_prices_daily.currency is distinct from excluded.currency
                    or market_prices_daily.source is distinct from excluded.source`,
                params,
            );
            console.log(`Prices batch ${index + 1}/${priceBatches.length}: ${batch.length} rows, ${formatDateRange(batch)}... done in ${Date.now() - batchStartedAt}ms`);
        }

        const actionBatches = chunkArray(actions, batchSize);
        console.log(`Importing actions: ${actions.length} rows in ${actionBatches.length} batches of size ${batchSize}...`);
        for (let index = 0; index < actionBatches.length; index += 1) {
            const batch = actionBatches[index];
            const batchStartedAt = Date.now();
            failedPhase = "actions_upsert";
            failedBatch = {
                table: "market_actions",
                index: index + 1,
                total: actionBatches.length,
                rowCount: batch.length,
                range: formatDateRange(batch),
            };

            const params = [];
            for (const action of batch) {
                params.push(
                    instrumentId,
                    provider,
                    symbol,
                    action.actionType,
                    action.date,
                    action.amount,
                    action.ratio,
                    action.currency,
                    payload.source ?? "yfinance",
                );
            }

            const valuesSql = buildValuesPlaceholders(batch.length, 9);
            await client.query(
                `insert into market_actions
                    (instrument_id, provider, symbol, action_type, date, amount, ratio, currency, source)
                 values ${valuesSql}
                 on conflict (instrument_id, provider, action_type, date)
                 do update set
                    symbol = excluded.symbol,
                    amount = excluded.amount,
                    ratio = excluded.ratio,
                    currency = excluded.currency,
                    source = excluded.source,
                    imported_at = now()
                 where
                    market_actions.symbol is distinct from excluded.symbol
                    or market_actions.amount is distinct from excluded.amount
                    or market_actions.ratio is distinct from excluded.ratio
                    or market_actions.currency is distinct from excluded.currency
                    or market_actions.source is distinct from excluded.source`,
                params,
            );
            console.log(`Actions batch ${index + 1}/${actionBatches.length}: ${batch.length} rows, ${formatDateRange(batch)}... done in ${Date.now() - batchStartedAt}ms`);
        }

        if (runId) {
            failedPhase = "run_item_success";
            await client.query(
                `insert into market_data_run_items
                    (run_id, instrument_id, provider, symbol, status, points_imported, actions_imported, first_date, last_date)
                 values
                    ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date)`,
                [
                    runId,
                    instrumentId,
                    provider,
                    symbol,
                    "success",
                    prices.length,
                    actions.length,
                    prices.length > 0 ? prices[0].date : null,
                    prices.length > 0 ? prices[prices.length - 1].date : null,
                ],
            );

            failedPhase = "run_success";
            await client.query(
                `update market_data_runs
                 set status = $2,
                     finished_at = now(),
                     successful_symbols = $3,
                     failed_symbols = $4,
                     error_message = null
                 where id = $1`,
                [runId, "success", 1, 0],
            );
        }

        console.log(`Imported instrument ${isin} / ${symbol}`);
        console.log(`Prices imported: ${prices.length}`);
        console.log(`Prices skipped: ${skippedPrices}`);
        console.log(`Actions imported: ${actions.length}`);
        console.log(`Actions skipped: ${skippedActions}`);
        console.log(`Date range: ${prices.length > 0 ? prices[0].date : "-"} - ${prices.length > 0 ? prices[prices.length - 1].date : "-"}`);
    } catch (error) {
        const safeMessage = sanitizeErrorMessage(error);

        if (failedBatch) {
            console.error(`Import batch failed (${failedBatch.table}) batch ${failedBatch.index}/${failedBatch.total}, rows=${failedBatch.rowCount}, range=${failedBatch.range}: ${safeMessage}`);
        } else if (failedPhase) {
            console.error(`Import failed in phase ${failedPhase}: ${safeMessage}`);
        }

        if (client) {
            try {
                await markRunFailed(client, runId, {
                    instrumentId,
                    provider,
                    symbol,
                    errorMessage: safeMessage,
                });
            } catch {
                // no-op
            }
        }

        throw error;
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

main().catch((error) => {
    const safeMessage = error instanceof Error ? error.message : "Unknown import error";
    console.error(`Import failed: ${safeMessage}`);
    process.exit(1);
});
