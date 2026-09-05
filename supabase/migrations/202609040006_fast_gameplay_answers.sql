-- Collapse the hot swipe persistence path into one database round trip. The
-- caller still supplies only its server-verified identity; this function is
-- service-role-only and resolves all internal IDs inside the transaction.
create or replace function public.record_game_answer_by_identity(
  p_invite_code text,
  p_profile_id uuid,
  p_guest_session_id uuid,
  p_tmdb_id bigint,
  p_seen boolean,
  p_reaction public.movie_reaction
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  answer_result jsonb;
  existing_reaction public.movie_reaction;
  existing_seen boolean;
  game_mode public.game_mode;
  resolved_game_id uuid;
  resolved_movie_id uuid;
  resolved_player_id uuid;
  player_finished_at timestamptz;
  player_progress integer;
begin
  if (p_profile_id is null) = (p_guest_session_id is null) then
    raise exception using message = 'Exactly one player identity is required';
  end if;

  select
    g.id,
    g.mode,
    gp.id,
    gp.progress,
    gp.finished_at,
    m.id
  into
    resolved_game_id,
    game_mode,
    resolved_player_id,
    player_progress,
    player_finished_at,
    resolved_movie_id
  from public.games g
  join public.game_players gp on gp.game_id = g.id
  join public.movies m on m.tmdb_id = p_tmdb_id
  join public.game_movies gm
    on gm.game_id = g.id and gm.movie_id = m.id
  where g.invite_code = upper(trim(p_invite_code))
    and (
      (p_profile_id is not null and gp.profile_id = p_profile_id) or
      (p_guest_session_id is not null and gp.guest_session_id = p_guest_session_id)
    )
  limit 1;

  if resolved_player_id is null then
    raise exception using message = 'Game player or movie not found';
  end if;

  select r.seen, r.reaction
  into existing_seen, existing_reaction
  from public.ratings r
  where r.game_player_id = resolved_player_id
    and r.movie_id = resolved_movie_id;

  -- Network retries after a committed write are successful no-ops.
  if found
    and existing_seen = p_seen
    and existing_reaction is not distinct from p_reaction then
    return jsonb_build_object(
      'complete', player_finished_at is not null,
      'game_id', resolved_game_id,
      'mode', game_mode,
      'progress', player_progress,
      'reaction_pending', existing_seen and existing_reaction is null
    );
  end if;

  select public.record_game_answer(
    resolved_player_id,
    resolved_game_id,
    resolved_movie_id,
    p_seen,
    p_reaction
  ) into answer_result;

  return answer_result || jsonb_build_object(
    'game_id', resolved_game_id,
    'mode', game_mode
  );
end;
$$;

revoke all on function public.record_game_answer_by_identity(
  text,
  uuid,
  uuid,
  bigint,
  boolean,
  public.movie_reaction
) from public, anon, authenticated;

grant execute on function public.record_game_answer_by_identity(
  text,
  uuid,
  uuid,
  bigint,
  boolean,
  public.movie_reaction
) to service_role;
