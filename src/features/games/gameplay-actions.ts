"use server";

import { z } from "zod";

import { completeChallengeAttempt } from "@/features/challenges/complete-attempt";
import {
  getGameIdentity,
  identityMatchesPlayer,
} from "@/features/games/identity";
import {
  GAME_MODE_DETAILS,
  inviteCodeSchema,
} from "@/features/games/validation";
import { calculateAndStoreResults } from "@/features/results/calculate-results";
import { trackServerAnalytics } from "@/lib/analytics/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const answerSchema = z
  .object({
    inviteCode: inviteCodeSchema,
    reaction: z.enum(["loved", "liked", "meh", "cant_remember"]).nullable(),
    seen: z.boolean(),
    tmdbId: z.number().int().positive(),
  })
  .refine((answer) => answer.seen || answer.reaction === null, {
    message: "Unseen movies cannot have a reaction.",
  });

export interface RecordAnswerResult {
  complete?: boolean;
  error?: string;
  progress?: number;
  reactionPending?: boolean;
  success: boolean;
}

export type GameResultsStatus = "waiting" | "processing" | "ready" | "error";

export async function ensureGameResultsAction(
  rawInviteCode: string,
): Promise<GameResultsStatus> {
  const inviteCode = inviteCodeSchema.safeParse(rawInviteCode);
  if (!inviteCode.success) return "error";

  try {
    const admin = getSupabaseAdmin();
    const { data: game } = await admin
      .from("games")
      .select("id, mode, status")
      .eq("invite_code", inviteCode.data)
      .maybeSingle();
    if (!game) return "error";
    if (game.status === "active") return "waiting";
    if (!["waiting_results", "completed"].includes(game.status)) return "error";

    const identity = await getGameIdentity();
    const { data: players } = await admin
      .from("game_players")
      .select("guest_session_id, profile_id")
      .eq("game_id", game.id);
    if (!players?.some((player) => identityMatchesPlayer(identity, player)))
      return "error";

    try {
      await completeChallengeAttempt(game.id);
    } catch (error) {
      console.error("Challenge completion recovery failed", error);
    }

    if (game.status === "waiting_results") {
      await calculateAndStoreResults(game.id);
      const { data: completedGame } = await admin
        .from("games")
        .select("status")
        .eq("id", game.id)
        .maybeSingle();
      return completedGame?.status === "completed" ? "ready" : "processing";
    }
    return "ready";
  } catch (error) {
    console.error("Result recovery failed", error);
    return "error";
  }
}

export async function recordAnswerAction(
  input: z.input<typeof answerSchema>,
): Promise<RecordAnswerResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Invalid movie answer.", success: false };

  try {
    const admin = getSupabaseAdmin();
    const { data: game } = await admin
      .from("games")
      .select("id, mode, status")
      .eq("invite_code", parsed.data.inviteCode)
      .maybeSingle();

    if (
      !game ||
      !["active", "waiting_results", "completed"].includes(game.status)
    ) {
      return { error: "This game is not active.", success: false };
    }

    const identity = await getGameIdentity();
    const { data: players } = await admin
      .from("game_players")
      .select("id, guest_session_id, profile_id, progress, finished_at")
      .eq("game_id", game.id);
    const player = players?.find((candidate) =>
      identityMatchesPlayer(identity, candidate),
    );
    if (!player) return { error: "Player session not found.", success: false };

    const { data: movie } = await admin
      .from("movies")
      .select("id")
      .eq("tmdb_id", parsed.data.tmdbId)
      .maybeSingle();
    if (!movie) return { error: "Movie not found.", success: false };

    const confirmedResult = async () => {
      const { data: existing } = await admin
        .from("ratings")
        .select("reaction, seen")
        .eq("game_player_id", player.id)
        .eq("movie_id", movie.id)
        .maybeSingle();
      if (
        existing &&
        existing.seen === parsed.data.seen &&
        existing.reaction === parsed.data.reaction
      ) {
        return {
          complete: Boolean(player.finished_at),
          progress: player.progress,
          reactionPending: existing.seen && existing.reaction === null,
          success: true,
        } satisfies RecordAnswerResult;
      }
      return null;
    };

    if (game.status !== "active") {
      return (
        (await confirmedResult()) ?? {
          error: "This game is no longer accepting answers.",
          success: false,
        }
      );
    }

    const { data, error } = await admin.rpc("record_game_answer", {
      p_game_id: game.id,
      p_game_player_id: player.id,
      p_movie_id: movie.id,
      p_reaction: parsed.data.reaction,
      p_seen: parsed.data.seen,
    });

    if (error) {
      const confirmed = await confirmedResult();
      if (confirmed) return confirmed;
      throw error;
    }
    const result = z
      .object({
        complete: z.boolean(),
        progress: z.number().int().nonnegative(),
        reaction_pending: z.boolean(),
      })
      .parse(data);

    if (!parsed.data.seen || parsed.data.reaction !== null) {
      await trackServerAnalytics(
        "movie_swiped",
        {
          deckSize: GAME_MODE_DETAILS[game.mode].movieCount,
          progress: result.progress,
        },
        parsed.data.inviteCode,
      );
    }

    if (result.complete) {
      try {
        await completeChallengeAttempt(game.id);
      } catch (error) {
        // Analytics must never make a successfully persisted answer appear to
        // fail. The null completed_at row remains safe to repair later.
        console.error("Challenge completion tracking failed", error);
      }
    }

    return {
      complete: result.complete,
      progress: result.progress,
      reactionPending: result.reaction_pending,
      success: true,
    };
  } catch (error) {
    console.error("Answer persistence failed", error);
    return {
      error: "Your answer didn’t save. Reconnecting…",
      success: false,
    };
  }
}
