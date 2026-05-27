-- Phase 4 storage cleanup after successful local backfill into asset_daily_prices.
--
-- Preconditions validated manually in Supabase/local DB:
-- - legacy market_prices_daily row count matched asset_daily_prices after backfill
-- - asset_daily_prices contains the migrated daily price history
-- - the two removed asset_daily_prices indexes were redundant or superseded by
--   idx_asset_daily_prices_provider_asset_date_desc for latest-market-price reads
--
-- Intentional transition breakage:
-- - legacy code paths that still read market_prices_daily must be moved to
--   asset_daily_prices before Phase 4 is considered complete.
-- - this cleanup does not drop the other legacy market_* tables yet.

-- Remove the legacy duplicated daily-price table. Do not use CASCADE; dependent
-- objects should fail explicitly so they can be migrated instead of silently removed.
drop table if exists public.market_prices_daily;

-- Remove redundant/obsolete asset_daily_prices indexes after the provider-first
-- latest-price index was tested and added in migration 007.
drop index if exists public.idx_asset_daily_prices_asset_provider_price_date_desc;
drop index if exists public.idx_asset_daily_prices_asset_price_date;
