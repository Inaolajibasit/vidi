-- Run only in an isolated test database with the migration chain applied.
-- Fixtures and table changes roll back. Sequence calls are local test activity.
begin;

do $$
declare browser_role text; target text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    foreach target in array array['achievements','profile_achievements','account_attention_reads'] loop
      if has_table_privilege(browser_role,'public.' || target,'TRUNCATE')
        or has_table_privilege(browser_role,'public.' || target,'REFERENCES')
        or has_table_privilege(browser_role,'public.' || target,'TRIGGER')
        or has_table_privilege(browser_role,'public.' || target,'MAINTAIN') then
        raise exception 'Unsafe browser table privileges remain: %.%', browser_role, target;
      end if;
    end loop;
  end loop;
end $$;

insert into auth.users (id) values
  ('eeeeeeee-1111-4111-8111-111111111111'),
  ('eeeeeeee-2222-4222-8222-222222222222');
insert into public.profiles (id,display_name) values
  ('eeeeeeee-1111-4111-8111-111111111111','Permission test A'),
  ('eeeeeeee-2222-4222-8222-222222222222','Permission test B')
on conflict (id) do nothing;
insert into public.achievements (slug,name,description)
values ('permission_test','Permission test','Local fixture');
insert into public.profile_achievements (profile_id,achievement_slug)
values ('eeeeeeee-1111-4111-8111-111111111111','permission_test');
insert into public.account_attention_reads (profile_id,kind,entity_id)
values ('eeeeeeee-2222-4222-8222-222222222222','game','eeeeeeee-3333-4333-8333-333333333333');

set local role anon;
do $$
begin
  if not exists (select 1 from public.achievements where slug='permission_test')
    or not exists (select 1 from public.profile_achievements where achievement_slug='permission_test') then
    raise exception 'Public achievement reads regressed';
  end if;
  begin
    perform 1 from public.account_attention_reads;
    raise exception 'Anonymous attention reads unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    truncate public.account_attention_reads;
    raise exception 'Anonymous truncate unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform nextval('public.challenge_events_id_seq');
    raise exception 'Anonymous challenge sequence access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','eeeeeeee-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into public.account_attention_reads (profile_id,kind,entity_id)
values ('eeeeeeee-1111-4111-8111-111111111111','game','eeeeeeee-3333-4333-8333-333333333333')
on conflict (profile_id,kind,entity_id) do update set seen_at=now();
do $$
declare affected integer;
begin
  if (select count(*) from public.account_attention_reads) <> 1 then
    raise exception 'Attention reads are not scoped to the authenticated user';
  end if;
  update public.account_attention_reads set seen_at=now()
    where profile_id='eeeeeeee-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user attention update allowed'; end if;
  begin
    insert into public.account_attention_reads (profile_id,kind,entity_id)
    values ('eeeeeeee-2222-4222-8222-222222222222','game','eeeeeeee-4444-4444-8444-444444444444');
    raise exception 'Cross-user attention insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.account_attention_reads;
    raise exception 'Attention deletion unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    truncate public.account_attention_reads;
    raise exception 'Authenticated truncate unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.achievements (slug,name,description) values ('forged','Forged','Forged');
    raise exception 'Achievement forging unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform setval('public.product_analytics_events_id_seq',1);
    raise exception 'Analytics sequence mutation unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Server writes retain their existing table and sequence access.
set local role service_role;
insert into public.product_analytics_events (event_name,properties)
values ('home_viewed','{}');
insert into public.account_attention_reads (profile_id,kind,entity_id)
values ('eeeeeeee-2222-4222-8222-222222222222','game','eeeeeeee-5555-4555-8555-555555555555');
reset role;

create table public.permission_default_test (id bigint generated always as identity);
do $$
declare browser_role text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    if has_table_privilege(browser_role,'public.permission_default_test','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      or has_sequence_privilege(browser_role,'public.permission_default_test_id_seq','USAGE,SELECT,UPDATE') then
      raise exception 'New objects still inherit browser privileges';
    end if;
  end loop;
  if not has_table_privilege('service_role','public.permission_default_test','INSERT')
    or not has_sequence_privilege('service_role','public.permission_default_test_id_seq','USAGE') then
    raise exception 'Server defaults regressed';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and
      (has_function_privilege('anon',p.oid,'EXECUTE')
       or has_function_privilege('authenticated',p.oid,'EXECUTE')
       or not has_function_privilege('service_role',p.oid,'EXECUTE'))
  ) then raise exception 'Server-only RPC grants regressed'; end if;
end $$;

rollback;
select 'browser privilege regression checks passed' as result;
