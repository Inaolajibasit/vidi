import "server-only";

import {
  getGameIdentity,
  identityMatchesPlayer,
} from "@/features/games/identity";
import { inviteCodeSchema } from "@/features/games/validation";
import { resolveGameResume } from "@/lib/algorithms/game-progress";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { GameStatus } from "@/types/database";

export interface GameplayMovie {
  genre: string;
  posterUrl: string | null;
  releaseYear: number | null;
  title: string;
  tmdbId: number;
}

export interface GameplayData {
  complete: boolean;
  currentIndex: number;
  inviteCode: string;
  movies: GameplayMovie[];
  playerId: string;
  reactionPending: boolean;
  status: GameStatus;
}

function posterUrl(path: string | null) {
  if (!path) return null;
  const fileName = path.split("/").at(-1);
  return fileName ? `/api/posters/${encodeURIComponent(fileName)}` : null;
}

export async function getGameplayData(
  rawInviteCode: string,
): Promise<GameplayData | null> {
  const parsedCode = inviteCodeSchema.safeParse(rawInviteCode);
  if (!parsedCode.success) return null;

  try {
    const admin = getSupabaseAdmin();
    const [{ data: game, error: gameError }, identity] = await Promise.all([
      admin
        .from("games")
        .select("id, invite_code, status")
        .eq("invite_code", parsedCode.data)
        .maybeSingle(),
      getGameIdentity({ loadDisplayName: false }),
    ]);

    if (gameError) throw gameError;
    if (!game) return null;

    const { data: players, error: playerError } = await admin
      .from("game_players")
      .select("id, guest_session_id, profile_id")
      .eq("game_id", game.id);

    if (playerError) throw playerError;
    const player = players?.find((candidate) =>
      identityMatchesPlayer(identity, candidate),
    );
    if (!player) return null;

    const [
      { data: gameMovies, error: deckError },
      { data: ratings, error: ratingError },
    ] = await Promise.all([
      admin
        .from("game_movies")
        .select("movie_id, position")
        .eq("game_id", game.id)
        .order("position", { ascending: true }),
      admin
        .from("ratings")
        .select("movie_id, reaction, seen")
        .eq("game_player_id", player.id),
    ]);

    if (deckError) throw deckError;
    if (ratingError) throw ratingError;
    const movieIds = (gameMovies ?? []).map((movie) => movie.movie_id);
    if (movieIds.length === 0) return null;

    const [
      { data: movies, error: movieError },
      { data: movieGenres, error: movieGenreError },
    ] = await Promise.all([
      admin
        .from("movies")
        .select("id, poster_path, release_year, title, tmdb_id")
        .in("id", movieIds),
      admin
        .from("movie_genres")
        .select("genre_id, movie_id, position")
        .in("movie_id", movieIds)
        .order("position", { ascending: true }),
    ]);

    if (movieError) throw movieError;
    if (movieGenreError) throw movieGenreError;
    const genreIds = [
      ...new Set((movieGenres ?? []).map((row) => row.genre_id)),
    ];
    const { data: genres, error: genreError } = genreIds.length
      ? await admin
          .from("genres")
          .select("name, tmdb_id")
          .in("tmdb_id", genreIds)
      : { data: [], error: null };

    if (genreError) throw genreError;

    const moviesById = new Map(
      (movies ?? []).map((movie) => [movie.id, movie]),
    );
    const genreNameById = new Map(
      (genres ?? []).map((genre) => [genre.tmdb_id, genre.name]),
    );
    const primaryGenreByMovie = new Map<string, string>();
    for (const mapping of movieGenres ?? []) {
      if (!primaryGenreByMovie.has(mapping.movie_id)) {
        primaryGenreByMovie.set(
          mapping.movie_id,
          genreNameById.get(mapping.genre_id) ?? "Film",
        );
      }
    }

    const orderedMovies = movieIds.map((movieId) => {
      const movie = moviesById.get(movieId);
      if (!movie) throw new Error(`Deck movie ${movieId} is missing.`);
      return {
        genre: primaryGenreByMovie.get(movieId) ?? "Film",
        id: movieId,
        posterUrl: posterUrl(movie.poster_path),
        releaseYear: movie.release_year,
        title: movie.title,
        tmdbId: movie.tmdb_id,
      };
    });
    const resume = resolveGameResume(
      movieIds,
      (ratings ?? []).map((rating) => ({
        movieId: rating.movie_id,
        reaction: rating.reaction,
        seen: rating.seen,
      })),
    );

    return {
      ...resume,
      inviteCode: game.invite_code,
      movies: orderedMovies.map((movie) => ({
        genre: movie.genre,
        posterUrl: movie.posterUrl,
        releaseYear: movie.releaseYear,
        title: movie.title,
        tmdbId: movie.tmdbId,
      })),
      playerId: player.id,
      status: game.status,
    };
  } catch (error) {
    console.error("Gameplay lookup failed", error);
    throw error;
  }
}
