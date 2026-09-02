import type { FriendshipStatus } from "@/types/database";

export interface FriendshipEdge {
  addresseeId: string;
  id: string;
  requesterId: string;
  status: FriendshipStatus;
}

export interface ClassifiedFriendship {
  friendshipId: string;
  otherProfileId: string;
}

export function classifyFriendships(
  userId: string,
  relationships: readonly FriendshipEdge[],
) {
  const friends: ClassifiedFriendship[] = [];
  const incoming: ClassifiedFriendship[] = [];
  const outgoing: ClassifiedFriendship[] = [];

  relationships.forEach((relationship) => {
    const requesterIsUser = relationship.requesterId === userId;
    const addresseeIsUser = relationship.addresseeId === userId;
    if (
      requesterIsUser === addresseeIsUser ||
      relationship.status === "blocked"
    )
      return;
    const item = {
      friendshipId: relationship.id,
      otherProfileId: requesterIsUser
        ? relationship.addresseeId
        : relationship.requesterId,
    };
    if (relationship.status === "accepted") friends.push(item);
    else if (addresseeIsUser) incoming.push(item);
    else outgoing.push(item);
  });

  return { friends, incoming, outgoing };
}
