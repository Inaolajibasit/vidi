import assert from "node:assert/strict";
import test from "node:test";

import {
  assignMoviePersonality,
  type PersonalityMovie,
  type PersonalityReaction,
} from "../src/lib/algorithms/personality";

function scenario({
  answered,
  genreIds = [],
  keywordNames = [],
  popularity = 30,
  positive = answered,
  releaseYear = 2015,
  seen = answered,
}: {
  answered: number;
  genreIds?: number[];
  keywordNames?: string[];
  popularity?: number;
  positive?: number;
  releaseYear?: number;
  seen?: number;
}) {
  const movies: PersonalityMovie[] = Array.from(
    { length: answered },
    (_, index) => ({
      genreIds,
      keywordNames,
      movieId: `movie-${index}`,
      popularity,
      releaseYear,
    }),
  );
  const ratings = movies.map((movie, index) => ({
    movieId: movie.movieId,
    reaction: (index < seen
      ? index < positive
        ? "loved"
        : "meh"
      : null) as PersonalityReaction | null,
    seen: index < seen,
  }));
  return { movies, ratings };
}

const personalityCases = [
  {
    expected: "the_overthinker",
    input: scenario({
      answered: 15,
      genreIds: [9648, 878],
      keywordNames: ["mind-bending"],
    }),
  },
  {
    expected: "plot_twist_addict",
    input: scenario({
      answered: 15,
      genreIds: [53, 9648],
      keywordNames: ["twist ending"],
    }),
  },
  {
    expected: "blockbuster_merchant",
    input: scenario({
      answered: 15,
      genreIds: [28, 12],
      popularity: 100,
    }),
  },
  {
    expected: "film_bro",
    input: scenario({
      answered: 20,
      genreIds: [80, 18, 878],
      popularity: 30,
      positive: 8,
      releaseYear: 1999,
      seen: 8,
    }),
  },
  {
    expected: "horror_menace",
    input: scenario({
      answered: 15,
      genreIds: [27],
      keywordNames: ["psychological horror"],
    }),
  },
  {
    expected: "the_casual",
    input: scenario({
      answered: 20,
      genreIds: [35],
      popularity: 90,
      positive: 3,
      seen: 3,
    }),
  },
  {
    expected: "animation_defender",
    input: scenario({
      answered: 15,
      genreIds: [16],
      keywordNames: ["anime"],
    }),
  },
  {
    expected: "the_completionist",
    input: scenario({ answered: 30, genreIds: [35], popularity: 30 }),
  },
  {
    expected: "cult_classic_merchant",
    input: scenario({
      answered: 20,
      genreIds: [35],
      keywordNames: ["cult film"],
      popularity: 10,
      positive: 8,
      releaseYear: 1985,
      seen: 8,
    }),
  },
  {
    expected: "the_romantic",
    input: scenario({
      answered: 15,
      genreIds: [10749, 18],
      keywordNames: ["first love"],
    }),
  },
] as const;

for (const personalityCase of personalityCases) {
  test(`selects ${personalityCase.expected} from matching behavior`, () => {
    const result = assignMoviePersonality(
      personalityCase.input.ratings,
      personalityCase.input.movies,
    );
    assert.equal(result.id, personalityCase.expected);
    assert.ok(result.reasons.length >= 2);
    assert.ok(result.score >= 45);
  });
}

test("shows still figuring you out below the evidence threshold", () => {
  const input = scenario({
    answered: 8,
    genreIds: [27],
    keywordNames: ["slasher"],
  });
  const result = assignMoviePersonality(input.ratings, input.movies);
  assert.equal(result.id, null);
  assert.equal(result.displayName, "STILL FIGURING YOU OUT");
});

test("cant remember is evidence of exposure but not taste preference", () => {
  const input = scenario({ answered: 20, genreIds: [27] });
  const ratings = input.ratings.map((rating) => ({
    ...rating,
    reaction: "cant_remember" as const,
  }));
  const result = assignMoviePersonality(ratings, input.movies);
  assert.equal(result.id, null);
  assert.equal(result.evidence.seenCount, 20);
  assert.equal(result.evidence.positiveCount, 0);
});

test("assignment and tie-breaking are deterministic regardless of input order", () => {
  const input = scenario({
    answered: 15,
    genreIds: [27],
    keywordNames: ["slasher"],
  });
  const first = assignMoviePersonality(input.ratings, input.movies);
  const second = assignMoviePersonality(
    [...input.ratings].reverse(),
    [...input.movies].reverse(),
  );
  assert.deepEqual(second, first);
});
