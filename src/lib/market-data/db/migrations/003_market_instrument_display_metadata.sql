alter table market_instruments
    add column if not exists display_name text;

alter table market_instruments
    add column if not exists name_source text;

alter table market_instruments
    add column if not exists display_name_source text;

alter table market_instruments
    add column if not exists display_metadata_updated_at timestamptz;
