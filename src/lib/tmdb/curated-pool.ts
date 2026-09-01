import "server-only";

import {
  discoverMovies,
  fetchPopularMovies,
  fetchRecommendedMovies,
  fetchSimilarMovies,
  fetchTopRatedMovies,
} from "@/lib/tmdb/client";
import type { MovieSummary, PaginatedMovies } from "@/lib/tmdb/types";

const FRANCHISE_AND_CULTURAL_ANCHORS = [
  11, 13, 85, 120, 128, 129, 149, 155, 1891, 218, 238, 348, 550, 603, 671, 680,
  808, 862, 1726, 9799, 24428, 27205, 36557, 70160, 324857, 372058, 438631,
  635302,
] as const;

const SOURCE_WEIGHT: Record<PoolSource, number> = {
  anchor: 220,
  anime: 85,
  decade: 55,
  franchise: 120,
  popular: 75,
  top_rated: 95,
};

export type PoolSource =
  "anchor" | "anime" | "decade" | "franchise" | "popular" | "top_rated";

export interface CuratedMovieCandidate {
  score: number;
  sources: PoolSource[];
  tmdbId: number;
}

export interface PoolLogger {
  error(message: string): void;
  info(message: string): void;
}

interface CandidateState {
  movie?: MovieSummary;
  sources: Set<PoolSource>;
}

function scoreCandidate(candidate: CandidateState): number {
  const sourceScore = [...candidate.sources].reduce(
    (total, source) => total + SOURCE_WEIGHT[source],
    0,
  );
  if (!candidate.movie) return sourceScore;

  const recognitionScore = Math.log10(candidate.movie.voteCount + 1) * 18;
  const qualityScore = candidate.movie.voteAverage * 6;
  const popularityScore = Math.min(candidate.movie.popularity, 180) * 0.25;
  const posterBonus = candidate.movie.posterPath ? 8 : 0;
  const releaseBonus = candidate.movie.releaseDate ? 4 : 0;

  return (
    sourceScore +
    recognitionScore +
    qualityScore +
    popularityScore +
    posterBonus +
    releaseBonus
  );
}

function isEligible(movie: MovieSummary): boolean {
  return (
    !movie.adult &&
    !movie.video &&
    movie.title.length > 0 &&
    movie.voteCount >= 25
  );
}

function addMovie(
  candidates: Map<number, CandidateState>,
  movie: MovieSummary,
  source: PoolSource,
): void {
  if (!isEligible(movie)) return;

  const existing = candidates.get(movie.id);
  if (existing) {
    existing.sources.add(source);
    if (movie.voteCount > (existing.movie?.voteCount ?? -1))
      existing.movie = movie;
    return;
  }

  candidates.set(movie.id, { movie, sources: new Set([source]) });
}

async function collectPages(
  candidates: Map<number, CandidateState>,
  label: string,
  pages: number[],
  source: PoolSource,
  fetchPage: (page: number) => Promise<PaginatedMovies>,
  logger: PoolLogger,
): Promise<void> {
  const batchSize = 20;

  for (let offset = 0; offset < pages.length; offset += batchSize) {
    const batch = pages.slice(offset, offset + batchSize);
    const results = await Promise.allSettled(batch.map(fetchPage));

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        result.value.results.forEach((movie) =>
          addMovie(candidates, movie, source),
        );
      } else {
        logger.error(
          `${label} page ${batch[index]} failed: ${String(result.reason)}`,
        );
      }
    });

    logger.info(
      `${label}: ${Math.min(offset + batch.length, pages.length)}/${pages.length} pages; ${candidates.size} unique candidates.`,
    );
  }
}

async function collectFranchiseNeighbours(
  candidates: Map<number, CandidateState>,
  logger: PoolLogger,
): Promise<void> {
  for (const tmdbId of FRANCHISE_AND_CULTURAL_ANCHORS) {
    const existing = candidates.get(tmdbId);
    if (existing) existing.sources.add("anchor");
    else candidates.set(tmdbId, { sources: new Set(["anchor"]) });
  }

  const results = await Promise.allSettled(
    FRANCHISE_AND_CULTURAL_ANCHORS.flatMap((tmdbId) => [
      fetchRecommendedMovies(tmdbId),
      fetchSimilarMovies(tmdbId),
    ]),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      result.value.results.forEach((movie) =>
        addMovie(candidates, movie, "franchise"),
      );
    } else {
      logger.error(
        `A franchise expansion request failed: ${String(result.reason)}`,
      );
    }
  }

  logger.info(
    `Franchise expansion complete; ${candidates.size} unique candidates.`,
  );
}

export async function buildCuratedMoviePool(
  target = 4_000,
  logger: PoolLogger = console,
): Promise<CuratedMovieCandidate[]> {
  if (!Number.isInteger(target) || target < 3_000 || target > 5_000) {
    throw new RangeError(
      "Curated pool target must be an integer between 3,000 and 5,000.",
    );
  }

  const candidates = new Map<number, CandidateState>();
  const range = (count: number) =>
    Array.from({ length: count }, (_, index) => index + 1);

  await collectPages(
    candidates,
    "Popular movies",
    range(120),
    "popular",
    fetchPopularMovies,
    logger,
  );
  await collectPages(
    candidates,
    "Top-rated movies",
    range(100),
    "top_rated",
    fetchTopRatedMovies,
    logger,
  );

  const decadeStrategies = [
    ["1950-01-01", "1969-12-31", 250],
    ["1970-01-01", "1979-12-31", 300],
    ["1980-01-01", "1989-12-31", 400],
    ["1990-01-01", "1999-12-31", 500],
    ["2000-01-01", "2009-12-31", 650],
    ["2010-01-01", "2019-12-31", 800],
    ["2020-01-01", "2029-12-31", 500],
  ] as const;

  for (const [startDate, endDate, minimumVotes] of decadeStrategies) {
    await collectPages(
      candidates,
      `Discovery ${startDate.slice(0, 4)}s`,
      range(12),
      "decade",
      (page) =>
        discoverMovies({
          page,
          primaryReleaseDateGte: startDate,
          primaryReleaseDateLte: endDate,
          sortBy: "vote_count.desc",
          voteCountGte: minimumVotes,
        }),
      logger,
    );
  }

  await collectPages(
    candidates,
    "Popular anime films",
    range(40),
    "anime",
    (page) =>
      discoverMovies({
        page,
        sortBy: "popularity.desc",
        voteCountGte: 100,
        withGenres: [16],
        withOriginalLanguage: "ja",
      }),
    logger,
  );

  await collectFranchiseNeighbours(candidates, logger);

  const ranked = [...candidates.entries()]
    .map(([tmdbId, candidate]) => ({
      score: scoreCandidate(candidate),
      sources: [...candidate.sources].sort(),
      tmdbId,
    }))
    .sort((a, b) => b.score - a.score || a.tmdbId - b.tmdbId)
    .slice(0, target);

  if (ranked.length < target) {
    logger.error(
      `TMDB returned only ${ranked.length} eligible movies for a target of ${target}.`,
    );
  }

  return ranked;
}
