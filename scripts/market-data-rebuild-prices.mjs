import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parseListArg(targetSet, rawValue) {
    if (!rawValue) return;
    for (const part of String(rawValue).split(",")) {
        const normalized = normalizeIsin(part);
        if (normalized) targetSet.add(normalized);
    }
}

function parseArgs(argv) {
    const options = {
        write: false,
        resetPrices: false,
        resetYfinancePrices: false,
        compact: false,
        continueOnError: false,
        help: false,
        limit: null,
        isin: null,
        excludeIsins: new Set(),
        period: null,
        provider: "yfinance",
        batchSize: null,
        python: null,
    };

    const passthrough = [];
    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--help") {
            options.help = true;
            continue;
        }
        if (token === "--write") {
            options.write = true;
            passthrough.push(token);
            continue;
        }
        if (token === "--reset-prices") {
            options.resetPrices = true;
            continue;
        }
        if (token === "--reset-yfinance-prices") {
            options.resetYfinancePrices = true;
            continue;
        }
        if (token === "--compact") {
            options.compact = true;
            passthrough.push(token);
            continue;
        }
        if (token === "--continue-on-error") {
            options.continueOnError = true;
            passthrough.push(token);
            continue;
        }
        if (token === "--limit") {
            const value = args.shift();
            options.limit = value;
            passthrough.push(token, value);
            continue;
        }
        if (token === "--isin") {
            const value = args.shift();
            options.isin = normalizeIsin(value);
            passthrough.push(token, value);
            continue;
        }
        if (token === "--exclude-isin") {
            const value = args.shift();
            parseListArg(options.excludeIsins, value);
            passthrough.push(token, value);
            continue;
        }
        if (token === "--period") {
            const value = args.shift();
            options.period = value;
            passthrough.push(token, value);
            continue;
        }
        if (token === "--provider") {
            const value = String(args.shift() ?? "yfinance").trim().toLowerCase();
            options.provider = value || "yfinance";
            passthrough.push(token, value);
            continue;
        }
        if (token === "--batch-size") {
            const value = args.shift();
            options.batchSize = value;
            passthrough.push(token, value);
            continue;
        }
        if (token === "--python") {
            const value = args.shift();
            options.python = value;
            passthrough.push(token, value);
            continue;
        }

        passthrough.push(token);
    }

    options.passthrough = passthrough;
    return options;
}

function printHelp() {
    console.log("db:market:rebuild-prices");
    console.log("- default: dry-run full rebuild plan from current primary mappings");
    console.log("- --write requires --reset-prices or --reset-yfinance-prices");
    console.log("- destructive reset deletes yfinance asset_daily_prices for the selected primary-mapping scope before importing full history");
    console.log("- asset_daily_prices is treated as rebuildable cache; primary mappings remain source of truth");
}

function runTsxScript(scriptRelativePath, args) {
    return new Promise((resolve, reject) => {
        const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
        const child = spawn(process.execPath, [tsxCliPath, scriptRelativePath, ...args], {
            cwd: process.cwd(),
            stdio: "inherit",
            env: process.env,
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Delegated command failed (${scriptRelativePath}, exit ${code})`));
        });
    });
}

async function deletePlannedPriceRows({ provider, isin, excludeIsins, limit }) {
    const { deleteDailyPricesForPrimaryMappings, listPrimaryMappingsForBackfill } = await import("../src/lib/market-data/db/repository-core.ts");
    let planned = await listPrimaryMappingsForBackfill(provider, isin ?? undefined);
    planned = planned.filter((row) => !excludeIsins.has(normalizeIsin(row.isin)));
    if (limit != null) {
        const numericLimit = Number(limit);
        if (Number.isFinite(numericLimit) && numericLimit > 0) {
            planned = planned.slice(0, Math.floor(numericLimit));
        }
    }

    const deleted = [];
    for (const row of planned) {
        const result = await deleteDailyPricesForPrimaryMappings({
            provider,
            isin: row.isin,
        });
        deleted.push({ isin: row.isin, deletedPriceRows: result.deletedPriceRows });
    }

    return {
        plannedCount: planned.length,
        deletedCount: deleted.reduce((sum, row) => sum + row.deletedPriceRows, 0),
    };
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const backfillArgs = ["--force", ...options.passthrough];
    if (!options.write) {
        await runTsxScript("scripts/backfill-primary-market-data.mjs", backfillArgs);
        return;
    }

    if (!options.resetPrices && !options.resetYfinancePrices) {
        throw new Error("db:market:rebuild-prices refuses --write without --reset-prices or --reset-yfinance-prices.");
    }

    const resetSummary = await deletePlannedPriceRows({
        provider: options.provider,
        isin: options.isin,
        excludeIsins: options.excludeIsins,
        limit: options.limit,
    });
    console.log("Price reset summary:");
    console.log(`- provider: ${options.provider}`);
    console.log(`- planned primary mappings reset: ${resetSummary.plannedCount}`);
    console.log(`- deleted price rows: ${resetSummary.deletedCount}`);

    await runTsxScript("scripts/backfill-primary-market-data.mjs", backfillArgs);
}

export { parseArgs };

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectExecution) {
    run().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
