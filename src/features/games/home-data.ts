import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GameMode, GameStatus } from "@/types/database";

export interface RecentGame {
  id: string;
  mode: GameMode;
  progress: number;
  status: GameStatus;
}

export interface HomeData {
  authenticated: boolean;
  profile: { avatarUrl: string | null; displayName: string } | null;
  recentGame: RecentGame | null;
}

export async function getHomeData(): Promise<HomeData> {
  const supabase = await createSupabaseServerClient();

  if (!supabase)
    return { authenticated: false, profile: null, recentGame: null };

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user)
    return { authenticated: false, profile: null, recentGame: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: player } = await supabase
    .from("game_players")
    .select("game_id, progress")
    .eq("profile_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const account = {
    avatarUrl: profile?.avatar_url ?? null,
    displayName:
      profile?.display_name ??
      user.user_metadata.full_name ??
      user.email?.split("@")[0] ??
      "Player",
  };

  if (!player)
    return { authenticated: true, profile: account, recentGame: null };

  const { data: game } = await supabase
    .from("games")
    .select("id, mode, status")
    .eq("id", player.game_id)
    .maybeSingle();

  return {
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
