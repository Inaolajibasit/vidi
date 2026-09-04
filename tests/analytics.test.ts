import assert from "node:assert/strict";
import test from "node:test";

import { isNewAuthUser } from "../src/features/auth/is-new-user";
import { parseAnalyticsEvent } from "../src/lib/analytics/events";
import { hashAnalyticsIdentifier } from "../src/lib/analytics/privacy";

const secret = "a-private-analytics-secret-with-32-characters";

test("accepts an allowlisted event with its exact property shape", () => {
  assert.deepEqual(
    parseAnalyticsEvent({
      entityKey: "GAME01",
      name: "movie_swiped",
      properties: { deckSize: 30, progress: 12 },
    }),
    {
      entityKey: "GAME01",
      name: "movie_swiped",
      properties: { deckSize: 30, progress: 12 },
    },
  );
});

test("rejects ratings, movie identifiers and other unapproved properties", () => {
  for (const properties of [
    { deckSize: 30, progress: 12, reaction: "loved" },
    { deckSize: 30, movieId: "movie-1", progress: 12 },
    { deckSize: 30, email: "person@example.com", progress: 12 },
  ]) {
    assert.throws(() =>
      parseAnalyticsEvent({
        entityKey: "GAME01",
        name: "movie_swiped",
        properties,
      }),
    );
  }
});

test("requires a correlation key for lifecycle events", () => {
  assert.throws(() =>
    parseAnalyticsEvent({
      name: "game_created",
      properties: {
        deckSize: 30,
        isGuest: true,
        maxPlayers: 2,
        mode: "quick",
      },
    }),
  );
});

test("analytics identifiers are deterministic, opaque and namespaced", () => {
  const first = hashAnalyticsIdentifier(secret, "actor", "same-value");
  const repeated = hashAnalyticsIdentifier(secret, "actor", "same-value");
  const otherNamespace = hashAnalyticsIdentifier(
    secret,
    "entity",
    "same-value",
  );

  assert.equal(first, repeated);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, otherNamespace);
  assert.doesNotMatch(first, /same-value/);
});

test("analytics hashing refuses weak secrets", () => {
  assert.throws(() => hashAnalyticsIdentifier("too-short", "actor", "a"));
});

test("new-account detection tolerates a short OAuth timestamp skew", () => {
  assert.equal(
    isNewAuthUser({
      created_at: "2026-09-04T12:00:00.000Z",
      last_sign_in_at: "2026-09-04T12:00:30.000Z",
    }),
    true,
  );
  assert.equal(
    isNewAuthUser({
      created_at: "2026-08-01T12:00:00.000Z",
      last_sign_in_at: "2026-09-04T12:00:00.000Z",
    }),
    false,
  );
});
