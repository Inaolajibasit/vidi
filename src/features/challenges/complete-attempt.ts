import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { trackServerAnalytics } from "@/lib/analytics/server";

export async function completeChallengeAttempt(gameId: string) {
  const admin = getSupabaseAdmin();
  const completedAt = new Date().toISOString();
  const { data: attempt, error } = await admin
    .from("challenge_attempts")
    .update({ completed_at: completedAt })
    .eq("game_id", gameId)
    .is("completed_at", null)
    .select("challenge_id, id, participant_guest_session_id, participant_profile_id")
    .maybeSingle();
  if (error) throw error;
  if (!attempt) return;
  const { error: eventError } = await admin.from("challenge_events").insert({
    attempt_id: attempt.id,
    challenge_id: attempt.challenge_id,
    event_type: "challenge_completed",
    guest_session_id: attempt.participant_guest_session_id,
    profile_id: attempt.participant_profile_id,
  });
  if (eventError) throw eventError;
  await trackServerAnalytics(
    "challenge_completed",
    {},
    attempt.challenge_id,
  );
}
