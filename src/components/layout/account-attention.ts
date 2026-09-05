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
    { data: friendRequests, error: friendError },
    { data: players, error: playerError },
  ] = await Promise.all([
    admin
      .from("friendships")
      .select("id")
      .eq("addressee_id", userId)
      .eq("status", "pending"),
    admin.from("game_players").select("game_id").eq("profile_id", userId),
  ]);

  if (friendError) throw friendError;
  if (playerError) throw playerError;

  const gameIds = [...new Set((players ?? []).map((player) => player.game_id))];
  if (!gameIds.length) {
    const requestIds = (friendRequests ?? []).map((request) => request.id);
    const { data: reads, error: readError } = requestIds.length
      ? await admin
          .from("account_attention_reads")
          .select("entity_id")
          .eq("profile_id", userId)
          .eq("kind", "friend_request")
          .in("entity_id", requestIds)
      : { data: [], error: null };
    if (readError) throw readError;
    const readIds = new Set((reads ?? []).map((read) => read.entity_id));
    return {
      friendRequests: requestIds.filter((id) => !readIds.has(id)).length,
      incompleteGames: 0,
    };
  }

  const { data: incompleteGames, error: gameError } = await admin
    .from("games")
    .select("id")
    .in("id", gameIds)
    .in("status", ["waiting", "active", "waiting_results"]);
  if (gameError) throw gameError;

  const requestIds = (friendRequests ?? []).map((request) => request.id);
  const incompleteGameIds = (incompleteGames ?? []).map((game) => game.id);
  const attentionIds = [...requestIds, ...incompleteGameIds];
  const { data: reads, error: readError } = attentionIds.length
    ? await admin
        .from("account_attention_reads")
        .select("entity_id, kind")
        .eq("profile_id", userId)
        .in("entity_id", attentionIds)
    : { data: [], error: null };
  if (readError) throw readError;
  const readRequests = new Set(
    (reads ?? [])
      .filter((read) => read.kind === "friend_request")
      .map((read) => read.entity_id),
  );
  const readGames = new Set(
    (reads ?? [])
      .filter((read) => read.kind === "game")
      .map((read) => read.entity_id),
  );

  return {
    friendRequests: requestIds.filter((id) => !readRequests.has(id)).length,
    incompleteGames: incompleteGameIds.filter((id) => !readGames.has(id))
      .length,
  };
}
