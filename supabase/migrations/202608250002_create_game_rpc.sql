-- Atomic Classic game creation. Only the server-side service role may execute
-- this function; clients never receive database IDs or guest session secrets.

create or replace function public.create_classic_game(
  p_invite_code text,
  p_mode public.game_mode,
  p_max_players smallint,
  p_profile_id uuid,
  p_guest_session_id uuid,
  p_display_name text,
  p_movie_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_game_id uuid;
  expected_movie_count integer;
begin
  if p_invite_code !~ '^[A-Z0-9]{6}$' then
    raise exception using message = 'Invalid invite code';
  end if;

  if p_max_players not between 2 and 5 then
    raise exception using message = 'Maximum players must be between 2 and 5';
  end if;

  if (p_profile_id is null) = (p_guest_session_id is null) then
    raise exception using message = 'Exactly one host identity is required';
  end if;

  if char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception using message = 'Host display name must be between 1 and 50 characters';
  end if;

  expected_movie_count := case p_mode
    when 'quick' then 30
    when 'proper' then 100
    when 'no_life' then 200
  end;

  if coalesce(cardinality(p_movie_ids), 0) <> expected_movie_count then
    raise exception using message = format('Classic mode requires exactly %s movies', expected_movie_count);
  end if;

  if (select count(distinct movie_id) from unnest(p_movie_ids) as movie_id) <> expected_movie_count then
    raise exception using message = 'The movie deck contains duplicate movies';
  end if;

  if (
    select count(*)
    from public.movies m
    where m.id = any(p_movie_ids)
  ) <> expected_movie_count then
    raise exception using message = 'The movie deck contains unknown movies';
  end if;

  insert into public.games (invite_code, host_profile_id, mode, max_players)
  values (p_invite_code, p_profile_id, p_mode, p_max_players)
  returning id into created_game_id;

  insert into public.game_players (
    game_id,
    profile_id,
    guest_session_id,
    display_name
  ) values (
    created_game_id,
    p_profile_id,
    p_guest_session_id,
    btrim(p_display_name)
  );

  insert into public.game_movies (game_id, movie_id, position)
  select
    created_game_id,
    deck.movie_id,
    deck.position::smallint
  from unnest(p_movie_ids) with ordinality as deck(movie_id, position);

  return p_invite_code;
end;
$$;

revoke all on function public.create_classic_game(
  text,
  public.game_mode,
  smallint,
  uuid,
  uuid,
  text,
  uuid[]
) from public, anon, authenticated;

grant execute on function public.create_classic_game(
  text,
  public.game_mode,
  smallint,
  uuid,
  uuid,
  text,
  uuid[]
) to service_role;
