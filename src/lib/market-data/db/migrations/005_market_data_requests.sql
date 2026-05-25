create table if not exists market_data_requests (
    id uuid primary key default gen_random_uuid(),
    isin text not null,
    name text,
    display_name text,
    asset_type text,
    currency text,
    wkn text,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    seen_count int not null default 1,
    status text not null default 'pending',
    source text not null default 'runtime_asset_discovery',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_market_data_requests_isin
    on market_data_requests (isin);

create index if not exists idx_market_data_requests_status
    on market_data_requests (status);

create index if not exists idx_market_data_requests_last_seen_at
    on market_data_requests (last_seen_at desc);

create index if not exists idx_market_data_requests_source
    on market_data_requests (source);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_market_data_requests_status'
    ) then
        alter table market_data_requests
            add constraint chk_market_data_requests_status
            check (
                status in ('pending', 'known_instrument', 'mapping_missing', 'import_ready', 'imported', 'failed', 'ignored')
            );
    end if;
end $$;
