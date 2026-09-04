"use server";

import { randomInt } from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getGameIdentity } from "@/features/games/identity";
import { generateInviteCode } from "@/lib/algorithms/game-deck";
import { trackServerAnalytics } from "@/lib/analytics/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,12}$/);
const startSchema = z.object({
  code: codeSchema,
  displayName: z.string().trim().min(1).max(50),
});
const CODE_ATTEMPTS = 5;

export interface StartChallengeState {
  message?: string;
}

function challengeStartMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Could not start the challenge. Try again.";
  }
  const value = error as { code?: string; message?: string };
  if (value.code === "PGRST202") {
    return "Challenge setup is not active yet. Run the latest Supabase migration.";
  }
  if (value.code === "23503") {
    return "The original game is no longer available for this challenge.";
  }
  if (value.code === "23514") {
    return "The original game data is incomplete. Create a new challenge link.";
  }
  if (value.message?.includes("Source game is not complete")) {
    return "The original game must be completed before this challenge can start.";
  }
  if (value.message?.includes("Challenge owner has no completed answers")) {
    return "The challenger’s finished answers could not be found.";
  }
  return "Could not start the challenge. Try again.";
}

export async function createChallengeAction(formData: FormData) {
  const inviteCode = codeSchema.safeParse(formData.get("inviteCode"));
  const identity = await getGameIdentity();
  if (!inviteCode.success || !identity?.profileId) {
    redirect(`/auth?next=${encodeURIComponent(`/results/${inviteCode.success ? inviteCode.data : ""}`)}`);
  }

  const admin = getSupabaseAdmin();
  const { data: game } = await admin
    .from("games")
    .select("id, status")
    .eq("invite_code", inviteCode.data)
    .maybeSingle();
  if (!game || game.status !== "completed") redirect(`/results/${inviteCode.data}`);

  const { data: player } = await admin
    .from("game_players")
    .select("id")
    .eq("game_id", game.id)
    .eq("profile_id", identity.profileId)
    .not("finished_at", "is", null)
    .maybeSingle();
  if (!player) redirect(`/results/${inviteCode.data}`);

  const { data: existing } = await admin
    .from("challenges")
    .select("active, code")
    .eq("creator_profile_id", identity.profileId)
    .eq("source_game_id", game.id)
    .maybeSingle();
  if (existing) {
    if (!existing.active) {
      await admin
        .from("challenges")
        .update({ active: true })
        .eq("code", existing.code);
    }
    redirect(`/challenge/${existing.code}`);
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode(randomInt);
    const { data: challenge, error } = await admin
      .from("challenges")
      .insert({
        code,
        creator_profile_id: identity.profileId,
        source_game_id: game.id,
        source_player_id: player.id,
      })
      .select("id")
      .single();
    if (!error) {
      await admin.from("challenge_events").insert({
        challenge_id: challenge.id,
        event_type: "challenge_created",
        profile_id: identity.profileId,
      });
      await trackServerAnalytics(
        "challenge_created",
        {},
        challenge.id,
      );
      redirect(`/challenge/${code}`);
    }
    if (error.code !== "23505") throw error;
  }

  throw new Error("Could not allocate a challenge code.");
}

export async function trackChallengeOpenedAction(rawCode: string) {
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return;
  const admin = getSupabaseAdmin();
  const { data: challenge } = await admin
    .from("challenges")
    .select("id")
    .eq("code", code.data)
    .eq("active", true)
    .maybeSingle();
  if (!challenge) return;
  const identity = await getGameIdentity({ createGuest: true });
  await admin.from("challenge_events").insert({
    challenge_id: challenge.id,
    event_type: "challenge_opened",
    guest_session_id: identity?.guestSessionId ?? null,
    profile_id: identity?.profileId ?? null,
  });
  await trackServerAnalytics("challenge_opened", {}, challenge.id);
}

export async function startChallengeAction(
  _state: StartChallengeState,
  formData: FormData,
): Promise<StartChallengeState> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Enter a name to start." };

  let startedGameCode: string | null = null;
  try {
    const admin = getSupabaseAdmin();
    const { data: challenge } = await admin
      .from("challenges")
      .select("creator_profile_id, id")
      .eq("code", parsed.data.code)
      .eq("active", true)
      .maybeSingle();
    if (!challenge) return { message: "This challenge is no longer available." };

    const identity = await getGameIdentity({
      createGuest: true,
      displayName: parsed.data.displayName,
    });
    if (!identity) return { message: "Could not create your player session." };
    if (identity.profileId === challenge.creator_profile_id) {
      return { message: "You created this challenge. Send the link to someone else." };
    }

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const gameCode = generateInviteCode(randomInt);
      const { data, error } = await admin.rpc("start_challenge_attempt", {
        p_challenge_id: challenge.id,
        p_display_name: identity.displayName,
        p_game_invite_code: gameCode,
        p_guest_session_id: identity.guestSessionId,
        p_profile_id: identity.profileId,
      });
      if (!error) {
        startedGameCode = data;
        break;
      }
      if (error.code !== "23505") throw error;
    }
  } catch (error) {
    const databaseError = error as {
      code?: string;
      details?: string;
      hint?: string;
      message?: string;
    };
    console.error("Challenge start failed", {
      code: databaseError.code,
      details: databaseError.details,
      hint: databaseError.hint,
      message: databaseError.message,
    });
    return { message: challengeStartMessage(error) };
  }

  if (startedGameCode) redirect(`/play/${startedGameCode}`);
  return { message: "Challenge codes are busy. Try again." };
}
