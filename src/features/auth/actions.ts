"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GUEST_SESSION_COOKIE } from "@/features/games/identity";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function claimGuestHistory() {
  const client = await createSupabaseServerClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  const store = await cookies();
  const guest = z.uuid().safeParse(store.get(GUEST_SESSION_COOKIE)?.value);
  if (!data.user || !guest.success) return;
  const { error } = await getSupabaseAdmin().rpc("claim_guest_history", {
    p_user_id: data.user.id,
    p_guest_session_id: guest.data,
  });
  if (error) throw error;
  store.delete(GUEST_SESSION_COOKIE);
}
export async function signOutAction() {
  const client = await createSupabaseServerClient();
  if (client) await client.auth.signOut();
  redirect("/");
}
