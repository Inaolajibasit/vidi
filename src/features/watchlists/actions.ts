"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  inviteCode: z.string().trim().min(4).max(12),
  movieId: z.uuid(),
});

async function authenticatedProfileId() {
  const client = await createSupabaseServerClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  return data.user?.id ?? null;
}

async function getOrCreateWatchlist(profileId: string) {
  const admin = getSupabaseAdmin();
  const { data: existing, error } = await admin
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId)
    .eq("name", "My Watchlist")
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;
  const { data, error: insertError } = await admin
    .from("watchlists")
    .insert({ name: "My Watchlist", profile_id: profileId })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return data.id;
}

export async function saveWatchlistItemAction(formData: FormData) {
  const input = itemSchema.safeParse(Object.fromEntries(formData));
  const profileId = await authenticatedProfileId();
  if (!input.success || !profileId) return;
  const admin = getSupabaseAdmin();
  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("invite_code", input.data.inviteCode)
    .maybeSingle();
  const watchlistId = await getOrCreateWatchlist(profileId);
  const { error } = await admin.from("watchlist_items").upsert(
    {
      movie_id: input.data.movieId,
      source_game_id: game?.id ?? null,
      watchlist_id: watchlistId,
    },
    { onConflict: "watchlist_id,movie_id" },
  );
  if (error) throw error;
  revalidatePath(`/results/${input.data.inviteCode}`);
}

export async function removeWatchlistItemAction(formData: FormData) {
  const input = itemSchema.safeParse(Object.fromEntries(formData));
  const profileId = await authenticatedProfileId();
  if (!input.success || !profileId) return;
  const admin = getSupabaseAdmin();
  const { data: lists, error: listError } = await admin
    .from("watchlists")
    .select("id")
    .eq("profile_id", profileId);
  if (listError) throw listError;
  const listIds = (lists ?? []).map((list) => list.id);
  if (listIds.length) {
    const { error } = await admin
      .from("watchlist_items")
      .delete()
      .in("watchlist_id", listIds)
      .eq("movie_id", input.data.movieId);
    if (error) throw error;
  }
  revalidatePath(`/results/${input.data.inviteCode}`);
}

export async function manuallyAddWatchlistItemAction(formData: FormData) {
  const parsedMovieId = z.uuid().safeParse(formData.get("movieId"));
  const currentProfileId = await authenticatedProfileId();
  if (!currentProfileId || !parsedMovieId.success) return;
  const watchlistId = await getOrCreateWatchlist(currentProfileId);
  const { error } = await getSupabaseAdmin()
    .from("watchlist_items")
    .upsert({ movie_id: parsedMovieId.data, watchlist_id: watchlistId }, { onConflict: "watchlist_id,movie_id" });
  if (error) throw error;
  revalidatePath("/watchlist");
}
