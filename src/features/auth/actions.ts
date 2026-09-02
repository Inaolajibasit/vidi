"use server";
import { redirect } from "next/navigation";
import { claimGuestHistoryForUser } from "@/features/auth/claim-guest-history";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function claimGuestHistory() {
  const client = await createSupabaseServerClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  if (!data.user) return { status: "nothing_to_claim" } as const;
  return claimGuestHistoryForUser(data.user.id);
}
export async function signOutAction() {
  const client = await createSupabaseServerClient();
  if (client) await client.auth.signOut();
  redirect("/");
}
