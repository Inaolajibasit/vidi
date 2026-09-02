import assert from "node:assert/strict";
import test from "node:test";

import { classifyFriendships } from "../src/lib/algorithms/friendships";

const userId = "user-a";

test("classifies mutual friends and both pending directions", () => {
  const result = classifyFriendships(userId, [
    {
      addresseeId: "user-b",
      id: "accepted",
      requesterId: userId,
      status: "accepted",
    },
    {
      addresseeId: userId,
      id: "incoming",
      requesterId: "user-c",
      status: "pending",
    },
    {
      addresseeId: "user-d",
      id: "outgoing",
      requesterId: userId,
      status: "pending",
    },
  ]);
  assert.deepEqual(result.friends, [
    { friendshipId: "accepted", otherProfileId: "user-b" },
  ]);
  assert.deepEqual(result.incoming, [
    { friendshipId: "incoming", otherProfileId: "user-c" },
  ]);
  assert.deepEqual(result.outgoing, [
    { friendshipId: "outgoing", otherProfileId: "user-d" },
  ]);
});

test("does not expose blocked, unrelated, or invalid self relationships", () => {
  const result = classifyFriendships(userId, [
    {
      addresseeId: "user-b",
      id: "blocked",
      requesterId: userId,
      status: "blocked",
    },
    {
      addresseeId: "user-c",
      id: "unrelated",
      requesterId: "user-b",
      status: "accepted",
    },
    {
      addresseeId: userId,
      id: "self",
      requesterId: userId,
      status: "pending",
    },
  ]);
  assert.deepEqual(result, { friends: [], incoming: [], outgoing: [] });
});

test("classification is deterministic", () => {
  const relationships = [
    {
      addresseeId: userId,
      id: "one",
      requesterId: "user-b",
      status: "pending" as const,
    },
  ];
  assert.deepEqual(
    classifyFriendships(userId, relationships),
    classifyFriendships(userId, relationships),
  );
});
