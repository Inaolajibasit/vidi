-- Results unlock only after calculation completes. In particular,
-- waiting_results must not expose another participant's raw ratings.
create or replace function private.results_visible(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    where g.id = target_game_id
      and g.status = 'completed'
      and private.is_game_participant(g.id)
  );
$$;

-- Game state is mutated only by identity-checking server actions and
-- service-role-only RPCs. Removing browser write grants prevents participants
-- from editing progress, changing game status, or rewriting ratings directly.
revoke insert, update, delete on public.games from authenticated;
revoke insert, update, delete on public.game_players from authenticated;
revoke insert, update, delete on public.ratings from authenticated;
drop policy if exists "authenticated users can create hosted games" on public.games;
drop policy if exists "hosts can update games" on public.games;
drop policy if exists "authenticated users can join as themselves" on public.game_players;
drop policy if exists "players can update their own public state" on public.game_players;
drop policy if exists "players can create their own ratings" on public.ratings;
drop policy if exists "players can update their own ratings" on public.ratings;
drop policy if exists "players can delete their own ratings" on public.ratings;

revoke execute on function private.is_game_participant(uuid)
  from public, anon;
revoke execute on function private.owns_game_player(uuid)
  from public, anon;
revoke execute on function private.owns_watchlist(uuid)
  from public, anon;
revoke execute on function private.results_visible(uuid)
  from public, anon;

create table if not exists private.request_rate_limits (
  scope text not null,
  actor_hash text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 1,
  primary key (scope, actor_hash, window_started_at),
  constraint request_rate_limits_scope check (scope ~ '^[a-z_]{1,40}$'),
  constraint request_rate_limits_actor_hash check (actor_hash ~ '^[a-f0-9]{64}$'),
  constraint request_rate_limits_attempts_positive check (attempts > 0)
);

revoke all on private.request_rate_limits from public, anon, authenticated;

create or replace function public.consume_request_rate_limit(
  p_scope text,
  p_actor_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
  window_start timestamptz;
begin
  if p_scope !~ '^[a-z_]{1,40}$'
    or p_actor_hash !~ '^[a-f0-9]{64}$'
    or p_limit not between 1 and 10000
    or p_window_seconds not between 10 and 86400 then
    raise exception using message = 'Invalid rate limit';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds)
    * p_window_seconds
  );

  insert into private.request_rate_limits (
    scope, actor_hash, window_started_at, attempts
  ) values (
    p_scope, p_actor_hash, window_start, 1
  )
  on conflict (scope, actor_hash, window_started_at)
  do update set attempts = private.request_rate_limits.attempts + 1
  returning attempts into current_attempts;

  delete from private.request_rate_limits
  where scope = p_scope
    and actor_hash = p_actor_hash
    and window_started_at < clock_timestamp() - interval '2 days';

  return current_attempts <= p_limit;
end;
$$;

revoke all on function public.consume_request_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_request_rate_limit(text, text, integer, integer)
  to service_role;
