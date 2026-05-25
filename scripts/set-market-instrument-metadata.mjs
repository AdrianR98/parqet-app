import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const HELP_TEXT = `Set market instrument metadata (safe by default).

Usage:
  npm run db:market:set:instrument-metadata -- --isin <ISIN> [flags]

Required:
  --isin <ISIN>

Optional fields:
  --name <name>
  --display-name <displayName>
  --asset-type <assetType>
  --currency <currency>
  --wkn <wkn>

Safety / mode:
  --force   Allow overwriting meaningful existing values
  --write   Apply DB update (default is dry-run)
  --help    Show this help
`;

const PLACEHOLDER_VALUES = new Set(["", "unknown", "n/a", "undefined", "null"]);

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeText(value) {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function normalizeAssetType(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toLowerCase() : null;
}

function normalizeCurrency(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
}

function parseArgs(argv) {
    const options = {
        isin: null,
        name: undefined,
        displayName: undefined,
        assetType: undefined,
        currency: undefined,
        wkn: undefined,
        force: false,
        write: false,
        help: false,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--isin") {
            options.isin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--name") {
            options.name = normalizeText(args.shift());
            continue;
        }
        if (token === "--display-name") {
            options.displayName = normalizeText(args.shift());
            continue;
        }
        if (token === "--asset-type") {
            options.assetType = normalizeAssetType(args.shift());
            continue;
        }
        if (token === "--currency") {
            options.currency = normalizeCurrency(args.shift());
            continue;
        }
        if (token === "--wkn") {
            options.wkn = normalizeText(args.shift());
            continue;
        }
        if (token === "--force") {
            options.force = true;
            continue;
        }
        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--help") {
            options.help = true;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    if (options.help) {
        return options;
    }

    if (!options.isin || !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Missing or invalid required --isin.");
    }

    if (options.currency != null && !/^[A-Z]{3}$/.test(options.currency)) {
        throw new Error("Invalid --currency. Expected uppercase 3-letter code (for example EUR).");
    }

    const providedFieldCount = ["name", "displayName", "assetType", "currency", "wkn"].reduce(
        (count, key) => count + (Object.hasOwn(options, key) && options[key] !== undefined ? 1 : 0),
        0,
    );

    if (providedFieldCount === 0) {
        throw new Error("No metadata field provided. Pass at least one of --name, --display-name, --asset-type, --currency, --wkn.");
    }

    return options;
}

function isPlaceholder(value, isin) {
    if (value == null) return true;
    const normalized = String(value).trim();
    if (!normalized) return true;
    const lowered = normalized.toLowerCase();
    if (PLACEHOLDER_VALUES.has(lowered)) return true;
    return normalized.toUpperCase() === isin;
}

function isMeaningful(value, isin) {
    return !isPlaceholder(value, isin);
}

function printState(label, row) {
    if (!row) {
        console.log(`${label}: -`);
        return;
    }

    console.log(`${label}:`);
    console.log(`  isin=${row.isin}`);
    console.log(`  name=${row.name ?? "-"}`);
    console.log(`  display_name=${row.displayName ?? "-"}`);
    console.log(`  asset_type=${row.assetType ?? "-"}`);
    console.log(`  currency=${row.currency ?? "-"}`);
    console.log(`  wkn=${row.wkn ?? "-"}`);
    console.log(`  metadata_source=${row.metadataSource ?? "-"}`);
    console.log(`  metadata_updated_at=${row.metadataUpdatedAt ?? "-"}`);
    console.log(`  name_source=${row.nameSource ?? "-"}`);
    console.log(`  display_name_source=${row.displayNameSource ?? "-"}`);
    console.log(`  display_metadata_updated_at=${row.displayMetadataUpdatedAt ?? "-"}`);
    console.log(`  updated_at=${row.updatedAt ?? "-"}`);
}

function printPlanned(planned, warnings) {
    if (planned.length === 0) {
        console.log("No changes planned.");
        return;
    }

    console.log("Planned updates:");
    for (const item of planned) {
        console.log(`  ${item.field}: ${item.before ?? "-"} -> ${item.after ?? "-"}`);
    }

    if (warnings.length > 0) {
        console.log("Warnings:");
        for (const warning of warnings) {
            console.log(`  - ${warning}`);
        }
    }
}

function buildPlan(before, options) {
    const planned = [];
    const warnings = [];
    const input = {
        isin: options.isin,
    };

    const candidates = [
        { key: "name", dbKey: "name" },
        { key: "displayName", dbKey: "displayName" },
        { key: "assetType", dbKey: "assetType" },
        { key: "currency", dbKey: "currency" },
        { key: "wkn", dbKey: "wkn" },
    ];

    for (const candidate of candidates) {
        if (!Object.hasOwn(options, candidate.key) || options[candidate.key] === undefined) {
            continue;
        }

        const nextValue = options[candidate.key];
        const currentValue = before[candidate.dbKey] ?? null;

        if (nextValue == null) {
            warnings.push(`Skipped ${candidate.key}: empty value is not allowed.`);
            continue;
        }

        if (currentValue === nextValue) {
            continue;
        }

        const shouldProtect =
            !options.force &&
            (candidate.key === "name" || candidate.key === "displayName" || candidate.key === "assetType" || candidate.key === "currency" || candidate.key === "wkn") &&
            isMeaningful(currentValue, options.isin);

        if (shouldProtect) {
            warnings.push(
                `Skipped ${candidate.key}: existing value \"${currentValue}\" is meaningful. Re-run with --force to overwrite.`,
            );
            continue;
        }

        input[candidate.key] = nextValue;
        planned.push({
            field: candidate.key,
            before: currentValue,
            after: nextValue,
        });
    }

    if (Object.hasOwn(input, "name") || Object.hasOwn(input, "displayName") || Object.hasOwn(input, "assetType") || Object.hasOwn(input, "currency") || Object.hasOwn(input, "wkn")) {
        input.metadataSource = "manual_cli";
    }

    if (Object.hasOwn(input, "name")) {
        input.nameSource = "manual_cli";
    }

    if (Object.hasOwn(input, "displayName")) {
        input.displayNameSource = "manual_cli";
    }

    return { planned, warnings, input };
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

    if (options.help) {
        console.log(HELP_TEXT);
        return;
    }

    const { getInstrumentByIsin, updateMarketInstrumentMetadata } = await import("../src/lib/market-data/db/repository-core.ts");
    const before = await getInstrumentByIsin(options.isin);

    if (!before) {
        throw new Error(`Instrument not found for ISIN ${options.isin}.`);
    }

    printState("Before", before);

    const { planned, warnings, input } = buildPlan(before, options);

    if (!options.write) {
        console.log("Metadata update mode: dry-run");
        printPlanned(planned, warnings);
        return;
    }

    if (planned.length === 0) {
        printPlanned(planned, warnings);
        return;
    }

    const after = await updateMarketInstrumentMetadata(input);
    if (!after) {
        throw new Error(`Instrument not found during update for ISIN ${options.isin}.`);
    }

    printPlanned(planned, warnings);
    printState("After", after);
    console.log("Metadata update mode: --write applied");
}

run()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Set instrument metadata failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
