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
export async function signOutAction(): Promise<{ message?: string }> {
  try {
    const client = await createSupabaseServerClient();
    if (!client)
      return { message: "Sign-out is unavailable. Please try again." };
    const { error } = await client.auth.signOut();
    if (error) return { message: "Couldn't sign out. Please try again." };
  } catch {
    return {
      message: "Couldn't sign out. Check your connection and try again.",
    };
  }
  redirect("/");
}
