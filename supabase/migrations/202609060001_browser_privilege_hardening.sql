-- Supabase's inherited ALL grants include table-wide operations that RLS does
-- not restrict. Rebuild these browser grants from the application's allowlist.
revoke all on public.achievements, public.profile_achievements
  from public, anon, authenticated;
grant select on public.achievements, public.profile_achievements
  to anon, authenticated;

revoke all on public.account_attention_reads from public, anon, authenticated;
grant select, insert, update on public.account_attention_reads to authenticated;

-- Challenge and analytics writes run through trusted server code or RPCs.
revoke all on sequence public.challenge_events_id_seq,
  public.product_analytics_events_id_seq from public, anon, authenticated;

-- Future postgres-owned tables/sequences require explicit browser grants.
-- Keep service_role defaults and all existing service-role grants intact.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

notify pgrst, 'reload schema';
