alter table market_instruments
    add column if not exists market_data_status text;

alter table market_instruments
    add column if not exists market_data_status_reason text;

alter table market_instruments
    add column if not exists market_data_successor_isin text;

alter table market_instruments
    add column if not exists market_data_successor_symbol text;

alter table market_instruments
    add column if not exists market_data_status_updated_at timestamptz;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_market_instruments_market_data_status'
    ) then
        alter table market_instruments
            add constraint chk_market_instruments_market_data_status
            check (
                market_data_status is null
                or market_data_status in ('active', 'excluded', 'legacy', 'derivative', 'unknown')
            );
    end if;
end $$;
