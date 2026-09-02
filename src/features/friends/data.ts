import "server-only";

import { classifyFriendships } from "@/lib/algorithms/friendships";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface FriendProfile {
  avatarUrl: string | null;
  displayName: string;
  id: string;
  personality: string | null;
  username: string | null;
}

export interface FriendshipItem {
  friendshipId: string;
  profile: FriendProfile;
}

export interface FriendsData {
  friends: FriendshipItem[];
  incoming: FriendshipItem[];
  outgoing: FriendshipItem[];
  userId: string;
}

export async function getFriendsData(): Promise<FriendsData | null> {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) return null;

  const { data: relationships, error } = await client
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const classified = classifyFriendships(
    user.id,
    (relationships ?? []).map((relationship) => ({
      addresseeId: relationship.addressee_id,
      id: relationship.id,
      requesterId: relationship.requester_id,
      status: relationship.status,
    })),
  );
  const profileIds = [
    ...new Set(
      [
        ...classified.friends,
        ...classified.incoming,
        ...classified.outgoing,
      ].map((item) => item.otherProfileId),
    ),
  ];
  const { data: profiles, error: profileError } = profileIds.length
    ? await client
        .from("profiles")
        .select("id, username, display_name, avatar_url, current_personality")
        .in("id", profileIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileMap = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        avatarUrl: profile.avatar_url,
        displayName: profile.display_name,
        id: profile.id,
        personality: profile.current_personality,
        username: profile.username,
      },
    ]),
  );

  const resolve = (items: typeof classified.friends) =>
    items.flatMap((item) => {
      const profile = profileMap.get(item.otherProfileId);
      return profile ? [{ friendshipId: item.friendshipId, profile }] : [];
    });

  return {
    friends: resolve(classified.friends),
    incoming: resolve(classified.incoming),
    outgoing: resolve(classified.outgoing),
    userId: user.id,
  };
}

export async function getFriendshipWith(profileId: string) {
  const client = await createSupabaseServerClient();
  if (!client)
    return { authenticated: false, relationship: null, userId: null };
  const { data: authData } = await client.auth.getUser();
  const user = authData.user;
  if (!user) return { authenticated: false, relationship: null, userId: null };
  if (user.id === profileId)
    return { authenticated: true, relationship: null, userId: user.id };
  const { data } = await client
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user.id})`,
    )
    .maybeSingle();
  return { authenticated: true, relationship: data, userId: user.id };
}
