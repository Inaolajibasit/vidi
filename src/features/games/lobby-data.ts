import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getGameIdentity,
  identityMatchesPlayer,
} from "@/features/games/identity";
import { inviteCodeSchema } from "@/features/games/validation";
import type { GameMode, GameStatus } from "@/types/database";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export interface LobbyData {
  authenticated: boolean;
  inviteCode: string;
  isHost: boolean;
  isParticipant: boolean;
  maxPlayers: number;
  mode: GameMode;
  players: Array<{
    avatarUrl: string | null;
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
  // Lobby pages refresh frequently while several participants join from the
  // same household or mobile network, so this limit must allow shared-IP play.
  if (!(await consumeRateLimit("lobby_read", 1_000, 3_600))) {
    throw new Error("Lobby lookup is temporarily unavailable.");
  }

  try {
    const admin = getSupabaseAdmin();
    const [{ data: game }, identity] = await Promise.all([
      admin
        .from("games")
        .select("id, host_profile_id, invite_code, max_players, mode, status")
        .eq("invite_code", parsedCode.data)
        .maybeSingle(),
      getGameIdentity({ loadDisplayName: false }),
    ]);

    if (!game) return null;

    const { data: players, error } = await admin
      .from("game_players")
      .select("display_name, guest_session_id, profile_id")
      .eq("game_id", game.id)
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    const profileIds = [
      ...new Set(
        (players ?? [])
          .map((player) => player.profile_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: profiles, error: profileError } = profileIds.length
      ? await admin
          .from("profiles")
          .select("avatar_url, id")
          .in("id", profileIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const avatarByProfile = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile.avatar_url]),
    );

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
        avatarUrl: player.profile_id
          ? (avatarByProfile.get(player.profile_id) ?? null)
          : null,
        displayName: player.display_name,
        isCurrent: identityMatchesPlayer(identity, player),
      })),
      status: game.status,
    };
  } catch (error) {
    console.error("Lobby lookup failed", error);
    throw error;
  }
}
