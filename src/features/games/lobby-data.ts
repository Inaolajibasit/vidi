import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getGameIdentity,
  identityMatchesPlayer,
} from "@/features/games/identity";
import { inviteCodeSchema } from "@/features/games/validation";
import type { GameMode, GameStatus } from "@/types/database";

export interface LobbyData {
  authenticated: boolean;
  inviteCode: string;
  isHost: boolean;
  isParticipant: boolean;
  maxPlayers: number;
  mode: GameMode;
  players: Array<{
    displayName: string;
    isCurrent: boolean;
  }>;
  status: GameStatus;
}

export async function getLobbyData(
  rawInviteCode: string,
): Promise<LobbyData | null> {
  const parsedCode = inviteCodeSchema.safeParse(rawInviteCode);
  if (!parsedCode.success) return null;

  try {
    const admin = getSupabaseAdmin();
    const { data: game } = await admin
      .from("games")
      .select("id, host_profile_id, invite_code, max_players, mode, status")
      .eq("invite_code", parsedCode.data)
      .maybeSingle();

    if (!game) return null;

    const { data: players, error } = await admin
      .from("game_players")
      .select("display_name, guest_session_id, profile_id")
      .eq("game_id", game.id)
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    const identity = await getGameIdentity();
    const hostPlayer = players?.[0];
    const isHost = hostPlayer
      ? identityMatchesPlayer(identity, hostPlayer)
      : false;
    const isParticipant =
      players?.some((player) => identityMatchesPlayer(identity, player)) ??
      false;

    return {
      authenticated: Boolean(identity?.profileId),
      inviteCode: game.invite_code,
      isHost,
      isParticipant,
      maxPlayers: game.max_players,
      mode: game.mode,
      players: (players ?? []).map((player) => ({
        displayName: player.display_name,
        isCurrent: identityMatchesPlayer(identity, player),
      })),
      status: game.status,
    };
  } catch (error) {
    console.error("Lobby lookup failed", error);
    return null;
  }
}
