-- Phase 4 current baseline.
--
-- This migration is the squashed active baseline for the Asset/reference-data
-- schema. It is intentionally additive and safe for already-populated
-- databases: it creates the current tables when missing and reasserts the
-- current columns, constraints, indexes and RLS posture without touching the
-- legacy market_* tables.

create extension if not exists pgcrypto;

create table if not exists public.assets (
    id uuid primary key default gen_random_uuid(),
    asset_key_type text not null,
    asset_key_value text not null,
    isin text,
    wkn text,
    name text,
    display_name text,
    asset_type text,
    currency text,
    exchange text,
    metadata_source text,
    metadata_updated_at timestamptz,
    name_source text,
    display_name_source text,
    display_metadata_updated_at timestamptz,
    market_data_status text,
    market_data_status_reason text,
    market_data_successor_isin text,
    market_data_successor_symbol text,
    market_data_status_updated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.assets
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

create unique index if not exists ux_assets_asset_key
    on public.assets (asset_key_type, asset_key_value);

create unique index if not exists ux_assets_isin_non_null
    on public.assets (isin)
    where isin is not null;

create index if not exists idx_assets_isin
    on public.assets (isin);

create index if not exists idx_assets_wkn
    on public.assets (wkn);

create index if not exists idx_assets_market_data_status
    on public.assets (market_data_status);

create index if not exists idx_assets_market_data_successor_isin
    on public.assets (market_data_successor_isin);

create table if not exists public.asset_symbol_mappings (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.assets(id) on delete restrict,
    provider text not null,
    provider_symbol text not null,
    exchange text,
    currency text,
    is_primary boolean not null default false,
    is_active boolean not null default true,
    verified_at timestamptz,
    instrument_id uuid,
    symbol text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.asset_symbol_mappings
    add column if not exists instrument_id uuid,
    add column if not exists symbol text,
    add column if not exists notes text;

create unique index if not exists ux_asset_symbol_mappings_provider_symbol_exchange
    on public.asset_symbol_mappings (provider, provider_symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_provider_symbol_exchange_legacy
    on public.asset_symbol_mappings (provider, symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_asset_provider_symbol_exchange
    on public.asset_symbol_mappings (asset_id, provider, provider_symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_primary_active
    on public.asset_symbol_mappings (asset_id, provider)
    where is_primary = true and is_active = true;

create index if not exists idx_asset_symbol_mappings_asset_provider_primary_active
    on public.asset_symbol_mappings (asset_id, provider, is_primary, is_active);

create table if not exists public.reference_data_sources (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    source_name text not null,
    source_type text not null,
    source_reference text,
    priority integer,
    reliability text,
    source_key text,
    display_name text,
    file_name text,
    row_count integer,
    imported_at timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.reference_data_sources
    add column if not exists source_key text,
    add column if not exists display_name text,
    add column if not exists file_name text,
    add column if not exists row_count integer,
    add column if not exists imported_at timestamptz,
    add column if not exists notes text;

create unique index if not exists ux_reference_data_sources_provider_name
    on public.reference_data_sources (provider, source_name);

create unique index if not exists ux_reference_data_sources_source_key
    on public.reference_data_sources (source_key);

create table if not exists public.reference_data_import_runs (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.reference_data_sources(id) on delete restrict,
    import_type text not null,
    status text not null,
    started_at timestamptz,
    finished_at timestamptz,
    requested_by text,
    parameters_json jsonb,
    summary_json jsonb,
    run_type text,
    provider text,
    requested_symbols integer,
    successful_symbols integer,
    failed_symbols integer,
    error_message text,
    created_at timestamptz not null default now()
);

alter table if exists public.reference_data_import_runs
    add column if not exists run_type text,
    add column if not exists provider text,
    add column if not exists requested_symbols integer,
    add column if not exists successful_symbols integer,
    add column if not exists failed_symbols integer,
    add column if not exists error_message text;

create index if not exists idx_reference_data_import_runs_created_at
    on public.reference_data_import_runs (created_at desc);

create index if not exists idx_reference_data_import_runs_status_created_at
    on public.reference_data_import_runs (status, created_at desc);

create index if not exists idx_reference_data_import_runs_source_created_at
    on public.reference_data_import_runs (source_id, created_at desc);

create table if not exists public.asset_daily_prices (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.assets(id) on delete restrict,
    provider text not null,
    price_date date not null,
    price_timestamp timestamptz,
    open_price numeric,
    high_price numeric,
    low_price numeric,
    close_price numeric not null,
    adjusted_close_price numeric,
    volume numeric,
    currency text,
    source_run_id uuid references public.reference_data_import_runs(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (asset_id, provider, price_date)
);

create index if not exists idx_asset_daily_prices_provider_asset_date_desc
    on public.asset_daily_prices (provider, asset_id, price_date desc)
    include (close_price, currency, price_timestamp);

create table if not exists public.dividend_events (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.assets(id) on delete restrict,
    provider text not null,
    ex_date date,
    pay_date date,
    record_date date,
    declaration_date date,
    amount numeric,
    currency text,
    source_run_id uuid references public.reference_data_import_runs(id) on delete set null,
    confidence text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_dividend_events_dedupe
    on public.dividend_events (asset_id, provider, ex_date, amount, coalesce(currency, ''))
    where ex_date is not null;

create index if not exists idx_dividend_events_asset_ex_date_desc
    on public.dividend_events (asset_id, ex_date desc);

create table if not exists public.corporate_action_events (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.assets(id) on delete restrict,
    provider text not null,
    action_type text not null,
    effective_date date,
    announced_date date,
    ratio_from numeric,
    ratio_to numeric,
    cash_component numeric,
    currency text,
    successor_asset_id uuid references public.assets(id) on delete set null,
    source_run_id uuid references public.reference_data_import_runs(id) on delete set null,
    confidence text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_corporate_action_events_dedupe
    on public.corporate_action_events (asset_id, provider, action_type, effective_date, coalesce(successor_asset_id::text, ''));

create index if not exists idx_corporate_action_events_asset_effective_date_desc
    on public.corporate_action_events (asset_id, effective_date desc);

create index if not exists idx_corporate_action_events_successor_asset_id
    on public.corporate_action_events (successor_asset_id);

create table if not exists public.reference_data_sources (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    source_name text not null,
    source_type text not null,
    source_reference text,
    priority integer,
    reliability text,
    source_key text,
    display_name text,
    file_name text,
    row_count integer,
    imported_at timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.reference_data_sources
    add column if not exists source_key text,
    add column if not exists display_name text,
    add column if not exists file_name text,
    add column if not exists row_count integer,
    add column if not exists imported_at timestamptz,
    add column if not exists notes text;

create unique index if not exists ux_reference_data_sources_provider_name
    on public.reference_data_sources (provider, source_name);

create unique index if not exists ux_reference_data_sources_source_key
    on public.reference_data_sources (source_key);

create table if not exists public.reference_data_import_runs (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.reference_data_sources(id) on delete restrict,
    import_type text not null,
    status text not null,
    started_at timestamptz,
    finished_at timestamptz,
    requested_by text,
    parameters_json jsonb,
    summary_json jsonb,
    run_type text,
    provider text,
    requested_symbols integer,
    successful_symbols integer,
    failed_symbols integer,
    error_message text,
    created_at timestamptz not null default now()
);

alter table if exists public.reference_data_import_runs
    add column if not exists run_type text,
    add column if not exists provider text,
    add column if not exists requested_symbols integer,
    add column if not exists successful_symbols integer,
    add column if not exists failed_symbols integer,
    add column if not exists error_message text;

create index if not exists idx_reference_data_import_runs_created_at
    on public.reference_data_import_runs (created_at desc);

create index if not exists idx_reference_data_import_runs_status_created_at
    on public.reference_data_import_runs (status, created_at desc);

create index if not exists idx_reference_data_import_runs_source_created_at
    on public.reference_data_import_runs (source_id, created_at desc);

create table if not exists public.reference_data_import_run_items (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.reference_data_import_runs(id) on delete restrict,
    asset_id uuid references public.assets(id) on delete set null,
    provider_symbol text,
    item_type text not null,
    status text not null,
    message text,
    raw_payload_reference text,
    raw_payload_hash text,
    instrument_id uuid,
    symbol text,
    points_imported integer,
    actions_imported integer,
    first_date date,
    last_date date,
    error_message text,
    created_at timestamptz not null default now()
);

alter table if exists public.reference_data_import_run_items
    add column if not exists instrument_id uuid,
    add column if not exists symbol text,
    add column if not exists points_imported integer,
    add column if not exists actions_imported integer,
    add column if not exists first_date date,
    add column if not exists last_date date,
    add column if not exists error_message text;

create index if not exists idx_reference_data_import_run_items_run_created_at
    on public.reference_data_import_run_items (run_id, created_at);

create index if not exists idx_reference_data_import_run_items_status_created_at
    on public.reference_data_import_run_items (status, created_at desc);

create unique index if not exists ux_reference_data_import_run_items_dedupe
    on public.reference_data_import_run_items (run_id, item_type, coalesce(provider_symbol, ''), coalesce(raw_payload_hash, ''));

create table if not exists public.reference_data_request_logs (
    id uuid primary key default gen_random_uuid(),
    source_id uuid references public.reference_data_sources(id) on delete set null,
    provider text not null,
    request_type text not null,
    request_key text not null,
    status text not null,
    requested_at timestamptz not null default now(),
    duration_ms integer,
    error_message text,
    response_hash text,
    cache_key text,
    isin text,
    name text,
    display_name text,
    asset_type text,
    currency text,
    wkn text,
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    seen_count integer not null default 1,
    source text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists public.reference_data_request_logs
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

create index if not exists idx_reference_data_request_logs_requested_at
    on public.reference_data_request_logs (requested_at desc);

create index if not exists idx_reference_data_request_logs_lookup
    on public.reference_data_request_logs (provider, request_type, request_key, requested_at desc);

create unique index if not exists ux_reference_data_request_logs_identity
    on public.reference_data_request_logs (provider, request_type, request_key);

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

alter table public.assets enable row level security;
alter table public.asset_symbol_mappings enable row level security;
alter table public.asset_daily_prices enable row level security;
alter table public.dividend_events enable row level security;
alter table public.corporate_action_events enable row level security;
alter table public.reference_data_sources enable row level security;
alter table public.reference_data_import_runs enable row level security;
alter table public.reference_data_import_run_items enable row level security;
alter table public.reference_data_request_logs enable row level security;
alter table public.reference_data_asset_candidates enable row level security;
