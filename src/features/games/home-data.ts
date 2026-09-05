import "server-only";

import {
  EMPTY_ACCOUNT_ATTENTION,
  getAccountAttention,
  type AccountAttention,
} from "@/components/layout/account-attention";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GameMode, GameStatus } from "@/types/database";

export interface RecentGame {
  id: string;
  mode: GameMode;
  progress: number;
  status: GameStatus;
}

export interface HomeData {
  attention: AccountAttention;
  authenticated: boolean;
  profile: { avatarUrl: string | null; displayName: string } | null;
  recentGame: RecentGame | null;
}

export async function getHomeData(): Promise<HomeData> {
  const supabase = await createSupabaseServerClient();

  if (!supabase)
    return {
      attention: EMPTY_ACCOUNT_ATTENTION,
      authenticated: false,
      profile: null,
      recentGame: null,
    };

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user)
    return {
      attention: EMPTY_ACCOUNT_ATTENTION,
      authenticated: false,
      profile: null,
      recentGame: null,
    };

  const [{ data: profile }, { data: player }, attention] = await Promise.all([
    supabase
      .from("profiles")
      .select("avatar_url, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("game_players")
      .select("game_id, progress")
      .eq("profile_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAccountAttention(user.id),
  ]);

  const account = {
    avatarUrl:
      profile?.avatar_url ??
      user.user_metadata.avatar_url ??
      user.user_metadata.picture ??
      null,
    displayName:
      profile?.display_name ??
      user.user_metadata.full_name ??
      user.email?.split("@")[0] ??
      "Player",
  };

  if (!player)
    return {
      attention,
      authenticated: true,
      profile: account,
      recentGame: null,
    };

  const { data: game } = await supabase
    .from("games")
    .select("id, mode, status")
    .eq("id", player.game_id)
    .maybeSingle();

  return {
    attention,
    authenticated: true,
    profile: account,
    recentGame: game
      ? {
          id: game.id,
          mode: game.mode,
          progress: player.progress,
          status: game.status,
        }
      : null,
  };
}
