alter table public.assets
    add column if not exists name text,
    add column if not exists metadata_source text,
    add column if not exists metadata_updated_at timestamptz,
    add column if not exists name_source text,
    add column if not exists display_name_source text,
    add column if not exists display_metadata_updated_at timestamptz,
    add column if not exists market_data_status text,
    add column if not exists market_data_status_reason text,
    add column if not exists market_data_successor_isin text,
    add column if not exists market_data_successor_symbol text,
    add column if not exists market_data_status_updated_at timestamptz;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_assets_market_data_status'
    ) then
        alter table public.assets
            add constraint chk_assets_market_data_status
                check (
                    market_data_status is null
                    or market_data_status in ('active', 'excluded', 'legacy', 'derivative', 'unknown')
                );
    end if;
end $$;

create index if not exists idx_assets_market_data_status
    on public.assets (market_data_status);

create index if not exists idx_assets_market_data_successor_isin
    on public.assets (market_data_successor_isin);

update public.assets a
set
    name = coalesce(a.name, i.name),
    display_name = coalesce(a.display_name, i.display_name),
    asset_type = coalesce(a.asset_type, i.asset_type),
    currency = coalesce(a.currency, i.currency),
    wkn = coalesce(a.wkn, i.wkn),
    exchange = coalesce(a.exchange, i.exchange),
    metadata_source = coalesce(a.metadata_source, i.metadata_source),
    metadata_updated_at = coalesce(a.metadata_updated_at, i.metadata_updated_at),
    name_source = coalesce(a.name_source, i.name_source),
    display_name_source = coalesce(a.display_name_source, i.display_name_source),
    display_metadata_updated_at = coalesce(a.display_metadata_updated_at, i.display_metadata_updated_at),
    market_data_status = coalesce(a.market_data_status, i.market_data_status, 'unknown'),
    market_data_status_reason = coalesce(a.market_data_status_reason, i.market_data_status_reason),
    market_data_successor_isin = coalesce(a.market_data_successor_isin, i.market_data_successor_isin),
    market_data_successor_symbol = coalesce(a.market_data_successor_symbol, i.market_data_successor_symbol),
    market_data_status_updated_at = coalesce(a.market_data_status_updated_at, i.market_data_status_updated_at)
from public.market_instruments i
where a.asset_key_type = 'isin'
  and a.asset_key_value = upper(regexp_replace(i.isin, '\s+', '', 'g'));

alter table public.asset_symbol_mappings
    add column if not exists instrument_id uuid,
    add column if not exists symbol text,
    add column if not exists notes text;

create unique index if not exists ux_asset_symbol_mappings_provider_symbol_exchange_legacy
    on public.asset_symbol_mappings (provider, symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_asset_provider_symbol_exchange
    on public.asset_symbol_mappings (asset_id, provider, provider_symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_primary_active
    on public.asset_symbol_mappings (asset_id, provider)
    where is_primary = true and is_active = true;

update public.asset_symbol_mappings m
set
    instrument_id = coalesce(m.instrument_id, m.asset_id),
    symbol = coalesce(m.symbol, m.provider_symbol),
    notes = coalesce(m.notes, legacy.notes),
    updated_at = now()
from public.market_symbol_mappings legacy
join public.market_instruments i
  on i.id = legacy.instrument_id
join public.assets a
  on a.asset_key_type = 'isin'
 and a.asset_key_value = upper(regexp_replace(i.isin, '\s+', '', 'g'))
where m.asset_id = a.id
  and m.provider = legacy.provider
  and m.provider_symbol = legacy.symbol
  and coalesce(m.exchange, '') = coalesce(legacy.exchange, '');

create table if not exists public.reference_data_asset_candidates (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.reference_data_sources(id) on delete restrict,
    source_key text not null,
    asset_id uuid references public.assets(id) on delete set null,
    isin text,
    wkn text,
    name text,
    display_name text,
    provider_symbol text,
    symbol text,
    mnemonic text,
    exchange text,
    mic_code text,
    primary_market_mic_code text,
    currency text,
    asset_type text,
    instrument_type text,
    product_category text,
    market_segment text,
    raw_payload jsonb,
    imported_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_reference_data_asset_candidates_identity
    on public.reference_data_asset_candidates (
        source_id,
        coalesce(isin, ''),
        coalesce(provider_symbol, ''),
        coalesce(mnemonic, '')
    );

create unique index if not exists ux_reference_data_asset_candidates_legacy_identity
    on public.reference_data_asset_candidates (
        source_key,
        coalesce(isin, ''),
        coalesce(symbol, ''),
        coalesce(mnemonic, '')
    );

create index if not exists idx_reference_data_asset_candidates_isin
    on public.reference_data_asset_candidates (isin);

create index if not exists idx_reference_data_asset_candidates_asset_id
    on public.reference_data_asset_candidates (asset_id);

create index if not exists idx_reference_data_asset_candidates_source_key
    on public.reference_data_asset_candidates (source_key);

alter table public.reference_data_sources
    add column if not exists source_key text,
    add column if not exists display_name text,
    add column if not exists file_name text,
    add column if not exists row_count integer,
    add column if not exists imported_at timestamptz,
    add column if not exists notes text;

create unique index if not exists ux_reference_data_sources_source_key
    on public.reference_data_sources (source_key);

update public.reference_data_sources s
set
    source_key = coalesce(s.source_key, rs.source_key),
    display_name = coalesce(s.display_name, rs.display_name),
    file_name = coalesce(s.file_name, rs.file_name),
    row_count = coalesce(s.row_count, rs.row_count),
    imported_at = coalesce(s.imported_at, rs.imported_at),
    notes = coalesce(s.notes, rs.notes),
    updated_at = now()
from public.market_reference_sources rs
where s.source_name = rs.source_key
  and s.provider = 'legacy_market_data';

insert into public.reference_data_sources (
    provider,
    source_key,
    source_name,
    display_name,
    source_type,
    file_name,
    source_reference,
    row_count,
    reliability,
    notes,
    imported_at,
    created_at,
    updated_at
)
select
    'legacy_market_data' as provider,
    rs.source_key,
    rs.source_key as source_name,
    rs.display_name,
    rs.source_type,
    rs.file_name,
    rs.file_name as source_reference,
    rs.row_count,
    null as reliability,
    rs.notes,
    rs.imported_at,
    rs.imported_at,
    rs.imported_at
from public.market_reference_sources rs
on conflict (provider, source_name)
do update set
    source_key = excluded.source_key,
    display_name = excluded.display_name,
    source_type = excluded.source_type,
    file_name = excluded.file_name,
    source_reference = excluded.source_reference,
    row_count = excluded.row_count,
    notes = excluded.notes,
    imported_at = excluded.imported_at,
    updated_at = now();

insert into public.reference_data_sources (
    provider,
    source_key,
    source_name,
    display_name,
    source_type,
    source_reference,
    row_count,
    reliability,
    notes,
    imported_at,
    created_at,
    updated_at
)
select
    'legacy_market_data' as provider,
    coalesce(r.provider, 'legacy_imports') as source_key,
    coalesce(r.provider, 'legacy_imports') as source_name,
    coalesce(r.provider, 'Legacy Imports') as display_name,
    'legacy_run' as source_type,
    null as source_reference,
    null as row_count,
    null as reliability,
    'legacy import run provenance' as notes,
    now() as imported_at,
    now() as created_at,
    now() as updated_at
from (
    select distinct provider
    from public.market_data_runs
) r
on conflict (provider, source_name)
do nothing;

insert into public.reference_data_asset_candidates (
    source_id,
    source_key,
    asset_id,
    isin,
    wkn,
    name,
    display_name,
    provider_symbol,
    symbol,
    mnemonic,
    exchange,
    mic_code,
    primary_market_mic_code,
    currency,
    asset_type,
    instrument_type,
    product_category,
    market_segment,
    raw_payload,
    imported_at,
    created_at,
    updated_at
)
select
    s.id as source_id,
    r.source_key,
    a.id as asset_id,
    r.isin,
    r.wkn,
    r.name,
    r.name as display_name,
    r.symbol as provider_symbol,
    r.symbol,
    r.mnemonic,
    r.exchange,
    r.mic_code,
    r.primary_market_mic_code,
    r.currency,
    r.instrument_type as asset_type,
    r.instrument_type,
    r.product_category,
    r.market_segment,
    r.raw_payload,
    r.imported_at,
    r.imported_at,
    r.imported_at
from public.market_reference_instruments r
join public.reference_data_sources s
  on s.provider = 'legacy_market_data'
 and s.source_name = r.source_key
left join public.assets a
  on a.asset_key_type = 'isin'
 and a.asset_key_value = upper(regexp_replace(r.isin, '\s+', '', 'g'))
on conflict (source_id, coalesce(isin, ''), coalesce(provider_symbol, ''), coalesce(mnemonic, ''))
do update set
    asset_id = excluded.asset_id,
    wkn = excluded.wkn,
    name = excluded.name,
    display_name = excluded.display_name,
    symbol = excluded.symbol,
    exchange = excluded.exchange,
    mic_code = excluded.mic_code,
    primary_market_mic_code = excluded.primary_market_mic_code,
    currency = excluded.currency,
    asset_type = excluded.asset_type,
    instrument_type = excluded.instrument_type,
    product_category = excluded.product_category,
    market_segment = excluded.market_segment,
    raw_payload = excluded.raw_payload,
    imported_at = excluded.imported_at,
    updated_at = now();

create unique index if not exists ux_reference_data_request_logs_identity
    on public.reference_data_request_logs (provider, request_type, request_key);

alter table public.reference_data_request_logs
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists isin text,
    add column if not exists name text,
    add column if not exists display_name text,
    add column if not exists asset_type text,
    add column if not exists currency text,
    add column if not exists wkn text,
    add column if not exists first_seen_at timestamptz,
    add column if not exists last_seen_at timestamptz,
    add column if not exists seen_count integer not null default 1,
    add column if not exists source text,
    add column if not exists notes text,
    add column if not exists updated_at timestamptz not null default now();

alter table public.reference_data_import_runs
    add column if not exists run_type text,
    add column if not exists provider text,
    add column if not exists requested_symbols integer,
    add column if not exists successful_symbols integer,
    add column if not exists failed_symbols integer,
    add column if not exists error_message text;

alter table public.reference_data_import_run_items
    add column if not exists instrument_id uuid,
    add column if not exists symbol text,
    add column if not exists points_imported integer,
    add column if not exists actions_imported integer,
    add column if not exists first_date date,
    add column if not exists last_date date,
    add column if not exists error_message text;

insert into public.reference_data_request_logs (
    provider,
    request_type,
    request_key,
    status,
    requested_at,
    isin,
    name,
    display_name,
    asset_type,
    currency,
    wkn,
    first_seen_at,
    last_seen_at,
    seen_count,
    source,
    notes,
    created_at,
    updated_at
)
select
    'parqet' as provider,
    'asset_discovery' as request_type,
    r.isin as request_key,
    r.status,
    coalesce(r.last_seen_at, r.created_at, now()) as requested_at,
    r.isin,
    r.name,
    r.display_name,
    r.asset_type,
    r.currency,
    r.wkn,
    r.first_seen_at,
    r.last_seen_at,
    r.seen_count,
    r.source,
    r.notes,
    r.created_at,
    r.updated_at
from public.market_data_requests r
on conflict (provider, request_type, request_key)
do update set
    status = excluded.status,
    requested_at = excluded.requested_at,
    isin = excluded.isin,
    name = excluded.name,
    display_name = excluded.display_name,
    asset_type = excluded.asset_type,
    currency = excluded.currency,
    wkn = excluded.wkn,
    first_seen_at = excluded.first_seen_at,
    last_seen_at = excluded.last_seen_at,
    seen_count = excluded.seen_count,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = now();

insert into public.reference_data_import_runs (
    id,
    source_id,
    import_type,
    status,
    started_at,
    finished_at,
    requested_by,
    parameters_json,
    summary_json,
    created_at,
    run_type,
    provider,
    requested_symbols,
    successful_symbols,
    failed_symbols,
    error_message
)
select
    r.id,
    source.id,
    coalesce(r.run_type, r.run_type, 'legacy_import') as import_type,
    r.status,
    r.started_at,
    r.finished_at,
    null as requested_by,
    jsonb_build_object('legacy_run_type', r.run_type, 'provider', r.provider, 'requested_symbols', r.requested_symbols) as parameters_json,
    jsonb_build_object('successful_symbols', r.successful_symbols, 'failed_symbols', r.failed_symbols, 'error_message', r.error_message) as summary_json,
    coalesce(r.started_at, r.created_at, now()) as created_at,
    r.run_type,
    r.provider,
    r.requested_symbols,
    r.successful_symbols,
    r.failed_symbols,
    r.error_message
from public.market_data_runs r
join public.reference_data_sources source
  on source.provider = 'legacy_market_data'
 and source.source_name = coalesce(r.provider, 'legacy_imports')
on conflict (id)
do update set
    status = excluded.status,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    parameters_json = excluded.parameters_json,
    summary_json = excluded.summary_json,
    run_type = excluded.run_type,
    provider = excluded.provider,
    requested_symbols = excluded.requested_symbols,
    successful_symbols = excluded.successful_symbols,
    failed_symbols = excluded.failed_symbols,
    error_message = excluded.error_message;

insert into public.reference_data_import_run_items (
    id,
    run_id,
    asset_id,
    provider_symbol,
    item_type,
    status,
    message,
    raw_payload_reference,
    raw_payload_hash,
    created_at,
    instrument_id,
    symbol,
    points_imported,
    actions_imported,
    first_date,
    last_date,
    error_message
)
select
    ri.id,
    ri.run_id,
    a.id as asset_id,
    ri.symbol,
    coalesce(nullif(ri.status, ''), 'legacy_item') as item_type,
    ri.status,
    ri.error_message,
    null as raw_payload_reference,
    null as raw_payload_hash,
    coalesce(ri.first_date, ri.created_at, now()) as created_at,
    ri.instrument_id,
    ri.symbol,
    ri.points_imported,
    ri.actions_imported,
    ri.first_date,
    ri.last_date,
    ri.error_message
from public.market_data_run_items ri
left join public.assets a
  on a.id = ri.instrument_id
on conflict (id)
do update set
    run_id = excluded.run_id,
    asset_id = excluded.asset_id,
    provider_symbol = excluded.provider_symbol,
    item_type = excluded.item_type,
    status = excluded.status,
    message = excluded.message,
    created_at = excluded.created_at,
    instrument_id = excluded.instrument_id,
    symbol = excluded.symbol,
    points_imported = excluded.points_imported,
    actions_imported = excluded.actions_imported,
    first_date = excluded.first_date,
    last_date = excluded.last_date,
    error_message = excluded.error_message;
