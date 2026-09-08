-- Read-only inventory. No emails, tokens, guest identities, or rating values.
begin read only;
set local statement_timeout = '30s';

select jsonb_build_object(
  'counts', jsonb_build_object(
    'auth_users', (select count(*) from auth.users),
    'profiles', (select count(*) from public.profiles),
    'games', (select count(*) from public.games),
    'players', (select count(*) from public.game_players),
    'guest_players', (select count(*) from public.game_players where profile_id is null),
    'ratings', (select count(*) from public.ratings),
    'results', (select count(*) from public.compatibility_results),
    'watchlists', (select count(*) from public.watchlists),
    'watchlist_items', (select count(*) from public.watchlist_items),
    'friendships', (select count(*) from public.friendships),
    'attention_reads', (select count(*) from public.account_attention_reads),
    'challenges', (select count(*) from public.challenges),
    'analytics_events', (select count(*) from public.product_analytics_events),
    'rate_limit_rows', (select count(*) from private.request_rate_limits),
    'movies', (select count(*) from public.movies)
  ),
  'test_account_candidates', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select id, created_at,
      case when email ~ '^security-probe-[ab]-[0-9a-f-]{36}@example\.com$'
        then 'exact_security_probe_email_pattern'
        else 'reserved_example_domain_requires_review' end as evidence
    from auth.users
    where email ~ '^security-probe-[ab]-[0-9a-f-]{36}@example\.com$'
      or email ~* '@(example\.(com|org|net|test)|[^@]+\.test)$'
  ) x),
  'seed_game', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select id, invite_code, status from public.games
    where id = '10000000-0000-4000-8000-000000000001'
      or invite_code = 'VIDI01'
  ) x),
  'seed_results', (select count(*) from public.compatibility_results where metrics @> '{"seed":true}'::jsonb),
  'e2e_game_candidates', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select g.id, g.status, g.created_at, count(*) as players,
      'guest_names_match_e2e_fixture_only_not_proof' as evidence
    from public.games g join public.game_players gp on gp.game_id=g.id
    where g.host_profile_id is null and g.mode='quick'
    group by g.id
    having count(*) between 2 and 5 and bool_and(gp.profile_id is null)
      and (array_agg(gp.display_name order by gp.display_name) = array['Player A','Player B']
        or (bool_and(gp.display_name ~ '^Group Player [1-5]$') and count(distinct gp.display_name)=count(*)))
  ) x),
  'game_status_counts', (select jsonb_agg(x) from (select status,count(*) from public.games group by status order by status) x),
  'table_security', (select jsonb_agg(x) from (
    select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls,
      r.rolname as role,
      array(select p from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p
        where has_table_privilege(r.oid,c.oid,p)) as privileges
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
      cross join pg_roles r
    where n.nspname in ('public','private') and c.relkind='r'
      and r.rolname in ('anon','authenticated','service_role')
    order by n.nspname,c.relname,r.rolname
  ) x),
  'function_security', (select jsonb_agg(x) from (
    select n.nspname as schema, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
      p.prosecdef as security_definer, p.proconfig as settings,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
    order by n.nspname,p.proname
  ) x),
  'sequence_security', (select jsonb_agg(x) from (
    select c.relname, r.rolname, has_sequence_privilege(r.oid,c.oid,'USAGE') as usage,
      has_sequence_privilege(r.oid,c.oid,'SELECT') as select_allowed,
      has_sequence_privilege(r.oid,c.oid,'UPDATE') as update_allowed
    from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
    where n.nspname='public' and c.relkind='S' and r.rolname in ('anon','authenticated','service_role')
    order by c.relname,r.rolname
  ) x),
  'foreign_keys', (select jsonb_agg(x) from (
    select conrelid::regclass::text as child, confrelid::regclass::text as parent, pg_get_constraintdef(oid) as definition
    from pg_constraint where contype='f' and connamespace='public'::regnamespace order by conrelid::regclass::text,conname
  ) x)
) as review;
commit;
