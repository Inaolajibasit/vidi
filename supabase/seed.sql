-- Development-only seed data. No auth.users rows are created here; Supabase
-- Auth owns that table. The sample game uses guest players so local resets are
-- deterministic and do not depend on an authenticated identity.

insert into public.personalities (slug, name, description, result_copy, criteria)
values
  (
    'the_archivist',
    'The Archivist',
    'You remember the film, the year, and probably who shot it.',
    'your watch history has its own watch history.',
    '{"knowledge_min": 85, "seen_ratio_min": 0.70}'::jsonb
  ),
  (
    'the_romantic',
    'The Romantic',
    'Feeling wins. Plot logistics can wait outside.',
    'emotionally available, at least during the third act.',
    '{"preferred_genres": [18, 10749], "loved_ratio_min": 0.35}'::jsonb
  ),
  (
    'the_wildcard',
    'The Wildcard',
    'Your taste moves fast and refuses to explain itself.',
    'predictable would have been easier. less interesting, though.',
    '{"rating_variance_min": 0.65}'::jsonb
  ),
  (
    'the_crowd_pleaser',
    'The Crowd Pleaser',
    'You know what lands in a room full of people.',
    'trusted with movie night. a dangerous amount of power.',
    '{"popularity_percentile_min": 0.65}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  result_copy = excluded.result_copy,
  criteria = excluded.criteria;

insert into public.genres (tmdb_id, name)
values
  (18, 'Drama'),
  (28, 'Action'),
  (53, 'Thriller'),
  (80, 'Crime'),
  (878, 'Science Fiction')
on conflict (tmdb_id) do update set name = excluded.name;

insert into public.movies (
  tmdb_id,
  title,
  original_title,
  release_date,
  release_year,
  overview,
  popularity,
  vote_average,
  vote_count,
  runtime,
  original_language
)
values
  (550, 'Fight Club', 'Fight Club', '1999-10-15', 1999, 'An insomniac finds an unconventional outlet for his frustration.', 61.2, 8.44, 31000, 139, 'en'),
  (680, 'Pulp Fiction', 'Pulp Fiction', '1994-10-14', 1994, 'Interlocking stories unfold across the Los Angeles underworld.', 55.8, 8.49, 29000, 154, 'en'),
  (155, 'The Dark Knight', 'The Dark Knight', '2008-07-18', 2008, 'A masked vigilante faces an agent of chaos in Gotham.', 92.4, 8.52, 33000, 152, 'en'),
  (27205, 'Inception', 'Inception', '2010-07-16', 2010, 'A skilled extractor is offered a chance to erase his past.', 84.1, 8.37, 37000, 148, 'en'),
  (13, 'Forrest Gump', 'Forrest Gump', '1994-07-06', 1994, 'One man moves through decades of American history.', 49.6, 8.47, 28000, 142, 'en')
on conflict (tmdb_id) do update set
  title = excluded.title,
  original_title = excluded.original_title,
  release_date = excluded.release_date,
  release_year = excluded.release_year,
  overview = excluded.overview,
  popularity = excluded.popularity,
  vote_average = excluded.vote_average,
  vote_count = excluded.vote_count,
  runtime = excluded.runtime,
  original_language = excluded.original_language;

insert into public.movie_genres (movie_id, genre_id)
select m.id, mapping.genre_id
from (
  values
    (550::bigint, 18), (550::bigint, 53),
    (680::bigint, 80), (680::bigint, 53),
    (155::bigint, 18), (155::bigint, 28), (155::bigint, 80),
    (27205::bigint, 28), (27205::bigint, 878),
    (13::bigint, 18)
) as mapping(tmdb_id, genre_id)
join public.movies m on m.tmdb_id = mapping.tmdb_id
on conflict do nothing;

insert into public.games (
  id,
  invite_code,
  mode,
  max_players,
  status,
  created_at,
  started_at,
  completed_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'VIDI01',
  'quick',
  5,
  'completed',
  '2026-08-24 18:00:00+00',
  '2026-08-24 18:02:00+00',
  '2026-08-24 18:05:00+00'
)
on conflict (id) do nothing;

-- Capacity enforcement only permits joins while waiting, so seed players before
-- restoring this deterministic sample game to its completed state.
update public.games
set status = 'waiting', started_at = null, completed_at = null
where id = '10000000-0000-4000-8000-000000000001';

insert into public.game_players (
  id,
  game_id,
  guest_session_id,
  display_name,
  joined_at,
  finished_at,
  progress
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'Sarah',
    '2026-08-24 18:00:30+00',
    '2026-08-24 18:04:40+00',
    5
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    'Mo',
    '2026-08-24 18:00:45+00',
    '2026-08-24 18:04:52+00',
    5
  )
on conflict (id) do nothing;

insert into public.game_movies (game_id, movie_id, position)
select
  '10000000-0000-4000-8000-000000000001'::uuid,
  m.id,
  deck.position
from (
  values
    (1::smallint, 550::bigint),
    (2::smallint, 680::bigint),
    (3::smallint, 155::bigint),
    (4::smallint, 27205::bigint),
    (5::smallint, 13::bigint)
) as deck(position, tmdb_id)
join public.movies m on m.tmdb_id = deck.tmdb_id
on conflict do nothing;

insert into public.ratings (game_player_id, game_id, movie_id, seen, reaction)
select
  answers.game_player_id,
  '10000000-0000-4000-8000-000000000001'::uuid,
  m.id,
  answers.seen,
  answers.reaction::public.movie_reaction
from (
  values
    ('20000000-0000-4000-8000-000000000001'::uuid, 550::bigint, true, 'loved'),
    ('20000000-0000-4000-8000-000000000001'::uuid, 680::bigint, true, 'loved'),
    ('20000000-0000-4000-8000-000000000001'::uuid, 155::bigint, true, 'liked'),
    ('20000000-0000-4000-8000-000000000001'::uuid, 27205::bigint, true, 'loved'),
    ('20000000-0000-4000-8000-000000000001'::uuid, 13::bigint, false, null),
    ('20000000-0000-4000-8000-000000000002'::uuid, 550::bigint, true, 'liked'),
    ('20000000-0000-4000-8000-000000000002'::uuid, 680::bigint, true, 'loved'),
    ('20000000-0000-4000-8000-000000000002'::uuid, 155::bigint, true, 'loved'),
    ('20000000-0000-4000-8000-000000000002'::uuid, 27205::bigint, true, 'liked'),
    ('20000000-0000-4000-8000-000000000002'::uuid, 13::bigint, false, null)
) as answers(game_player_id, tmdb_id, seen, reaction)
join public.movies m on m.tmdb_id = answers.tmdb_id
on conflict (game_player_id, movie_id) do update set
  seen = excluded.seen,
  reaction = excluded.reaction;

update public.games
set
  status = 'completed',
  started_at = '2026-08-24 18:02:00+00',
  completed_at = '2026-08-24 18:05:00+00'
where id = '10000000-0000-4000-8000-000000000001';

insert into public.compatibility_results (
  game_id,
  overall_score,
  taste_score,
  knowledge_score,
  shared_seen_count,
  knowledge_winner_player_id,
  personality_slug,
  result_copy,
  metrics
)
values (
  '10000000-0000-4000-8000-000000000001',
  88,
  84,
  80,
  4,
  '20000000-0000-4000-8000-000000000001',
  'the_crowd_pleaser',
  '88% — close enough to share the remote.',
  '{"seed": true, "rated_movies": 5}'::jsonb
)
on conflict (game_id) where subject_player_id is null and compared_player_id is null
do update set
  overall_score = excluded.overall_score,
  taste_score = excluded.taste_score,
  knowledge_score = excluded.knowledge_score,
  shared_seen_count = excluded.shared_seen_count,
  knowledge_winner_player_id = excluded.knowledge_winner_player_id,
  personality_slug = excluded.personality_slug,
  result_copy = excluded.result_copy,
  metrics = excluded.metrics;
