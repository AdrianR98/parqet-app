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
        listReferenceSourceCounts,
        listVerifiedMappingsForPromotion,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    const summary = await getMarketDataStatusSummary();
    const allInstruments = await listMarketInstruments({ limit: 50000 });
    const sourceCounts = await listReferenceSourceCounts();
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
    console.log(`- instruments with WKN: ${allInstruments.filter((item) => item.wkn && item.wkn.trim()).length}`);
    console.log(`- instruments with display_name: ${allInstruments.filter((item) => item.displayName && item.displayName.trim()).length}`);
    console.log(`- instruments with name_source: ${allInstruments.filter((item) => item.nameSource && item.nameSource.trim()).length}`);
    console.log(`- instruments with display_name_source: ${allInstruments.filter((item) => item.displayNameSource && item.displayNameSource.trim()).length}`);
    console.log(`- instruments with name_source=trading_universe: ${allInstruments.filter((item) => item.nameSource === "trading_universe").length}`);
    console.log(`- instruments with display_name_source=trading_universe: ${allInstruments.filter((item) => item.displayNameSource === "trading_universe").length}`);

    if (sourceCounts.length > 0) {
        console.log("- reference source counts:");
        for (const item of sourceCounts) {
            console.log(`  - ${item.sourceKey}: ${item.rowCount}`);
        }
    }

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
