import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type RateLimitScope =
  | "challenge_start"
  | "challenge_read"
  | "analytics"
  | "friend_request"
  | "game_answer"
  | "game_create"
  | "game_join"
  | "lobby_read"
  | "result_read"
  | "share_card";

function requestFingerprint(
  headerStore: Awaited<ReturnType<typeof headers>>,
): string | null {
  const forwarded =
    headerStore.get("x-vercel-forwarded-for") ??
    headerStore.get("x-real-ip") ??
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!forwarded) return null;

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update(forwarded).digest("hex");
}

export async function consumeRateLimit(
  scope: RateLimitScope,
  limit: number,
  windowSeconds: number,
) {
  const fingerprint = requestFingerprint(await headers());
  if (!fingerprint) return true;

  const { data, error } = await getSupabaseAdmin().rpc(
    "consume_request_rate_limit",
    {
      p_actor_hash: fingerprint,
      p_limit: limit,
      p_scope: scope,
      p_window_seconds: windowSeconds,
    },
  );
  if (error) {
    console.error("Rate-limit check failed", { code: error.code, scope });
    return false;
  }
  return data;
}
