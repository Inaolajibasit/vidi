import "server-only";

import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { GameMode } from "@/types/database";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,12}$/);

export interface ChallengeData {
  code: string;
  creator: {
    avatarUrl: string | null;
    displayName: string;
  };
  mode: GameMode;
  movieCount: number;
}

export async function getChallengeData(
  rawCode: string,
): Promise<ChallengeData | null> {
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return null;
  if (!(await consumeRateLimit("challenge_read", 120, 3_600))) return null;
  const admin = getSupabaseAdmin();
  const { data: challenge, error } = await admin
    .from("challenges")
    .select("code, creator_profile_id, source_game_id")
    .eq("code", code.data)
    .eq("active", true)
    .maybeSingle();
  if (error || !challenge) return null;

  const [{ data: creator }, { data: game }, { count }] = await Promise.all([
    admin
      .from("profiles")
      .select("avatar_url, display_name")
      .eq("id", challenge.creator_profile_id)
      .maybeSingle(),
    admin
      .from("games")
      .select("mode, status")
      .eq("id", challenge.source_game_id)
      .maybeSingle(),
    admin
      .from("game_movies")
      .select("movie_id", { count: "exact", head: true })
      .eq("game_id", challenge.source_game_id),
  ]);
  if (!creator || !game || game.status !== "completed" || !count) return null;
  return {
    code: challenge.code,
    creator: {
      avatarUrl: creator.avatar_url,
      displayName: creator.display_name,
    },
    mode: game.mode,
    movieCount: count,
  };
}
