create or replace function public.claim_guest_history(p_user_id uuid, p_guest_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g record; existing_id uuid; claimed integer := 0;
begin
  if p_user_id is null or p_guest_session_id is null or not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Invalid claim'; end if;
  for g in select * from public.game_players where guest_session_id=p_guest_session_id for update loop
    select id into existing_id from public.game_players where game_id=g.game_id and profile_id=p_user_id;
    if existing_id is not null then
      delete from public.ratings r using public.ratings e where r.game_player_id=g.id and e.game_player_id=existing_id and e.movie_id=r.movie_id;
      update public.ratings set game_player_id=existing_id where game_player_id=g.id;
      delete from public.game_players where id=g.id;
    else
      update public.game_players set profile_id=p_user_id, guest_session_id=null where id=g.id;
    end if;
    update public.games set host_profile_id=p_user_id where id=g.game_id and host_profile_id is null;
    claimed := claimed + 1;
  end loop;
  update public.profiles set movies_seen_count=(select count(distinct r.movie_id) from public.ratings r join public.game_players gp on gp.id=r.game_player_id where gp.profile_id=p_user_id and r.seen) where id=p_user_id;
  return jsonb_build_object('games_claimed',claimed);
end; $$;
revoke all on function public.claim_guest_history(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_guest_history(uuid,uuid) to service_role;

drop policy if exists "authenticated users can read profiles" on public.profiles;
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
grant select on public.profiles to anon;

create table public.achievements (slug text primary key check (slug ~ '^[a-z0-9_]+$'), name text not null, description text not null, criteria jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.profile_achievements (profile_id uuid not null references public.profiles(id) on delete cascade, achievement_slug text not null references public.achievements(slug) on delete cascade, earned_at timestamptz not null default now(), primary key(profile_id, achievement_slug));
alter table public.achievements enable row level security;
alter table public.profile_achievements enable row level security;
create policy "achievements are public" on public.achievements for select to anon, authenticated using(true);
create policy "earned achievements are public" on public.profile_achievements for select to anon, authenticated using(true);
grant select on public.achievements, public.profile_achievements to anon, authenticated;
