import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { lobbyTopic } from "@/features/games/realtime-topic";

export type LobbyEvent = "game_started" | "player_joined" | "player_left";

export async function broadcastLobbyEvent(
  inviteCode: string,
  event: LobbyEvent,
) {
  const admin = getSupabaseAdmin();
  const channel = admin.channel(lobbyTopic(inviteCode));

  try {
    await channel.httpSend(event, { inviteCode });
  } catch (error) {
    // Database state is authoritative. A missed broadcast is repaired by the
    // next reconnect, refresh, or lobby action rather than failing the action.
    console.error(`Lobby broadcast failed: ${event}`, error);
  } finally {
    await admin.removeChannel(channel);
  }
}
