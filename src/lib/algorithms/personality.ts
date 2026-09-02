export type PersonalityReaction = "loved" | "liked" | "meh" | "cant_remember";

export interface PersonalityMovie {
  genreIds: readonly number[];
  keywordNames: readonly string[];
  movieId: string;
  popularity: number;
  releaseYear: number | null;
}

export interface PersonalityRating {
  movieId: string;
  reaction: PersonalityReaction | null;
  seen: boolean;
}

export type PersonalityId =
  | "the_overthinker"
  | "plot_twist_addict"
  | "blockbuster_merchant"
  | "film_bro"
  | "horror_menace"
  | "the_casual"
  | "animation_defender"
  | "the_completionist"
  | "cult_classic_merchant"
  | "the_romantic";

export interface PersonalityEvidence {
  answeredCount: number;
  cantRememberRatio: number;
  lovedRatio: number;
  mainstreamPositiveRatio: number;
  nichePositiveRatio: number;
  positiveCount: number;
  ratedCount: number;
  seenCount: number;
  seenRatio: number;
}

export interface PersonalityResult {
  description: string;
  displayName: string;
  evidence: PersonalityEvidence;
  id: PersonalityId | null;
  reasons: string[];
  score: number;
  scores: Partial<Record<PersonalityId, number>>;
}

interface ScoringContext {
  evidence: PersonalityEvidence;
  genreAffinity: (genreId: number) => number;
  keywordAffinity: (terms: readonly string[]) => number;
  olderPositiveRatio: number;
}

export interface PersonalityDefinition {
  description: string;
  displayName: string;
  id: PersonalityId;
  minimumEvidence: { answered: number; positive: number; seen: number };
  score: (context: ScoringContext) => number;
  explain: (context: ScoringContext) => string[];
}

const GENRE = {
  action: 28,
  adventure: 12,
  animation: 16,
  crime: 80,
  drama: 18,
  horror: 27,
  mystery: 9648,
  romance: 10749,
  scienceFiction: 878,
  thriller: 53,
} as const;

const STILL_FIGURING_YOU_OUT = {
  description: "Rate a few more films and vidi will make the call.",
  displayName: "STILL FIGURING YOU OUT",
} as const;

export const PERSONALITY_SCORING_CONFIG = {
  confidenceMinimum: 45,
  completionistReferenceCount: 30,
  mainstreamPopularityMinimum: 45,
  nichePopularityMaximum: 20,
  olderMovieBeforeYear: 2005,
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const rounded = (value: number) => Math.round(clamp01(value) * 100);
const average = (...values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export const PERSONALITY_DEFINITIONS: readonly PersonalityDefinition[] = [
  {
    id: "the_overthinker",
    displayName: "THE OVERTHINKER",
    description: "You finish the film. The film does not finish with you.",
    minimumEvidence: { answered: 15, positive: 4, seen: 6 },
    score: (c) =>
      average(
        c.genreAffinity(GENRE.mystery),
        c.genreAffinity(GENRE.scienceFiction),
        c.keywordAffinity([
          "mind-bending",
          "philosophy",
          "nonlinear timeline",
          "psychological",
          "dream",
          "time travel",
        ]),
      ),
    explain: (c) => [
      `Strongest signal: layered stories scored ${rounded(c.keywordAffinity(["mind-bending", "philosophy", "nonlinear timeline", "psychological", "dream", "time travel"]))}%.`,
      "Mystery and science-fiction reactions supplied the supporting evidence.",
    ],
  },
  {
    id: "plot_twist_addict",
    displayName: "PLOT-TWIST ADDICT",
    description: "If the third act behaves itself, you feel cheated.",
    minimumEvidence: { answered: 15, positive: 4, seen: 6 },
    score: (c) =>
      average(
        c.genreAffinity(GENRE.thriller),
        c.genreAffinity(GENRE.mystery),
        c.keywordAffinity([
          "plot twist",
          "twist ending",
          "mystery",
          "unreliable narrator",
          "conspiracy",
        ]),
      ),
    explain: (c) => [
      `Thriller preference scored ${rounded(c.genreAffinity(GENRE.thriller))}%.`,
      "Twist, mystery and unreliable-narrator themes separated this result from general genre taste.",
    ],
  },
  {
    id: "blockbuster_merchant",
    displayName: "BLOCKBUSTER MERCHANT",
    description: "Big screen. Big stakes. Reasonable amount of structural damage.",
    minimumEvidence: { answered: 15, positive: 5, seen: 7 },
    score: (c) =>
      average(
        c.evidence.mainstreamPositiveRatio,
        Math.max(
          c.genreAffinity(GENRE.action),
          c.genreAffinity(GENRE.adventure),
        ),
        c.evidence.seenRatio,
      ),
    explain: (c) => [
      `${rounded(c.evidence.mainstreamPositiveRatio)}% of positive reactions went to mainstream films.`,
      "Action and adventure preference reinforced the result.",
    ],
  },
  {
    id: "film_bro",
    displayName: "FILM BRO",
    description: "You have thoughts about aspect ratios. Several, apparently.",
    minimumEvidence: { answered: 20, positive: 6, seen: 8 },
    score: (c) =>
      average(
        Math.max(c.genreAffinity(GENRE.crime), c.genreAffinity(GENRE.drama)),
        c.genreAffinity(GENRE.scienceFiction),
        c.olderPositiveRatio,
        1 - c.evidence.mainstreamPositiveRatio * 0.45,
      ),
    explain: (c) => [
      "Crime, drama and cerebral science fiction formed the clearest preference cluster.",
      `${rounded(c.olderPositiveRatio)}% of positive reactions were for pre-2005 films.`,
    ],
  },
  {
    id: "horror_menace",
    displayName: "HORROR MENACE",
    description: "A dark hallway is apparently a perfectly good evening.",
    minimumEvidence: { answered: 15, positive: 4, seen: 5 },
    score: (c) =>
      average(
        c.genreAffinity(GENRE.horror),
        c.keywordAffinity([
          "slasher",
          "supernatural horror",
          "psychological horror",
          "haunted house",
          "zombie",
        ]),
      ),
    explain: (c) => [
      `Horror preference scored ${rounded(c.genreAffinity(GENRE.horror))}%.`,
      "Horror-specific themes confirmed that this was more than one enthusiastic rating.",
    ],
  },
  {
    id: "the_casual",
    displayName: "THE CASUAL",
    description: "You like movies. You also have other things going on.",
    minimumEvidence: { answered: 20, positive: 2, seen: 3 },
    score: (c) =>
      average(
        1 - c.evidence.seenRatio,
        c.evidence.cantRememberRatio,
        c.evidence.mainstreamPositiveRatio,
      ),
    explain: (c) => [
      `You had seen ${rounded(c.evidence.seenRatio)}% of the deck.`,
      "A mainstream lean and lighter recall signal made this the best fit.",
    ],
  },
  {
    id: "animation_defender",
    displayName: "ANIMATION DEFENDER",
    description: "It is a medium, not a genre. Yes, you have explained this before.",
    minimumEvidence: { answered: 15, positive: 4, seen: 5 },
    score: (c) =>
      average(
        c.genreAffinity(GENRE.animation),
        c.keywordAffinity([
          "anime",
          "hand-drawn animation",
          "stop motion",
          "adult animation",
          "computer animation",
        ]),
      ),
    explain: (c) => [
      `Animation preference scored ${rounded(c.genreAffinity(GENRE.animation))}%.`,
      "Animation-specific themes supplied the supporting evidence.",
    ],
  },
  {
    id: "the_completionist",
    displayName: "THE COMPLETIONIST",
    description: "You have seen nearly everything. This is not an intervention.",
    minimumEvidence: { answered: 20, positive: 3, seen: 14 },
    score: (c) =>
      average(
        c.evidence.seenRatio,
        clamp01(
          c.evidence.seenCount /
            PERSONALITY_SCORING_CONFIG.completionistReferenceCount,
        ),
        1 - c.evidence.cantRememberRatio,
      ),
    explain: (c) => [
      `You had seen ${rounded(c.evidence.seenRatio)}% of the deck (${c.evidence.seenCount} films).`,
      "Strong recall kept this from being knowledge without evidence.",
    ],
  },
  {
    id: "cult_classic_merchant",
    displayName: "CULT CLASSIC MERCHANT",
    description: "Your recommendations usually begin with “hear me out.”",
    minimumEvidence: { answered: 20, positive: 5, seen: 7 },
    score: (c) =>
      average(
        c.evidence.nichePositiveRatio,
        c.olderPositiveRatio,
        c.keywordAffinity([
          "cult film",
          "independent film",
          "midnight movie",
          "surrealism",
          "experimental film",
        ]),
      ),
    explain: (c) => [
      `${rounded(c.evidence.nichePositiveRatio)}% of positive reactions went to less-mainstream films.`,
      "Older, cult and independent signals supplied the rest of the evidence.",
    ],
  },
  {
    id: "the_romantic",
    displayName: "THE ROMANTIC",
    description: "Feeling wins. Plot logistics can wait outside.",
    minimumEvidence: { answered: 15, positive: 4, seen: 5 },
    score: (c) =>
      average(
        c.genreAffinity(GENRE.romance),
        c.keywordAffinity([
          "romance",
          "love",
          "first love",
          "romantic comedy",
          "forbidden love",
        ]),
        c.genreAffinity(GENRE.drama) * 0.65,
      ),
    explain: (c) => [
      `Romance preference scored ${rounded(c.genreAffinity(GENRE.romance))}%.`,
      "Love-story themes and emotional drama reinforced the result.",
    ],
  },
] as const;

function weightedAffinity(
  ratings: readonly PersonalityRating[],
  movies: ReadonlyMap<string, PersonalityMovie>,
  matches: (movie: PersonalityMovie) => boolean,
) {
  let matching = 0;
  let total = 0;
  ratings.forEach((rating) => {
    if (!rating.seen || rating.reaction === "cant_remember" || !rating.reaction)
      return;
    const movie = movies.get(rating.movieId);
    if (!movie) return;
    const weight = rating.reaction === "loved" ? 1 : rating.reaction === "liked" ? 0.65 : -0.45;
    total += Math.abs(weight);
    if (matches(movie)) matching += weight;
  });
  return total ? clamp01(matching / total) : 0;
}

export function assignMoviePersonality(
  ratings: readonly PersonalityRating[],
  movieList: readonly PersonalityMovie[],
): PersonalityResult {
  const movies = new Map(movieList.map((movie) => [movie.movieId, movie]));
  const usableRatings = ratings.filter((rating) => movies.has(rating.movieId));
  const seen = usableRatings.filter((rating) => rating.seen);
  const rated = seen.filter(
    (rating) => rating.reaction && rating.reaction !== "cant_remember",
  );
  const positive = rated.filter(
    (rating) => rating.reaction === "loved" || rating.reaction === "liked",
  );
  const countPositive = (predicate: (movie: PersonalityMovie) => boolean) =>
    positive.filter((rating) => predicate(movies.get(rating.movieId)!)).length;
  const positiveRatio = (predicate: (movie: PersonalityMovie) => boolean) =>
    positive.length ? countPositive(predicate) / positive.length : 0;
  const evidence: PersonalityEvidence = {
    answeredCount: usableRatings.length,
    cantRememberRatio: seen.length
      ? seen.filter((rating) => rating.reaction === "cant_remember").length /
        seen.length
      : 0,
    lovedRatio: rated.length
      ? rated.filter((rating) => rating.reaction === "loved").length / rated.length
      : 0,
    mainstreamPositiveRatio: positiveRatio(
      (movie) =>
        movie.popularity >=
        PERSONALITY_SCORING_CONFIG.mainstreamPopularityMinimum,
    ),
    nichePositiveRatio: positiveRatio(
      (movie) =>
        movie.popularity < PERSONALITY_SCORING_CONFIG.nichePopularityMaximum,
    ),
    positiveCount: positive.length,
    ratedCount: rated.length,
    seenCount: seen.length,
    seenRatio: usableRatings.length ? seen.length / usableRatings.length : 0,
  };
  const context: ScoringContext = {
    evidence,
    genreAffinity: (genreId) =>
      weightedAffinity(usableRatings, movies, (movie) =>
        movie.genreIds.includes(genreId),
      ),
    keywordAffinity: (terms) => {
      const normalized = terms.map((term) => term.toLowerCase());
      return weightedAffinity(usableRatings, movies, (movie) =>
        movie.keywordNames.some((keyword) =>
          normalized.some(
            (term) =>
              keyword.toLowerCase().includes(term) ||
              term.includes(keyword.toLowerCase()),
          ),
        ),
      );
    },
    olderPositiveRatio: positiveRatio(
      (movie) =>
        movie.releaseYear !== null &&
        movie.releaseYear < PERSONALITY_SCORING_CONFIG.olderMovieBeforeYear,
    ),
  };

  const scores: Partial<Record<PersonalityId, number>> = {};
  const eligible = PERSONALITY_DEFINITIONS.filter((definition) => {
    const minimum = definition.minimumEvidence;
    const hasEvidence =
      evidence.answeredCount >= minimum.answered &&
      evidence.positiveCount >= minimum.positive &&
      evidence.seenCount >= minimum.seen;
    if (hasEvidence) scores[definition.id] = rounded(definition.score(context));
    return hasEvidence;
  }).sort(
    (a, b) =>
      (scores[b.id] ?? 0) - (scores[a.id] ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const winner = eligible[0];
  const winningScore = winner ? (scores[winner.id] ?? 0) : 0;

  if (
    !winner ||
    winningScore < PERSONALITY_SCORING_CONFIG.confidenceMinimum
  ) {
    return {
      ...STILL_FIGURING_YOU_OUT,
      evidence,
      id: null,
      reasons: [
        `${evidence.answeredCount} usable answers and ${evidence.positiveCount} positive reactions are available.`,
        "No personality cleared both its evidence threshold and confidence threshold.",
      ],
      score: winningScore,
      scores,
    };
  }

  return {
    description: winner.description,
    displayName: winner.displayName,
    evidence,
    id: winner.id,
    reasons: winner.explain(context),
    score: winningScore,
    scores,
  };
}
