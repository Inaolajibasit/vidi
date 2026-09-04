"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackServerAnalytics } from "@/lib/analytics/server";

const inviteCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/);
const itemIdSchema = z.uuid();

async function authenticatedProfileId() {
  const client = await createSupabaseServerClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  return data.user?.id ?? null;
}

async function getOrCreatePersonalWatchlist(profileId: string) {
  const admin = getSupabaseAdmin();
  const { data: existing, error } = await admin
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId)
    .eq("kind", "personal")
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  const { data, error: insertError } = await admin
    .from("watchlists")
    .insert({ kind: "personal", name: "My Watchlist", profile_id: profileId })
    .select("id")
    .single();
  if (!insertError) return data.id;
  if (insertError.code !== "23505") throw insertError;

  const { data: raced, error: racedError } = await admin
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId)
    .eq("kind", "personal")
    .single();
  if (racedError) throw racedError;
  return raced.id;
}

function personalMovieIds(metrics: unknown, playerId: string) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return [];
  const lists = (metrics as Record<string, unknown>).personalWatchlists;
  if (!lists || typeof lists !== "object" || Array.isArray(lists)) return [];
  const ids = (lists as Record<string, unknown>)[playerId];
  return Array.isArray(ids)
    ? ids.filter((id): id is string => z.uuid().safeParse(id).success)
    : [];
}

async function completedGameWatchlists(profileId: string, inviteCode: string) {
  const admin = getSupabaseAdmin();
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id, status")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (gameError) throw gameError;
  if (!game || game.status !== "completed") return null;

  const { data: players, error: playerError } = await admin
    .from("game_players")
    .select("id, display_name, profile_id")
    .eq("game_id", game.id)
    .order("joined_at");
  if (playerError) throw playerError;
  const currentPlayer = players?.find((player) => player.profile_id === profileId);
  if (!currentPlayer || !players || players.length < 2) return null;

  const { data: results, error: resultError } = await admin
    .from("compatibility_results")
    .select("metrics, subject_player_id, watchlist_movie_ids")
    .eq("game_id", game.id);
  if (resultError) throw resultError;
  const group = results?.find((result) => !result.subject_player_id);
  const pair = results?.find((result) => result.subject_player_id);
  const sharedMovieIds = group?.watchlist_movie_ids ?? pair?.watchlist_movie_ids ?? [];
  const generatedPersonalIds = group
    ? personalMovieIds(group.metrics, currentPlayer.id)
    : [];

  return {
    gameId: game.id,
    participantNames: players.map((player) => player.display_name),
    personalMovieIds: generatedPersonalIds.length
      ? generatedPersonalIds
      : sharedMovieIds,
    sharedMovieIds,
  };
}

async function addMovies(
  watchlistId: string,
  movieIds: readonly string[],
  sourceGameId: string | null,
) {
  if (!movieIds.length) return;
  const { error } = await getSupabaseAdmin().from("watchlist_items").upsert(
    movieIds.map((movieId) => ({
      movie_id: movieId,
      source_game_id: sourceGameId,
      watchlist_id: watchlistId,
    })),
    { onConflict: "watchlist_id,movie_id" },
  );
  if (error) throw error;
}

export async function savePersonalGameWatchlistAction(formData: FormData) {
  const code = inviteCodeSchema.safeParse(formData.get("inviteCode"));
  const profileId = await authenticatedProfileId();
  if (!profileId || !code.success) return;
  const generated = await completedGameWatchlists(profileId, code.data);
  if (!generated) return;
  const watchlistId = await getOrCreatePersonalWatchlist(profileId);
  await addMovies(watchlistId, generated.personalMovieIds, generated.gameId);
  await trackServerAnalytics(
    "watchlist_saved",
    { itemCount: generated.personalMovieIds.length, kind: "personal" },
    generated.gameId,
  );
  revalidatePath(`/results/${code.data}`);
  revalidatePath("/watchlist");
}

export async function saveSharedGameWatchlistAction(formData: FormData) {
  const code = inviteCodeSchema.safeParse(formData.get("inviteCode"));
  const profileId = await authenticatedProfileId();
  if (!profileId || !code.success) return;
  const generated = await completedGameWatchlists(profileId, code.data);
  if (!generated) return;

  const admin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await admin
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId)
    .eq("kind", "shared")
    .eq("source_game_id", generated.gameId)
    .maybeSingle();
  if (existingError) throw existingError;

  let watchlistId = existing?.id;
  if (!watchlistId) {
    const { data, error } = await admin
      .from("watchlists")
      .insert({
        kind: "shared",
        name: generated.participantNames.join(" × ").slice(0, 80),
        participant_names: generated.participantNames,
        profile_id: profileId,
        source_game_id: generated.gameId,
      })
      .select("id")
      .single();
    if (!error) {
      watchlistId = data.id;
    } else if (error.code === "23505") {
      const { data: raced, error: racedError } = await admin
        .from("watchlists")
        .select("id")
        .eq("profile_id", profileId)
        .eq("kind", "shared")
        .eq("source_game_id", generated.gameId)
        .single();
      if (racedError) throw racedError;
      watchlistId = raced.id;
    } else {
      throw error;
    }
  }

  await addMovies(watchlistId, generated.sharedMovieIds, generated.gameId);
  await trackServerAnalytics(
    "watchlist_saved",
    { itemCount: generated.sharedMovieIds.length, kind: "shared" },
    generated.gameId,
  );
  revalidatePath(`/results/${code.data}`);
  revalidatePath("/watchlist");
}

async function ownedListIds(profileId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []).map((list) => list.id);
}

export async function removeWatchlistItemAction(formData: FormData) {
  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  const profileId = await authenticatedProfileId();
  if (!profileId || !itemId.success) return;
  const listIds = await ownedListIds(profileId);
  if (!listIds.length) return;
  const { error } = await getSupabaseAdmin()
    .from("watchlist_items")
    .delete()
    .eq("id", itemId.data)
    .in("watchlist_id", listIds);
  if (error) throw error;
  revalidatePath("/watchlist");
}

export async function markWatchlistItemWatchedAction(formData: FormData) {
  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  const profileId = await authenticatedProfileId();
  if (!profileId || !itemId.success) return;
  const listIds = await ownedListIds(profileId);
  if (!listIds.length) return;
  const { error } = await getSupabaseAdmin()
    .from("watchlist_items")
    .update({ watched_at: new Date().toISOString() })
    .eq("id", itemId.data)
    .in("watchlist_id", listIds);
  if (error) throw error;
  revalidatePath("/watchlist");
}

export async function manuallyAddWatchlistItemAction(formData: FormData) {
  const movieId = z.uuid().safeParse(formData.get("movieId"));
  const profileId = await authenticatedProfileId();
  if (!profileId || !movieId.success) return;
  const watchlistId = await getOrCreatePersonalWatchlist(profileId);
  await addMovies(watchlistId, [movieId.data], null);
  await trackServerAnalytics("watchlist_saved", {
    itemCount: 1,
    kind: "personal",
  });
  revalidatePath("/watchlist");
}
