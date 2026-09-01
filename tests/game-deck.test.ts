import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeterministicDeck,
  buildRankedMovieDeck,
  generateInviteCode,
  getStageCounts,
  type DeckMovieCandidate,
} from "../src/lib/algorithms/game-deck";

function rankedCandidates(count = 300): DeckMovieCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    director: `director-${index % 24}`,
    franchiseId: index % 3 === 0 ? Math.floor(index / 18) : null,
    genreIds: [index % 10, (index + 3) % 10],
    id: `movie-${index}`,
    keywordIds: [index % 30, (index + 7) % 30],
    keywordNames: index % 13 === 0 ? ["satire"] : ["friendship"],
    originalLanguage: index % 9 === 0 ? "ja" : "en",
    popularity: count - index,
    releaseYear: 1970 + (index % 55),
    voteAverage: 5.2 + (index % 38) / 10,
    voteCount: (count - index) * 100,
  }));
}

test("builds the same shared deck from the same seed", () => {
  const candidates = Array.from(
    { length: 300 },
    (_, index) => `movie-${index}`,
  );

  const firstDeck = buildDeterministicDeck(candidates, 100, "game-seed");
  const secondDeck = buildDeterministicDeck(candidates, 100, "game-seed");

  assert.deepEqual(firstDeck, secondDeck);
  assert.equal(new Set(firstDeck).size, 100);
  assert.deepEqual(candidates.slice(0, 3), ["movie-0", "movie-1", "movie-2"]);
});

test("different seeds produce different decks", () => {
  const candidates = Array.from({ length: 60 }, (_, index) => index);

  assert.notDeepEqual(
    buildDeterministicDeck(candidates, 30, "seed-one"),
    buildDeterministicDeck(candidates, 30, "seed-two"),
  );
});

test("rejects a deck larger than the movie pool", () => {
  assert.throws(
    () => buildDeterministicDeck(["one", "two"], 3, "seed"),
    /2 candidates; 3 are required/,
  );
});

test("generates invite codes from the unambiguous alphabet", () => {
  let index = 0;
  const code = generateInviteCode((upperBound) => {
    const value = index % upperBound;
    index += 1;
    return value;
  });

  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(code.length, 6);
});

test("allocates the four conceptual stages at the required proportions", () => {
  assert.deepEqual(getStageCounts(100), {
    boundary: 25,
    calibration: 15,
    depth: 20,
    exploration: 40,
  });
  assert.equal(
    Object.values(getStageCounts(30)).reduce((a, b) => a + b),
    30,
  );
  assert.equal(
    Object.values(getStageCounts(200)).reduce((a, b) => a + b),
    200,
  );
});

test("ranked decks are identical for the same game seed", () => {
  const candidates = rankedCandidates();
  const first = buildRankedMovieDeck(candidates, 100, "V7K4Q");
  const second = buildRankedMovieDeck(candidates, 100, "V7K4Q");

  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((movie) => movie.id)).size, 100);
});

test("different game seeds resolve close scoring choices differently", () => {
  const candidates = rankedCandidates();
  const first = buildRankedMovieDeck(candidates, 30, "AAAAAA");
  const second = buildRankedMovieDeck(candidates, 30, "BBBBBB");

  assert.notDeepEqual(
    first.map((movie) => movie.id),
    second.map((movie) => movie.id),
  );
});

test("orders recognizable calibration before progressively niche depth", () => {
  const deck = buildRankedMovieDeck(rankedCandidates(), 100, "NICHE1");
  const calibration = deck.filter((movie) => movie.stage === "calibration");
  const depth = deck.filter((movie) => movie.stage === "depth");
  const averagePopularity = (movies: typeof deck) =>
    movies.reduce((sum, movie) => sum + movie.popularity, 0) / movies.length;

  assert.ok(averagePopularity(calibration) > averagePopularity(depth));
  assert.equal(calibration.length, 15);
  assert.equal(depth.length, 20);
});

test("caps franchise saturation below ten movies", () => {
  const candidates = rankedCandidates(500).map((movie, index) => ({
    ...movie,
    franchiseId: index < 200 ? 99 : movie.franchiseId,
  }));
  const deck = buildRankedMovieDeck(candidates, 200, "FRANCHISE");
  const franchiseMovies = deck.filter((movie) => movie.franchiseId === 99);

  assert.ok(franchiseMovies.length <= 8);
});

test("diversity penalties prevent five identical directors consecutively", () => {
  const candidates = rankedCandidates(250);
  const deck = buildRankedMovieDeck(candidates, 100, "DIRECTORS");

  for (let index = 0; index <= deck.length - 5; index += 1) {
    assert.ok(
      new Set(deck.slice(index, index + 5).map((movie) => movie.director))
        .size > 1,
    );
  }
});

test("rejects duplicate candidate IDs and undersized pools", () => {
  const duplicate = rankedCandidates(30);
  duplicate[1] = { ...duplicate[1], id: duplicate[0].id };

  assert.throws(
    () => buildRankedMovieDeck(duplicate, 30, "DUPLICATE"),
    /unique IDs/,
  );
  assert.throws(
    () => buildRankedMovieDeck(rankedCandidates(20), 30, "SMALL"),
    /20 candidates; 30 are required/,
  );
});

test("honours multiple preferred genres when they can fill the deck", () => {
  const candidates = rankedCandidates(120);
  const deck = buildRankedMovieDeck(candidates, 30, "GENRES", {
    preferredGenreIds: [2, 7],
  });

  assert.ok(
    deck.every((movie) => movie.genreIds.some((genre) => genre === 2 || genre === 7)),
  );
});

test("excludes recently played movies when enough fresh choices exist", () => {
  const candidates = rankedCandidates(120);
  const recentMovieIds = new Set(candidates.slice(0, 40).map((movie) => movie.id));
  const deck = buildRankedMovieDeck(candidates, 30, "FRESH", { recentMovieIds });

  assert.equal(deck.some((movie) => recentMovieIds.has(movie.id)), false);
});
