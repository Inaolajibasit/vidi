do $$
begin
  create type public.watchlist_kind as enum ('personal', 'shared');
exception
  when duplicate_object then null;
end $$;

alter table public.watchlists
  add column if not exists kind public.watchlist_kind not null default 'personal',
  add column if not exists participant_names text[] not null default '{}';

alter table public.watchlist_items
  add column if not exists watched_at timestamptz;

update public.watchlists as list
set
  kind = 'shared',
  participant_names = coalesce((
    select array_agg(player.display_name order by player.joined_at)
    from public.game_players as player
    where player.game_id = list.source_game_id
  ), '{}')
where list.source_game_id is not null
  and (
    select count(*)
    from public.game_players as player
    where player.game_id = list.source_game_id
  ) between 2 and 5;

update public.watchlists
set source_game_id = null,
    participant_names = '{}'
where kind = 'personal'
  and source_game_id is not null;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by profile_id
      order by created_at, id
    ) as keep_id,
    row_number() over (
      partition by profile_id
      order by created_at, id
    ) as position
  from public.watchlists
  where kind = 'personal'
)
insert into public.watchlist_items (
  watchlist_id,
  movie_id,
  source_game_id,
  watched_at,
  created_at
)
select
  ranked.keep_id,
  item.movie_id,
  item.source_game_id,
  item.watched_at,
  item.created_at
from ranked
join public.watchlist_items as item on item.watchlist_id = ranked.id
where ranked.position > 1
on conflict (watchlist_id, movie_id) do nothing;

with ranked as (
  select
    id,
    row_number() over (
      partition by profile_id
      order by created_at, id
    ) as position
  from public.watchlists
  where kind = 'personal'
)
delete from public.watchlists as list
using ranked
where list.id = ranked.id
  and ranked.position > 1;

alter table public.watchlists
  drop constraint if exists watchlists_kind_source_check,
  add constraint watchlists_kind_source_check check (
    (kind = 'personal' and source_game_id is null and cardinality(participant_names) = 0)
    or
    (kind = 'shared' and source_game_id is not null and cardinality(participant_names) between 2 and 5)
  );

create unique index if not exists watchlists_one_personal_per_profile_idx
  on public.watchlists (profile_id)
  where kind = 'personal';

create unique index if not exists watchlists_one_shared_per_game_idx
  on public.watchlists (profile_id, source_game_id)
  where kind = 'shared';

create index if not exists watchlist_items_unwatched_idx
  on public.watchlist_items (watchlist_id, created_at desc)
  where watched_at is null;
