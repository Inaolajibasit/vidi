import assert from "node:assert/strict";
import test from "node:test";

import { generateWatchlists, type WatchlistPlayer } from "../src/lib/algorithms/watchlists";

const movies = [
  { genreIds: [1], keywordIds: [10], movieId: "a", voteAverage: 8 },
  { genreIds: [1], keywordIds: [11], movieId: "b", voteAverage: 8 },
  { genreIds: [2], keywordIds: [12], movieId: "c", voteAverage: 8 },
];

function player(id: string, ratings: WatchlistPlayer["ratings"]): WatchlistPlayer {
  return { id, ratings };
}

test("friend loved outranks friend liked and seen movies are excluded", () => {
  const result = generateWatchlists([
    player("me", [{ movieId: "c", reaction: "loved", seen: true }]),
    player("friend", [
      { movieId: "a", reaction: "liked", seen: true },
      { movieId: "b", reaction: "loved", seen: true },
      { movieId: "c", reaction: "loved", seen: true },
    ]),
  ], movies);
  assert.deepEqual(result.personal.me.map((item) => item.movieId), ["b", "a"]);
});

test("group list can contain a movie seen by some but not everyone", () => {
  const result = generateWatchlists([
    player("one", [{ movieId: "a", reaction: "loved", seen: true }]),
    player("two", [{ movieId: "a", reaction: null, seen: false }]),
    player("three", [{ movieId: "a", reaction: "liked", seen: true }]),
  ], movies);
  assert.equal(result.shared[0]?.movieId, "a");
});

test("ranking is deterministic and cant remember is neutral", () => {
  const players = [
    player("one", [{ movieId: "a", reaction: "cant_remember", seen: true }]),
    player("two", [{ movieId: "b", reaction: "liked", seen: true }]),
  ];
  assert.deepEqual(generateWatchlists(players, movies), generateWatchlists(players, movies));
  const neutralCandidate = generateWatchlists(players, movies).personal.two.find((item) => item.movieId === "a");
  assert.equal(neutralCandidate?.friendLovedCount ?? 0, 0);
  assert.equal(neutralCandidate?.friendLikedCount ?? 0, 0);
});
