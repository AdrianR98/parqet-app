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
        "005_market_data_requests.sql",
        "006_asset_reference_data_schema.sql",
        "007_asset_daily_prices_latest_provider_index.sql",
        "008_drop_legacy_price_table_and_redundant_indexes.sql",
        "009_trim_asset_daily_prices_before_2000.sql",
        "010_enable_rls_asset_reference_tables.sql",
        "011_expand_asset_reference_curation_model.sql",
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
