import nextEnv from "@next/env";
import {
    buildStatusUpdatePlan,
    parseStatusCliArgs,
    STATUS_HELP_TEXT,
} from "../src/lib/market-data/cli/market-instrument-status-cli.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function printState(label, row) {
    if (!row) {
        console.log(`${label}: -`);
        return;
    }
    console.log(`${label}:`);
    console.log(`  isin=${row.isin}`);
    console.log(`  name=${row.displayName ?? row.name ?? "-"}`);
    console.log(`  market_data_status=${row.marketDataStatus ?? "-"}`);
    console.log(`  market_data_status_reason=${row.marketDataStatusReason ?? "-"}`);
    console.log(`  market_data_successor_isin=${row.marketDataSuccessorIsin ?? "-"}`);
    console.log(`  market_data_successor_symbol=${row.marketDataSuccessorSymbol ?? "-"}`);
    console.log(`  market_data_status_updated_at=${row.marketDataStatusUpdatedAt ?? "-"}`);
}

function printPlanned(plan) {
    if (plan.changes.length === 0) {
        console.log("No changes planned.");
        return;
    }

    console.log("Planned updates:");
    for (const change of plan.changes) {
        console.log(`  ${change.field}: ${change.before ?? "-"} -> ${change.after ?? "-"}`);
    }
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        if (typeof endPostgresPool === "function") await endPostgresPool();
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseStatusCliArgs(process.argv.slice(2));
    if (options.help) {
        console.log(STATUS_HELP_TEXT);
        return;
    }
    const { getInstrumentByIsin, updateMarketInstrumentStatus } = await import("../src/lib/market-data/db/repository-core.ts");

    const before = await getInstrumentByIsin(options.isin);
    if (!before) {
        throw new Error(`Instrument not found for ISIN ${options.isin}.`);
    }

    printState("Before", before);
    const plan = buildStatusUpdatePlan(before, options);
    printPlanned(plan);
    if (options.force) {
        console.log("Note: --force currently has no additional effect for status updates.");
    }

    if (!options.write) {
        console.log("Dry-run mode: no database changes were applied. Add --write to apply.");
        return;
    }

    if (plan.changes.length === 0) {
        return;
    }

    const after = await updateMarketInstrumentStatus({
        isin: options.isin,
        status: plan.next.status,
        reason: plan.next.reason,
        successorIsin: plan.next.successorIsin,
        successorSymbol: plan.next.successorSymbol,
    });

    if (!after) {
        throw new Error(`Instrument not found during update for ISIN ${options.isin}.`);
    }

    printState("After", after);
    console.log("Write mode: status update applied.");
}

run()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Set instrument status failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
