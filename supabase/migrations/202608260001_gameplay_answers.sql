-- Core gameplay persistence. A Seen answer may temporarily have no reaction so
-- refresh recovery can reopen the lightweight reaction step. Completion and
-- progress remain transactional and answers must arrive in deck order.

alter table public.ratings
  drop constraint ratings_reaction_consistency;

alter table public.ratings
  add constraint ratings_reaction_consistency check (
    (not seen and reaction is null) or seen
  );

alter table public.movie_genres
  add column position smallint not null default 1;

alter table public.movie_genres
  add constraint movie_genres_position_positive check (position > 0);

create index movie_genres_movie_position_idx
  on public.movie_genres (movie_id, position);

create or replace function public.record_game_answer(
  p_game_player_id uuid,
  p_game_id uuid,
  p_movie_id uuid,
  p_seen boolean,
  p_reaction public.movie_reaction
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_progress integer;
  deck_count integer;
  expected_movie_id uuid;
  new_progress integer;
  game_complete boolean;
begin
  if (not p_seen and p_reaction is not null) then
    raise exception using message = 'Unseen movies cannot have a reaction';
  end if;

  select gp.progress
  into current_progress
  from public.game_players gp
  join public.games g on g.id = gp.game_id
  where gp.id = p_game_player_id
    and gp.game_id = p_game_id
    and g.status = 'active'
  for update of gp;

  if not found then
    raise exception using message = 'Active game player not found';
  end if;

  select count(*) into deck_count
  from public.game_movies gm
  where gm.game_id = p_game_id;

  select gm.movie_id into expected_movie_id
  from public.game_movies gm
  where gm.game_id = p_game_id
    and gm.position = current_progress + 1;

  if expected_movie_id is null then
    raise exception using message = 'The player has already finished';
  end if;

  if expected_movie_id <> p_movie_id then
    raise exception using message = 'Answer is out of deck order';
  end if;

  insert into public.ratings (
    game_player_id,
    game_id,
    movie_id,
    seen,
    reaction
  ) values (
    p_game_player_id,
    p_game_id,
    p_movie_id,
    p_seen,
    p_reaction
  )
  on conflict (game_player_id, movie_id) do update set
    seen = excluded.seen,
    reaction = excluded.reaction,
    updated_at = now();

  select count(*) into new_progress
  from public.ratings r
  where r.game_player_id = p_game_player_id
    and (not r.seen or r.reaction is not null);

  update public.game_players
  set
    progress = new_progress,
    finished_at = case
      when new_progress = deck_count then coalesce(finished_at, now())
      else null
    end
  where id = p_game_player_id;

  game_complete := new_progress = deck_count;

  if game_complete and not exists (
    select 1
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.finished_at is null
  ) then
    update public.games
    set status = 'waiting_results'
    where id = p_game_id and status = 'active';
  end if;

  return jsonb_build_object(
    'complete', game_complete,
    'progress', new_progress,
    'reaction_pending', p_seen and p_reaction is null
  );
end;
$$;

revoke all on function public.record_game_answer(
  uuid,
  uuid,
  uuid,
  boolean,
  public.movie_reaction
) from public, anon, authenticated;

grant execute on function public.record_game_answer(
  uuid,
  uuid,
  uuid,
  boolean,
  public.movie_reaction
) to service_role;
