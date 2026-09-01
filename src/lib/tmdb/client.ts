import "server-only";

import { z } from "zod";

import {
  creditsSchema,
  genreListSchema,
  keywordListSchema,
  movieBundleSchema,
  movieDetailsSchema,
  paginatedMoviesSchema,
} from "@/lib/tmdb/schemas";
import {
  normalizeMovieBundle,
  normalizeMovieCredits,
  normalizeMovieDetails,
  normalizePaginatedMovies,
} from "@/lib/tmdb/normalize";
import type {
  DiscoverMovieOptions,
  MovieBundle,
  MovieCredits,
  MovieDetails,
  PaginatedMovies,
  TmdbGenre,
  TmdbKeyword,
} from "@/lib/tmdb/types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_LANGUAGE = "en-US";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 4;
const MIN_REQUEST_INTERVAL_MS = 125;

const authEnvironmentSchema = z
  .object({
    TMDB_ACCESS_TOKEN: z.string().trim().min(1).optional(),
    TMDB_API_KEY: z.string().trim().min(1).optional(),
  })
  .refine(
    (environment) => environment.TMDB_ACCESS_TOKEN || environment.TMDB_API_KEY,
    {
      message: "Set TMDB_ACCESS_TOKEN or TMDB_API_KEY.",
    },
  );

type TmdbSchema<T> = z.ZodType<T>;
type TmdbFetchOptions = RequestInit & {
  next?: {
    revalidate: number;
    tags?: string[];
  };
};

interface RequestOptions {
  cacheSeconds: number;
  params?: Record<string, boolean | number | string | undefined>;
  tags?: string[];
}

export class TmdbRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TmdbRequestError";
  }
}

let requestSchedule: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function reserveRequestSlot(): Promise<void> {
  const reservation = requestSchedule.then(async () => {
    const waitTime = Math.max(0, nextRequestAt - Date.now());
    if (waitTime > 0) await delay(waitTime);
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  });

  requestSchedule = reservation.catch(() => undefined);
  return reservation;
}

function getAuthentication(): { apiKey?: string; bearerToken?: string } {
  const environment = authEnvironmentSchema.parse(process.env);
  return {
    apiKey: environment.TMDB_ACCESS_TOKEN
      ? undefined
      : environment.TMDB_API_KEY,
    bearerToken: environment.TMDB_ACCESS_TOKEN,
  };
}

function buildUrl(
  path: string,
  params: RequestOptions["params"],
  apiKey?: string,
): URL {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("language", DEFAULT_LANGUAGE);

  if (apiKey) url.searchParams.set("api_key", apiKey);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url;
}

function retryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
  }

  return Math.min(8_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

async function request<T>(
  path: string,
  schema: TmdbSchema<T>,
  options: RequestOptions,
): Promise<T> {
  const { apiKey, bearerToken } = getAuthentication();
  const url = buildUrl(path, options.params, apiKey);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await reserveRequestSlot();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response | null = null;

    try {
      const fetchOptions: TmdbFetchOptions = {
        cache: "force-cache",
        headers: {
          accept: "application/json",
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        next: {
          revalidate: options.cacheSeconds,
          tags: options.tags,
        },
        signal: controller.signal,
      };

      response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          await delay(retryDelay(response, attempt));
          continue;
        }

        throw new TmdbRequestError(
          `TMDB request ${path} failed with status ${response.status}.`,
          response.status,
          retryable,
        );
      }

      const payload: unknown = await response.json();
      return schema.parse(payload);
    } catch (error) {
      if (error instanceof TmdbRequestError || error instanceof z.ZodError)
        throw error;

      if (attempt < MAX_RETRIES) {
        await delay(retryDelay(response, attempt));
        continue;
      }

      throw new TmdbRequestError(
        `TMDB request ${path} failed after ${MAX_RETRIES + 1} attempts.`,
        null,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new TmdbRequestError(
    `TMDB request ${path} exhausted its retries.`,
    null,
    true,
  );
}

function assertMovieId(movieId: number): void {
  if (!Number.isInteger(movieId) || movieId <= 0) {
    throw new TypeError("movieId must be a positive integer.");
  }
}

function normalizePage(page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    throw new RangeError("TMDB page must be an integer between 1 and 500.");
  }
  return page;
}

export async function fetchPopularMovies(page = 1): Promise<PaginatedMovies> {
  const payload = await request("/movie/popular", paginatedMoviesSchema, {
    cacheSeconds: 21_600,
    params: { include_adult: false, page: normalizePage(page) },
    tags: ["tmdb:popular"],
  });
  return normalizePaginatedMovies(payload);
}

export async function fetchMovieDetails(
  movieId: number,
): Promise<MovieDetails> {
  assertMovieId(movieId);
  const payload = await request(`/movie/${movieId}`, movieDetailsSchema, {
    cacheSeconds: 604_800,
    tags: [`tmdb:movie:${movieId}`],
  });
  return normalizeMovieDetails(payload);
}

export async function fetchMovieGenres(): Promise<TmdbGenre[]> {
  const payload = await request("/genre/movie/list", genreListSchema, {
    cacheSeconds: 2_592_000,
    tags: ["tmdb:genres"],
  });
  return payload.genres;
}

export async function fetchMovieKeywords(
  movieId: number,
): Promise<TmdbKeyword[]> {
  assertMovieId(movieId);
  const payload = await request(
    `/movie/${movieId}/keywords`,
    keywordListSchema,
    {
      cacheSeconds: 604_800,
      tags: [`tmdb:movie:${movieId}:keywords`],
    },
  );
  return payload.keywords;
}

export async function fetchMovieCredits(
  movieId: number,
): Promise<MovieCredits> {
  assertMovieId(movieId);
  const payload = await request(`/movie/${movieId}/credits`, creditsSchema, {
    cacheSeconds: 604_800,
    tags: [`tmdb:movie:${movieId}:credits`],
  });
  return normalizeMovieCredits(payload);
}

export async function fetchSimilarMovies(
  movieId: number,
  page = 1,
): Promise<PaginatedMovies> {
  assertMovieId(movieId);
  const payload = await request(
    `/movie/${movieId}/similar`,
    paginatedMoviesSchema,
    {
      cacheSeconds: 86_400,
      params: { page: normalizePage(page) },
      tags: [`tmdb:movie:${movieId}:similar`],
    },
  );
  return normalizePaginatedMovies(payload);
}

export async function fetchRecommendedMovies(
  movieId: number,
  page = 1,
): Promise<PaginatedMovies> {
  assertMovieId(movieId);
  const payload = await request(
    `/movie/${movieId}/recommendations`,
    paginatedMoviesSchema,
    {
      cacheSeconds: 86_400,
      params: { page: normalizePage(page) },
      tags: [`tmdb:movie:${movieId}:recommendations`],
    },
  );
  return normalizePaginatedMovies(payload);
}

/** Internal pool-building endpoint; product code should prefer the named queries above. */
export async function discoverMovies(
  options: DiscoverMovieOptions = {},
): Promise<PaginatedMovies> {
  const payload = await request("/discover/movie", paginatedMoviesSchema, {
    cacheSeconds: 21_600,
    params: {
      include_adult: false,
      include_video: false,
      page: normalizePage(options.page ?? 1),
      "primary_release_date.gte": options.primaryReleaseDateGte,
      "primary_release_date.lte": options.primaryReleaseDateLte,
      sort_by: options.sortBy ?? "popularity.desc",
      "vote_count.gte": options.voteCountGte,
      with_genres: options.withGenres?.join("|"),
      with_original_language: options.withOriginalLanguage,
    },
    tags: ["tmdb:discover"],
  });
  return normalizePaginatedMovies(payload);
}

/** Internal pool-building endpoint used to diversify beyond current popularity. */
export async function fetchTopRatedMovies(page = 1): Promise<PaginatedMovies> {
  const payload = await request("/movie/top_rated", paginatedMoviesSchema, {
    cacheSeconds: 21_600,
    params: { page: normalizePage(page) },
    tags: ["tmdb:top-rated"],
  });
  return normalizePaginatedMovies(payload);
}

/** Bundles details and keywords into one TMDB request during bulk ingestion. */
export async function fetchMovieBundle(movieId: number): Promise<MovieBundle> {
  assertMovieId(movieId);
  const payload = await request(`/movie/${movieId}`, movieBundleSchema, {
    cacheSeconds: 604_800,
    params: { append_to_response: "keywords,credits" },
    tags: [`tmdb:movie:${movieId}`],
  });
  return normalizeMovieBundle(payload);
}
