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

function normalizeOptionalText(value) {
    const v = String(value ?? "").trim();
    return v ? v : null;
}

function appendNotes(existing, additions) {
    const base = normalizeOptionalText(existing);
    const extra = additions.filter(Boolean).join("; ");
    if (!base) return extra || null;
    if (!extra) return base;
    return `${base} | ${extra}`.slice(0, 2000);
}

function parseArgs(argv) {
    const options = {
        fromIsin: null,
        toIsin: null,
        provider: "yfinance",
        symbol: null,
        write: false,
        makePrimary: true,
        deactivateSource: true,
        copyValidation: true,
        reason: null,
        allowTargetPrimary: false,
        allowTargetExistingSymbol: false,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--from-isin") {
            options.fromIsin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--to-isin") {
            options.toIsin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--provider") {
            options.provider = normalizeProvider(args.shift());
            continue;
        }
        if (token === "--symbol") {
            options.symbol = normalizeSymbol(args.shift());
            continue;
        }
        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--make-primary") {
            options.makePrimary = true;
            continue;
        }
        if (token === "--no-make-primary") {
            options.makePrimary = false;
            continue;
        }
        if (token === "--deactivate-source") {
            options.deactivateSource = true;
            continue;
        }
        if (token === "--no-deactivate-source") {
            options.deactivateSource = false;
            continue;
        }
        if (token === "--copy-validation") {
            options.copyValidation = true;
            continue;
        }
        if (token === "--no-copy-validation") {
            options.copyValidation = false;
            continue;
        }
        if (token === "--reason") {
            options.reason = normalizeOptionalText(args.shift());
            continue;
        }
        if (token === "--allow-target-primary") {
            options.allowTargetPrimary = true;
            continue;
        }
        if (token === "--allow-target-existing-symbol") {
            options.allowTargetExistingSymbol = true;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    if (!options.fromIsin || !/^[A-Z0-9]{12}$/.test(options.fromIsin)) {
        throw new Error("Missing or invalid required --from-isin.");
    }
    if (!options.toIsin || !/^[A-Z0-9]{12}$/.test(options.toIsin)) {
        throw new Error("Missing or invalid required --to-isin.");
    }
    if (!options.symbol) {
        throw new Error("Missing required --symbol.");
    }

    return options;
}

function printHeader(options) {
    console.log(`From ISIN: ${options.fromIsin}`);
    console.log(`To ISIN: ${options.toIsin}`);
    console.log(`Provider: ${options.provider}`);
    console.log(`Symbol: ${options.symbol}`);
    console.log(`Mode: ${options.write ? "write" : "dry-run"}`);
}

function printRow(label, row) {
    if (!row) {
        console.log(`${label}: -`);
        return;
    }
    const name = row.display_name ?? row.name ?? "-";
    console.log(`${label}: ${row.isin} | ${name}`);
}

function printMapping(label, row) {
    if (!row) {
        console.log(`${label}: -`);
        return;
    }
    console.log(
        `${label}: id=${row.id} | isin=${row.owner_isin ?? "-"} | instrument=${row.owner_name ?? "-"} | instrument_id=${row.instrument_id} | provider=${row.provider} | symbol=${row.symbol} | exchange=${row.exchange ?? "-"} | currency=${row.currency ?? "-"} | primary=${row.is_primary ? "yes" : "no"} | active=${row.is_active ? "yes" : "no"} | verified_at=${row.verified_at ?? "-"}`,
    );
}

function printMappings(label, rows) {
    console.log(`${label}: ${rows.length}`);
    if (rows.length === 0) {
        console.log("  (none)");
        return;
    }
    for (const row of rows) {
        printMapping("  row", row);
    }
}

async function loadDiagnostics(queryPostgres, options, fromInstrument) {
    const baseSelect = `select
            m.id,
            m.instrument_id,
            i.isin as owner_isin,
            coalesce(i.display_name, i.name, '-') as owner_name,
            m.provider,
            m.symbol,
            m.exchange,
            m.currency,
            m.is_primary,
            m.is_active,
            m.verified_at,
            m.notes
         from market_symbol_mappings m
         join market_instruments i on i.id = m.instrument_id`;

    const sameFromInstrument = await queryPostgres(
        `${baseSelect}
         where m.instrument_id = $1
           and m.provider = $2
           and m.symbol = $3
         order by m.updated_at desc, m.id asc`,
        [fromInstrument.id, options.provider, options.symbol],
    );

    const sameProviderSymbolGlobal = await queryPostgres(
        `${baseSelect}
         where m.provider = $1
           and m.symbol = $2
         order by m.updated_at desc, m.id asc`,
        [options.provider, options.symbol],
    );

    const sameFromIsinAnySymbol = await queryPostgres(
        `${baseSelect}
         where i.isin = $1
           and m.provider = $2
         order by m.updated_at desc, m.id asc`,
        [options.fromIsin, options.provider],
    );

    const sameTargetIsinAnySymbol = await queryPostgres(
        `${baseSelect}
         where i.isin = $1
           and m.provider = $2
         order by m.updated_at desc, m.id asc`,
        [options.toIsin, options.provider],
    );

    return {
        sameFromInstrument: sameFromInstrument.rows,
        sameProviderSymbolGlobal: sameProviderSymbolGlobal.rows,
        sameFromIsinAnySymbol: sameFromIsinAnySymbol.rows,
        sameTargetIsinAnySymbol: sameTargetIsinAnySymbol.rows,
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
    const { queryPostgres, withPostgresClient } = await import("../src/lib/db/postgres-core.ts");

    printHeader(options);

    const instrumentsResult = await queryPostgres(
        `select id, isin, name, display_name
         from market_instruments
         where isin = any($1::text[])
         order by isin asc`,
        [[options.fromIsin, options.toIsin]],
    );

    const fromInstrument = instrumentsResult.rows.find((r) => r.isin === options.fromIsin) ?? null;
    const toInstrument = instrumentsResult.rows.find((r) => r.isin === options.toIsin) ?? null;

    printRow("Source instrument", fromInstrument);
    printRow("Target instrument", toInstrument);

    if (!fromInstrument || !toInstrument) {
        throw new Error("Source or target instrument not found.");
    }

    const diagnostics = await loadDiagnostics(queryPostgres, options, fromInstrument);
    let sourceMapping = diagnostics.sameFromInstrument[0] ?? null;
    if (!sourceMapping) {
        const globalRows = diagnostics.sameProviderSymbolGlobal;
        if (globalRows.length === 1) {
            const owner = globalRows[0];
            if (owner.owner_isin === options.fromIsin) {
                sourceMapping = owner;
            } else {
                printMapping("Global symbol owner", owner);
                throw new Error(`Symbol is owned by different ISIN: ${owner.owner_isin}`);
            }
        } else if (globalRows.length > 1) {
            printMappings("same provider + symbol globally", globalRows);
            throw new Error("Ambiguous global symbol mapping");
        }
    }

    printMapping("Source mapping", sourceMapping);

    if (!sourceMapping) {
        printMappings("same from instrument + provider + symbol", diagnostics.sameFromInstrument);
        printMappings("same provider + symbol globally", diagnostics.sameProviderSymbolGlobal);
        printMappings("same from ISIN + provider (any symbol)", diagnostics.sameFromIsinAnySymbol);
        printMappings("same target ISIN + provider (any symbol)", diagnostics.sameTargetIsinAnySymbol);
        throw new Error("Source mapping not found for from-isin/provider/symbol.");
    }

    const targetMappingsResult = await queryPostgres(
        `select id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active, verified_at, notes
         from market_symbol_mappings
         where instrument_id = $1
           and provider = $2
         order by updated_at desc, symbol asc`,
        [toInstrument.id, options.provider],
    );

    const targetMappings = targetMappingsResult.rows;
    const targetVerifiedPrimary = targetMappings.find((row) => row.is_primary && row.is_active && row.verified_at);

    if (targetVerifiedPrimary && !options.allowTargetPrimary) {
        console.log("Status: skipped");
        console.log("Reason: target_verified_primary_exists");
        printMapping("Target verified primary", targetVerifiedPrimary);
        return;
    }

    const globalRows = diagnostics.sameProviderSymbolGlobal;
    const globalOther = globalRows.find((row) => row.instrument_id !== fromInstrument.id && row.instrument_id !== toInstrument.id) ?? null;
    if (globalOther) {
        console.log("Status: skipped");
        console.log("Reason: symbol_in_use_by_other_instrument");
        printMapping("Conflicting mapping", globalOther);
        return;
    }

    const targetExistingSameSymbol = targetMappings.find((row) => row.symbol === options.symbol) ?? null;
    if (targetExistingSameSymbol && !options.allowTargetExistingSymbol) {
        console.log("Status: skipped");
        console.log("Reason: target_existing_symbol_mapping");
        printMapping("Target symbol mapping", targetExistingSameSymbol);
        return;
    }

    const reasonText = options.reason ?? "mapping transfer";
    console.log(`Planned transfer to ${options.toIsin}`);
    console.log(`Source mapping id: ${sourceMapping.id}`);
    console.log(`Source mapping owner: ${sourceMapping.owner_isin ?? "-"}`);
    console.log("Planned change:");
    console.log("- transfer mapping to target instrument");
    console.log(`- make_primary=${options.makePrimary ? "yes" : "no"}`);
    console.log(`- copy_validation=${options.copyValidation ? "yes" : "no"}`);
    console.log(`- deactivate_source=${options.deactivateSource ? "yes" : "no"}`);

    if (!options.write) {
        console.log("Status: planned");
        console.log("Reason: dry_run");
        return;
    }

    const outcome = await withPostgresClient(async (client) => {
        await client.query("begin");
        try {
            const lockResult = await client.query(
                `select id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active, verified_at, notes
                 from market_symbol_mappings
                 where id = $1
                 for update`,
                [sourceMapping.id],
            );
            const locked = lockResult.rows[0];
            if (!locked) {
                throw new Error("Source mapping disappeared during transfer.");
            }
            if (locked.instrument_id !== fromInstrument.id) {
                throw new Error("Source mapping no longer attached to from instrument.");
            }

            if (options.makePrimary) {
                await client.query(
                    `update market_symbol_mappings
                     set is_primary = false,
                         updated_at = now()
                     where instrument_id = $1
                       and provider = $2`,
                    [toInstrument.id, options.provider],
                );
            }

            const transferredNotes = appendNotes(locked.notes, [
                `transferred_from=${options.fromIsin}`,
                `transferred_to=${options.toIsin}`,
                `source_mapping_id=${locked.id}`,
                `reason=${reasonText}`,
            ]);

            const verifiedAt = options.copyValidation ? locked.verified_at ?? null : null;

            await client.query(
                `update market_symbol_mappings
                 set instrument_id = $1,
                     exchange = $2,
                     currency = $3,
                     is_primary = $4,
                     is_active = true,
                     verified_at = $5,
                     notes = $6,
                     updated_at = now()
                 where id = $7`,
                [
                    toInstrument.id,
                    locked.exchange ?? null,
                    locked.currency ?? null,
                    options.makePrimary,
                    verifiedAt,
                    transferredNotes,
                    locked.id,
                ],
            );

            let sourceDeactivated = false;
            if (options.deactivateSource && false) {
                sourceDeactivated = true;
            }

            const afterResult = await client.query(
                `select id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active, verified_at, notes
                 from market_symbol_mappings
                 where id = $1`,
                [locked.id],
            );

            await client.query("commit");
            return {
                mappingAfter: afterResult.rows[0] ?? null,
                sourceDeactivated,
            };
        } catch (error) {
            await client.query("rollback");
            throw error;
        }
    });

    console.log("Status: written");
    console.log("Reason: mapping_transferred");
    printMapping("Transferred mapping", outcome.mappingAfter);
    console.log(`Source mapping deactivated: ${outcome.sourceDeactivated ? "yes" : "no (in-place transfer)"}`);
}

run()
    .catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Mapping transfer failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
