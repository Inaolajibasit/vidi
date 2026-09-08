import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Count each seen movie once across all of this account's game appearances. */
export async function getProfileSeenMovieIds(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<string[]> {
  const movieIds = new Set<string>();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("ratings")
      .select("movie_id, game_players!inner(profile_id)")
      .eq("game_players.profile_id", profileId)
      .eq("seen", true)
      .order("game_player_id")
      .order("movie_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error("Seen movies could not be loaded.");
    for (const rating of data) movieIds.add(rating.movie_id);
    if (data.length < pageSize) return [...movieIds];
  }
}
