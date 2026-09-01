-- vidi foundational schema
-- Guests are intentionally served through trusted server endpoints using the
-- service role. Browser-provided guest_session_id values are not identities.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.game_mode as enum ('quick', 'proper', 'no_life');
create type public.game_status as enum ('waiting', 'active', 'waiting_results', 'completed', 'expired');
create type public.movie_reaction as enum ('loved', 'liked', 'meh', 'cant_remember');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.personalities (
  slug text primary key,
  name text not null unique,
  description text not null,
  result_copy text not null,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personalities_slug_format check (slug ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint personalities_criteria_object check (jsonb_typeof(criteria) = 'object')
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique,
  display_name text not null,
  avatar_url text,
  movies_seen_count integer not null default 0,
  current_personality text references public.personalities (slug) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username::text ~ '^[A-Za-z0-9_]{3,24}$'
  ),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 50),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048),
  constraint profiles_movies_seen_nonnegative check (movies_seen_count >= 0)
);

create table public.friendships (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct_profiles check (requester_id <> addressee_id)
);

create unique index friendships_unique_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_status_idx on public.friendships (requester_id, status);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);

create table public.movies (
  id uuid primary key default extensions.gen_random_uuid(),
  tmdb_id bigint not null unique,
  title text not null,
  original_title text not null,
  poster_path text,
  backdrop_path text,
  release_date date,
  release_year smallint,
  overview text not null default '',
  popularity numeric(12, 4) not null default 0,
  vote_average numeric(4, 2) not null default 0,
  vote_count integer not null default 0,
  runtime smallint,
  original_language varchar(10) not null,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(original_title, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movies_tmdb_id_positive check (tmdb_id > 0),
  constraint movies_title_present check (char_length(title) > 0 and char_length(original_title) > 0),
  constraint movies_paths_valid check (
    (poster_path is null or poster_path ~ '^/') and
    (backdrop_path is null or backdrop_path ~ '^/')
  ),
  constraint movies_release_year_valid check (release_year is null or release_year between 1888 and 2200),
  constraint movies_release_year_matches check (
    release_date is null or release_year is null or extract(year from release_date)::smallint = release_year
  ),
  constraint movies_popularity_nonnegative check (popularity >= 0),
  constraint movies_vote_average_range check (vote_average between 0 and 10),
  constraint movies_vote_count_nonnegative check (vote_count >= 0),
  constraint movies_runtime_positive check (runtime is null or runtime > 0)
);

create index movies_search_idx on public.movies using gin (search_vector);
create index movies_release_year_idx on public.movies (release_year desc) where release_year is not null;
create index movies_popularity_idx on public.movies (popularity desc);
create index movies_vote_quality_idx on public.movies (vote_average desc, vote_count desc);

create table public.genres (
  tmdb_id integer primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint genres_tmdb_id_positive check (tmdb_id > 0),
  constraint genres_name_present check (char_length(name) > 0)
);

create table public.movie_genres (
  movie_id uuid not null references public.movies (id) on delete cascade,
  genre_id integer not null references public.genres (tmdb_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (movie_id, genre_id)
);

create index movie_genres_genre_movie_idx on public.movie_genres (genre_id, movie_id);

create table public.movie_keywords (
  movie_id uuid not null references public.movies (id) on delete cascade,
  tmdb_keyword_id bigint not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (movie_id, tmdb_keyword_id),
  constraint movie_keywords_tmdb_id_positive check (tmdb_keyword_id > 0),
  constraint movie_keywords_name_present check (char_length(name) > 0)
);

create index movie_keywords_name_idx on public.movie_keywords (lower(name));
create index movie_keywords_tmdb_idx on public.movie_keywords (tmdb_keyword_id);

create table public.games (
  id uuid primary key default extensions.gen_random_uuid(),
  invite_code text not null unique,
  host_profile_id uuid references public.profiles (id) on delete set null,
  mode public.game_mode not null,
  max_players smallint not null default 5,
  status public.game_status not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint games_invite_code_format check (invite_code ~ '^[A-Z0-9]{6}$'),
  constraint games_player_limit check (max_players between 2 and 5),
  constraint games_started_timeline check (started_at is null or started_at >= created_at),
  constraint games_completed_timeline check (
    completed_at is null or (started_at is not null and completed_at >= started_at)
  ),
  constraint games_status_timestamps check (
    (status = 'waiting' and started_at is null and completed_at is null) or
    (status in ('active', 'waiting_results') and started_at is not null and completed_at is null) or
    (status = 'completed' and started_at is not null and completed_at is not null) or
    status = 'expired'
  )
);

create index games_host_created_idx on public.games (host_profile_id, created_at desc)
  where host_profile_id is not null;
create index games_status_created_idx on public.games (status, created_at desc);
create index games_expiry_candidates_idx on public.games (created_at)
  where status in ('waiting', 'active');

create table public.game_players (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  guest_session_id uuid,
  display_name text not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  progress smallint not null default 0,
  constraint game_players_identity_exactly_one check (
    (profile_id is not null and guest_session_id is null) or
    (profile_id is null and guest_session_id is not null)
  ),
  constraint game_players_display_name_length check (char_length(display_name) between 1 and 50),
  constraint game_players_progress_range check (progress between 0 and 200),
  constraint game_players_finished_timeline check (finished_at is null or finished_at >= joined_at),
  unique (game_id, id)
);

create unique index game_players_profile_unique_idx on public.game_players (game_id, profile_id)
  where profile_id is not null;
create unique index game_players_guest_unique_idx on public.game_players (game_id, guest_session_id)
  where guest_session_id is not null;
create index game_players_profile_history_idx on public.game_players (profile_id, joined_at desc)
  where profile_id is not null;
create index game_players_game_finished_idx on public.game_players (game_id, finished_at);

create table public.game_movies (
  game_id uuid not null references public.games (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete restrict,
  position smallint not null,
  created_at timestamptz not null default now(),
  primary key (game_id, movie_id),
  unique (game_id, position),
  constraint game_movies_position_range check (position between 1 and 200)
);

create index game_movies_movie_idx on public.game_movies (movie_id);

create table public.ratings (
  game_player_id uuid not null,
  game_id uuid not null,
  movie_id uuid not null,
  seen boolean not null,
  reaction public.movie_reaction,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_player_id, movie_id),
  foreign key (game_id, game_player_id)
    references public.game_players (game_id, id) on delete cascade,
  foreign key (game_id, movie_id)
    references public.game_movies (game_id, movie_id) on delete cascade,
  constraint ratings_reaction_consistency check (
    (seen and reaction is not null) or (not seen and reaction is null)
  )
);

create index ratings_game_movie_idx on public.ratings (game_id, movie_id);
create index ratings_movie_seen_idx on public.ratings (movie_id, seen) where seen;
create index ratings_player_seen_idx on public.ratings (game_player_id, seen);

create table public.watchlists (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Watchlist',
  source_game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlists_name_length check (char_length(name) between 1 and 80)
);

create index watchlists_profile_updated_idx on public.watchlists (profile_id, updated_at desc);
create index watchlists_source_game_idx on public.watchlists (source_game_id)
  where source_game_id is not null;

create table public.watchlist_items (
  id uuid primary key default extensions.gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  source_game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (watchlist_id, movie_id)
);

create index watchlist_items_movie_idx on public.watchlist_items (movie_id);
create index watchlist_items_watchlist_created_idx on public.watchlist_items (watchlist_id, created_at desc);

create table public.compatibility_results (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  subject_player_id uuid,
  compared_player_id uuid,
  overall_score numeric(5, 2) not null,
  taste_score numeric(5, 2) not null,
  knowledge_score numeric(5, 2) not null,
  shared_seen_count integer not null default 0,
  shared_favourite_movie_ids uuid[] not null default '{}',
  disagreement_movie_ids uuid[] not null default '{}',
  watchlist_movie_ids uuid[] not null default '{}',
  knowledge_winner_player_id uuid,
  personality_slug text references public.personalities (slug) on update cascade on delete set null,
  result_copy text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (game_id, subject_player_id)
    references public.game_players (game_id, id) on delete cascade,
  foreign key (game_id, compared_player_id)
    references public.game_players (game_id, id) on delete cascade,
  foreign key (game_id, knowledge_winner_player_id)
    references public.game_players (game_id, id) on delete set null (knowledge_winner_player_id),
  constraint compatibility_results_scope check (
    (subject_player_id is null and compared_player_id is null) or
    (subject_player_id is not null and compared_player_id is not null and subject_player_id <> compared_player_id)
  ),
  constraint compatibility_results_scores check (
    overall_score between 0 and 100 and
    taste_score between 0 and 100 and
    knowledge_score between 0 and 100
  ),
  constraint compatibility_results_counts check (shared_seen_count >= 0),
  constraint compatibility_results_metrics_object check (jsonb_typeof(metrics) = 'object')
);

create unique index compatibility_results_group_unique_idx on public.compatibility_results (game_id)
  where subject_player_id is null and compared_player_id is null;
create unique index compatibility_results_pair_unique_idx
  on public.compatibility_results (
    game_id,
    least(subject_player_id, compared_player_id),
    greatest(subject_player_id, compared_player_id)
  ) where subject_player_id is not null and compared_player_id is not null;
create index compatibility_results_subject_idx
  on public.compatibility_results (subject_player_id, created_at desc)
  where subject_player_id is not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'username' ~ '^[A-Za-z0-9_]{3,24}$'
        then (new.raw_user_meta_data ->> 'username')::extensions.citext
      else null
    end,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        'Player'
      ),
      50
    ),
    left(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), 2048)
  );
  return new;
end;
$$;

create or replace function private.is_game_participant(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.game_id = target_game_id
      and gp.profile_id = (select auth.uid())
  );
$$;

create or replace function private.owns_game_player(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.id = target_player_id
      and gp.profile_id = (select auth.uid())
  );
$$;

create or replace function private.owns_watchlist(target_watchlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.watchlists w
    where w.id = target_watchlist_id
      and w.profile_id = (select auth.uid())
  );
$$;

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
      and g.status in ('waiting_results', 'completed')
      and private.is_game_participant(g.id)
  );
$$;

create or replace function private.enforce_game_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status public.game_status;
  player_limit smallint;
  player_count integer;
begin
  select g.status, g.max_players
  into target_status, player_limit
  from public.games g
  where g.id = new.game_id
  for update;

  if not found then
    raise exception 'Game does not exist';
  end if;

  if target_status <> 'waiting' then
    raise exception 'Players can only join a waiting game';
  end if;

  select count(*) into player_count
  from public.game_players gp
  where gp.game_id = new.game_id;

  if player_count >= player_limit then
    raise exception 'Game is full';
  end if;

  return new;
end;
$$;

create or replace function private.protect_game_player_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.game_id <> old.game_id
    or new.profile_id is distinct from old.profile_id
    or new.guest_session_id is distinct from old.guest_session_id then
    raise exception 'Player identity cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function private.protect_friendship_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Friendship participants cannot be changed';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger friendships_set_updated_at before update on public.friendships
  for each row execute function private.set_updated_at();
create trigger movies_set_updated_at before update on public.movies
  for each row execute function private.set_updated_at();
create trigger games_set_updated_at before update on public.games
  for each row execute function private.set_updated_at();
create trigger game_players_set_updated_at before update on public.game_players
  for each row execute function private.set_updated_at();
create trigger ratings_set_updated_at before update on public.ratings
  for each row execute function private.set_updated_at();
create trigger watchlists_set_updated_at before update on public.watchlists
  for each row execute function private.set_updated_at();
create trigger compatibility_results_set_updated_at before update on public.compatibility_results
  for each row execute function private.set_updated_at();
create trigger personalities_set_updated_at before update on public.personalities
  for each row execute function private.set_updated_at();

create trigger game_players_enforce_capacity
  before insert on public.game_players
  for each row execute function private.enforce_game_capacity();
create trigger game_players_protect_identity
  before update on public.game_players
  for each row execute function private.protect_game_player_identity();
create trigger friendships_protect_identity
  before update on public.friendships
  for each row execute function private.protect_friendship_identity();

grant execute on function private.is_game_participant(uuid) to authenticated;
grant execute on function private.owns_game_player(uuid) to authenticated;
grant execute on function private.owns_watchlist(uuid) to authenticated;
grant execute on function private.results_visible(uuid) to authenticated;

alter table public.personalities enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.movies enable row level security;
alter table public.genres enable row level security;
alter table public.movie_genres enable row level security;
alter table public.movie_keywords enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_movies enable row level security;
alter table public.ratings enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.compatibility_results enable row level security;

create policy "authenticated users can read personality definitions"
  on public.personalities for select to authenticated using (true);

create policy "authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "friendship participants can read friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "users can request friendships"
  on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
create policy "friendship participants can update friendships"
  on public.friendships for update to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id))
  with check ((select auth.uid()) in (requester_id, addressee_id));
create policy "friendship participants can delete friendships"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "authenticated users can read movies"
  on public.movies for select to authenticated using (true);
create policy "authenticated users can read genres"
  on public.genres for select to authenticated using (true);
create policy "authenticated users can read movie genres"
  on public.movie_genres for select to authenticated using (true);
create policy "authenticated users can read movie keywords"
  on public.movie_keywords for select to authenticated using (true);

create policy "participants can read games"
  on public.games for select to authenticated
  using (host_profile_id = (select auth.uid()) or private.is_game_participant(id));
create policy "authenticated users can create hosted games"
  on public.games for insert to authenticated
  with check (host_profile_id = (select auth.uid()) and status = 'waiting');
create policy "hosts can update games"
  on public.games for update to authenticated
  using (host_profile_id = (select auth.uid()))
  with check (host_profile_id = (select auth.uid()));

create policy "participants can read game players"
  on public.game_players for select to authenticated
  using (private.is_game_participant(game_id));
create policy "authenticated users can join as themselves"
  on public.game_players for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and guest_session_id is null
  );
create policy "players can update their own public state"
  on public.game_players for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "participants can read the shared deck"
  on public.game_movies for select to authenticated
  using (private.is_game_participant(game_id));

create policy "players can read their ratings before results"
  on public.ratings for select to authenticated
  using (
    private.owns_game_player(game_player_id)
    or private.results_visible(game_id)
  );
create policy "players can create their own ratings"
  on public.ratings for insert to authenticated
  with check (private.owns_game_player(game_player_id));
create policy "players can update their own ratings"
  on public.ratings for update to authenticated
  using (private.owns_game_player(game_player_id))
  with check (private.owns_game_player(game_player_id));
create policy "players can delete their own ratings"
  on public.ratings for delete to authenticated
  using (private.owns_game_player(game_player_id));

create policy "users can read their watchlists"
  on public.watchlists for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "users can create their watchlists"
  on public.watchlists for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "users can update their watchlists"
  on public.watchlists for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "users can delete their watchlists"
  on public.watchlists for delete to authenticated
  using (profile_id = (select auth.uid()));

create policy "users can read their watchlist items"
  on public.watchlist_items for select to authenticated
  using (private.owns_watchlist(watchlist_id));
create policy "users can create their watchlist items"
  on public.watchlist_items for insert to authenticated
  with check (private.owns_watchlist(watchlist_id));
create policy "users can update their watchlist items"
  on public.watchlist_items for update to authenticated
  using (private.owns_watchlist(watchlist_id))
  with check (private.owns_watchlist(watchlist_id));
create policy "users can delete their watchlist items"
  on public.watchlist_items for delete to authenticated
  using (private.owns_watchlist(watchlist_id));

create policy "participants can read completed compatibility results"
  on public.compatibility_results for select to authenticated
  using (private.results_visible(game_id));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.personalities, public.profiles, public.friendships,
  public.movies, public.genres, public.movie_genres, public.movie_keywords,
  public.games, public.game_movies, public.ratings,
  public.watchlists, public.watchlist_items, public.compatibility_results
  to authenticated;
grant select (
  id,
  game_id,
  profile_id,
  display_name,
  joined_at,
  updated_at,
  finished_at,
  progress
) on public.game_players to authenticated;
grant insert on public.friendships, public.games, public.game_players,
  public.ratings, public.watchlists, public.watchlist_items
  to authenticated;
grant update on public.friendships, public.games, public.game_players,
  public.ratings, public.watchlists, public.watchlist_items
  to authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;
grant delete on public.friendships, public.ratings, public.watchlists, public.watchlist_items
  to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.games';
    execute 'alter publication supabase_realtime add table public.game_players';
    execute 'alter publication supabase_realtime add table public.game_movies';
  end if;
end
$$;
