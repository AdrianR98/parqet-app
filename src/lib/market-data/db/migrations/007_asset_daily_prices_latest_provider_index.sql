-- Phase 4 / #395 support: optimize latest-market-price reads from asset_daily_prices.
--
-- This index is intentionally ordered by provider first because the dashboard/PRM
-- latest-price read path filters by provider (currently yfinance) and then needs
-- the newest row per asset.
--
-- It replaces the manually tested, more useful access pattern for:
--   where provider = 'yfinance'
--   order by asset_id, price_date desc
--
-- No asset_latest_prices table is introduced; latestMarketPrice remains derived
-- from asset_daily_prices.

create index if not exists idx_asset_daily_prices_provider_asset_date_desc
on public.asset_daily_prices (provider, asset_id, price_date desc)
include (close_price, currency, price_timestamp);
