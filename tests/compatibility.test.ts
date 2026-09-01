import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateGroupCompatibility,
  calculatePairCompatibility,
  type ResultMovieAttributes,
  type ResultPlayer,
  type ResultReaction,
} from "../src/lib/algorithms/compatibility";

const movies: ResultMovieAttributes[] = [
  { genreIds: [1], keywordIds: [10], movieId: "a" },
  { genreIds: [1], keywordIds: [10, 11], movieId: "b" },
  { genreIds: [2], keywordIds: [20], movieId: "c" },
  { genreIds: [3], keywordIds: [30], movieId: "d" },
];

function player(
  id: string,
  answers: Array<[string, boolean, ResultReaction | null]>,
): ResultPlayer {
  return {
    id,
    ratings: answers.map(([movieId, seen, reaction]) => ({
      movieId,
      reaction,
      seen,
    })),
  };
}

test("identical users score full compatibility", () => {
  const answers: Array<[string, boolean, ResultReaction | null]> = [
    ["a", true, "loved"],
    ["b", true, "liked"],
    ["c", false, null],
  ];
  const result = calculatePairCompatibility(
    player("one", answers),
    player("two", answers),
    movies,
  );

  assert.equal(result.overallCompatibility, 100);
  assert.equal(result.tasteMatch, 100);
  assert.equal(result.ratingAgreement, 100);
  assert.equal(result.knowledgeOverlap, 100);
});

test("opposite reactions produce a low taste match without treating unseen as dislike", () => {
  const result = calculatePairCompatibility(
    player("one", [["a", true, "loved"]]),
    player("two", [["a", true, "meh"]]),
    movies,
  );

  assert.equal(result.tasteMatch, 0);
  assert.equal(result.ratingAgreement, 20);
  assert.equal(result.overallCompatibility, 25);
  assert.deepEqual(result.disagreementMovieIds, ["a"]);
});

test("taste vectors find shared patterns even with zero shared movies", () => {
  const result = calculatePairCompatibility(
    player("one", [["a", true, "loved"]]),
    player("two", [["b", true, "loved"]]),
    movies,
  );

  assert.equal(result.moviesBothSeen, 0);
  assert.equal(result.ratingAgreement, 0);
  assert.equal(result.knowledgeOverlap, 0);
  assert.ok(result.tasteMatch > 90);
});

test("little exposure overlap only contributes to movie knowledge", () => {
  const result = calculatePairCompatibility(
    player("one", [
      ["a", false, null],
      ["c", true, "liked"],
    ]),
    player("two", [
      ["a", true, "meh"],
      ["c", false, null],
    ]),
    movies,
  );

  assert.equal(result.moviesBothSeen, 0);
  assert.equal(result.ratingAgreement, 0);
  assert.equal(result.knowledgeOverlap, 0);
});

test("cant remember counts as seen but is excluded from taste and agreement", () => {
  const result = calculatePairCompatibility(
    player("one", [["a", true, "cant_remember"]]),
    player("two", [["a", true, "loved"]]),
    movies,
  );

  assert.equal(result.moviesBothSeen, 1);
  assert.equal(result.knowledgeOverlap, 100);
  assert.equal(result.ratingAgreement, 0);
  assert.equal(result.tasteMatch, 0);
});

test("all unseen answers produce zero scores", () => {
  const result = calculatePairCompatibility(
    player("one", [
      ["a", false, null],
      ["b", false, null],
    ]),
    player("two", [
      ["a", false, null],
      ["b", false, null],
    ]),
    movies,
  );

  assert.equal(result.overallCompatibility, 0);
  assert.equal(result.knowledgeWinnerPlayerId, null);
});

test("shared favourites and the movie knowledge winner are deterministic", () => {
  const result = calculatePairCompatibility(
    player("z", [
      ["a", true, "loved"],
      ["b", true, "loved"],
    ]),
    player("a", [
      ["a", true, "loved"],
      ["b", false, null],
    ]),
    movies,
  );

  assert.deepEqual(result.playerIds, ["a", "z"]);
  assert.deepEqual(result.sharedFavouriteMovieIds, ["a"]);
  assert.equal(result.knowledgeWinnerPlayerId, "z");
});

test("supports deterministic groups of three through five players", () => {
  const players = Array.from({ length: 5 }, (_, index) =>
    player(`p${index + 1}`, [
      ["a", true, index % 2 ? "liked" : "loved"],
      ["b", index < 3, index < 3 ? "meh" : null],
      ["c", index === 0, index === 0 ? "liked" : null],
    ]),
  );

  const three = calculateGroupCompatibility(players.slice(0, 3), movies);
  const five = calculateGroupCompatibility(players, movies);
  assert.equal(three.pairs.length, 3);
  assert.equal(five.pairs.length, 10);
  assert.equal(five.knowledgeWinnerPlayerId, "p1");
  assert.deepEqual(
    five,
    calculateGroupCompatibility([...players].reverse(), movies),
  );
  assert.ok(
    five.highestCompatibilityPair.overallCompatibility >=
      five.lowestCompatibilityPair.overallCompatibility,
  );
});
