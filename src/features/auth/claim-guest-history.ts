import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { GUEST_SESSION_COOKIE } from "@/features/games/identity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type GuestHistoryClaimResult =
  | { status: "claimed" | "nothing_to_claim" }
  | { status: "failed"; reason: "configuration" | "database" };

/**
 * Associates the current browser's guest games with an authenticated user.
 *
 * Authentication must never fail because this secondary migration fails. The
 * guest cookie is deliberately retained on failure so a later attempt can
 * safely retry the idempotent database function.
 */
export async function claimGuestHistoryForUser(
  userId: string,
): Promise<GuestHistoryClaimResult> {
  const store = await cookies();
  const guestSessionId = z
    .uuid()
    .safeParse(store.get(GUEST_SESSION_COOKIE)?.value);

  if (!guestSessionId.success) return { status: "nothing_to_claim" };

  try {
    const { error } = await getSupabaseAdmin().rpc("claim_guest_history", {
      p_user_id: userId,
      p_guest_session_id: guestSessionId.data,
    });

    if (error) {
      console.error("Guest history claim failed", {
        code: error.code,
        hint: error.hint,
        message: error.message,
      });
      return { status: "failed", reason: "database" };
    }
  } catch (error) {
    console.error("Guest history claim could not be initialized", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: "failed", reason: "configuration" };
  }

  store.delete(GUEST_SESSION_COOKIE);
  return { status: "claimed" };
}
