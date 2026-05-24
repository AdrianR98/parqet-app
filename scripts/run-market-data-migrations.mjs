import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
    const { withPostgresClient } = await import("../src/lib/db/postgres-core.ts");

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const migrationFiles = [
        "001_market_data.sql",
        "002_market_reference_instruments.sql",
        "003_market_instrument_display_metadata.sql",
        "004_market_instrument_status.sql",
    ];

    await withPostgresClient(async (client) => {
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
    });
}

main().catch((error) => {
    const safeMessage = error instanceof Error ? error.message : "Unknown migration error";
    console.error(`Market data migration failed: ${safeMessage}`);
    process.exit(1);
});
