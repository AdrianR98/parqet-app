create table if not exists market_reference_sources (
    id uuid primary key default gen_random_uuid(),
    source_key text not null unique,
    display_name text not null,
    source_type text not null,
    file_name text,
    row_count integer,
    imported_at timestamptz not null default now(),
    notes text
);

create table if not exists market_reference_instruments (
    id uuid primary key default gen_random_uuid(),
    source_key text not null,
    isin text,
    wkn text,
    name text,
    symbol text,
    mnemonic text,
    exchange text,
    mic_code text,
    primary_market_mic_code text,
    currency text,
    instrument_type text,
    product_category text,
    market_segment text,
    raw_payload jsonb,
    imported_at timestamptz not null default now()
);

create unique index if not exists ux_market_reference_instruments_source_key
    on market_reference_instruments (source_key, isin, coalesce(symbol, ''), coalesce(mnemonic, ''));

create index if not exists idx_market_reference_instruments_isin
    on market_reference_instruments (isin);

create index if not exists idx_market_reference_instruments_source_key
    on market_reference_instruments (source_key);

create index if not exists idx_market_reference_instruments_mnemonic
    on market_reference_instruments (mnemonic);

create index if not exists idx_market_reference_instruments_wkn
    on market_reference_instruments (wkn);

alter table market_instruments
    add column if not exists wkn text;

alter table market_instruments
    add column if not exists metadata_source text;

alter table market_instruments
    add column if not exists metadata_updated_at timestamptz;
