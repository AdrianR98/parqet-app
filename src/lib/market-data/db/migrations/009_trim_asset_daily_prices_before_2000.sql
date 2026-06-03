-- Phase 4 storage cleanup: trim daily price history before 2000-01-01.
--
-- Rationale:
-- - UI/chart surfaces do not need full daily price history back to the 1960s.
-- - Local Supabase validation showed this removes 178,395 historical rows from
--   the current dataset and reduces asset_daily_prices storage materially.
-- - latestMarketPrice remains derived from asset_daily_prices.
--
-- Important:
-- - VACUUM FULL is intentionally not included because the migration runner wraps
--   migration files in a transaction. The manual local cleanup used VACUUM FULL
--   in Supabase after this delete, but automated migrations should only perform
--   the data trim and ANALYZE.

DELETE FROM public.asset_daily_prices
WHERE price_date < DATE '2000-01-01';

ANALYZE public.asset_daily_prices;
