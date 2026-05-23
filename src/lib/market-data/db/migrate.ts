import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { PostgresConfigError, withPostgresClient } from "../../db/postgres";

export async function runMarketDataMigration001(): Promise<void> {
    const migrationPath = path.join(process.cwd(), "src", "lib", "market-data", "db", "migrations", "001_market_data.sql");
    const sql = await fs.readFile(migrationPath, "utf8");

    try {
        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                await client.query(sql);
                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });
    } catch (error) {
        if (error instanceof PostgresConfigError) {
            throw new Error("Postgres-Verbindung ist nicht konfiguriert.");
        }
        throw error;
    }
}

