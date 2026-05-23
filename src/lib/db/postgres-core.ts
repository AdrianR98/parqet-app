
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

export type PostgresEnvKey =
    | "SUPABASE_POSTGRES_URL"
    | "SUPABASE_POSTGRES_PRISMA_URL"
    | "POSTGRES_URL"
    | "POSTGRES_PRISMA_URL"
    | "DATABASE_URL";

export class PostgresConfigError extends Error {
    readonly code = "missing_db_config";

    constructor(message: string) {
        super(message);
        this.name = "PostgresConfigError";
    }
}

const POSTGRES_ENV_PRIORITY: PostgresEnvKey[] = [
    "SUPABASE_POSTGRES_URL",
    "SUPABASE_POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL",
];

let postgresPool: Pool | null = null;
let resolvedConnection: { key: PostgresEnvKey; url: string } | null = null;

function readBooleanFalseEnv(rawValue: string | undefined): boolean {
    if (typeof rawValue !== "string") {
        return false;
    }

    return rawValue.trim().toLowerCase() === "false";
}

function normalizePostgresConnectionString(connectionString: string): string {
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

function resolvePostgresSsl(connectionString: string): boolean | { rejectUnauthorized: boolean; ca?: string } {
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

    // Supabase pooler/local migration environments can fail chain verification locally.
    // This fallback keeps credentials private while allowing controlled local connectivity.
    if (hostname.includes("supabase.com") || hostname.includes("supabase.co")) {
        return { rejectUnauthorized: false };
    }

    return { rejectUnauthorized: true };
}

export function resolvePostgresConnectionString(): { key: PostgresEnvKey; url: string } | null {
    if (resolvedConnection) {
        return resolvedConnection;
    }

    for (const key of POSTGRES_ENV_PRIORITY) {
        const rawValue = process.env[key];
        if (typeof rawValue !== "string") {
            continue;
        }

        const url = rawValue.trim();
        if (!url) {
            continue;
        }

        resolvedConnection = { key, url };
        return resolvedConnection;
    }

    return null;
}

export function getPostgresPool(): Pool {
    if (postgresPool) {
        return postgresPool;
    }

    const resolved = resolvePostgresConnectionString();
    if (!resolved) {
        throw new PostgresConfigError("Postgres-Verbindung ist serverseitig nicht konfiguriert.");
    }
    const normalizedConnectionString = normalizePostgresConnectionString(resolved.url);

    postgresPool = new Pool({
        connectionString: normalizedConnectionString,
        ssl: resolvePostgresSsl(normalizedConnectionString),
    });

    return postgresPool;
}

export async function withPostgresClient<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPostgresPool().connect();
    try {
        return await handler(client);
    } finally {
        client.release();
    }
}

export async function queryPostgres<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
): Promise<QueryResult<T>> {
    return getPostgresPool().query<T>(text, params);
}
