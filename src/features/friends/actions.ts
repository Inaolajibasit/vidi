"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackServerAnalytics } from "@/lib/analytics/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export interface FriendActionState {
  message?: string;
  success?: boolean;
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);
const friendshipIdSchema = z.uuid();

async function authenticatedClient() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

function refreshFriendshipViews(username?: string | null) {
  revalidatePath("/friends");
  revalidatePath("/profile");
  if (username) revalidatePath(`/profile/${username}`);
}

export async function sendFriendRequestAction(
  _previous: FriendActionState,
  formData: FormData,
): Promise<FriendActionState> {
  const username = usernameSchema.safeParse(formData.get("username"));
  if (!username.success)
    return { message: "Enter a valid username.", success: false };
  if (!(await consumeRateLimit("friend_request", 20, 3_600))) {
    return {
      message: "Too many friend requests. Try again later.",
      success: false,
    };
  }
  const auth = await authenticatedClient();
  if (!auth) return { message: "Sign in to add friends.", success: false };

  const { data: addressee, error: profileError } = await auth.client
    .from("profiles")
    .select("id, username")
    .eq("username", username.data)
    .maybeSingle();
  if (profileError)
    return { message: "Could not look up that profile.", success: false };
  if (!addressee)
    return { message: "No vidi user has that username.", success: false };
  if (addressee.id === auth.userId)
    return { message: "You cannot add yourself.", success: false };

  const { data: existing, error: existingError } = await auth.client
    .from("friendships")
    .select("status")
    .or(
      `and(requester_id.eq.${auth.userId},addressee_id.eq.${addressee.id}),and(requester_id.eq.${addressee.id},addressee_id.eq.${auth.userId})`,
    )
    .maybeSingle();
  if (existingError)
    return { message: "Could not check this friendship.", success: false };
  if (existing)
    return {
      message:
        existing.status === "accepted"
          ? "You are already friends."
          : existing.status === "pending"
            ? "A friend request is already pending."
            : "This friendship is unavailable.",
      success: false,
    };

  const { error } = await auth.client.from("friendships").insert({
    addressee_id: addressee.id,
    requester_id: auth.userId,
    status: "pending",
  });
  if (error)
    return {
      message:
        error.code === "23505"
          ? "A friend request already exists."
          : "Could not send the friend request.",
      success: false,
    };

  refreshFriendshipViews(addressee.username);
  await trackServerAnalytics("friend_request_sent", {});
  return { message: "Friend request sent.", success: true };
}

async function mutateFriendship(
  formData: FormData,
  operation: "accept" | "decline" | "remove",
): Promise<FriendActionState> {
  const friendshipId = friendshipIdSchema.safeParse(
    formData.get("friendshipId"),
  );
  if (!friendshipId.success)
    return { message: "Invalid friend request.", success: false };
  const auth = await authenticatedClient();
  if (!auth) return { message: "Sign in to continue.", success: false };

  const response =
    operation === "accept"
      ? await auth.client
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", friendshipId.data)
          .eq("addressee_id", auth.userId)
          .eq("status", "pending")
          .select("id")
          .maybeSingle()
      : await auth.client
          .from("friendships")
          .delete()
          .eq("id", friendshipId.data)
          .select("id")
          .maybeSingle();
  if (response.error || !response.data)
    return {
      message: "This friendship changed already. Refresh and try again.",
      success: false,
    };

  refreshFriendshipViews();
  return {
    message: {
      accept: "Friend request accepted.",
      decline: "Friend request declined.",
      remove: "Friendship removed.",
    }[operation],
    success: true,
  };
}

export async function acceptFriendRequestAction(
  _previous: FriendActionState,
  formData: FormData,
) {
  return mutateFriendship(formData, "accept");
}

export async function deleteFriendshipAction(
  _previous: FriendActionState,
  formData: FormData,
) {
  return mutateFriendship(formData, "remove");
}

export async function declineFriendRequestAction(
  _previous: FriendActionState,
  formData: FormData,
) {
  return mutateFriendship(formData, "decline");
}
