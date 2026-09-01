"use server";

import { randomInt } from "node:crypto";

import { redirect } from "next/navigation";

import {
  buildRankedMovieDeck,
  generateInviteCode,
} from "@/lib/algorithms/game-deck";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getGameIdentity } from "@/features/games/identity";
import {
  createGameSchema,
  GAME_MODE_DETAILS,
} from "@/features/games/validation";

const INVITE_ATTEMPTS = 5;
const NETWORK_RETRY_DELAYS = [250, 750] as const;

function isTransportFailure(error: { details?: string; message?: string } | null) {
  const description = `${error?.message ?? ""} ${error?.details ?? ""}`;
  return /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(description);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface CreateGameState {
  fieldErrors?: Partial<
    Record<"displayName" | "genreIds" | "maxPlayers" | "mode", string>
  >;
  message?: string;
}

function firstFieldErrors(
  error: ReturnType<typeof createGameSchema.safeParse>,
) {
  if (error.success) return undefined;

  const fields = error.error.flatten().fieldErrors;
  return {
    displayName: fields.displayName?.[0],
    genreIds: fields.genreIds?.[0],
    maxPlayers: fields.maxPlayers?.[0],
    mode: fields.mode?.[0],
  };
}

export async function createGameAction(
  _previousState: CreateGameState,
  formData: FormData,
): Promise<CreateGameState> {
  const parsed = createGameSchema.safeParse({
    displayName: formData.get("displayName"),
    genreIds: formData.getAll("genreIds"),
    maxPlayers: formData.get("maxPlayers"),
    mode: formData.get("mode"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: firstFieldErrors(parsed),
      message: "Check the highlighted details and try again.",
    };
  }

  let inviteCode: string | undefined;

  try {
    const admin = getSupabaseAdmin();
    const movieCount = GAME_MODE_DETAILS[parsed.data.mode].movieCount;
    const identity = await getGameIdentity({
      createGuest: true,
      displayName: parsed.data.displayName,
    });

    if (!identity) throw new Error("Could not establish a host identity.");

    let movieResponse = await admin.rpc(
      "get_deck_candidates",
      { p_limit: 3_000 },
    );
    for (const delay of NETWORK_RETRY_DELAYS) {
      if (!movieResponse.error || !isTransportFailure(movieResponse.error)) break;
      await wait(delay);
      movieResponse = await admin.rpc("get_deck_candidates", {
        p_limit: 3_000,
      });
    }
    const { data: movies, error: movieError } = movieResponse;

    if (movieError) throw movieError;

    if (!movies || movies.length < movieCount) {
      return {
        message: `The movie library has ${movies?.length ?? 0} movies. Sync at least ${movieCount} before creating this mode.`,
      };
    }

    let recentGameIds: string[] = [];
    if (identity.profileId) {
      const { data } = await admin
        .from("games")
        .select("id")
        .eq("host_profile_id", identity.profileId)
        .order("created_at", { ascending: false })
        .limit(5);
      recentGameIds = (data ?? []).map((game) => game.id);
    } else if (identity.guestSessionId) {
      const { data } = await admin
        .from("game_players")
        .select("game_id")
        .eq("guest_session_id", identity.guestSessionId)
        .order("joined_at", { ascending: false })
        .limit(5);
      recentGameIds = (data ?? []).map((player) => player.game_id);
    }
    const { data: recentMovies } = recentGameIds.length
      ? await admin
          .from("game_movies")
          .select("movie_id")
          .in("game_id", recentGameIds)
      : { data: [] };
    const recentMovieIds = new Set(
      (recentMovies ?? []).map((movie) => movie.movie_id),
    );

    for (let attempt = 0; attempt < INVITE_ATTEMPTS; attempt += 1) {
      const candidateCode = generateInviteCode(randomInt);
      // The invite code is stored with the game and doubles as its reproducible
      // seed. The complete ordered deck is still persisted exactly once below.
      const movieIds = buildRankedMovieDeck(
        movies.map((movie) => ({
          director: movie.director_name,
          franchiseId: movie.franchise_id,
          genreIds: movie.genre_ids,
          id: movie.id,
          keywordIds: movie.keyword_ids,
          keywordNames: movie.keyword_names,
          originalLanguage: movie.original_language,
          popularity: Number(movie.popularity),
          releaseYear: movie.release_year,
          voteAverage: Number(movie.vote_average),
          voteCount: movie.vote_count,
        })),
        movieCount,
        candidateCode,
        {
          preferredGenreIds: parsed.data.genreIds,
          recentMovieIds,
        },
      ).map((movie) => movie.id);
      const { data, error } = await admin.rpc("create_classic_game", {
        p_display_name: identity.displayName,
        p_guest_session_id: identity.guestSessionId,
        p_invite_code: candidateCode,
        p_max_players: parsed.data.maxPlayers,
        p_mode: parsed.data.mode,
        p_movie_ids: movieIds,
        p_profile_id: identity.profileId,
      });

      if (!error) {
        inviteCode = data;
        break;
      }

      if (error.code !== "23505") throw error;
    }
  } catch (error) {
    console.error("Game creation failed", error);
    return {
      message:
        "We couldn’t create the game. Check the Supabase migration and try again.",
    };
  }

  if (!inviteCode) {
    return { message: "Invite codes are busy. Please try again." };
  }

  redirect(`/join/${inviteCode}`);
}
