import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const VALID_STATUS = new Set(["active", "excluded", "legacy", "derivative", "unknown"]);

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSymbol(value) {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized || null;
}

function parseArgs(argv) {
    const options = {
        isin: null,
        status: null,
        reason: null,
        successorIsin: null,
        successorSymbol: null,
        write: false,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--isin") {
            options.isin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--status") {
            options.status = String(args.shift() ?? "").trim().toLowerCase();
            continue;
        }
        if (token === "--reason") {
            const value = String(args.shift() ?? "").trim();
            options.reason = value || null;
            continue;
        }
        if (token === "--successor-isin") {
            const value = normalizeIsin(args.shift());
            options.successorIsin = value || null;
            continue;
        }
        if (token === "--successor-symbol") {
            options.successorSymbol = normalizeSymbol(args.shift());
            continue;
        }
        if (token === "--write") {
            options.write = true;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    if (!options.isin || !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Missing or invalid required --isin.");
    }
    if (!options.status || !VALID_STATUS.has(options.status)) {
        throw new Error("Missing or invalid required --status.");
    }
    if (options.successorIsin && !/^[A-Z0-9]{12}$/.test(options.successorIsin)) {
        throw new Error("Invalid --successor-isin.");
    }

    return options;
}

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

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        if (typeof endPostgresPool === "function") await endPostgresPool();
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const { getMarketInstrumentStatusByIsin, updateMarketInstrumentStatus } = await import("../src/lib/market-data/db/repository-core.ts");

    const before = await getMarketInstrumentStatusByIsin(options.isin);
    if (!before) {
        throw new Error(`Instrument not found for ISIN ${options.isin}.`);
    }

    printState("Before", before);

    if (!options.write) {
        console.log("Status update mode: dry-run");
        if (options.status === "active" && (options.successorIsin || options.successorSymbol)) {
            console.log("Note: successor fields are cleared for status=active.");
        }
        console.log(`Planned: status=${options.status} reason=${options.reason ?? "-"} successor_isin=${options.successorIsin ?? "-"} successor_symbol=${options.successorSymbol ?? "-"}`);
        return;
    }

    const after = await updateMarketInstrumentStatus({
        isin: options.isin,
        status: options.status,
        reason: options.reason,
        successorIsin: options.successorIsin,
        successorSymbol: options.successorSymbol,
    });

    if (!after) {
        throw new Error(`Instrument not found during update for ISIN ${options.isin}.`);
    }

    printState("After", after);
    console.log("Status update mode: --write applied");
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
