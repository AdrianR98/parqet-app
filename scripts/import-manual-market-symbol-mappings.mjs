import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const DEFAULT_PROVIDER = "yfinance";

function printHelp() {
    console.log("Usage: npm run db:market:import:manual-mappings -- <file> [flags]");
    console.log("");
    console.log("Flags:");
    console.log("  --write                 Apply DB writes (default is dry-run)");
    console.log("  --force                 Allow overriding verified/primary safeguards");
    console.log("  --limit <n>             Limit processed entries");
    console.log("  --isin <A,B,...>        Process only selected ISINs");
    console.log("  --provider <provider>   Provider override/filter (default yfinance)");
    console.log("  --help                  Show this help");
}

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSymbol(value) {
    return String(value ?? "").trim().toUpperCase();
}

function normalizeProvider(value) {
    return String(value ?? DEFAULT_PROVIDER).trim().toLowerCase() || DEFAULT_PROVIDER;
}

function normalizeOptional(value) {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
}

function normalizeCurrency(value) {
    const normalized = normalizeOptional(value);
    return normalized ? normalized.toUpperCase() : null;
}

function parseLimit(value) {
    const parsed = Number(value ?? "");
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid --limit value.");
    }
    return parsed;
}

function parseIsinSet(value) {
    const set = new Set();
    for (const part of String(value ?? "").split(",")) {
        const isin = normalizeIsin(part);
        if (isin) set.add(isin);
    }
    return set;
}

function parseArgs(argv) {
    const options = {
        filePath: null,
        write: false,
        force: false,
        limit: null,
        isinFilter: null,
        provider: DEFAULT_PROVIDER,
        help: false,
    };

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
            continue;
        }

        if (token === "--force") {
            options.force = true;
            continue;
        }

        if (token === "--limit") {
            options.limit = parseLimit(args.shift());
            continue;
        }

        if (token === "--isin") {
            options.isinFilter = parseIsinSet(args.shift());
            continue;
        }

        if (token === "--provider") {
            options.provider = normalizeProvider(args.shift());
            continue;
        }

        if (token.startsWith("--")) {
            throw new Error(`Unknown argument: ${token}`);
        }

        if (!options.filePath) {
            options.filePath = token;
            continue;
        }

        throw new Error(`Unexpected argument: ${token}`);
    }

    if (!options.help && !options.filePath) {
        throw new Error("Missing required input file path.");
    }

    return options;
}

function ensureProviderSupported(provider) {
    if (provider !== DEFAULT_PROVIDER) {
        throw new Error(`Unsupported provider: ${provider}. Supported providers: ${DEFAULT_PROVIDER}`);
    }
}

function parseJsonRoot(input) {
    if (Array.isArray(input)) return input;
    if (input && typeof input === "object" && Array.isArray(input.mappings)) {
        return input.mappings;
    }
    throw new Error("Input must be an array or an object with { mappings: [...] }.");
}

function buildNotes(entry) {
    const flags = [
        "manual_mapping",
        "source=manual-symbol-mappings",
        `manualReview=${entry.manualReview ? "true" : "false"}`,
        `skipValidation=${entry.skipValidation ? "true" : "false"}`,
    ];

    if (entry.name) {
        flags.push(`name=${entry.name.slice(0, 120)}`);
    }

    if (entry.notes) {
        flags.push(entry.notes);
    }

    return flags.join("; ").slice(0, 2000);
}

function validateEntry(raw, defaultProvider) {
    const isin = normalizeIsin(raw?.isin);
    if (!/^[A-Z0-9]{12}$/.test(isin)) {
        return { ok: false, reason: "invalid_isin" };
    }

    const provider = normalizeProvider(raw?.provider ?? defaultProvider);
    if (!provider) return { ok: false, reason: "missing_provider" };

    if (provider !== defaultProvider) {
        return { ok: false, reason: `provider_not_allowed:${provider}` };
    }

    const symbol = normalizeSymbol(raw?.symbol);
    if (!symbol) {
        return { ok: false, reason: "missing_symbol" };
    }

    const currency = normalizeCurrency(raw?.currency);
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
        return { ok: false, reason: "invalid_currency" };
    }

    return {
        ok: true,
        value: {
            isin,
            name: normalizeOptional(raw?.name),
            provider,
            symbol,
            exchange: normalizeOptional(raw?.exchange),
            currency,
            notes: normalizeOptional(raw?.notes),
            isPrimary: raw?.isPrimary === true,
            skipValidation: raw?.skipValidation === true,
            manualReview: raw?.manualReview === true,
        },
    };
}

function determineAction(ctx) {
    if (!ctx.instrument) {
        return { action: "invalid", reason: "instrument_not_found" };
    }

    if (ctx.globalSymbolMapping && ctx.globalSymbolMapping.instrumentId !== ctx.instrument.id) {
        return { action: "invalid", reason: "provider_symbol_used_by_other_isin" };
    }

    const targetBySymbol = ctx.sameIsinProviderMappings.find((row) => row.symbol === ctx.entry.symbol);
    const target = targetBySymbol ?? ctx.sameIsinProviderMappings[0] ?? null;

    if (!target) {
        return { action: "insert", reason: "no_existing_isin_provider_mapping", target: null };
    }

    const isProtected = Boolean(target.verifiedAt) || Boolean(target.isPrimary);
    if (isProtected && !ctx.force) {
        if (target.isPrimary) {
            return { action: "skip_existing_primary", reason: "existing_primary_protected", target };
        }
        return { action: "skip_existing_verified", reason: "existing_verified_protected", target };
    }

    if (isProtected && ctx.force) {
        return { action: "would_force_update", reason: target.isPrimary ? "force_overrides_primary" : "force_overrides_verified", target };
    }

    return { action: "update_unverified", reason: "replace_unverified_mapping", target };
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    ensureProviderSupported(options.provider);

    const absolutePath = path.resolve(process.cwd(), options.filePath);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw);
    const rootMappings = parseJsonRoot(parsed);

    const {
        getInstrumentByIsin,
        getSymbolMappingsByIsin,
        getSymbolMappingByProviderSymbol,
        insertManualSymbolMapping,
        updateSymbolMappingById,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    const summary = {
        loaded: rootMappings.length,
        plannedInserts: 0,
        plannedUpdates: 0,
        skippedExistingVerified: 0,
        skippedExistingPrimary: 0,
        wouldForceUpdate: 0,
        invalidEntries: 0,
        written: 0,
    };

    let processed = 0;

    for (const rawEntry of rootMappings) {
        const validation = validateEntry(rawEntry, options.provider);
        if (!validation.ok) {
            summary.invalidEntries += 1;
            const fallbackIsin = normalizeIsin(rawEntry?.isin) || "-";
            const fallbackSymbol = normalizeSymbol(rawEntry?.symbol) || "-";
            console.log(`${fallbackIsin} | ${fallbackSymbol} | invalid | ${validation.reason}`);
            continue;
        }

        const entry = validation.value;
        if (options.isinFilter && options.isinFilter.size > 0 && !options.isinFilter.has(entry.isin)) {
            continue;
        }

        if (options.limit && processed >= options.limit) {
            break;
        }

        processed += 1;

        const instrument = await getInstrumentByIsin(entry.isin);
        const sameIsinProviderMappings = instrument ? await getSymbolMappingsByIsin(entry.isin, entry.provider) : [];
        const globalSymbolMapping = await getSymbolMappingByProviderSymbol(entry.provider, entry.symbol);

        const decision = determineAction({
            entry,
            instrument,
            sameIsinProviderMappings,
            globalSymbolMapping,
            force: options.force,
        });

        if (decision.action === "insert") summary.plannedInserts += 1;
        if (decision.action === "update_unverified") summary.plannedUpdates += 1;
        if (decision.action === "skip_existing_verified") summary.skippedExistingVerified += 1;
        if (decision.action === "skip_existing_primary") summary.skippedExistingPrimary += 1;
        if (decision.action === "would_force_update") summary.wouldForceUpdate += 1;
        if (decision.action === "invalid") summary.invalidEntries += 1;

        console.log(`${entry.isin} | ${entry.symbol} | ${decision.action} | ${decision.reason}`);

        if (!options.write) {
            continue;
        }

        if (decision.action === "insert") {
            const inserted = await insertManualSymbolMapping({
                instrumentId: instrument.id,
                provider: entry.provider,
                symbol: entry.symbol,
                exchange: entry.exchange,
                currency: entry.currency,
                isPrimary: entry.isPrimary,
                isActive: true,
                verifiedAt: null,
                notes: buildNotes(entry),
            });
            if (inserted) summary.written += 1;
            continue;
        }

        if (decision.action === "update_unverified" || decision.action === "would_force_update") {
            const updated = await updateSymbolMappingById({
                id: decision.target.id,
                symbol: entry.symbol,
                exchange: entry.exchange,
                currency: entry.currency,
                isPrimary: entry.isPrimary,
                isActive: true,
                notes: buildNotes(entry),
            });
            if (updated) summary.written += 1;
        }
    }

    console.log("Summary:");
    console.log(`- loaded: ${summary.loaded}`);
    console.log(`- planned inserts: ${summary.plannedInserts}`);
    console.log(`- planned updates: ${summary.plannedUpdates}`);
    console.log(`- skipped existing verified: ${summary.skippedExistingVerified}`);
    console.log(`- skipped existing primary: ${summary.skippedExistingPrimary}`);
    console.log(`- would force update: ${summary.wouldForceUpdate}`);
    console.log(`- invalid entries: ${summary.invalidEntries}`);
    console.log(`- written: ${options.write ? summary.written : 0}`);
    if (!options.write) {
        console.log("- mode: dry-run (use --write to apply changes)");
    }
}

run()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Manual mapping import failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
