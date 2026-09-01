import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchMovieBundle, fetchMovieGenres } from "@/lib/tmdb/client";
import type { MovieBundle, TmdbKeyword } from "@/lib/tmdb/types";
import type { Database, MovieInsert } from "@/types/database";

const MAX_USEFUL_KEYWORDS = 25;
const IGNORED_KEYWORDS = new Set([
  "aftercreditsstinger",
  "duringcreditsstinger",
  "end credits",
  "opening credits",
  "title sequence",
]);

export interface IngestionFailure {
  message: string;
  tmdbId: number;
}

export interface IngestionResult {
  failed: IngestionFailure[];
  skipped: number;
  succeeded: number[];
}

export interface IngestionLogger {
  error(message: string): void;
  info(message: string): void;
}

export interface IngestMoviesOptions {
  concurrency?: number;
  logger?: IngestionLogger;
  onMovieStored?: (
    tmdbId: number,
    completed: number,
    total: number,
  ) => Promise<void> | void;
  skipTmdbIds?: ReadonlySet<number>;
}

function releaseYear(releaseDate: string | null): number | null {
  return releaseDate ? Number(releaseDate.slice(0, 4)) : null;
}

function movieInsert(bundle: MovieBundle): MovieInsert {
  const movie = bundle.details;
  return {
    backdrop_path: movie.backdropPath,
    collection_name: movie.collection?.name ?? null,
    collection_tmdb_id: movie.collection?.id ?? null,
    director_name: bundle.directorName,
    original_language: movie.originalLanguage,
    original_title: movie.originalTitle,
    overview: movie.overview,
    popularity: movie.popularity,
    poster_path: movie.posterPath,
    release_date: movie.releaseDate,
    release_year: releaseYear(movie.releaseDate),
    runtime: movie.runtime,
    title: movie.title,
    tmdb_id: movie.id,
    vote_average: movie.voteAverage,
    vote_count: movie.voteCount,
  };
}

function usefulKeywords(keywords: TmdbKeyword[]): TmdbKeyword[] {
  const seen = new Set<number>();
  return keywords
    .filter((keyword) => {
      const normalizedName = keyword.name.trim().toLowerCase();
      if (
        !normalizedName ||
        normalizedName.length > 80 ||
        IGNORED_KEYWORDS.has(normalizedName)
      )
        return false;
      if (seen.has(keyword.id)) return false;
      seen.add(keyword.id);
      return true;
    })
    .slice(0, MAX_USEFUL_KEYWORDS);
}

async function syncGenres(
  supabase: SupabaseClient<Database>,
  movieId: string,
  genreIds: number[],
): Promise<void> {
  if (genreIds.length > 0) {
    const { error } = await supabase.from("movie_genres").upsert(
      genreIds.map((genreId, index) => ({
        genre_id: genreId,
        movie_id: movieId,
        position: index + 1,
      })),
      { onConflict: "movie_id,genre_id" },
    );
    if (error) throw error;
  }

  const { data: existing, error: readError } = await supabase
    .from("movie_genres")
    .select("genre_id")
    .eq("movie_id", movieId);
  if (readError) throw readError;

  const staleIds = (existing ?? [])
    .map((row) => row.genre_id)
    .filter((genreId) => !genreIds.includes(genreId));
  if (staleIds.length > 0) {
    const { error } = await supabase
      .from("movie_genres")
      .delete()
      .eq("movie_id", movieId)
      .in("genre_id", staleIds);
    if (error) throw error;
  }
}

async function syncKeywords(
  supabase: SupabaseClient<Database>,
  movieId: string,
  keywords: TmdbKeyword[],
): Promise<void> {
  const selectedKeywords = usefulKeywords(keywords);

  if (selectedKeywords.length > 0) {
    const { error } = await supabase.from("movie_keywords").upsert(
      selectedKeywords.map((keyword) => ({
        movie_id: movieId,
        name: keyword.name.trim(),
        tmdb_keyword_id: keyword.id,
      })),
      { onConflict: "movie_id,tmdb_keyword_id" },
    );
    if (error) throw error;
  }

  const { data: existing, error: readError } = await supabase
    .from("movie_keywords")
    .select("tmdb_keyword_id")
    .eq("movie_id", movieId);
  if (readError) throw readError;

  const selectedIds = new Set(selectedKeywords.map((keyword) => keyword.id));
  const staleIds = (existing ?? [])
    .map((row) => row.tmdb_keyword_id)
    .filter((keywordId) => !selectedIds.has(keywordId));
  if (staleIds.length > 0) {
    const { error } = await supabase
      .from("movie_keywords")
      .delete()
      .eq("movie_id", movieId)
      .in("tmdb_keyword_id", staleIds);
    if (error) throw error;
  }
}

export async function storeMovieBundle(
  bundle: MovieBundle,
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
): Promise<string> {
  if (bundle.details.adult || bundle.details.video) {
    throw new Error(
      `TMDB movie ${bundle.details.id} is not eligible for the movie pool.`,
    );
  }

  const { data: movie, error } = await supabase
    .from("movies")
    .upsert(movieInsert(bundle), { onConflict: "tmdb_id" })
    .select("id")
    .single();
  if (error) throw error;

  await syncGenres(
    supabase,
    movie.id,
    bundle.details.genres.map((genre) => genre.id),
  );
  await syncKeywords(supabase, movie.id, bundle.keywords);

  return movie.id;
}

export async function syncMovieGenres(
  supabase: SupabaseClient<Database> = getSupabaseAdmin(),
): Promise<number> {
  const genres = await fetchMovieGenres();
  const { error } = await supabase.from("genres").upsert(
    genres.map((genre) => ({ name: genre.name, tmdb_id: genre.id })),
    { onConflict: "tmdb_id" },
  );
  if (error) throw error;
  return genres.length;
}

export async function ingestMovies(
  tmdbIds: number[],
  options: IngestMoviesOptions = {},
): Promise<IngestionResult> {
  const concurrency = Math.min(8, Math.max(1, options.concurrency ?? 4));
  const logger = options.logger ?? console;
  const skipTmdbIds = options.skipTmdbIds ?? new Set<number>();
  const queue = tmdbIds.filter((tmdbId) => !skipTmdbIds.has(tmdbId));
  const result: IngestionResult = {
    failed: [],
    skipped: tmdbIds.length - queue.length,
    succeeded: [],
  };
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const tmdbId = queue[index];

      try {
        const bundle = await fetchMovieBundle(tmdbId);
        await storeMovieBundle(bundle);
        result.succeeded.push(tmdbId);
        const completed = result.succeeded.length + result.failed.length;
        logger.info(
          `[${completed}/${queue.length}] Stored ${bundle.details.title} (${tmdbId}).`,
        );
        await options.onMovieStored?.(tmdbId, completed, queue.length);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failed.push({ message, tmdbId });
        logger.error(
          `[${result.succeeded.length + result.failed.length}/${queue.length}] Failed TMDB ${tmdbId}: ${message}`,
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker),
  );
  return result;
}
