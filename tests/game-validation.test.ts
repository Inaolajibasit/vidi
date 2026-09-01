import assert from "node:assert/strict";
import test from "node:test";

import {
  createGameSchema,
  inviteCodeSchema,
  joinGameSchema,
} from "../src/features/games/validation";
import { lobbyTopic } from "../src/features/games/realtime-topic";

test("accepts valid Classic game setup input", () => {
  const result = createGameSchema.safeParse({
    displayName: " Sarah ",
    maxPlayers: "5",
    mode: "no_life",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.displayName, "Sarah");
    assert.equal(result.data.maxPlayers, 5);
  }
});

test("rejects unsupported player limits and modes", () => {
  assert.equal(
    createGameSchema.safeParse({
      displayName: "Mo",
      maxPlayers: 6,
      mode: "personalized",
    }).success,
    false,
  );
});

test("normalizes valid invite codes", () => {
  assert.equal(inviteCodeSchema.parse(" ab3d9x "), "AB3D9X");
  assert.equal(inviteCodeSchema.safeParse("too-short").success, false);
});

test("validates and normalizes lobby joins", () => {
  const result = joinGameSchema.parse({
    displayName: "  Ada  ",
    inviteCode: " ab3d9x ",
  });

  assert.deepEqual(result, { displayName: "Ada", inviteCode: "AB3D9X" });
  assert.equal(lobbyTopic(result.inviteCode), "game:AB3D9X");
});
