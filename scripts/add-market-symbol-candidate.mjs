import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSymbol(value) {
    return String(value ?? "").trim().toUpperCase();
}

function normalizeProvider(value) {
    return String(value ?? "yfinance").trim().toLowerCase() || "yfinance";
}

function normalizeOptionalValue(value) {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
}

function parseNumber(raw, label) {
    const value = Number(raw ?? "");
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid ${label} value.`);
    }
    return value;
}

function parseArgs(argv) {
    const options = {
        isin: null,
        symbol: null,
        provider: "yfinance",
        exchange: null,
        currency: null,
        score: 50,
        source: "manual",
        reason: null,
        write: false,
        allowExistingPrimary: false,
        allowDuplicate: false,
        showExisting: false,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--isin") {
            options.isin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--symbol") {
            options.symbol = normalizeSymbol(args.shift());
            continue;
        }
        if (token === "--provider") {
            options.provider = normalizeProvider(args.shift());
            continue;
        }
        if (token === "--exchange") {
            options.exchange = normalizeOptionalValue(args.shift());
            continue;
        }
        if (token === "--currency") {
            const value = normalizeOptionalValue(args.shift());
            options.currency = value ? value.toUpperCase() : null;
            continue;
        }
        if (token === "--score") {
            options.score = parseNumber(args.shift(), "--score");
            continue;
        }
        if (token === "--source") {
            const value = normalizeOptionalValue(args.shift());
            options.source = value ?? "manual";
            continue;
        }
        if (token === "--reason") {
            options.reason = normalizeOptionalValue(args.shift());
            continue;
        }
        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--allow-existing-primary") {
            options.allowExistingPrimary = true;
            continue;
        }
        if (token === "--allow-duplicate") {
            options.allowDuplicate = true;
            continue;
        }
        if (token === "--show-existing") {
            options.showExisting = true;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    if (!options.isin || !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Missing or invalid required --isin.");
    }
    if (!options.symbol) {
        throw new Error("Missing required --symbol.");
    }

    return options;
}

function buildNotes(options) {
    const parts = [
        `source=${options.source}`,
        `score=${options.score}`,
    ];
    if (options.reason) parts.push(`reason=${options.reason}`);
    return parts.join("; ");
}

function printResult(result) {
    console.log(`ISIN: ${result.isin}`);
    console.log(`Instrument: ${result.instrumentName}`);
    console.log(`Symbol: ${result.symbol}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Exchange: ${result.exchange ?? "-"}`);
    console.log(`Currency: ${result.currency ?? "-"}`);
    console.log(`Status: ${result.status}`);
    console.log(`Reason: ${result.reason}`);
}

function toIsoOrNull(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function printMappings(label, rows) {
    console.log("");
    console.log(`${label}: ${rows.length}`);
    if (rows.length === 0) {
        console.log("  (none)");
        return;
    }

    for (const row of rows) {
        console.log(
            `  id=${row.id ?? "-"} | isin=${row.instrument_isin ?? "-"} | instrument=${row.instrument_name ?? "-"} | provider=${row.provider} | symbol=${row.symbol} | exchange=${row.exchange ?? "-"} | currency=${row.currency ?? "-"} | primary=${row.is_primary ? "yes" : "no"} | active=${row.is_active ? "yes" : "no"} | verified_at=${toIsoOrNull(row.verified_at) ?? "-"} | notes=${row.notes ?? "-"}`,
        );
    }
}

async function loadExistingDiagnostics(queryPostgres, input) {
    const sameInstrumentSameSymbol = await queryPostgres(
        `select
            m.id,
            i.isin as instrument_isin,
            coalesce(i.display_name, i.name, '-') as instrument_name,
            m.provider,
            m.symbol,
            m.exchange,
            m.currency,
            m.is_primary,
            m.is_active,
            m.verified_at,
            m.notes
         from market_symbol_mappings m
         join market_instruments i on i.id = m.instrument_id
         where m.instrument_id = $1
           and m.provider = $2
           and m.symbol = $3
         order by m.updated_at desc, m.id asc`,
        [input.instrumentId, input.provider, input.symbol],
    );

    const sameProviderSymbolGlobal = await queryPostgres(
        `select
            m.id,
            i.isin as instrument_isin,
            coalesce(i.display_name, i.name, '-') as instrument_name,
            m.provider,
            m.symbol,
            m.exchange,
            m.currency,
            m.is_primary,
            m.is_active,
            m.verified_at,
            m.notes
         from market_symbol_mappings m
         join market_instruments i on i.id = m.instrument_id
         where m.provider = $1
           and m.symbol = $2
         order by i.isin asc, m.updated_at desc, m.id asc`,
        [input.provider, input.symbol],
    );

    const sameIsinProviderAnySymbol = await queryPostgres(
        `select
            m.id,
            i.isin as instrument_isin,
            coalesce(i.display_name, i.name, '-') as instrument_name,
            m.provider,
            m.symbol,
            m.exchange,
            m.currency,
            m.is_primary,
            m.is_active,
            m.verified_at,
            m.notes
         from market_symbol_mappings m
         join market_instruments i on i.id = m.instrument_id
         where i.isin = $1
           and m.provider = $2
         order by m.updated_at desc, m.id asc`,
        [input.isin, input.provider],
    );

    return {
        sameInstrumentSameSymbol: sameInstrumentSameSymbol.rows,
        sameProviderSymbolGlobal: sameProviderSymbolGlobal.rows,
        sameIsinProviderAnySymbol: sameIsinProviderAnySymbol.rows,
    };
}

async function closeDbPool() {
    try {
        const postgresCore = await import("../src/lib/db/postgres-core.ts");
        if (typeof postgresCore.endPostgresPool === "function") {
            await postgresCore.endPostgresPool();
            return;
        }
        if (typeof postgresCore.getPostgresPool === "function") {
            const pool = postgresCore.getPostgresPool();
            if (pool && typeof pool.end === "function") {
                await pool.end();
            }
        }
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const { getInstrumentByIsin, insertSymbolMappingCandidate } = await import("../src/lib/market-data/db/repository-core.ts");
    const { queryPostgres } = await import("../src/lib/db/postgres-core.ts");

    const instrument = await getInstrumentByIsin(options.isin);
    if (!instrument) {
        printResult({
            isin: options.isin,
            instrumentName: "-",
            symbol: options.symbol,
            provider: options.provider,
            exchange: options.exchange,
            currency: options.currency,
            status: "error",
            reason: "instrument_not_found",
        });
        process.exitCode = 1;
        return;
    }

    const instrumentName = instrument.displayName ?? instrument.name ?? "-";
    const diagnosticInput = {
        instrumentId: instrument.id,
        isin: options.isin,
        provider: options.provider,
        symbol: options.symbol,
    };

    const primaryCheck = await queryPostgres(
        `select exists (
            select 1
            from market_symbol_mappings
            where instrument_id = $1
              and provider = $2
              and is_primary = true
              and verified_at is not null
              and is_active = true
        ) as has_verified_primary`,
        [instrument.id, options.provider],
    );
    const hasVerifiedPrimary = Boolean(primaryCheck.rows[0]?.has_verified_primary);

    if (hasVerifiedPrimary && !options.allowExistingPrimary) {
        printResult({
            isin: options.isin,
            instrumentName,
            symbol: options.symbol,
            provider: options.provider,
            exchange: options.exchange,
            currency: options.currency,
            status: "skipped",
            reason: "verified_primary_exists",
        });
        return;
    }

    const duplicateCheck = await queryPostgres(
        `select exists (
            select 1
            from market_symbol_mappings
            where instrument_id = $1
              and provider = $2
              and symbol = $3
        ) as exists_duplicate`,
        [instrument.id, options.provider, options.symbol],
    );
    const hasDuplicate = Boolean(duplicateCheck.rows[0]?.exists_duplicate);

    if (hasDuplicate && !options.allowDuplicate) {
        printResult({
            isin: options.isin,
            instrumentName,
            symbol: options.symbol,
            provider: options.provider,
            exchange: options.exchange,
            currency: options.currency,
            status: "skipped",
            reason: "duplicate_candidate_exists",
        });
        const diagnostics = await loadExistingDiagnostics(queryPostgres, diagnosticInput);
        printMappings("same instrument_id + provider + symbol", diagnostics.sameInstrumentSameSymbol);
        printMappings("same provider + symbol globally", diagnostics.sameProviderSymbolGlobal);
        printMappings("same ISIN + provider (any symbol)", diagnostics.sameIsinProviderAnySymbol);
        return;
    }

    if (options.showExisting) {
        printResult({
            isin: options.isin,
            instrumentName,
            symbol: options.symbol,
            provider: options.provider,
            exchange: options.exchange,
            currency: options.currency,
            status: "planned",
            reason: "show_existing",
        });
        const diagnostics = await loadExistingDiagnostics(queryPostgres, diagnosticInput);
        printMappings("same instrument_id + provider + symbol", diagnostics.sameInstrumentSameSymbol);
        printMappings("same provider + symbol globally", diagnostics.sameProviderSymbolGlobal);
        printMappings("same ISIN + provider (any symbol)", diagnostics.sameIsinProviderAnySymbol);
        return;
    }

    if (!options.write) {
        printResult({
            isin: options.isin,
            instrumentName,
            symbol: options.symbol,
            provider: options.provider,
            exchange: options.exchange,
            currency: options.currency,
            status: "planned",
            reason: "dry_run",
        });
        return;
    }

    const inserted = await insertSymbolMappingCandidate({
        instrumentId: instrument.id,
        provider: options.provider,
        symbol: options.symbol,
        exchange: options.exchange,
        currency: options.currency,
        notes: buildNotes(options),
    });

    printResult({
        isin: options.isin,
        instrumentName,
        symbol: options.symbol,
        provider: options.provider,
        exchange: options.exchange,
        currency: options.currency,
        status: inserted ? "written" : "skipped",
        reason: inserted ? "inserted_candidate" : "duplicate_on_write",
    });
    if (!inserted) {
        const diagnostics = await loadExistingDiagnostics(queryPostgres, diagnosticInput);
        printMappings("same instrument_id + provider + symbol", diagnostics.sameInstrumentSameSymbol);
        printMappings("same provider + symbol globally", diagnostics.sameProviderSymbolGlobal);
        printMappings("same ISIN + provider (any symbol)", diagnostics.sameIsinProviderAnySymbol);
    }
}

run()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Manual candidate insert failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
