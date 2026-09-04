import type { MovieReaction } from "@/types/database";

export interface RecapMovieAttribute {
  genres: Array<{ id: number; name: string }>;
  movieId: string;
  themes: Array<{ id: number; name: string }>;
}

export interface RecapRatingActivity {
  movieId: string;
  reaction: MovieReaction | null;
  recordedAt: string;
  seen: boolean;
  updatedAt: string;
}

export interface RecapGameActivity {
  completedAt: string;
  gameId: string;
  knowledgeScore: number;
  personalityId: string | null;
}

export interface RecapCompatibilityActivity {
  completedAt: string;
  friendDisplayName: string;
  friendProfileId: string;
  gameId: string;
  overallScore: number;
}

export interface MonthlyRecapSource {
  attributes: RecapMovieAttribute[];
  compatibilities: RecapCompatibilityActivity[];
  games: RecapGameActivity[];
  personalityBeforeMonth: string | null;
  ratings: RecapRatingActivity[];
  seenBeforeMonth: number;
  seenThroughMonth: number;
}

export interface RecapPreference {
  id: number;
  lovedCount: number;
  movieIds: string[];
  name: string;
  score: number;
}

export interface MonthlyRecap {
  gamesPlayed: number;
  highestCompatibilityFriend: null | {
    averageCompatibility: number;
    displayName: string;
    gamesTogether: number;
    profileId: string;
  };
  knowledgeGrowth: {
    endingSeenCount: number;
    firstGameScore: number | null;
    lastGameScore: number | null;
    newUniqueMovies: number;
    percentagePointChange: number | null;
    startingSeenCount: number;
  };
  movieIds: {
    liked: string[];
    loved: string[];
    meh: string[];
    seen: string[];
  };
  moviesLiked: number;
  moviesLoved: number;
  moviesMeh: number;
  moviesSeen: number;
  personality: {
    atEnd: string | null;
    atStart: string | null;
    changes: Array<{
      changedAt: string;
      from: string | null;
      gameId: string;
      to: string;
    }>;
  };
  strongestGenre: RecapPreference | null;
  strongestTheme: RecapPreference | null;
}

export interface MonthlyRecapPeriod {
  end: string;
  key: string;
  label: string;
  month: number;
  start: string;
  timeZone: "UTC";
  year: number;
}

export function getUtcMonthlyRecapPeriod(
  year: number,
  month: number,
): MonthlyRecapPeriod {
  if (!Number.isInteger(year) || year < 2020 || year > 2200)
    throw new RangeError("Recap year must be between 2020 and 2200.");
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new RangeError("Recap month must be between 1 and 12.");
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    end: end.toISOString(),
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("en", {
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(start),
    month,
    start: start.toISOString(),
    timeZone: "UTC",
    year,
  };
}

export const MONTHLY_RECAP_SCORING = {
  // Positive reactions build affinity; Meh is a weak negative signal.
  // Can't Remember remains neutral, matching the compatibility engine.
  preferenceMinimum: 0,
  reactionWeight: {
    cant_remember: 0,
    liked: 2,
    loved: 3,
    meh: -1,
  } satisfies Record<MovieReaction, number>,
} as const;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function latestRatings(ratings: readonly RecapRatingActivity[]) {
  const latest = new Map<string, RecapRatingActivity>();
  [...ratings]
    .sort(
      (a, b) =>
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.updatedAt.localeCompare(b.updatedAt) ||
        a.movieId.localeCompare(b.movieId),
    )
    .forEach((rating) => latest.set(rating.movieId, rating));
  return [...latest.values()].sort((a, b) =>
    a.movieId.localeCompare(b.movieId),
  );
}

function strongestPreference(
  ratings: readonly RecapRatingActivity[],
  attributes: readonly RecapMovieAttribute[],
  field: "genres" | "themes",
): RecapPreference | null {
  const attributesByMovie = new Map(
    attributes.map((attribute) => [attribute.movieId, attribute]),
  );
  const scores = new Map<number, RecapPreference>();

  ratings.forEach((rating) => {
    if (!rating.seen || !rating.reaction) return;
    if (rating.reaction === "cant_remember") return;
    const weight = MONTHLY_RECAP_SCORING.reactionWeight[rating.reaction];
    (attributesByMovie.get(rating.movieId)?.[field] ?? []).forEach((value) => {
      const current = scores.get(value.id) ?? {
        id: value.id,
        lovedCount: 0,
        movieIds: [],
        name: value.name,
        score: 0,
      };
      current.score += weight;
      if (rating.reaction === "loved") current.lovedCount += 1;
      if (!current.movieIds.includes(rating.movieId))
        current.movieIds.push(rating.movieId);
      scores.set(value.id, current);
    });
  });

  return (
    [...scores.values()]
      .filter((value) => value.score > MONTHLY_RECAP_SCORING.preferenceMinimum)
      .map((value) => ({
        ...value,
        movieIds: value.movieIds.toSorted(),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.lovedCount - a.lovedCount ||
          b.movieIds.length - a.movieIds.length ||
          a.name.localeCompare(b.name) ||
          a.id - b.id,
      )[0] ?? null
  );
}

function highestCompatibility(
  rows: readonly RecapCompatibilityActivity[],
): MonthlyRecap["highestCompatibilityFriend"] {
  const friends = new Map<
    string,
    { displayName: string; profileId: string; scores: number[] }
  >();
  rows.forEach((row) => {
    const current = friends.get(row.friendProfileId) ?? {
      displayName: row.friendDisplayName,
      profileId: row.friendProfileId,
      scores: [],
    };
    current.scores.push(row.overallScore);
    friends.set(row.friendProfileId, current);
  });

  return (
    [...friends.values()]
      .map((friend) => ({
        averageCompatibility: round(
          friend.scores.reduce((sum, score) => sum + score, 0) /
            friend.scores.length,
        ),
        displayName: friend.displayName,
        gamesTogether: friend.scores.length,
        profileId: friend.profileId,
      }))
      .sort(
        (a, b) =>
          b.averageCompatibility - a.averageCompatibility ||
          b.gamesTogether - a.gamesTogether ||
          a.displayName.localeCompare(b.displayName) ||
          a.profileId.localeCompare(b.profileId),
      )[0] ?? null
  );
}

function personalityTimeline(
  beforeMonth: string | null,
  games: readonly RecapGameActivity[],
): MonthlyRecap["personality"] {
  let current = beforeMonth;
  const changes: MonthlyRecap["personality"]["changes"] = [];
  [...games]
    .sort(
      (a, b) =>
        a.completedAt.localeCompare(b.completedAt) ||
        a.gameId.localeCompare(b.gameId),
    )
    .forEach((game) => {
      if (!game.personalityId || game.personalityId === current) return;
      changes.push({
        changedAt: game.completedAt,
        from: current,
        gameId: game.gameId,
        to: game.personalityId,
      });
      current = game.personalityId;
    });
  return { atEnd: current, atStart: beforeMonth, changes };
}

export function calculateMonthlyRecap(
  source: MonthlyRecapSource,
): MonthlyRecap {
  const ratings = latestRatings(source.ratings);
  const seen = ratings.filter((rating) => rating.seen);
  const reactionIds = (reaction: MovieReaction) =>
    seen
      .filter((rating) => rating.reaction === reaction)
      .map((rating) => rating.movieId)
      .toSorted();
  const games = [...source.games].sort(
    (a, b) =>
      a.completedAt.localeCompare(b.completedAt) ||
      a.gameId.localeCompare(b.gameId),
  );
  const firstScore = games[0]?.knowledgeScore ?? null;
  const lastScore = games.at(-1)?.knowledgeScore ?? null;
  const seenIds = seen.map((rating) => rating.movieId).toSorted();
  const lovedIds = reactionIds("loved");
  const likedIds = reactionIds("liked");
  const mehIds = reactionIds("meh");

  return {
    gamesPlayed: new Set(games.map((game) => game.gameId)).size,
    highestCompatibilityFriend: highestCompatibility(source.compatibilities),
    knowledgeGrowth: {
      endingSeenCount: source.seenThroughMonth,
      firstGameScore: firstScore,
      lastGameScore: lastScore,
      newUniqueMovies: Math.max(
        0,
        source.seenThroughMonth - source.seenBeforeMonth,
      ),
      percentagePointChange:
        firstScore === null || lastScore === null
          ? null
          : round(lastScore - firstScore),
      startingSeenCount: source.seenBeforeMonth,
    },
    movieIds: {
      liked: likedIds,
      loved: lovedIds,
      meh: mehIds,
      seen: seenIds,
    },
    moviesLiked: likedIds.length,
    moviesLoved: lovedIds.length,
    moviesMeh: mehIds.length,
    moviesSeen: seenIds.length,
    personality: personalityTimeline(source.personalityBeforeMonth, games),
    strongestGenre: strongestPreference(ratings, source.attributes, "genres"),
    strongestTheme: strongestPreference(ratings, source.attributes, "themes"),
  };
}
