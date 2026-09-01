import assert from "node:assert/strict";
import test from "node:test";

import {
  isAnswerComplete,
  resolveGameResume,
} from "../src/lib/algorithms/game-progress";

test("resumes at the first unanswered movie from persisted answers", () => {
  const resume = resolveGameResume(
    ["one", "two", "three"],
    [
      { movieId: "one", reaction: null, seen: false },
      { movieId: "two", reaction: "loved", seen: true },
    ],
  );

  assert.deepEqual(resume, {
    complete: false,
    currentIndex: 2,
    reactionPending: false,
  });
});

test("refresh recovery keeps a seen movie on its pending reaction step", () => {
  const resume = resolveGameResume(
    ["one", "two"],
    [{ movieId: "one", reaction: null, seen: true }],
  );

  assert.deepEqual(resume, {
    complete: false,
    currentIndex: 0,
    reactionPending: true,
  });
});

test("does not skip an answer gap even when a later answer exists", () => {
  const resume = resolveGameResume(
    ["one", "two", "three"],
    [
      { movieId: "one", reaction: "meh", seen: true },
      { movieId: "three", reaction: null, seen: false },
    ],
  );

  assert.equal(resume.currentIndex, 1);
  assert.equal(resume.reactionPending, false);
});

test("marks a persisted deck complete only when every answer is complete", () => {
  const resume = resolveGameResume(
    ["one", "two"],
    [
      { movieId: "one", reaction: null, seen: false },
      { movieId: "two", reaction: "cant_remember", seen: true },
    ],
  );

  assert.deepEqual(resume, {
    complete: true,
    currentIndex: 2,
    reactionPending: false,
  });
  assert.equal(
    isAnswerComplete({ movieId: "one", reaction: null, seen: true }),
    false,
  );
});
