import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { PostgresConfigError, withPostgresClient } from "../../db/postgres";

async function runMarketDataMigrationFile(fileName: string): Promise<void> {
    const migrationPath = path.join(process.cwd(), "src", "lib", "market-data", "db", "migrations", fileName);
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

export async function runMarketDataMigration001(): Promise<void> {
    await runMarketDataMigrationFile("001_market_data.sql");
}

export async function runMarketDataMigration002(): Promise<void> {
    await runMarketDataMigrationFile("002_market_reference_instruments.sql");
}

export async function runMarketDataMigrations(): Promise<void> {
    await runMarketDataMigration001();
    await runMarketDataMigration002();
    await runMarketDataMigrationFile("003_market_instrument_display_metadata.sql");
    await runMarketDataMigrationFile("004_market_instrument_status.sql");
}

