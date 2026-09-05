import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const GUEST_SESSION_COOKIE = "vidi_guest_session";

export interface GameIdentity {
  displayName: string;
  guestSessionId: string | null;
  profileId: string | null;
}

interface IdentityOptions {
  createGuest?: boolean;
  displayName?: string;
  loadDisplayName?: boolean;
}

export async function getGameIdentity({
  createGuest = false,
  displayName = "Player",
  loadDisplayName = true,
}: IdentityOptions = {}): Promise<GameIdentity | null> {
  const publicClient = await createSupabaseServerClient();
  const { data } = publicClient
    ? await publicClient.auth.getUser()
    : { data: { user: null } };

  if (data.user) {
    const { data: profile } = loadDisplayName
      ? await getSupabaseAdmin()
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .maybeSingle()
      : { data: null };

    return {
      displayName: profile?.display_name ?? displayName,
      guestSessionId: null,
      profileId: data.user.id,
    };
  }

  const cookieStore = await cookies();
  const existingSession = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  const validSession = z.uuid().safeParse(existingSession);

  if (validSession.success) {
    return {
      displayName,
      guestSessionId: validSession.data,
      profileId: null,
    };
  }

  if (!createGuest) return null;

  const guestSessionId = randomUUID();
  cookieStore.set(GUEST_SESSION_COOKIE, guestSessionId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return { displayName, guestSessionId, profileId: null };
}

export function identityMatchesPlayer(
  identity: GameIdentity | null,
  player: { guest_session_id: string | null; profile_id: string | null },
) {
  if (!identity) return false;
  return identity.profileId
    ? player.profile_id === identity.profileId
    : player.guest_session_id === identity.guestSessionId;
}
