import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const migrationFiles = [
        "001_market_data.sql",
        "002_market_reference_instruments.sql",
        "003_market_instrument_display_metadata.sql",
    ];

    const pool = new Pool({
        connectionString: normalizedConnectionString,
        ssl: resolvePostgresSsl(normalizedConnectionString),
    });

    const client = await pool.connect();
    try {
        for (const migrationFile of migrationFiles) {
            const migrationPath = path.join(scriptDir, "..", "src", "lib", "market-data", "db", "migrations", migrationFile);
            const sql = await readFile(migrationPath, "utf8");
            console.log(`Running market data migration ${migrationFile}...`);
            await client.query("begin");
            try {
                await client.query(sql);
                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        }
        console.log("Market data migration completed.");
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    const safeMessage = error instanceof Error ? error.message : "Unknown migration error";
    console.error(`Market data migration failed: ${safeMessage}`);
    process.exit(1);
});
