export type ResultReaction = "loved" | "liked" | "meh" | "cant_remember";

export interface ResultMovieAttributes {
  genreIds: readonly number[];
  keywordIds: readonly number[];
  movieId: string;
}

export interface ResultRating {
  movieId: string;
  reaction: ResultReaction | null;
  seen: boolean;
}

export interface ResultPlayer {
  id: string;
  ratings: readonly ResultRating[];
}

export interface CompatibilityWeights {
  knowledgeOverlap: number;
  ratingAgreement: number;
  tasteSimilarity: number;
}

export const DEFAULT_COMPATIBILITY_WEIGHTS: CompatibilityWeights = {
  knowledgeOverlap: 0.2,
  ratingAgreement: 0.25,
  tasteSimilarity: 0.55,
};

export interface PairCompatibilityResult {
  disagreementMovieIds: string[];
  knowledgeOverlap: number;
  knowledgeWinnerPlayerId: string | null;
  moviesBothSeen: number;
  overallCompatibility: number;
  playerIds: [string, string];
  ratingAgreement: number;
  sharedFavouriteMovieIds: string[];
  tasteMatch: number;
}

export interface GroupCompatibilityResult {
  groupCompatibility: number;
  highestCompatibilityPair: PairCompatibilityResult;
  knowledgeWinnerPlayerId: string | null;
  lowestCompatibilityPair: PairCompatibilityResult;
  pairs: PairCompatibilityResult[];
}

const REACTION_SCORE: Partial<Record<ResultReaction, number>> = {
  loved: 3,
  liked: 2,
  meh: 1,
};

const TASTE_WEIGHT: Partial<Record<ResultReaction, number>> = {
  loved: 1,
  liked: 0.5,
  meh: -1,
};

function roundScore(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

function ratingAgreementForDifference(difference: number) {
  if (difference === 0) return 100;
  if (difference === 1) return 70;
  return 20;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  keys.forEach((key) => {
    const valueA = a.get(key) ?? 0;
    const valueB = b.get(key) ?? 0;
    dot += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  });
  if (magnitudeA === 0 || magnitudeB === 0) return null;
  return dot / Math.sqrt(magnitudeA * magnitudeB);
}

function buildTasteVector(
  player: ResultPlayer,
  attributes: ReadonlyMap<string, ResultMovieAttributes>,
) {
  const vector = new Map<string, number>();
  player.ratings.forEach((rating) => {
    if (!rating.seen || !rating.reaction) return;
    const weight = TASTE_WEIGHT[rating.reaction];
    const movie = attributes.get(rating.movieId);
    if (weight === undefined || !movie) return;
    movie.genreIds.forEach((id) =>
      vector.set(`genre:${id}`, (vector.get(`genre:${id}`) ?? 0) + weight),
    );
    movie.keywordIds.forEach((id) =>
      vector.set(`keyword:${id}`, (vector.get(`keyword:${id}`) ?? 0) + weight),
    );
  });
  return vector;
}

function validateWeights(weights: CompatibilityWeights) {
  const values = Object.values(weights);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.some((value) => value < 0) || Math.abs(total - 1) > 0.000001) {
    throw new RangeError(
      "Compatibility weights must be nonnegative and total 1.",
    );
  }
}

export function calculatePairCompatibility(
  first: ResultPlayer,
  second: ResultPlayer,
  movieAttributes: readonly ResultMovieAttributes[],
  weights = DEFAULT_COMPATIBILITY_WEIGHTS,
): PairCompatibilityResult {
  validateWeights(weights);
  if (first.id === second.id)
    throw new Error("Pair players must be different.");

  const attributes = new Map(
    movieAttributes.map((movie) => [movie.movieId, movie]),
  );
  const firstRatings = new Map(
    first.ratings.map((rating) => [rating.movieId, rating]),
  );
  const secondRatings = new Map(
    second.ratings.map((rating) => [rating.movieId, rating]),
  );
  const firstSeen = new Set(
    first.ratings
      .filter((rating) => rating.seen)
      .map((rating) => rating.movieId),
  );
  const secondSeen = new Set(
    second.ratings
      .filter((rating) => rating.seen)
      .map((rating) => rating.movieId),
  );
  const bothSeen = [...firstSeen].filter((movieId) => secondSeen.has(movieId));
  const seenUnion = new Set([...firstSeen, ...secondSeen]);
  const knowledgeOverlap = seenUnion.size
    ? (bothSeen.length / seenUnion.size) * 100
    : 0;

  const agreements: Array<{
    movieId: string;
    score: number;
    difference: number;
  }> = [];
  bothSeen.forEach((movieId) => {
    const firstReaction = firstRatings.get(movieId)?.reaction;
    const secondReaction = secondRatings.get(movieId)?.reaction;
    const firstScore = firstReaction
      ? REACTION_SCORE[firstReaction]
      : undefined;
    const secondScore = secondReaction
      ? REACTION_SCORE[secondReaction]
      : undefined;
    if (firstScore === undefined || secondScore === undefined) return;
    const difference = Math.abs(firstScore - secondScore);
    agreements.push({
      difference,
      movieId,
      score: ratingAgreementForDifference(difference),
    });
  });
  const ratingAgreement = agreements.length
    ? agreements.reduce((sum, item) => sum + item.score, 0) / agreements.length
    : 0;

  const cosine = cosineSimilarity(
    buildTasteVector(first, attributes),
    buildTasteVector(second, attributes),
  );
  const tasteMatch = cosine === null ? 0 : roundScore(((cosine + 1) / 2) * 100);
  const overallCompatibility = roundScore(
    tasteMatch * weights.tasteSimilarity +
      ratingAgreement * weights.ratingAgreement +
      knowledgeOverlap * weights.knowledgeOverlap,
  );
  const firstSeenCount = firstSeen.size;
  const secondSeenCount = secondSeen.size;

  return {
    disagreementMovieIds: agreements
      .filter((item) => item.difference === 2)
      .sort((a, b) => a.movieId.localeCompare(b.movieId))
      .map((item) => item.movieId),
    knowledgeOverlap: roundScore(knowledgeOverlap),
    knowledgeWinnerPlayerId:
      firstSeenCount === secondSeenCount
        ? null
        : firstSeenCount > secondSeenCount
          ? first.id
          : second.id,
    moviesBothSeen: bothSeen.length,
    overallCompatibility,
    playerIds: [first.id, second.id].sort() as [string, string],
    ratingAgreement: roundScore(ratingAgreement),
    sharedFavouriteMovieIds: bothSeen
      .filter(
        (movieId) =>
          firstRatings.get(movieId)?.reaction === "loved" &&
          secondRatings.get(movieId)?.reaction === "loved",
      )
      .sort(),
    tasteMatch,
  };
}

export function calculateGroupCompatibility(
  players: readonly ResultPlayer[],
  movieAttributes: readonly ResultMovieAttributes[],
  weights = DEFAULT_COMPATIBILITY_WEIGHTS,
): GroupCompatibilityResult {
  if (players.length < 2 || players.length > 5) {
    throw new RangeError("Compatibility groups require 2 to 5 players.");
  }
  const orderedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));
  const pairs: PairCompatibilityResult[] = [];
  for (let first = 0; first < orderedPlayers.length; first += 1) {
    for (let second = first + 1; second < orderedPlayers.length; second += 1) {
      pairs.push(
        calculatePairCompatibility(
          orderedPlayers[first],
          orderedPlayers[second],
          movieAttributes,
          weights,
        ),
      );
    }
  }
  const ranked = [...pairs].sort(
    (a, b) =>
      b.overallCompatibility - a.overallCompatibility ||
      a.playerIds.join(":").localeCompare(b.playerIds.join(":")),
  );
  const seenCounts = orderedPlayers.map((player) => ({
    count: player.ratings.filter((rating) => rating.seen).length,
    id: player.id,
  }));
  const maxSeen = Math.max(...seenCounts.map((item) => item.count));
  const winners = seenCounts.filter((item) => item.count === maxSeen);

  return {
    groupCompatibility: roundScore(
      pairs.reduce((sum, pair) => sum + pair.overallCompatibility, 0) /
        pairs.length,
    ),
    highestCompatibilityPair: ranked[0],
    knowledgeWinnerPlayerId: winners.length === 1 ? winners[0].id : null,
    lowestCompatibilityPair: ranked.at(-1)!,
    pairs,
  };
}
