create table if not exists assets (
    id uuid primary key default gen_random_uuid(),
    asset_key_type text not null,
    asset_key_value text not null,
    isin text,
    wkn text,
    display_name text,
    asset_type text,
    currency text,
    exchange text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_assets_asset_key
    on assets (asset_key_type, asset_key_value);

create unique index if not exists ux_assets_isin_non_null
    on assets (isin)
    where isin is not null;

create index if not exists idx_assets_isin
    on assets (isin);

create index if not exists idx_assets_wkn
    on assets (wkn);

create table if not exists reference_data_sources (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    source_name text not null,
    source_type text not null,
    source_reference text,
    priority integer,
    reliability text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_reference_data_sources_provider_name
    on reference_data_sources (provider, source_name);

create table if not exists reference_data_import_runs (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references reference_data_sources(id) on delete restrict,
    import_type text not null,
    status text not null,
    started_at timestamptz,
    finished_at timestamptz,
    requested_by text,
    parameters_json jsonb,
    summary_json jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_reference_data_import_runs_created_at
    on reference_data_import_runs (created_at desc);

create index if not exists idx_reference_data_import_runs_status_created_at
    on reference_data_import_runs (status, created_at desc);

create index if not exists idx_reference_data_import_runs_source_created_at
    on reference_data_import_runs (source_id, created_at desc);

create table if not exists asset_symbol_mappings (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references assets(id) on delete cascade,
    provider text not null,
    provider_symbol text not null,
    exchange text,
    currency text,
    is_primary boolean not null default false,
    is_active boolean not null default true,
    verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_asset_symbol_mappings_provider_symbol_exchange
    on asset_symbol_mappings (provider, provider_symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_asset_provider_symbol_exchange
    on asset_symbol_mappings (asset_id, provider, provider_symbol, coalesce(exchange, ''));

create unique index if not exists ux_asset_symbol_mappings_primary_active
    on asset_symbol_mappings (asset_id, provider)
    where is_primary = true and is_active = true;

create index if not exists idx_asset_symbol_mappings_asset_provider_primary_active
    on asset_symbol_mappings (asset_id, provider, is_primary, is_active);

create table if not exists asset_daily_prices (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references assets(id) on delete cascade,
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
    source_run_id uuid references reference_data_import_runs(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (asset_id, provider, price_date)
);

create index if not exists idx_asset_daily_prices_asset_provider_price_date_desc
    on asset_daily_prices (asset_id, provider, price_date desc);

create index if not exists idx_asset_daily_prices_asset_price_date
    on asset_daily_prices (asset_id, price_date);

create table if not exists dividend_events (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references assets(id) on delete cascade,
    provider text not null,
    ex_date date,
    pay_date date,
    record_date date,
    declaration_date date,
    amount numeric,
    currency text,
    source_run_id uuid references reference_data_import_runs(id) on delete set null,
    confidence text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_dividend_events_dedupe
    on dividend_events (asset_id, provider, ex_date, amount, coalesce(currency, ''))
    where ex_date is not null;

create index if not exists idx_dividend_events_asset_ex_date_desc
    on dividend_events (asset_id, ex_date desc);

create table if not exists corporate_action_events (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references assets(id) on delete cascade,
    provider text not null,
    action_type text not null,
    effective_date date,
    announced_date date,
    ratio_from numeric,
    ratio_to numeric,
    cash_component numeric,
    currency text,
    successor_asset_id uuid references assets(id) on delete set null,
    source_run_id uuid references reference_data_import_runs(id) on delete set null,
    confidence text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists ux_corporate_action_events_dedupe
    on corporate_action_events (asset_id, provider, action_type, effective_date, coalesce(successor_asset_id::text, ''));

create index if not exists idx_corporate_action_events_asset_effective_date_desc
    on corporate_action_events (asset_id, effective_date desc);

create index if not exists idx_corporate_action_events_successor_asset_id
    on corporate_action_events (successor_asset_id);

create table if not exists reference_data_import_run_items (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references reference_data_import_runs(id) on delete cascade,
    asset_id uuid references assets(id) on delete set null,
    provider_symbol text,
    item_type text not null,
    status text not null,
    message text,
    raw_payload_reference text,
    raw_payload_hash text,
    created_at timestamptz not null default now()
);

create index if not exists idx_reference_data_import_run_items_run_created_at
    on reference_data_import_run_items (run_id, created_at);

create index if not exists idx_reference_data_import_run_items_status_created_at
    on reference_data_import_run_items (status, created_at desc);

create unique index if not exists ux_reference_data_import_run_items_dedupe
    on reference_data_import_run_items (run_id, item_type, coalesce(provider_symbol, ''), coalesce(raw_payload_hash, ''));

create table if not exists reference_data_request_logs (
    id uuid primary key default gen_random_uuid(),
    source_id uuid references reference_data_sources(id) on delete set null,
    provider text not null,
    request_type text not null,
    request_key text not null,
    status text not null,
    requested_at timestamptz not null default now(),
    duration_ms integer,
    error_message text,
    response_hash text,
    cache_key text
);

create index if not exists idx_reference_data_request_logs_requested_at
    on reference_data_request_logs (requested_at desc);

create index if not exists idx_reference_data_request_logs_lookup
    on reference_data_request_logs (provider, request_type, request_key, requested_at desc);
