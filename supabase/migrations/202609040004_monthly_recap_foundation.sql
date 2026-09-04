-- Read-optimized source data for on-demand monthly recaps. No scheduled job or
-- duplicate recap storage is required at this stage.
create index if not exists ratings_player_created_idx
  on public.ratings (game_player_id, created_at desc);

create index if not exists games_completed_idx
  on public.games (completed_at desc)
  where status = 'completed';

create index if not exists compatibility_results_compared_idx
  on public.compatibility_results (compared_player_id, created_at desc)
  where compared_player_id is not null;

create or replace function public.get_monthly_recap_source(
  p_profile_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with user_players as materialized (
    select gp.id as player_id, gp.game_id
    from public.game_players gp
    where gp.profile_id = p_profile_id
  ),
  monthly_ratings as materialized (
    select
      r.movie_id,
      r.reaction,
      r.seen,
      r.created_at,
      r.updated_at
    from public.ratings r
    join user_players up on up.player_id = r.game_player_id
    where r.created_at >= p_month_start
      and r.created_at < p_month_end
  ),
  monthly_movies as (
    select distinct mr.movie_id
    from monthly_ratings mr
  ),
  movie_attributes as (
    select
      mm.movie_id,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', g.tmdb_id, 'name', g.name)
          order by mg.position, g.tmdb_id
        )
        from public.movie_genres mg
        join public.genres g on g.tmdb_id = mg.genre_id
        where mg.movie_id = mm.movie_id
      ), '[]'::jsonb) as genres,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', mk.tmdb_keyword_id, 'name', mk.name)
          order by mk.tmdb_keyword_id
        )
        from public.movie_keywords mk
        where mk.movie_id = mm.movie_id
      ), '[]'::jsonb) as themes
    from monthly_movies mm
  ),
  monthly_games as materialized (
    select
      g.id as game_id,
      g.completed_at,
      up.player_id,
      coalesce((
        select round(
          100.0 * count(*) filter (where r.seen) /
          nullif(count(*), 0),
          2
        )
        from public.ratings r
        where r.game_player_id = up.player_id
      ), 0) as knowledge_score,
      (
        select cr.metrics #>> array['personalities', up.player_id::text, 'id']
        from public.compatibility_results cr
        where cr.game_id = g.id
          and cr.subject_player_id is null
        limit 1
      ) as personality_id
    from user_players up
    join public.games g on g.id = up.game_id
    where g.status = 'completed'
      and g.completed_at >= p_month_start
      and g.completed_at < p_month_end
  ),
  accepted_friends as (
    select case
      when f.requester_id = p_profile_id then f.addressee_id
      else f.requester_id
    end as profile_id
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = p_profile_id or f.addressee_id = p_profile_id)
  ),
  monthly_compatibilities as (
    select
      mg.game_id,
      mg.completed_at,
      other.profile_id as friend_profile_id,
      p.display_name as friend_display_name,
      cr.overall_score
    from monthly_games mg
    join public.compatibility_results cr
      on cr.game_id = mg.game_id
      and cr.subject_player_id is not null
      and (cr.subject_player_id = mg.player_id or cr.compared_player_id = mg.player_id)
    join public.game_players other
      on other.game_id = mg.game_id
      and other.id = case
        when cr.subject_player_id = mg.player_id then cr.compared_player_id
        else cr.subject_player_id
      end
    join accepted_friends af on af.profile_id = other.profile_id
    join public.profiles p on p.id = other.profile_id
  ),
  personality_before_month as (
    select cr.metrics #>> array['personalities', up.player_id::text, 'id'] as personality_id
    from user_players up
    join public.games g on g.id = up.game_id
    join public.compatibility_results cr
      on cr.game_id = g.id
      and cr.subject_player_id is null
    where g.status = 'completed'
      and g.completed_at < p_month_start
      and cr.metrics #>> array['personalities', up.player_id::text, 'id'] is not null
    order by g.completed_at desc, g.id
    limit 1
  )
  select jsonb_build_object(
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'movieId', mr.movie_id,
        'seen', mr.seen,
        'reaction', mr.reaction,
        'recordedAt', mr.created_at,
        'updatedAt', mr.updated_at
      ) order by mr.created_at, mr.movie_id)
      from monthly_ratings mr
    ), '[]'::jsonb),
    'attributes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'movieId', ma.movie_id,
        'genres', ma.genres,
        'themes', ma.themes
      ) order by ma.movie_id)
      from movie_attributes ma
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameId', mg.game_id,
        'completedAt', mg.completed_at,
        'knowledgeScore', mg.knowledge_score,
        'personalityId', mg.personality_id
      ) order by mg.completed_at, mg.game_id)
      from monthly_games mg
    ), '[]'::jsonb),
    'compatibilities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'gameId', mc.game_id,
        'completedAt', mc.completed_at,
        'friendProfileId', mc.friend_profile_id,
        'friendDisplayName', mc.friend_display_name,
        'overallScore', mc.overall_score
      ) order by mc.completed_at, mc.game_id, mc.friend_profile_id)
      from monthly_compatibilities mc
    ), '[]'::jsonb),
    'personalityBeforeMonth', (
      select pbm.personality_id from personality_before_month pbm
    ),
    'seenBeforeMonth', (
      select count(distinct r.movie_id)
      from public.ratings r
      join user_players up on up.player_id = r.game_player_id
      where r.seen and r.created_at < p_month_start
    ),
    'seenThroughMonth', (
      select count(distinct r.movie_id)
      from public.ratings r
      join user_players up on up.player_id = r.game_player_id
      where r.seen and r.created_at < p_month_end
    )
  );
$$;

revoke all on function public.get_monthly_recap_source(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_monthly_recap_source(uuid, timestamptz, timestamptz)
  to service_role;
