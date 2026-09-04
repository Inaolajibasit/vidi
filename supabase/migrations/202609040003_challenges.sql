do $$
begin
  create type public.challenge_event_type as enum (
    'challenge_created',
    'challenge_opened',
    'challenge_started',
    'challenge_completed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  code varchar(12) not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  creator_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_game_id uuid not null references public.games(id) on delete cascade,
  source_player_id uuid not null references public.game_players(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint challenges_reusable_source unique (creator_profile_id, source_game_id)
);

create table if not exists public.challenge_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  game_id uuid not null unique references public.games(id) on delete cascade,
  participant_profile_id uuid references public.profiles(id) on delete set null,
  participant_guest_session_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint challenge_attempt_identity check (
    (participant_profile_id is not null)::integer +
    (participant_guest_session_id is not null)::integer = 1
  )
);

create unique index if not exists challenge_attempt_profile_idx
  on public.challenge_attempts (challenge_id, participant_profile_id)
  where participant_profile_id is not null;
create unique index if not exists challenge_attempt_guest_idx
  on public.challenge_attempts (challenge_id, participant_guest_session_id)
  where participant_guest_session_id is not null;

create table if not exists public.challenge_events (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  attempt_id uuid references public.challenge_attempts(id) on delete cascade,
  event_type public.challenge_event_type not null,
  profile_id uuid references public.profiles(id) on delete set null,
  guest_session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists challenges_creator_created_idx
  on public.challenges (creator_profile_id, created_at desc);
create index if not exists challenge_attempts_challenge_started_idx
  on public.challenge_attempts (challenge_id, started_at desc);
create index if not exists challenge_events_challenge_created_idx
  on public.challenge_events (challenge_id, created_at desc);

alter table public.challenges enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.challenge_events enable row level security;

revoke all on public.challenges, public.challenge_attempts, public.challenge_events
  from public, anon, authenticated;

create or replace function public.start_challenge_attempt(
  p_challenge_id uuid,
  p_game_invite_code varchar,
  p_display_name text,
  p_profile_id uuid,
  p_guest_session_id uuid
)
returns varchar
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_row record;
  existing_code varchar;
  source_game_row record;
  source_player_row record;
  attempt_game_id uuid := extensions.gen_random_uuid();
  challenger_player_id uuid := extensions.gen_random_uuid();
  participant_player_id uuid := extensions.gen_random_uuid();
  deck_size integer;
  attempt_id uuid;
begin
  if (p_profile_id is not null)::integer +
     (p_guest_session_id is not null)::integer <> 1 then
    raise exception 'Exactly one participant identity is required';
  end if;

  select c.* into challenge_row
  from public.challenges c
  where c.id = p_challenge_id and c.active
  for update;
  if not found then raise exception 'Challenge is unavailable'; end if;
  if p_profile_id = challenge_row.creator_profile_id then
    raise exception 'Challenge creators cannot challenge themselves';
  end if;

  select g.invite_code into existing_code
  from public.challenge_attempts a
  join public.games g on g.id = a.game_id
  where a.challenge_id = p_challenge_id
    and (
      (p_profile_id is not null and a.participant_profile_id = p_profile_id)
      or
      (p_guest_session_id is not null and a.participant_guest_session_id = p_guest_session_id)
    )
  limit 1;
  if existing_code is not null then return existing_code; end if;

  select g.* into source_game_row
  from public.games g
  where g.id = challenge_row.source_game_id and g.status = 'completed';
  if not found then raise exception 'Source game is not complete'; end if;

  select gp.* into source_player_row
  from public.game_players gp
  where gp.id = challenge_row.source_player_id
    and gp.game_id = challenge_row.source_game_id
    and gp.profile_id = challenge_row.creator_profile_id
    and gp.finished_at is not null;
  if not found then raise exception 'Challenge owner has no completed answers'; end if;

  select count(*) into deck_size
  from public.game_movies gm
  where gm.game_id = challenge_row.source_game_id;
  if deck_size < 1 then raise exception 'Source deck is empty'; end if;

  insert into public.games (
    id, invite_code, host_profile_id, mode, max_players, status, started_at
  ) values (
    attempt_game_id, p_game_invite_code, challenge_row.creator_profile_id,
    source_game_row.mode, 2, 'active', now()
  );

  insert into public.game_players (
    id, game_id, profile_id, display_name, progress, finished_at
  ) values (
    challenger_player_id, attempt_game_id, challenge_row.creator_profile_id,
    source_player_row.display_name, deck_size, now()
  );

  insert into public.game_players (
    id, game_id, profile_id, guest_session_id, display_name
  ) values (
    participant_player_id, attempt_game_id, p_profile_id,
    p_guest_session_id, left(btrim(p_display_name), 50)
  );

  insert into public.game_movies (game_id, movie_id, position)
  select attempt_game_id, gm.movie_id, gm.position
  from public.game_movies gm
  where gm.game_id = challenge_row.source_game_id
  order by gm.position;

  insert into public.ratings (
    game_player_id, game_id, movie_id, seen, reaction
  )
  select challenger_player_id, attempt_game_id, r.movie_id, r.seen, r.reaction
  from public.ratings r
  where r.game_player_id = challenge_row.source_player_id;

  insert into public.challenge_attempts (
    challenge_id, game_id, participant_profile_id,
    participant_guest_session_id
  ) values (
    p_challenge_id, attempt_game_id, p_profile_id, p_guest_session_id
  ) returning id into attempt_id;

  insert into public.challenge_events (
    challenge_id, attempt_id, event_type, profile_id, guest_session_id
  ) values (
    p_challenge_id, attempt_id, 'challenge_started', p_profile_id,
    p_guest_session_id
  );

  return p_game_invite_code;
end;
$$;

revoke all on function public.start_challenge_attempt(
  uuid, varchar, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.start_challenge_attempt(
  uuid, varchar, text, uuid, uuid
) to service_role;

notify pgrst, 'reload schema';
