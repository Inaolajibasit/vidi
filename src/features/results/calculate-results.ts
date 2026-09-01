import "server-only";

import {
  calculateGroupCompatibility,
  type ResultMovieAttributes,
  type ResultPlayer,
} from "@/lib/algorithms/compatibility";
import { generateWatchlists } from "@/lib/algorithms/watchlists";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CompatibilityResultInsert } from "@/types/database";

export async function calculateAndStoreResults(gameId: string) {
  const admin = getSupabaseAdmin();
  const [
    { data: players, error: playerError },
    { data: ratings, error: ratingError },
  ] = await Promise.all([
    admin.from("game_players").select("id").eq("game_id", gameId),
    admin
      .from("ratings")
      .select("game_player_id, movie_id, reaction, seen")
      .eq("game_id", gameId),
  ]);
  if (playerError) throw playerError;
  if (ratingError) throw ratingError;
  if (!players || players.length < 2) return;

  const movieIds = [
    ...new Set((ratings ?? []).map((rating) => rating.movie_id)),
  ];
  const [
    { data: genres, error: genreError },
    { data: keywords, error: keywordError },
    { data: movies, error: movieError },
  ] = await Promise.all([
    admin
      .from("movie_genres")
      .select("genre_id, movie_id")
      .in("movie_id", movieIds),
    admin
      .from("movie_keywords")
      .select("movie_id, tmdb_keyword_id")
      .in("movie_id", movieIds),
    admin
      .from("movies")
      .select("id, popularity, vote_average")
      .in("id", movieIds),
  ]);
  if (genreError) throw genreError;
  if (keywordError) throw keywordError;
  if (movieError) throw movieError;

  const attributesByMovie = new Map<string, ResultMovieAttributes>();
  movieIds.forEach((movieId) =>
    attributesByMovie.set(movieId, { genreIds: [], keywordIds: [], movieId }),
  );
  (genres ?? []).forEach((genre) => {
    const movie = attributesByMovie.get(genre.movie_id);
    if (movie) (movie.genreIds as number[]).push(genre.genre_id);
  });
  (keywords ?? []).forEach((keyword) => {
    const movie = attributesByMovie.get(keyword.movie_id);
    if (movie) (movie.keywordIds as number[]).push(keyword.tmdb_keyword_id);
  });

  const resultPlayers: ResultPlayer[] = players.map((player) => ({
    id: player.id,
    ratings: (ratings ?? [])
      .filter((rating) => rating.game_player_id === player.id)
      .map((rating) => ({
        movieId: rating.movie_id,
        reaction: rating.reaction,
        seen: rating.seen,
      })),
  }));
  const result = calculateGroupCompatibility(resultPlayers, [
    ...attributesByMovie.values(),
  ]);
  const movieMetadata = new Map((movies ?? []).map((movie) => [movie.id, movie]));
  const watchlists = generateWatchlists(
    resultPlayers,
    [...attributesByMovie.values()].map((movie) => ({
      ...movie,
      popularity: Number(movieMetadata.get(movie.movieId)?.popularity ?? 0),
      voteAverage: Number(movieMetadata.get(movie.movieId)?.vote_average ?? 0),
    })),
  );

  const rows: CompatibilityResultInsert[] = result.pairs.map((pair) => {
    return {
      compared_player_id: pair.playerIds[1],
      disagreement_movie_ids: pair.disagreementMovieIds,
      game_id: gameId,
      knowledge_score: pair.knowledgeOverlap,
      knowledge_winner_player_id: pair.knowledgeWinnerPlayerId,
      metrics: { ratingAgreement: pair.ratingAgreement },
      overall_score: pair.overallCompatibility,
      shared_favourite_movie_ids: pair.sharedFavouriteMovieIds,
      shared_seen_count: pair.moviesBothSeen,
      subject_player_id: pair.playerIds[0],
      taste_score: pair.tasteMatch,
      watchlist_movie_ids: watchlists.shared.map((movie) => movie.movieId),
    };
  });
  rows.push({
    disagreement_movie_ids: [],
    game_id: gameId,
    knowledge_score:
      result.pairs.reduce((sum, pair) => sum + pair.knowledgeOverlap, 0) /
      result.pairs.length,
    knowledge_winner_player_id: result.knowledgeWinnerPlayerId,
    metrics: {
      highestPair: result.highestCompatibilityPair.playerIds,
      lowestPair: result.lowestCompatibilityPair.playerIds,
      pairCount: result.pairs.length,
      personalWatchlists: Object.fromEntries(
        Object.entries(watchlists.personal).map(([playerId, items]) => [
          playerId,
          items.map((item) => item.movieId),
        ]),
      ),
    },
    overall_score: result.groupCompatibility,
    shared_favourite_movie_ids: [],
    shared_seen_count: Math.round(
      result.pairs.reduce((sum, pair) => sum + pair.moviesBothSeen, 0) /
        result.pairs.length,
    ),
    taste_score:
      result.pairs.reduce((sum, pair) => sum + pair.tasteMatch, 0) /
      result.pairs.length,
    watchlist_movie_ids: watchlists.shared.map((movie) => movie.movieId),
  });

  const { error: deleteError } = await admin
    .from("compatibility_results")
    .delete()
    .eq("game_id", gameId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await admin
    .from("compatibility_results")
    .insert(rows);
  if (insertError) throw insertError;
  const { error: completeError } = await admin
    .from("games")
    .update({ completed_at: new Date().toISOString(), status: "completed" })
    .eq("id", gameId)
    .eq("status", "waiting_results");
  if (completeError) throw completeError;
}
