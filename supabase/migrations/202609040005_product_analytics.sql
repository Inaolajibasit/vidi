-- First-party product analytics. This table intentionally stores no profile
-- IDs, guest session IDs, invite codes, IP addresses, user agents or ratings.
create table public.product_analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  actor_hash text,
  entity_hash text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint product_analytics_event_name check (event_name in (
    'home_viewed',
    'create_game_clicked',
    'game_created',
    'invite_shared',
    'join_page_opened',
    'player_joined',
    'game_started',
    'movie_swiped',
    'game_completed',
    'results_viewed',
    'result_shared',
    'challenge_created',
    'challenge_opened',
    'challenge_completed',
    'signup_started',
    'signup_completed',
    'watchlist_saved',
    'friend_request_sent'
  )),
  constraint product_analytics_actor_hash check (
    actor_hash is null or actor_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint product_analytics_entity_hash check (
    entity_hash is null or entity_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint product_analytics_properties_object check (
    jsonb_typeof(properties) = 'object'
  ),
  constraint product_analytics_properties_size check (
    octet_length(properties::text) <= 2048
  ),
  constraint product_analytics_properties_allowlist check (
    case
      when event_name in (
        'home_viewed', 'create_game_clicked', 'join_page_opened',
        'results_viewed', 'challenge_created', 'challenge_opened',
        'challenge_completed', 'friend_request_sent'
      ) then properties = '{}'::jsonb
      when event_name in ('game_started', 'game_completed')
        then properties - array['deckSize', 'mode', 'playerCount'] = '{}'::jsonb
      when event_name = 'game_created'
        then properties - array['deckSize', 'isGuest', 'maxPlayers', 'mode'] = '{}'::jsonb
      when event_name = 'invite_shared'
        then properties - array['method'] = '{}'::jsonb
      when event_name = 'movie_swiped'
        then properties - array['deckSize', 'progress'] = '{}'::jsonb
      when event_name = 'player_joined'
        then properties - array['isGuest'] = '{}'::jsonb
      when event_name = 'result_shared'
        then properties - array['format', 'method'] = '{}'::jsonb
      when event_name = 'signup_started'
        then properties - array['method'] = '{}'::jsonb
      when event_name = 'signup_completed'
        then properties - array['hadGuestHistory', 'method'] = '{}'::jsonb
      when event_name = 'watchlist_saved'
        then properties - array['itemCount', 'kind'] = '{}'::jsonb
      else false
    end
  )
);

create index product_analytics_name_time_idx
  on public.product_analytics_events (event_name, occurred_at desc);
create index product_analytics_entity_time_idx
  on public.product_analytics_events (entity_hash, occurred_at desc)
  where entity_hash is not null;
create index product_analytics_actor_time_idx
  on public.product_analytics_events (actor_hash, occurred_at desc)
  where actor_hash is not null;

alter table public.product_analytics_events enable row level security;
revoke all on public.product_analytics_events from public, anon, authenticated;
grant select, insert on public.product_analytics_events to service_role;
grant usage, select on sequence public.product_analytics_events_id_seq to service_role;

-- Centralized insertion applies a conservative per-actor rate limit. Calls
-- without an actor are limited by normal application traffic controls.
create or replace function public.record_product_analytics_event(
  p_event_name text,
  p_actor_hash text,
  p_entity_hash text,
  p_properties jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_hash is not null and (
    select count(*)
    from public.product_analytics_events e
    where e.actor_hash = p_actor_hash
      and e.occurred_at >= now() - interval '1 minute'
  ) >= 120 then
    return false;
  end if;

  insert into public.product_analytics_events (
    event_name,
    actor_hash,
    entity_hash,
    properties
  ) values (
    p_event_name,
    p_actor_hash,
    p_entity_hash,
    coalesce(p_properties, '{}'::jsonb)
  );
  return true;
end;
$$;

revoke all on function public.record_product_analytics_event(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_product_analytics_event(text, text, text, jsonb)
  to service_role;

create or replace function public.get_product_analytics_metrics(
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scoped as materialized (
    select *
    from public.product_analytics_events e
    where e.occurred_at >= p_period_start
      and e.occurred_at < p_period_end
  ),
  latest_game_progress as (
    select
      actor_hash,
      entity_hash,
      max(
        least(
          100,
          100.0 * (properties ->> 'progress')::numeric /
          nullif((properties ->> 'deckSize')::numeric, 0)
        )
      ) as completion
    from scoped
    where event_name = 'movie_swiped'
      and actor_hash is not null
      and entity_hash is not null
      and properties ? 'progress'
      and properties ? 'deckSize'
    group by actor_hash, entity_hash
  ),
  guest_actors as (
    select distinct actor_hash
    from scoped
    where event_name in ('game_created', 'player_joined')
      and properties ->> 'isGuest' = 'true'
      and actor_hash is not null
  ),
  converted_guest_actors as (
    select distinct s.actor_hash
    from scoped s
    join guest_actors g on g.actor_hash = s.actor_hash
    where s.event_name = 'signup_completed'
      and s.properties ->> 'hadGuestHistory' = 'true'
  ),
  game_creators as (
    select actor_hash, count(distinct entity_hash) as games_created
    from scoped
    where event_name = 'game_created'
      and actor_hash is not null
      and entity_hash is not null
    group by actor_hash
  ),
  counts as (
    select
      (select count(distinct entity_hash) from scoped
        where event_name = 'game_created' and entity_hash is not null) as games_created,
      (select count(distinct completed.entity_hash) from scoped completed
        where completed.event_name = 'game_completed'
          and completed.entity_hash is not null
          and exists (select 1 from scoped created
            where created.event_name = 'game_created'
              and created.entity_hash = completed.entity_hash)) as games_completed,
      (select count(distinct entity_hash) from scoped
        where event_name = 'invite_shared' and entity_hash is not null) as invites_shared,
      (select count(distinct shared.entity_hash) from scoped shared
        where shared.event_name = 'invite_shared'
          and shared.entity_hash is not null
          and exists (select 1 from scoped joined
            where joined.event_name = 'player_joined'
              and joined.entity_hash = shared.entity_hash)) as invites_converted,
      (select count(distinct entity_hash) from scoped
        where event_name = 'results_viewed' and entity_hash is not null) as results_viewed,
      (select count(distinct viewed.entity_hash) from scoped viewed
        where viewed.event_name = 'results_viewed'
          and viewed.entity_hash is not null
          and exists (select 1 from scoped shared
            where shared.event_name = 'result_shared'
              and shared.entity_hash = viewed.entity_hash)) as results_shared,
      (select count(distinct entity_hash) from scoped
        where event_name = 'challenge_opened' and entity_hash is not null) as challenges_opened,
      (select count(distinct opened.entity_hash) from scoped opened
        where opened.event_name = 'challenge_opened'
          and opened.entity_hash is not null
          and exists (select 1 from scoped completed
            where completed.event_name = 'challenge_completed'
              and completed.entity_hash = opened.entity_hash)) as challenges_completed,
      (select count(*) from guest_actors) as guest_actors,
      (select count(*) from converted_guest_actors) as converted_guests,
      (select count(*) from game_creators) as game_creators,
      (select count(*) from game_creators where games_created >= 2) as repeat_game_creators
  )
  select jsonb_build_object(
    'gameCompletionRate', jsonb_build_object(
      'numerator', games_completed,
      'denominator', games_created,
      'rate', case when games_created = 0 then null else round(100.0 * games_completed / games_created, 2) end
    ),
    'inviteConversionRate', jsonb_build_object(
      'numerator', invites_converted,
      'denominator', invites_shared,
      'rate', case when invites_shared = 0 then null else round(100.0 * invites_converted / invites_shared, 2) end
    ),
    'averageDeckCompletion', (
      select round(avg(completion), 2) from latest_game_progress
    ),
    'shareRate', jsonb_build_object(
      'numerator', results_shared,
      'denominator', results_viewed,
      'rate', case when results_viewed = 0 then null else round(100.0 * results_shared / results_viewed, 2) end
    ),
    'challengeConversionRate', jsonb_build_object(
      'numerator', challenges_completed,
      'denominator', challenges_opened,
      'rate', case when challenges_opened = 0 then null else round(100.0 * challenges_completed / challenges_opened, 2) end
    ),
    'guestToAccountConversionRate', jsonb_build_object(
      'numerator', converted_guests,
      'denominator', guest_actors,
      'rate', case when guest_actors = 0 then null else round(100.0 * converted_guests / guest_actors, 2) end
    ),
    'rematchRate', jsonb_build_object(
      'numerator', repeat_game_creators,
      'denominator', game_creators,
      'rate', case when game_creators = 0 then null else round(100.0 * repeat_game_creators / game_creators, 2) end
    )
  )
  from counts;
$$;

revoke all on function public.get_product_analytics_metrics(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_product_analytics_metrics(timestamptz, timestamptz)
  to service_role;
