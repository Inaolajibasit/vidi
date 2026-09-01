import type { MovieReaction } from "@/types/database";

export interface WatchlistMovie {
  genreIds: readonly number[];
  keywordIds: readonly number[];
  movieId: string;
  popularity?: number;
  voteAverage?: number;
}

export interface WatchlistPlayer {
  id: string;
  ratings: ReadonlyArray<{
    movieId: string;
    reaction: MovieReaction | null;
    seen: boolean;
  }>;
}

export interface RankedWatchlistMovie {
  friendLikedCount: number;
  friendLovedCount: number;
  movieId: string;
  score: number;
}

export interface GeneratedWatchlists {
  personal: Record<string, RankedWatchlistMovie[]>;
  shared: RankedWatchlistMovie[];
}

const REACTION_WEIGHT: Record<MovieReaction, number> = {
  cant_remember: 0,
  liked: 0.55,
  loved: 1,
  meh: -0.7,
};

function attributes(movie: WatchlistMovie) {
  return [
    ...movie.genreIds.map((id) => `g:${id}`),
    ...movie.keywordIds.map((id) => `k:${id}`),
  ];
}

function tasteVector(player: WatchlistPlayer, movieMap: Map<string, WatchlistMovie>) {
  const vector = new Map<string, number>();
  for (const rating of player.ratings) {
    if (!rating.seen || !rating.reaction || rating.reaction === "cant_remember") continue;
    const movie = movieMap.get(rating.movieId);
    if (!movie) continue;
    const weight = REACTION_WEIGHT[rating.reaction];
    for (const attribute of attributes(movie)) {
      vector.set(attribute, (vector.get(attribute) ?? 0) + weight);
    }
  }
  return vector;
}

function predictedAffinity(movie: WatchlistMovie, vector: Map<string, number>) {
  const movieAttributes = attributes(movie);
  if (!movieAttributes.length || !vector.size) return 0.5;
  const mean =
    movieAttributes.reduce((sum, attribute) => sum + (vector.get(attribute) ?? 0), 0) /
    movieAttributes.length;
  return 1 / (1 + Math.exp(-mean));
}

function rank(
  movies: readonly WatchlistMovie[],
  players: readonly WatchlistPlayer[],
  targetPlayers: readonly WatchlistPlayer[],
  excludedSeen: Set<string>,
  limit: number,
) {
  const movieMap = new Map(movies.map((movie) => [movie.movieId, movie]));
  const vectors = targetPlayers.map((player) => tasteVector(player, movieMap));
  return movies
    .filter((movie) => !excludedSeen.has(movie.movieId))
    .map((movie) => {
      let friendLovedCount = 0;
      let friendLikedCount = 0;
      for (const player of players) {
        const rating = player.ratings.find((item) => item.movieId === movie.movieId);
        if (rating?.seen && rating.reaction === "loved") friendLovedCount += 1;
        if (rating?.seen && rating.reaction === "liked") friendLikedCount += 1;
      }
      const affinity =
        vectors.reduce((sum, vector) => sum + predictedAffinity(movie, vector), 0) /
        Math.max(vectors.length, 1);
      // Explicit friend signals dominate; taste and quality break close calls.
      const score =
        friendLovedCount * 100 +
        friendLikedCount * 60 +
        affinity * 25 +
        Math.min(movie.voteAverage ?? 0, 10) * 0.5 +
        Math.log1p(Math.max(movie.popularity ?? 0, 0)) * 0.2;
      return { friendLikedCount, friendLovedCount, movieId: movie.movieId, score };
    })
    .filter((item) => item.friendLovedCount > 0 || item.friendLikedCount > 0 || item.score >= 18)
    .sort((a, b) => b.score - a.score || a.movieId.localeCompare(b.movieId))
    .slice(0, limit);
}

export function generateWatchlists(
  players: readonly WatchlistPlayer[],
  movies: readonly WatchlistMovie[],
  limit = 20,
): GeneratedWatchlists {
  const personal = Object.fromEntries(
    players.map((player) => {
      const seen = new Set(player.ratings.filter((rating) => rating.seen).map((rating) => rating.movieId));
      return [player.id, rank(movies, players.filter((item) => item.id !== player.id), [player], seen, limit)];
    }),
  );
  const seenByEveryone = new Set(
    movies
      .filter((movie) => players.every((player) => player.ratings.some((r) => r.movieId === movie.movieId && r.seen)))
      .map((movie) => movie.movieId),
  );
  return { personal, shared: rank(movies, players, players, seenByEveryone, limit) };
}
