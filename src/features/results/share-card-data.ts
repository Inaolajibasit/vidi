import "server-only";

import { inviteCodeSchema } from "@/features/games/validation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface ShareCardData {
  biggestDisagreement: string | null;
  compatibilityScore: number;
  inviteCode: string;
  knowledgeScore: number;
  playerNames: string[];
  sharedFavouritesCount: number;
  tasteScore: number;
}

/** A deliberately narrow public read model for completed-game share images. */
export async function getShareCardData(
  rawCode: string,
): Promise<ShareCardData | null> {
  const code = inviteCodeSchema.safeParse(rawCode);
  if (!code.success) return null;

  const admin = getSupabaseAdmin();
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id, invite_code, status")
    .eq("invite_code", code.data)
    .maybeSingle();
  if (gameError || !game || game.status !== "completed") return null;

  const [playersResponse, resultsResponse] = await Promise.all([
    admin
      .from("game_players")
      .select("display_name")
      .eq("game_id", game.id)
      .order("joined_at"),
    admin.from("compatibility_results").select("*").eq("game_id", game.id),
  ]);
  if (playersResponse.error || resultsResponse.error) return null;

  const players = playersResponse.data ?? [];
  const pairResults = (resultsResponse.data ?? []).filter(
    (result) => result.subject_player_id,
  );
  const groupResult = (resultsResponse.data ?? []).find(
    (result) => !result.subject_player_id,
  );
  const displayPair = pairResults.toSorted(
    (a, b) => Number(b.overall_score) - Number(a.overall_score),
  )[0];
  const primary =
    players.length === 2 ? displayPair : (groupResult ?? displayPair);
  if (!primary || !displayPair || players.length < 2) return null;

  const disagreementId = pairResults
    .filter((result) => result.disagreement_movie_ids.length)
    .toSorted((a, b) => Number(a.overall_score) - Number(b.overall_score))[0]
    ?.disagreement_movie_ids[0];
  const { data: disagreementMovie } = disagreementId
    ? await admin
        .from("movies")
        .select("title")
        .eq("id", disagreementId)
        .maybeSingle()
    : { data: null };

  return {
    biggestDisagreement: disagreementMovie?.title ?? null,
    compatibilityScore: Math.round(Number(primary.overall_score)),
    inviteCode: game.invite_code,
    knowledgeScore: Math.round(Number(primary.knowledge_score)),
    playerNames: players.map((player) => player.display_name),
    sharedFavouritesCount: primary.shared_favourite_movie_ids.length,
    tasteScore: Math.round(Number(primary.taste_score)),
  };
}
