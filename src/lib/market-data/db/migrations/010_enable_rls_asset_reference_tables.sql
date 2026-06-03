-- Phase 4 security baseline: enable Row Level Security on Asset/reference-data tables.
--
-- Current access model:
-- - Application access is expected to go through server/API routes and privileged
--   Postgres connections, not direct browser Supabase table access.
-- - No anon/authenticated policies are created here intentionally. With RLS
--   enabled and no permissive policies, direct client-side access is denied.
-- - Service/privileged server access remains responsible for controlled reads and
--   writes.
--
-- Future private user-owned tables need separate ownership policies based on
-- auth.uid(); these public/reference-data tables do not currently carry user_id.

alter table public.assets enable row level security;
alter table public.asset_symbol_mappings enable row level security;
alter table public.asset_daily_prices enable row level security;
alter table public.dividend_events enable row level security;
alter table public.corporate_action_events enable row level security;
alter table public.reference_data_sources enable row level security;
alter table public.reference_data_import_runs enable row level security;
alter table public.reference_data_import_run_items enable row level security;
alter table public.reference_data_request_logs enable row level security;
