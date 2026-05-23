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

async function main() {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
        throw new Error("Postgres-Verbindung ist nicht konfiguriert.");
    }

    const normalizedConnectionString = normalizePostgresConnectionString(connectionString);

    const pool = new Pool({
        connectionString: normalizedConnectionString,
        ssl: resolvePostgresSsl(normalizedConnectionString),
    });

    try {
        const client = await pool.connect();
        try {
            await client.query("begin");
            const instrument = await client.query(
                `insert into market_instruments (isin, name, asset_type, currency)
                 values ($1, $2, $3, $4)
                 on conflict (isin)
                 do update set
                   name = excluded.name,
                   asset_type = excluded.asset_type,
                   currency = excluded.currency,
                   updated_at = now()
                 returning id`,
                ["US7561091049", "Realty Income", "equity", "USD"],
            );

            const instrumentId = instrument.rows[0]?.id;
            if (!instrumentId) {
                throw new Error("Instrument konnte nicht gespeichert werden.");
            }

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
                    "yfinance",
                    "O",
                    "NYSE",
                    "USD",
                    true,
                    true,
                    "Initial real market-data test mapping",
                ],
            );

            await client.query("commit");
            console.log("Seeded market mapping: US7561091049 / O (yfinance)");
        } catch (error) {
            await client.query("rollback");
            throw error;
        } finally {
            client.release();
        }
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    const safeMessage = error instanceof Error ? error.message : "Unknown seed error";
    console.error(`Market seed failed: ${safeMessage}`);
    process.exit(1);
});
