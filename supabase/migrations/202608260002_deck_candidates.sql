alter table public.movies
  add column if not exists director_name text,
  add column if not exists collection_tmdb_id bigint,
  add column if not exists collection_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movies_collection_consistency'
      and conrelid = 'public.movies'::regclass
  ) then
    alter table public.movies
      add constraint movies_collection_consistency check (
        (collection_tmdb_id is null and collection_name is null) or
        (
          collection_tmdb_id is not null and
          collection_tmdb_id > 0 and
          collection_name is not null
        )
      );
  end if;
end
$$;

create index if not exists movies_collection_idx
  on public.movies (collection_tmdb_id)
  where collection_tmdb_id is not null;
create index if not exists movies_director_idx
  on public.movies (director_name)
  where director_name is not null;

-- Phase 9 normally creates this column first. Keeping this guard here makes
-- the migration safe when it is applied manually through the SQL editor.
alter table public.movie_genres
  add column if not exists position smallint not null default 1;

create or replace function public.get_deck_candidates(p_limit integer default 3000)
returns table (
  id uuid,
  popularity numeric,
  vote_average numeric,
  vote_count integer,
  release_year smallint,
  original_language varchar,
  director_name text,
  franchise_id bigint,
  genre_ids integer[],
  keyword_ids bigint[],
  keyword_names text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id::uuid as id,
    m.popularity::numeric as popularity,
    m.vote_average::numeric as vote_average,
    m.vote_count::integer as vote_count,
    m.release_year::smallint as release_year,
    m.original_language::varchar as original_language,
    m.director_name::text as director_name,
    m.collection_tmdb_id::bigint as franchise_id,
    coalesce((
      select array_agg(mg.genre_id order by mg.position, mg.genre_id)
      from public.movie_genres mg where mg.movie_id = m.id
    ), '{}'::integer[]) as genre_ids,
    coalesce((
      select array_agg(mk.tmdb_keyword_id order by mk.tmdb_keyword_id)
      from public.movie_keywords mk where mk.movie_id = m.id
    ), '{}'::bigint[]) as keyword_ids,
    coalesce((
      select array_agg(lower(mk.name) order by mk.tmdb_keyword_id)
      from public.movie_keywords mk where mk.movie_id = m.id
    ), '{}'::text[]) as keyword_names
  from public.movies m
  where m.poster_path is not null
  order by m.popularity desc, m.vote_count desc, m.id
  limit greatest(1, least(p_limit, 5000));
$$;

revoke all on function public.get_deck_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.get_deck_candidates(integer) to service_role;
