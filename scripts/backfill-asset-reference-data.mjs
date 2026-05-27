import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unknown error";
}

function parseArgs(argv) {
    return {
        dryRun: argv.includes("--dry-run"),
    };
}

function toInt(value) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

async function closeDbPool() {
    try {
        const db = await import("../src/lib/db/postgres-core.ts");
        if (typeof db.endPostgresPool === "function") {
            await db.endPostgresPool();
        }
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const { withPostgresClient } = await import("../src/lib/db/postgres-core.ts");

    const summary = {
        dryRun: options.dryRun,
        sources: {
            marketInstruments: 0,
            marketSymbolMappings: 0,
            marketPricesDaily: 0,
            marketActions: 0,
            marketDataRuns: 0,
            marketDataRunItems: 0,
            marketDataRequests: 0,
            marketReferenceSources: 0,
            marketReferenceInstruments: 0,
        },
        targets: {
            assets: { inserted: 0, updated: 0 },
            assetSymbolMappings: { inserted: 0, updated: 0 },
            assetDailyPrices: { inserted: 0, updated: 0 },
            referenceDataSources: { inserted: 0, updated: 0 },
            referenceDataImportRuns: { inserted: 0, updated: 0 },
            referenceDataImportRunItems: { inserted: 0, updated: 0 },
            referenceDataRequestLogs: { inserted: 0, updated: 0 },
            dividendEvents: { inserted: 0, updated: 0 },
            corporateActionEvents: { inserted: 0, updated: 0 },
        },
        skipped: {
            unresolvedSymbolMappings: 0,
            unresolvedPrices: 0,
            unresolvedActions: 0,
            unresolvedRunItems: 0,
            unresolvedReferenceInstruments: 0,
            actionUnknownType: 0,
            actionDividendNoExDate: 0,
            actionCorporateNoEffectiveDate: 0,
        },
        warnings: [],
    };

    await withPostgresClient(async (client) => {
        await client.query("begin");
        try {
            const sourceCountsResult = await client.query(
                `select
                    (select count(*) from market_instruments) as market_instruments,
                    (select count(*) from market_symbol_mappings) as market_symbol_mappings,
                    (select count(*) from market_prices_daily) as market_prices_daily,
                    (select count(*) from market_actions) as market_actions,
                    (select count(*) from market_data_runs) as market_data_runs,
                    (select count(*) from market_data_run_items) as market_data_run_items,
                    (select count(*) from market_data_requests) as market_data_requests,
                    (select count(*) from market_reference_sources) as market_reference_sources,
                    (select count(*) from market_reference_instruments) as market_reference_instruments`,
            );
            const sourceRow = sourceCountsResult.rows[0] ?? {};
            summary.sources.marketInstruments = toInt(sourceRow.market_instruments);
            summary.sources.marketSymbolMappings = toInt(sourceRow.market_symbol_mappings);
            summary.sources.marketPricesDaily = toInt(sourceRow.market_prices_daily);
            summary.sources.marketActions = toInt(sourceRow.market_actions);
            summary.sources.marketDataRuns = toInt(sourceRow.market_data_runs);
            summary.sources.marketDataRunItems = toInt(sourceRow.market_data_run_items);
            summary.sources.marketDataRequests = toInt(sourceRow.market_data_requests);
            summary.sources.marketReferenceSources = toInt(sourceRow.market_reference_sources);
            summary.sources.marketReferenceInstruments = toInt(sourceRow.market_reference_instruments);

            await client.query(
                `insert into reference_data_sources
                    (provider, source_name, source_type, source_reference, reliability, created_at, updated_at)
                 select
                    lower(split_part(source_key, ':', 1)) as provider,
                    coalesce(nullif(display_name, ''), source_key) as source_name,
                    coalesce(nullif(source_type, ''), 'legacy_reference') as source_type,
                    file_name as source_reference,
                    notes as reliability,
                    coalesce(imported_at, now()) as created_at,
                    now() as updated_at
                 from market_reference_sources
                 on conflict (provider, source_name)
                 do update set
                    source_type = excluded.source_type,
                    source_reference = excluded.source_reference,
                    reliability = excluded.reliability,
                    updated_at = now()`,
            );
            await client.query(
                `insert into reference_data_sources
                    (provider, source_name, source_type, source_reference, reliability, created_at, updated_at)
                 values
                    ('parqet_runtime', 'runtime_asset_discovery', 'legacy_request_log', 'market_data_requests', null, now(), now())
                 on conflict (provider, source_name)
                 do update set
                    updated_at = now()`,
            );

            const sourceCountNew = await client.query(`select count(*) as count from reference_data_sources`);
            summary.targets.referenceDataSources.inserted = toInt(sourceCountNew.rows[0]?.count);

            await client.query(
                `insert into reference_data_sources
                    (provider, source_name, source_type, source_reference, reliability, created_at, updated_at)
                 select distinct
                    lower(provider),
                    'legacy-market-data-runs:' || lower(provider),
                    'legacy_market_run',
                    'market_data_runs',
                    null,
                    now(),
                    now()
                 from market_data_runs
                 where provider is not null
                 on conflict (provider, source_name)
                 do update set
                    updated_at = now()`,
            );

            const assetsBackfill = await client.query(
                `with up as (
                    insert into assets
                        (asset_key_type, asset_key_value, isin, wkn, display_name, asset_type, currency, exchange, created_at, updated_at)
                    select
                        'isin',
                        upper(regexp_replace(i.isin, '\\s+', '', 'g')),
                        upper(regexp_replace(i.isin, '\\s+', '', 'g')),
                        i.wkn,
                        i.display_name,
                        i.asset_type,
                        i.currency,
                        null,
                        coalesce(i.created_at, now()),
                        now()
                    from market_instruments i
                    where i.isin is not null
                      and upper(regexp_replace(i.isin, '\\s+', '', 'g')) ~ '^[A-Z0-9]{12}$'
                    on conflict (asset_key_type, asset_key_value)
                    do update set
                        isin = excluded.isin,
                        wkn = coalesce(assets.wkn, excluded.wkn),
                        display_name = coalesce(assets.display_name, excluded.display_name),
                        asset_type = coalesce(assets.asset_type, excluded.asset_type),
                        currency = coalesce(assets.currency, excluded.currency),
                        updated_at = now()
                    returning (xmax = 0) as inserted
                )
                select
                    count(*) filter (where inserted) as inserted,
                    count(*) filter (where not inserted) as updated
                from up`,
            );
            summary.targets.assets.inserted = toInt(assetsBackfill.rows[0]?.inserted);
            summary.targets.assets.updated = toInt(assetsBackfill.rows[0]?.updated);

            const unresolvedMappingsResult = await client.query(
                `select count(*) as count
                 from market_symbol_mappings m
                 join market_instruments i on i.id = m.instrument_id
                 left join assets a
                   on a.asset_key_type = 'isin'
                  and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                 where a.id is null`,
            );
            summary.skipped.unresolvedSymbolMappings = toInt(unresolvedMappingsResult.rows[0]?.count);

            const symbolMappingsUpdate = await client.query(
                `update asset_symbol_mappings asm
                 set
                    asset_id = src.asset_id,
                    currency = src.currency,
                    is_primary = src.is_primary,
                    is_active = src.is_active,
                    verified_at = src.verified_at,
                    updated_at = now()
                 from (
                    select
                        a.id as asset_id,
                        lower(m.provider) as provider,
                        upper(m.symbol) as provider_symbol,
                        m.exchange,
                        m.currency,
                        m.is_primary,
                        m.is_active,
                        m.verified_at
                    from market_symbol_mappings m
                    join market_instruments i on i.id = m.instrument_id
                    join assets a
                      on a.asset_key_type = 'isin'
                     and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                 ) src
                 where asm.provider = src.provider
                   and asm.provider_symbol = src.provider_symbol
                   and coalesce(asm.exchange, '') = coalesce(src.exchange, '')`,
            );
            const symbolMappingsInsert = await client.query(
                `insert into asset_symbol_mappings
                    (asset_id, provider, provider_symbol, exchange, currency, is_primary, is_active, verified_at, created_at, updated_at)
                 select
                    src.asset_id,
                    src.provider,
                    src.provider_symbol,
                    src.exchange,
                    src.currency,
                    src.is_primary,
                    src.is_active,
                    src.verified_at,
                    now(),
                    now()
                 from (
                    select
                        a.id as asset_id,
                        lower(m.provider) as provider,
                        upper(m.symbol) as provider_symbol,
                        m.exchange,
                        m.currency,
                        m.is_primary,
                        m.is_active,
                        m.verified_at
                    from market_symbol_mappings m
                    join market_instruments i on i.id = m.instrument_id
                    join assets a
                      on a.asset_key_type = 'isin'
                     and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                 ) src
                 where not exists (
                    select 1
                    from asset_symbol_mappings asm
                    where asm.provider = src.provider
                      and asm.provider_symbol = src.provider_symbol
                      and coalesce(asm.exchange, '') = coalesce(src.exchange, '')
                 )`,
            );
            summary.targets.assetSymbolMappings.inserted = symbolMappingsInsert.rowCount ?? 0;
            summary.targets.assetSymbolMappings.updated = symbolMappingsUpdate.rowCount ?? 0;

            const unresolvedPricesResult = await client.query(
                `select count(*) as count
                 from market_prices_daily p
                 join market_instruments i on i.id = p.instrument_id
                 left join assets a
                   on a.asset_key_type = 'isin'
                  and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                 where a.id is null`,
            );
            summary.skipped.unresolvedPrices = toInt(unresolvedPricesResult.rows[0]?.count);

            const pricesBackfill = await client.query(
                `with up as (
                    insert into asset_daily_prices
                        (asset_id, provider, price_date, price_timestamp, open_price, high_price, low_price, close_price, adjusted_close_price, volume, currency, source_run_id, created_at, updated_at)
                    select
                        a.id as asset_id,
                        lower(p.provider) as provider,
                        p.date as price_date,
                        null::timestamptz as price_timestamp,
                        p.open as open_price,
                        p.high as high_price,
                        p.low as low_price,
                        p.close as close_price,
                        p.adj_close as adjusted_close_price,
                        p.volume,
                        p.currency,
                        null::uuid as source_run_id,
                        coalesce(p.imported_at, now()) as created_at,
                        now() as updated_at
                    from market_prices_daily p
                    join market_instruments i on i.id = p.instrument_id
                    join assets a
                      on a.asset_key_type = 'isin'
                     and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    on conflict (asset_id, provider, price_date)
                    do update set
                        price_timestamp = excluded.price_timestamp,
                        open_price = excluded.open_price,
                        high_price = excluded.high_price,
                        low_price = excluded.low_price,
                        close_price = excluded.close_price,
                        adjusted_close_price = excluded.adjusted_close_price,
                        volume = excluded.volume,
                        currency = excluded.currency,
                        updated_at = now()
                    returning (xmax = 0) as inserted
                )
                select
                    count(*) filter (where inserted) as inserted,
                    count(*) filter (where not inserted) as updated
                from up`,
            );
            summary.targets.assetDailyPrices.inserted = toInt(pricesBackfill.rows[0]?.inserted);
            summary.targets.assetDailyPrices.updated = toInt(pricesBackfill.rows[0]?.updated);

            const runsBackfill = await client.query(
                `with up as (
                    insert into reference_data_import_runs
                        (id, source_id, import_type, status, started_at, finished_at, requested_by, parameters_json, summary_json, created_at)
                    select
                        r.id,
                        s.id as source_id,
                        coalesce(r.run_type, 'legacy_market_run') as import_type,
                        coalesce(r.status, 'unknown') as status,
                        r.started_at,
                        r.finished_at,
                        null::text as requested_by,
                        null::jsonb as parameters_json,
                        jsonb_build_object(
                            'requested_symbols', r.requested_symbols,
                            'successful_symbols', r.successful_symbols,
                            'failed_symbols', r.failed_symbols,
                            'error_message', r.error_message,
                            'legacy_table', 'market_data_runs'
                        ) as summary_json,
                        coalesce(r.started_at, now()) as created_at
                    from market_data_runs r
                    join reference_data_sources s
                      on s.provider = lower(r.provider)
                     and s.source_name = ('legacy-market-data-runs:' || lower(r.provider))
                    on conflict (id)
                    do update set
                        source_id = excluded.source_id,
                        import_type = excluded.import_type,
                        status = excluded.status,
                        started_at = excluded.started_at,
                        finished_at = excluded.finished_at,
                        requested_by = excluded.requested_by,
                        parameters_json = excluded.parameters_json,
                        summary_json = excluded.summary_json
                    returning (xmax = 0) as inserted
                )
                select
                    count(*) filter (where inserted) as inserted,
                    count(*) filter (where not inserted) as updated
                from up`,
            );
            summary.targets.referenceDataImportRuns.inserted = toInt(runsBackfill.rows[0]?.inserted);
            summary.targets.referenceDataImportRuns.updated = toInt(runsBackfill.rows[0]?.updated);

            const unresolvedRunItemsResult = await client.query(
                `select count(*) as count
                 from market_data_run_items ri
                 left join market_instruments i on i.id = ri.instrument_id
                 left join assets a
                   on a.asset_key_type = 'isin'
                  and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                 where ri.instrument_id is not null
                   and a.id is null`,
            );
            summary.skipped.unresolvedRunItems = toInt(unresolvedRunItemsResult.rows[0]?.count);

            const runItemsBackfill = await client.query(
                `with up as (
                    insert into reference_data_import_run_items
                        (id, run_id, asset_id, provider_symbol, item_type, status, message, raw_payload_reference, raw_payload_hash, created_at)
                    select
                        ri.id,
                        ri.run_id,
                        a.id as asset_id,
                        upper(ri.symbol) as provider_symbol,
                        'legacy_market_run_item'::text as item_type,
                        coalesce(ri.status, 'unknown') as status,
                        ri.error_message as message,
                        null::text as raw_payload_reference,
                        md5(concat_ws('|', ri.run_id::text, ri.id::text, coalesce(ri.symbol, ''), coalesce(ri.status, ''), coalesce(ri.error_message, ''))) as raw_payload_hash,
                        coalesce(r.started_at, now()) as created_at
                    from market_data_run_items ri
                    left join market_data_runs r on r.id = ri.run_id
                    left join market_instruments i on i.id = ri.instrument_id
                    left join assets a
                      on a.asset_key_type = 'isin'
                     and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    where exists (select 1 from reference_data_import_runs nr where nr.id = ri.run_id)
                    on conflict (id)
                    do update set
                        run_id = excluded.run_id,
                        asset_id = excluded.asset_id,
                        provider_symbol = excluded.provider_symbol,
                        item_type = excluded.item_type,
                        status = excluded.status,
                        message = excluded.message,
                        raw_payload_reference = excluded.raw_payload_reference,
                        raw_payload_hash = excluded.raw_payload_hash,
                        created_at = excluded.created_at
                    returning (xmax = 0) as inserted
                )
                select
                    count(*) filter (where inserted) as inserted,
                    count(*) filter (where not inserted) as updated
                from up`,
            );
            summary.targets.referenceDataImportRunItems.inserted = toInt(runItemsBackfill.rows[0]?.inserted);
            summary.targets.referenceDataImportRunItems.updated = toInt(runItemsBackfill.rows[0]?.updated);

            const requestLogsBackfill = await client.query(
                `with src as (
                    select
                        s.id as source_id,
                        'parqet_runtime'::text as provider,
                        'asset_discovery'::text as request_type,
                        upper(regexp_replace(r.isin, '\\s+', '', 'g')) as request_key,
                        coalesce(r.status, 'pending') as status,
                        coalesce(r.last_seen_at, r.created_at, now()) as requested_at,
                        null::integer as duration_ms,
                        r.notes as error_message,
                        md5(concat_ws('|', upper(regexp_replace(r.isin, '\\s+', '', 'g')), coalesce(r.status, ''), coalesce(r.last_seen_at::text, ''))) as response_hash,
                        r.source as cache_key
                    from market_data_requests r
                    join reference_data_sources s
                      on s.provider = 'parqet_runtime'
                     and s.source_name = 'runtime_asset_discovery'
                    where upper(regexp_replace(r.isin, '\\s+', '', 'g')) ~ '^[A-Z0-9]{12}$'
                ),
                up as (
                    insert into reference_data_request_logs
                        (source_id, provider, request_type, request_key, status, requested_at, duration_ms, error_message, response_hash, cache_key)
                    select
                        source_id,
                        provider,
                        request_type,
                        request_key,
                        status,
                        requested_at,
                        duration_ms,
                        error_message,
                        response_hash,
                        cache_key
                    from src
                    where not exists (
                        select 1
                        from reference_data_request_logs t
                        where t.provider = src.provider
                          and t.request_type = src.request_type
                          and t.request_key = src.request_key
                          and t.status = src.status
                          and t.requested_at = src.requested_at
                    )
                    returning true
                )
                select
                    count(*) as inserted,
                    0::int as updated
                from up`,
            );
            summary.targets.referenceDataRequestLogs.inserted = toInt(requestLogsBackfill.rows[0]?.inserted);
            summary.targets.referenceDataRequestLogs.updated = toInt(requestLogsBackfill.rows[0]?.updated);

            const unresolvedActionsResult = await client.query(
                `select count(*) as count
                 from market_actions a
                 join market_instruments i on i.id = a.instrument_id
                 left join assets s
                   on s.asset_key_type = 'isin'
                  and s.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                 where s.id is null`,
            );
            summary.skipped.unresolvedActions = toInt(unresolvedActionsResult.rows[0]?.count);

            const actionTypeStats = await client.query(
                `select
                    count(*) filter (where lower(action_type) in ('dividend', 'capital_gain') and date is null) as dividend_no_date,
                    count(*) filter (where lower(action_type) in ('split', 'reverse_split', 'merger', 'spin_off', 'spinoff', 'corporate_action') and date is null) as corporate_no_date,
                    count(*) filter (where lower(action_type) not in ('dividend', 'capital_gain', 'split', 'reverse_split', 'merger', 'spin_off', 'spinoff', 'corporate_action')) as unknown_type
                 from market_actions`,
            );
            summary.skipped.actionDividendNoExDate = toInt(actionTypeStats.rows[0]?.dividend_no_date);
            summary.skipped.actionCorporateNoEffectiveDate = toInt(actionTypeStats.rows[0]?.corporate_no_date);
            summary.skipped.actionUnknownType = toInt(actionTypeStats.rows[0]?.unknown_type);

            const dividendsUpdate = await client.query(
                `update dividend_events de
                 set
                    pay_date = null,
                    record_date = null,
                    declaration_date = null,
                    confidence = null,
                    updated_at = now()
                 from (
                    select
                        s.id as asset_id,
                        lower(a.provider) as provider,
                        a.date as ex_date,
                        a.amount,
                        a.currency
                    from market_actions a
                    join market_instruments i on i.id = a.instrument_id
                    join assets s on s.asset_key_type = 'isin' and s.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    where lower(a.action_type) in ('dividend', 'capital_gain')
                      and a.date is not null
                 ) src
                 where de.asset_id = src.asset_id
                   and de.provider = src.provider
                   and de.ex_date = src.ex_date
                   and de.amount is not distinct from src.amount
                   and coalesce(de.currency, '') = coalesce(src.currency, '')`,
            );
            const dividendsInsert = await client.query(
                `insert into dividend_events
                    (asset_id, provider, ex_date, pay_date, record_date, declaration_date, amount, currency, source_run_id, confidence, created_at, updated_at)
                 select
                    src.asset_id,
                    src.provider,
                    src.ex_date,
                    null::date,
                    null::date,
                    null::date,
                    src.amount,
                    src.currency,
                    null::uuid,
                    null::text,
                    now(),
                    now()
                 from (
                    select
                        s.id as asset_id,
                        lower(a.provider) as provider,
                        a.date as ex_date,
                        a.amount,
                        a.currency
                    from market_actions a
                    join market_instruments i on i.id = a.instrument_id
                    join assets s on s.asset_key_type = 'isin' and s.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    where lower(a.action_type) in ('dividend', 'capital_gain')
                      and a.date is not null
                 ) src
                 where not exists (
                    select 1
                    from dividend_events de
                    where de.asset_id = src.asset_id
                      and de.provider = src.provider
                      and de.ex_date = src.ex_date
                      and de.amount is not distinct from src.amount
                      and coalesce(de.currency, '') = coalesce(src.currency, '')
                 )`,
            );
            summary.targets.dividendEvents.inserted = dividendsInsert.rowCount ?? 0;
            summary.targets.dividendEvents.updated = dividendsUpdate.rowCount ?? 0;

            const corporateActionsUpdate = await client.query(
                `update corporate_action_events cae
                 set
                    announced_date = null,
                    ratio_from = null,
                    ratio_to = null,
                    cash_component = src.cash_component,
                    currency = src.currency,
                    confidence = null,
                    updated_at = now()
                 from (
                    select
                        s.id as asset_id,
                        lower(a.provider) as provider,
                        lower(a.action_type) as action_type,
                        a.date as effective_date,
                        a.amount as cash_component,
                        a.currency
                    from market_actions a
                    join market_instruments i on i.id = a.instrument_id
                    join assets s on s.asset_key_type = 'isin' and s.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    where lower(a.action_type) in ('split', 'reverse_split', 'merger', 'spin_off', 'spinoff', 'corporate_action')
                      and a.date is not null
                 ) src
                 where cae.asset_id = src.asset_id
                   and cae.provider = src.provider
                   and cae.action_type = src.action_type
                   and cae.effective_date = src.effective_date
                   and cae.successor_asset_id is null`,
            );
            const corporateActionsInsert = await client.query(
                `insert into corporate_action_events
                    (asset_id, provider, action_type, effective_date, announced_date, ratio_from, ratio_to, cash_component, currency, successor_asset_id, source_run_id, confidence, created_at, updated_at)
                 select
                    src.asset_id,
                    src.provider,
                    src.action_type,
                    src.effective_date,
                    null::date,
                    null::numeric,
                    null::numeric,
                    src.cash_component,
                    src.currency,
                    null::uuid,
                    null::uuid,
                    null::text,
                    now(),
                    now()
                 from (
                    select
                        s.id as asset_id,
                        lower(a.provider) as provider,
                        lower(a.action_type) as action_type,
                        a.date as effective_date,
                        a.amount as cash_component,
                        a.currency
                    from market_actions a
                    join market_instruments i on i.id = a.instrument_id
                    join assets s on s.asset_key_type = 'isin' and s.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    where lower(a.action_type) in ('split', 'reverse_split', 'merger', 'spin_off', 'spinoff', 'corporate_action')
                      and a.date is not null
                 ) src
                 where not exists (
                    select 1
                    from corporate_action_events cae
                    where cae.asset_id = src.asset_id
                      and cae.provider = src.provider
                      and cae.action_type = src.action_type
                      and cae.effective_date = src.effective_date
                      and cae.successor_asset_id is null
                 )`,
            );
            summary.targets.corporateActionEvents.inserted = corporateActionsInsert.rowCount ?? 0;
            summary.targets.corporateActionEvents.updated = corporateActionsUpdate.rowCount ?? 0;

            const unresolvedReferenceInstrumentsResult = await client.query(
                `select count(*) as count
                 from market_reference_instruments r
                 where r.isin is null
                    or upper(regexp_replace(coalesce(r.isin, ''), '\\s+', '', 'g')) !~ '^[A-Z0-9]{12}$'`,
            );
            summary.skipped.unresolvedReferenceInstruments = toInt(unresolvedReferenceInstrumentsResult.rows[0]?.count);

            if (summary.skipped.actionUnknownType > 0) {
                summary.warnings.push(`Skipped ${summary.skipped.actionUnknownType} market_actions rows with unresolved action_type.`);
            }
            if (summary.skipped.actionDividendNoExDate > 0) {
                summary.warnings.push(`Skipped ${summary.skipped.actionDividendNoExDate} dividend-like market_actions rows without date.`);
            }
            if (summary.skipped.actionCorporateNoEffectiveDate > 0) {
                summary.warnings.push(`Skipped ${summary.skipped.actionCorporateNoEffectiveDate} corporate-action-like market_actions rows without date.`);
            }
            if (summary.skipped.unresolvedReferenceInstruments > 0) {
                summary.warnings.push(`Skipped ${summary.skipped.unresolvedReferenceInstruments} market_reference_instruments rows without safe asset mapping.`);
            }

            if (options.dryRun) {
                await client.query("rollback");
            } else {
                await client.query("commit");
            }
        } catch (error) {
            await client.query("rollback");
            throw error;
        }
    });

    console.log(`Mode: ${summary.dryRun ? "dry-run" : "write"}`);
    console.log("Source rows read:");
    console.log(`- market_instruments: ${summary.sources.marketInstruments}`);
    console.log(`- market_symbol_mappings: ${summary.sources.marketSymbolMappings}`);
    console.log(`- market_prices_daily: ${summary.sources.marketPricesDaily}`);
    console.log(`- market_actions: ${summary.sources.marketActions}`);
    console.log(`- market_data_runs: ${summary.sources.marketDataRuns}`);
    console.log(`- market_data_run_items: ${summary.sources.marketDataRunItems}`);
    console.log(`- market_data_requests: ${summary.sources.marketDataRequests}`);
    console.log(`- market_reference_sources: ${summary.sources.marketReferenceSources}`);
    console.log(`- market_reference_instruments: ${summary.sources.marketReferenceInstruments}`);

    console.log("Target upserts:");
    console.log(`- assets: inserted=${summary.targets.assets.inserted} updated=${summary.targets.assets.updated}`);
    console.log(`- asset_symbol_mappings: inserted=${summary.targets.assetSymbolMappings.inserted} updated=${summary.targets.assetSymbolMappings.updated}`);
    console.log(`- asset_daily_prices: inserted=${summary.targets.assetDailyPrices.inserted} updated=${summary.targets.assetDailyPrices.updated}`);
    console.log(`- reference_data_sources: inserted=${summary.targets.referenceDataSources.inserted} updated=${summary.targets.referenceDataSources.updated}`);
    console.log(`- reference_data_import_runs: inserted=${summary.targets.referenceDataImportRuns.inserted} updated=${summary.targets.referenceDataImportRuns.updated}`);
    console.log(`- reference_data_import_run_items: inserted=${summary.targets.referenceDataImportRunItems.inserted} updated=${summary.targets.referenceDataImportRunItems.updated}`);
    console.log(`- reference_data_request_logs: inserted=${summary.targets.referenceDataRequestLogs.inserted} updated=${summary.targets.referenceDataRequestLogs.updated}`);
    console.log(`- dividend_events: inserted=${summary.targets.dividendEvents.inserted} updated=${summary.targets.dividendEvents.updated}`);
    console.log(`- corporate_action_events: inserted=${summary.targets.corporateActionEvents.inserted} updated=${summary.targets.corporateActionEvents.updated}`);

    console.log("Skipped / unresolved:");
    console.log(`- unresolved symbol mappings (missing asset): ${summary.skipped.unresolvedSymbolMappings}`);
    console.log(`- unresolved price rows (missing asset): ${summary.skipped.unresolvedPrices}`);
    console.log(`- unresolved market_actions rows (missing asset): ${summary.skipped.unresolvedActions}`);
    console.log(`- unresolved run items (missing asset): ${summary.skipped.unresolvedRunItems}`);
    console.log(`- unresolved reference instruments: ${summary.skipped.unresolvedReferenceInstruments}`);
    console.log(`- market_actions unknown type: ${summary.skipped.actionUnknownType}`);
    console.log(`- market_actions dividend-like without date: ${summary.skipped.actionDividendNoExDate}`);
    console.log(`- market_actions corporate-like without date: ${summary.skipped.actionCorporateNoEffectiveDate}`);

    if (summary.warnings.length > 0) {
        console.log("Warnings:");
        for (const warning of summary.warnings) {
            console.log(`- ${warning}`);
        }
    }

    console.log("Legacy tables were not dropped or truncated.");
    if (summary.dryRun) {
        console.log("Dry-run complete: all writes were rolled back.");
    } else {
        console.log("Backfill complete: writes committed.");
    }
}

run()
    .catch((error) => {
        console.error(`Asset/reference backfill failed: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
