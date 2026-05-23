create extension if not exists pgcrypto;

create table if not exists market_instruments (
    id uuid primary key default gen_random_uuid(),
    isin text not null unique,
    name text,
    asset_type text,
    currency text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists market_symbol_mappings (
    id uuid primary key default gen_random_uuid(),
    instrument_id uuid not null references market_instruments(id) on delete cascade,
    provider text not null,
    symbol text not null,
    exchange text,
    currency text,
    is_primary boolean not null default false,
    is_active boolean not null default true,
    verified_at timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider, symbol),
    unique (instrument_id, provider, symbol)
);

create table if not exists market_prices_daily (
    instrument_id uuid not null references market_instruments(id) on delete cascade,
    provider text not null,
    symbol text not null,
    date date not null,
    open numeric,
    high numeric,
    low numeric,
    close numeric not null,
    adj_close numeric,
    volume numeric,
    currency text,
    source text,
    imported_at timestamptz not null default now(),
    primary key (instrument_id, provider, date)
);

create table if not exists market_actions (
    instrument_id uuid not null references market_instruments(id) on delete cascade,
    provider text not null,
    symbol text not null,
    action_type text not null,
    date date not null,
    amount numeric,
    ratio text,
    currency text,
    source text,
    imported_at timestamptz not null default now(),
    primary key (instrument_id, provider, action_type, date)
);

comment on column market_actions.action_type is
    'Expected values: dividend, split, capital_gain, other';

create table if not exists market_data_runs (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    run_type text not null,
    status text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    requested_symbols int not null default 0,
    successful_symbols int not null default 0,
    failed_symbols int not null default 0,
    error_message text
);

create table if not exists market_data_run_items (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references market_data_runs(id) on delete cascade,
    instrument_id uuid references market_instruments(id) on delete set null,
    provider text not null,
    symbol text not null,
    status text not null,
    points_imported int not null default 0,
    actions_imported int not null default 0,
    first_date date,
    last_date date,
    error_message text
);

create index if not exists idx_market_prices_daily_instrument_date
    on market_prices_daily (instrument_id, date);

create index if not exists idx_market_prices_daily_provider_symbol_date
    on market_prices_daily (provider, symbol, date);

create index if not exists idx_market_actions_instrument_date
    on market_actions (instrument_id, date);

create index if not exists idx_market_actions_provider_symbol_date
    on market_actions (provider, symbol, date);

create index if not exists idx_market_symbol_mappings_provider_symbol
    on market_symbol_mappings (provider, symbol);

create index if not exists idx_market_data_run_items_run_id
    on market_data_run_items (run_id);
