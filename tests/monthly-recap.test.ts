import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMonthlyRecap,
  getUtcMonthlyRecapPeriod,
  type MonthlyRecapSource,
} from "../src/lib/algorithms/monthly-recap";

const at = (day: number) =>
  `2026-08-${String(day).padStart(2, "0")}T12:00:00.000Z`;

function source(
  overrides: Partial<MonthlyRecapSource> = {},
): MonthlyRecapSource {
  return {
    attributes: [],
    compatibilities: [],
    games: [],
    personalityBeforeMonth: null,
    ratings: [],
    seenBeforeMonth: 0,
    seenThroughMonth: 0,
    ...overrides,
  };
}

test("counts unique monthly movies and keeps the latest repeated reaction", () => {
  const recap = calculateMonthlyRecap(
    source({
      ratings: [
        {
          movieId: "a",
          reaction: "liked",
          recordedAt: at(1),
          seen: true,
          updatedAt: at(1),
        },
        {
          movieId: "a",
          reaction: "loved",
          recordedAt: at(5),
          seen: true,
          updatedAt: at(5),
        },
        {
          movieId: "b",
          reaction: "liked",
          recordedAt: at(2),
          seen: true,
          updatedAt: at(2),
        },
        {
          movieId: "c",
          reaction: "meh",
          recordedAt: at(3),
          seen: true,
          updatedAt: at(3),
        },
        {
          movieId: "d",
          reaction: "cant_remember",
          recordedAt: at(4),
          seen: true,
          updatedAt: at(4),
        },
        {
          movieId: "e",
          reaction: null,
          recordedAt: at(4),
          seen: false,
          updatedAt: at(4),
        },
      ],
    }),
  );

  assert.equal(recap.moviesSeen, 4);
  assert.equal(recap.moviesLoved, 1);
  assert.equal(recap.moviesLiked, 1);
  assert.equal(recap.moviesMeh, 1);
  assert.deepEqual(recap.movieIds.loved, ["a"]);
});

test("ranks genre and theme preference with reaction evidence", () => {
  const ratings: MonthlyRecapSource["ratings"] = [
    {
      movieId: "a",
      reaction: "loved",
      recordedAt: at(1),
      seen: true,
      updatedAt: at(1),
    },
    {
      movieId: "b",
      reaction: "liked",
      recordedAt: at(2),
      seen: true,
      updatedAt: at(2),
    },
    {
      movieId: "c",
      reaction: "meh",
      recordedAt: at(3),
      seen: true,
      updatedAt: at(3),
    },
  ];
  const recap = calculateMonthlyRecap(
    source({
      attributes: [
        {
          movieId: "a",
          genres: [{ id: 878, name: "Science Fiction" }],
          themes: [{ id: 1, name: "time travel" }],
        },
        {
          movieId: "b",
          genres: [{ id: 878, name: "Science Fiction" }],
          themes: [{ id: 1, name: "time travel" }],
        },
        {
          movieId: "c",
          genres: [{ id: 18, name: "Drama" }],
          themes: [{ id: 2, name: "family" }],
        },
      ],
      ratings,
    }),
  );

  assert.deepEqual(recap.strongestGenre, {
    id: 878,
    lovedCount: 1,
    movieIds: ["a", "b"],
    name: "Science Fiction",
    score: 5,
  });
  assert.equal(recap.strongestTheme?.name, "time travel");
});

test("excludes non-positive genre and theme signals", () => {
  const recap = calculateMonthlyRecap(
    source({
      attributes: [
        {
          movieId: "a",
          genres: [{ id: 18, name: "Drama" }],
          themes: [{ id: 2, name: "family" }],
        },
      ],
      ratings: [
        {
          movieId: "a",
          reaction: "meh",
          recordedAt: at(1),
          seen: true,
          updatedAt: at(1),
        },
      ],
    }),
  );
  assert.equal(recap.strongestGenre, null);
  assert.equal(recap.strongestTheme, null);
});

test("highest compatibility friend uses monthly average then games together", () => {
  const recap = calculateMonthlyRecap(
    source({
      compatibilities: [
        {
          completedAt: at(1),
          friendDisplayName: "Sarah",
          friendProfileId: "s",
          gameId: "g1",
          overallScore: 90,
        },
        {
          completedAt: at(2),
          friendDisplayName: "Sarah",
          friendProfileId: "s",
          gameId: "g2",
          overallScore: 70,
        },
        {
          completedAt: at(3),
          friendDisplayName: "Tomi",
          friendProfileId: "t",
          gameId: "g3",
          overallScore: 82,
        },
      ],
    }),
  );
  assert.deepEqual(recap.highestCompatibilityFriend, {
    averageCompatibility: 82,
    displayName: "Tomi",
    gamesTogether: 1,
    profileId: "t",
  });
});

test("tracks chronological personality transitions and knowledge growth", () => {
  const recap = calculateMonthlyRecap(
    source({
      games: [
        {
          completedAt: at(20),
          gameId: "g2",
          knowledgeScore: 65,
          personalityId: "the_overthinker",
        },
        {
          completedAt: at(5),
          gameId: "g1",
          knowledgeScore: 40,
          personalityId: "the_casual",
        },
      ],
      personalityBeforeMonth: "the_casual",
      seenBeforeMonth: 12,
      seenThroughMonth: 18,
    }),
  );

  assert.equal(recap.gamesPlayed, 2);
  assert.deepEqual(recap.knowledgeGrowth, {
    endingSeenCount: 18,
    firstGameScore: 40,
    lastGameScore: 65,
    newUniqueMovies: 6,
    percentagePointChange: 25,
    startingSeenCount: 12,
  });
  assert.deepEqual(recap.personality, {
    atEnd: "the_overthinker",
    atStart: "the_casual",
    changes: [
      {
        changedAt: at(20),
        from: "the_casual",
        gameId: "g2",
        to: "the_overthinker",
      },
    ],
  });
});

test("empty months return stable zero and null states", () => {
  const recap = calculateMonthlyRecap(source());
  assert.equal(recap.moviesSeen, 0);
  assert.equal(recap.gamesPlayed, 0);
  assert.equal(recap.highestCompatibilityFriend, null);
  assert.equal(recap.strongestGenre, null);
  assert.equal(recap.knowledgeGrowth.percentagePointChange, null);
  assert.deepEqual(recap.personality, {
    atEnd: null,
    atStart: null,
    changes: [],
  });
});

test("aggregation is deterministic regardless of source ordering", () => {
  const input = source({
    games: [
      {
        completedAt: at(1),
        gameId: "a",
        knowledgeScore: 10,
        personalityId: "the_casual",
      },
      {
        completedAt: at(2),
        gameId: "b",
        knowledgeScore: 20,
        personalityId: "film_bro",
      },
    ],
    ratings: [
      {
        movieId: "b",
        reaction: "liked",
        recordedAt: at(2),
        seen: true,
        updatedAt: at(2),
      },
      {
        movieId: "a",
        reaction: "loved",
        recordedAt: at(1),
        seen: true,
        updatedAt: at(1),
      },
    ],
  });
  assert.deepEqual(
    calculateMonthlyRecap(input),
    calculateMonthlyRecap({
      ...input,
      games: input.games.toReversed(),
      ratings: input.ratings.toReversed(),
    }),
  );
});

test("UTC month periods handle December rollover and reject invalid input", () => {
  assert.deepEqual(getUtcMonthlyRecapPeriod(2026, 12), {
    end: "2027-01-01T00:00:00.000Z",
    key: "2026-12",
    label: "December 2026",
    month: 12,
    start: "2026-12-01T00:00:00.000Z",
    timeZone: "UTC",
    year: 2026,
  });
  assert.throws(() => getUtcMonthlyRecapPeriod(2026, 13), RangeError);
});
