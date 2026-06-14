import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parsePositiveInt(raw, flagName) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid ${flagName} value: ${raw}`);
    }
    return parsed;
}

function parseArgs(argv) {
    const options = {
        write: false,
        isin: null,
        limit: null,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--isin") {
            options.isin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--limit") {
            options.limit = parsePositiveInt(args.shift(), "--limit");
            continue;
        }
        if (token === "--help") {
            console.log("Usage: npm run db:market:hydrate-metadata -- [--write] [--isin <ISIN>] [--limit <N>]");
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    return options;
}

function summarizeMetadataCounts(instruments) {
    const hasValue = (value) => typeof value === "string" && value.trim() && value.trim() !== "0";
    return {
        totalAssets: instruments.length,
        hasWkn: instruments.filter((item) => hasValue(item.wkn)).length,
        hasName: instruments.filter((item) => hasValue(item.name)).length,
        hasDisplayName: instruments.filter((item) => hasValue(item.displayName)).length,
        hasAssetType: instruments.filter((item) => hasValue(item.assetType)).length,
        hasCurrency: instruments.filter((item) => hasValue(item.currency)).length,
    };
}

function printCounts(label, counts) {
    console.log(`${label}:`);
    console.log(`- total assets: ${counts.totalAssets}`);
    console.log(`- has_wkn: ${counts.hasWkn}`);
    console.log(`- has_name: ${counts.hasName}`);
    console.log(`- has_display_name: ${counts.hasDisplayName}`);
    console.log(`- has_asset_type: ${counts.hasAssetType}`);
    console.log(`- has_currency: ${counts.hasCurrency}`);
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const {
        enrichMarketInstrumentsFromReferences,
        enrichMarketInstrumentsFromTradingUniverse,
        listMarketInstruments,
        listTradingUniverseReferenceMatches,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    const allInstruments = await listMarketInstruments({ limit: options.limit ?? 50000 });
    const scopedInstruments = allInstruments.filter((instrument) => !options.isin || instrument.isin === options.isin);
    const beforeCounts = summarizeMetadataCounts(scopedInstruments);

    console.log("Market Metadata Hydration");
    console.log(`- mode: ${options.write ? "write" : "dry-run"}`);
    printCounts("before", beforeCounts);

    const tradingUniverseMatches = await listTradingUniverseReferenceMatches({
        isin: options.isin ?? undefined,
        limit: options.limit ?? undefined,
        setDisplayName: true,
    });

    const tradingPreview = {
        matched: tradingUniverseMatches.length,
        nameUpdates: tradingUniverseMatches.filter((item) => item.plannedNameUpdate).length,
        displayNameUpdates: tradingUniverseMatches.filter((item) => item.plannedDisplayNameUpdate).length,
        skippedExistingBetter: tradingUniverseMatches.filter((item) => item.existingBetter).length,
    };

    console.log("planned/trading_universe:");
    console.log(`- matched: ${tradingPreview.matched}`);
    console.log(`- name_updates: ${tradingPreview.nameUpdates}`);
    console.log(`- display_name_updates: ${tradingPreview.displayNameUpdates}`);
    console.log(`- skipped_existing_better: ${tradingPreview.skippedExistingBetter}`);

    if (!options.write) {
        console.log("write summary: skipped (dry-run)");
        return;
    }

    const referenceWrite = await enrichMarketInstrumentsFromReferences({
        isin: options.isin ?? undefined,
        limit: options.limit ?? undefined,
    });
    const tradingWrite = await enrichMarketInstrumentsFromTradingUniverse({
        isin: options.isin ?? undefined,
        limit: options.limit ?? undefined,
        setDisplayName: true,
    });

    const afterAllInstruments = await listMarketInstruments({ limit: options.limit ?? 50000 });
    const afterScopedInstruments = afterAllInstruments.filter((instrument) => !options.isin || instrument.isin === options.isin);
    const afterCounts = summarizeMetadataCounts(afterScopedInstruments);

    console.log("write/reference_candidates:");
    console.log(`- matched: ${referenceWrite.matched}`);
    console.log(`- updated: ${referenceWrite.updated}`);
    console.log(`- wkn_updates: ${referenceWrite.wknUpdates}`);
    console.log(`- currency_updates: ${referenceWrite.currencyUpdates}`);
    console.log(`- asset_type_updates: ${referenceWrite.assetTypeUpdates}`);
    console.log(`- name_updates: ${referenceWrite.nameUpdates}`);

    console.log("write/trading_universe:");
    console.log(`- matched: ${tradingWrite.matched}`);
    console.log(`- updated: ${tradingWrite.updated}`);
    console.log(`- name_updates: ${tradingWrite.nameUpdates}`);
    console.log(`- display_name_updates: ${tradingWrite.displayNameUpdates}`);
    console.log(`- skipped_existing_better: ${tradingWrite.skippedExistingBetter}`);

    printCounts("after", afterCounts);
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
