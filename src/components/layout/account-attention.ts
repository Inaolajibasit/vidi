import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface AccountAttention {
  friendRequests: number;
  incompleteGames: number;
}

export const EMPTY_ACCOUNT_ATTENTION: AccountAttention = {
  friendRequests: 0,
  incompleteGames: 0,
};

export async function getAccountAttention(
  userId: string,
): Promise<AccountAttention> {
  const admin = getSupabaseAdmin();
  const [
    { count: friendRequests, error: friendError },
    { data: players, error: playerError },
  ] = await Promise.all([
    admin
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", userId)
      .eq("status", "pending"),
    admin.from("game_players").select("game_id").eq("profile_id", userId),
  ]);

  if (friendError) throw friendError;
  if (playerError) throw playerError;

  const gameIds = [...new Set((players ?? []).map((player) => player.game_id))];
  if (!gameIds.length) {
    return { friendRequests: friendRequests ?? 0, incompleteGames: 0 };
  }

  const { count: incompleteGames, error: gameError } = await admin
    .from("games")
    .select("id", { count: "exact", head: true })
    .in("id", gameIds)
    .in("status", ["waiting", "active", "waiting_results"]);
  if (gameError) throw gameError;

  return {
    friendRequests: friendRequests ?? 0,
    incompleteGames: incompleteGames ?? 0,
  };
}
