import assert from "node:assert/strict";
import test from "node:test";

import {
  removeConfirmedAnswer,
  resolveOptimisticResume,
  retryDelay,
  upsertOfflineAnswer,
} from "../src/lib/algorithms/offline-answer-queue";

const pending = {
  createdAt: 1,
  reaction: null,
  seen: true,
  tmdbId: 10,
} as const;

test("updates a pending seen answer without changing queue order", () => {
  const next = upsertOfflineAnswer(
    [pending, { createdAt: 2, reaction: null, seen: false, tmdbId: 20 }],
    { createdAt: 3, reaction: "loved", seen: true, tmdbId: 10 },
  );
  assert.deepEqual(
    next.map((item) => item.tmdbId),
    [10, 20],
  );
  assert.equal(next[0].reaction, "loved");
  assert.equal(next[0].createdAt, 1);
});

test("does not remove a locally updated answer when an older request succeeds", () => {
  const updated = {
    createdAt: 1,
    reaction: "liked",
    seen: true,
    tmdbId: 10,
  } as const;
  assert.deepEqual(removeConfirmedAnswer([updated], pending), [updated]);
  assert.deepEqual(removeConfirmedAnswer([updated], updated), []);
});

test("restores optimistic progress and a pending reaction after refresh", () => {
  assert.deepEqual(
    resolveOptimisticResume([10, 20, 30], 0, false, [
      { createdAt: 1, reaction: null, seen: false, tmdbId: 10 },
      { createdAt: 2, reaction: null, seen: true, tmdbId: 20 },
    ]),
    { currentIndex: 1, reactionPending: true },
  );
});

test("retry backoff is bounded", () => {
  assert.equal(retryDelay(0), 750);
  assert.equal(retryDelay(20), 30_000);
});
