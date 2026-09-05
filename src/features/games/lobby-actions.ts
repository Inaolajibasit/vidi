"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { trackServerAnalytics } from "@/lib/analytics/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getGameIdentity,
  identityMatchesPlayer,
} from "@/features/games/identity";
import { broadcastLobbyEvent } from "@/features/games/realtime";
import {
  GAME_MODE_DETAILS,
  inviteCodeSchema,
  joinGameSchema,
} from "@/features/games/validation";

export interface LobbyActionState {
  displayNameError?: string;
  message?: string;
}

function lobbyPath(inviteCode: string) {
  return `/join/${inviteCode}`;
}

export async function joinGameAction(
  _previousState: LobbyActionState,
  formData: FormData,
): Promise<LobbyActionState> {
  const parsed = joinGameSchema.safeParse({
    displayName: formData.get("displayName"),
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success) {
    return {
      displayNameError:
        parsed.error.flatten().fieldErrors.displayName?.[0] ?? undefined,
      message: parsed.error.issues[0]?.message,
    };
  }

  const { displayName, inviteCode } = parsed.data;

  try {
    const admin = getSupabaseAdmin();
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, max_players, status")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (gameError) throw gameError;
    if (!game) return { message: "That invite code doesn’t exist." };
    if (game.status === "expired") {
      return { message: "This game has expired. Ask the host for a new one." };
    }
    if (game.status !== "waiting") {
      return { message: "This game has already started." };
    }

    const identity = await getGameIdentity({ createGuest: true, displayName });
    if (!identity) return { message: "Couldn’t create a player session." };

    let existingQuery = admin
      .from("game_players")
      .select("id")
      .eq("game_id", game.id);
    existingQuery = identity.profileId
      ? existingQuery.eq("profile_id", identity.profileId)
      : existingQuery.eq("guest_session_id", identity.guestSessionId!);
    const { data: existingPlayer } = await existingQuery.maybeSingle();

    if (!existingPlayer) {
      const { count, error: countError } = await admin
        .from("game_players")
        .select("id", { count: "exact", head: true })
        .eq("game_id", game.id);

      if (countError) throw countError;
      if ((count ?? 0) >= game.max_players) {
        return { message: "This room is full." };
      }

      const { error: insertError } = await admin.from("game_players").insert({
        display_name: identity.displayName,
        game_id: game.id,
        guest_session_id: identity.guestSessionId,
        profile_id: identity.profileId,
      });

      if (insertError && insertError.code !== "23505") {
        if (insertError.message.includes("Game is full")) {
          return { message: "This room is full." };
        }
        throw insertError;
      }

      if (!insertError) {
        await trackServerAnalytics(
          "player_joined",
          { isGuest: !identity.profileId },
          inviteCode,
        );
        revalidatePath(lobbyPath(inviteCode));
        await broadcastLobbyEvent(inviteCode, "player_joined");
      }
    }
  } catch (error) {
    console.error("Join game failed", error);
    return { message: "Couldn’t join the game. Please try again." };
  }

  redirect(lobbyPath(inviteCode));
}

export async function startGameAction(
  _previousState: LobbyActionState,
  formData: FormData,
): Promise<LobbyActionState> {
  const parsedCode = inviteCodeSchema.safeParse(formData.get("inviteCode"));
  if (!parsedCode.success) return { message: "Invalid invite code." };
  const inviteCode = parsedCode.data;

  try {
    const admin = getSupabaseAdmin();
    const { data: game, error: gameError } = await admin
      .from("games")
      .select("id, mode, status")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (gameError) throw gameError;
    if (!game) return { message: "Game not found." };
    if (game.status === "expired") return { message: "This game has expired." };
    if (game.status !== "waiting")
      return { message: "The game has already started." };

    const { data: players, error: playerError } = await admin
      .from("game_players")
      .select("id, guest_session_id, profile_id")
      .eq("game_id", game.id)
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true });

    if (playerError) throw playerError;
    const identity = await getGameIdentity({ loadDisplayName: false });
    if (!players?.[0] || !identityMatchesPlayer(identity, players[0])) {
      return { message: "Only the host can start this game." };
    }
    if (players.length < 2) {
      return { message: "At least 2 players are needed to start." };
    }

    const { data: updatedGame, error: updateError } = await admin
      .from("games")
      .update({ started_at: new Date().toISOString(), status: "active" })
      .eq("id", game.id)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedGame) return { message: "The game was already started." };

    revalidatePath(lobbyPath(inviteCode));
    await broadcastLobbyEvent(inviteCode, "game_started");
    await trackServerAnalytics(
      "game_started",
      {
        deckSize: GAME_MODE_DETAILS[game.mode].movieCount,
        mode: game.mode,
        playerCount: players.length,
      },
      inviteCode,
    );
    return {};
  } catch (error) {
    console.error("Start game failed", error);
    return { message: "Couldn’t start the game. Please try again." };
  }
}

export async function leaveGameAction(formData: FormData) {
  const parsedCode = inviteCodeSchema.safeParse(formData.get("inviteCode"));
  if (!parsedCode.success) redirect("/");
  const inviteCode = parsedCode.data;

  try {
    const admin = getSupabaseAdmin();
    const { data: game } = await admin
      .from("games")
      .select("id, status")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (game?.status === "waiting") {
      const { data: players } = await admin
        .from("game_players")
        .select("id, guest_session_id, profile_id")
        .eq("game_id", game.id)
        .order("joined_at", { ascending: true })
        .order("id", { ascending: true });
      const identity = await getGameIdentity({ loadDisplayName: false });
      const currentIndex =
        players?.findIndex((player) =>
          identityMatchesPlayer(identity, player),
        ) ?? -1;

      if (currentIndex > 0 && players) {
        const { error } = await admin
          .from("game_players")
          .delete()
          .eq("id", players[currentIndex].id);
        if (error) throw error;
        revalidatePath(lobbyPath(inviteCode));
        await broadcastLobbyEvent(inviteCode, "player_left");
      }
    }
  } catch (error) {
    console.error("Leave game failed", error);
  }

  redirect("/");
}
