import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unbekannter Fehler";
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {}
}

async function run() {
    const {
        getMarketDataStatusSummary,
        listMarketInstruments,
        listVerifiedMappingsForPromotion,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    const summary = await getMarketDataStatusSummary();
    const allInstruments = await listMarketInstruments({ limit: 50000 });
    const verifiedMappings = await listVerifiedMappingsForPromotion("yfinance");

    const verifiedIsins = new Set(verifiedMappings.map((item) => item.isin));
    const verifiedNonPrimary = verifiedMappings.filter((item) => !item.isPrimary);

    console.log("Market Data Status");
    console.log(`- instruments total: ${summary.instrumentsTotal}`);
    console.log(`- mappings total: ${summary.mappingsTotal}`);
    console.log(`- yfinance mappings total: ${summary.yfinanceMappingsTotal}`);
    console.log(`- verified yfinance mappings: ${summary.verifiedYfinanceMappings}`);
    console.log(`- primary yfinance mappings: ${summary.primaryYfinanceMappings}`);
    console.log(`- instruments with at least one verified yfinance mapping: ${summary.instrumentsWithVerifiedYfinance}`);
    console.log(`- instruments without any mapping: ${summary.instrumentsWithoutAnyMapping}`);
    console.log(`- instruments with mapping but no verified mapping: ${summary.instrumentsWithMappingButNoVerifiedYfinance}`);
    console.log(`- instruments with primary mapping: ${summary.instrumentsWithPrimaryYfinance}`);
    console.log(`- instruments without primary mapping: ${summary.instrumentsWithoutPrimaryYfinance}`);
    console.log(`- instruments with daily price data: ${summary.instrumentsWithDailyPrices}`);
    console.log(`- instruments with market actions: ${summary.instrumentsWithActions}`);
    console.log(`- instruments with primary mapping but no price data: ${summary.instrumentsWithPrimaryButNoPrices}`);
    console.log(`- failed validation candidates: ${summary.failedValidationCandidates}`);

    const withoutVerified = allInstruments
        .filter((item) => !verifiedIsins.has(item.isin))
        .slice(0, 20);

    if (withoutVerified.length > 0) {
        console.log("Top instruments without verified yfinance mapping (max 20):");
        for (const row of withoutVerified) {
            console.log(`- ${row.isin} | ${row.name ?? "-"}`);
        }
    }

    if (verifiedNonPrimary.length > 0) {
        console.log("Top verified mappings not primary (max 20):");
        for (const row of verifiedNonPrimary.slice(0, 20)) {
            console.log(`- ${row.isin} | ${row.symbol} | ${row.exchange ?? "-"} | ${row.currency ?? "-"}`);
        }
    }
}

run()
    .catch((error) => {
        console.error(`Statusreport fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
