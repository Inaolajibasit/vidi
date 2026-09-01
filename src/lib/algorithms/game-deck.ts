const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function seedToUint32(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0 || 1;
}

function createRandom(seed: string) {
  let state = seedToUint32(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export type DeckStage = "calibration" | "exploration" | "boundary" | "depth";

export interface DeckMovieCandidate {
  director?: string | null;
  franchiseId?: number | null;
  genreIds: readonly number[];
  id: string;
  keywordIds?: readonly number[];
  keywordNames?: readonly string[];
  originalLanguage?: string;
  popularity: number;
  releaseYear: number | null;
  voteAverage: number;
  voteCount: number;
}

export interface StagedDeckMovie extends DeckMovieCandidate {
  stage: DeckStage;
}

export interface DeckPreferences {
  preferredGenreIds?: readonly number[];
  recentMovieIds?: ReadonlySet<string>;
}

const STAGE_SHARES: ReadonlyArray<[DeckStage, number]> = [
  ["calibration", 0.15],
  ["exploration", 0.4],
  ["boundary", 0.25],
  ["depth", 0.2],
];

const DIVISIVE_KEYWORDS = new Set([
  "anti hero",
  "controversy",
  "dark comedy",
  "dystopia",
  "politics",
  "religion",
  "revenge",
  "satire",
  "superhero",
]);

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizedLog(value: number, maximum: number) {
  return maximum <= 0
    ? 0
    : Math.log1p(Math.max(0, value)) / Math.log1p(maximum);
}

function decade(year: number | null) {
  return year ? Math.floor(year / 10) * 10 : null;
}

function seededNoise(seed: string, movieId: string, position: number) {
  const random = createRandom(`${seed}:${position}:${movieId}`);
  return random();
}

export function getStageCounts(deckSize: number): Record<DeckStage, number> {
  if (!Number.isInteger(deckSize) || deckSize < 1) {
    throw new RangeError("Deck size must be a positive integer.");
  }

  const counts = STAGE_SHARES.map(([stage, share]) => ({
    exact: deckSize * share,
    stage,
    value: Math.floor(deckSize * share),
  }));
  let remaining = deckSize - counts.reduce((sum, item) => sum + item.value, 0);

  counts
    .sort((a, b) => b.exact - b.value - (a.exact - a.value))
    .forEach((item) => {
      if (remaining > 0) {
        item.value += 1;
        remaining -= 1;
      }
    });

  return Object.fromEntries(
    counts.map(({ stage, value }) => [stage, value]),
  ) as Record<DeckStage, number>;
}

function stageForPosition(position: number, counts: Record<DeckStage, number>) {
  let boundary = 0;
  for (const [stage] of STAGE_SHARES) {
    boundary += counts[stage];
    if (position < boundary) return stage;
  }
  return "depth";
}

/**
 * Builds one immutable shared deck. Scores deliberately change by stage:
 * calibration favors recognition, exploration follows themes already surfaced,
 * boundary favors credible taste dividers, and depth rewards quality below the
 * popularity head. A greedy diversity penalty then prevents locally repetitive
 * genres, decades, directors, keywords, and franchises.
 */
export function buildRankedMovieDeck(
  candidates: readonly DeckMovieCandidate[],
  count: number,
  seed: string,
  preferences: DeckPreferences = {},
): StagedDeckMovie[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Deck size must be a positive integer.");
  }
  if (candidates.length < count) {
    throw new RangeError(
      `Movie library has ${candidates.length} candidates; ${count} are required.`,
    );
  }
  if (!seed.trim()) throw new TypeError("A deck seed is required.");

  const uniqueCandidates = new Map(
    candidates.map((movie) => [movie.id, movie]),
  );
  if (uniqueCandidates.size < count) {
    throw new RangeError("Movie candidates must have unique IDs.");
  }

  const allCandidates = [...uniqueCandidates.values()];
  const preferredGenres = new Set(preferences.preferredGenreIds ?? []);
  const genreCandidates = preferredGenres.size
    ? allCandidates.filter((movie) =>
        movie.genreIds.some((genreId) => preferredGenres.has(genreId)),
      )
    : allCandidates;
  // Honour the host's genre selection when the library can fill the complete
  // deck. If it cannot, fall back to the full pool instead of failing creation.
  const genrePool = genreCandidates.length >= count ? genreCandidates : allCandidates;
  const freshCandidates = preferences.recentMovieIds?.size
    ? genrePool.filter((movie) => !preferences.recentMovieIds!.has(movie.id))
    : genrePool;
  // Prefer entirely fresh decks; gradually re-use films only after the eligible
  // pool is too small for the selected mode and genres.
  const pool = freshCandidates.length >= count ? freshCandidates : genrePool;
  const maxPopularity = Math.max(...pool.map((movie) => movie.popularity), 1);
  const maxVoteCount = Math.max(...pool.map((movie) => movie.voteCount), 1);
  const stageCounts = getStageCounts(count);
  const selected: StagedDeckMovie[] = [];
  const selectedIds = new Set<string>();
  const genreCounts = new Map<number, number>();
  const keywordCounts = new Map<number, number>();
  const franchiseCounts = new Map<number, number>();
  const directorCounts = new Map<string, number>();
  const decadeCounts = new Map<number, number>();
  const franchiseLimit = Math.max(2, Math.ceil(count * 0.04));

  for (let position = 0; position < count; position += 1) {
    const stage = stageForPosition(position, stageCounts);
    const recent = selected.slice(-4);
    let best: DeckMovieCandidate | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const movie of pool) {
      if (selectedIds.has(movie.id)) continue;
      if (
        movie.franchiseId &&
        (franchiseCounts.get(movie.franchiseId) ?? 0) >= franchiseLimit
      ) {
        continue;
      }

      const recognition =
        normalizedLog(movie.popularity, maxPopularity) * 0.56 +
        normalizedLog(movie.voteCount, maxVoteCount) * 0.34 +
        clamp01(movie.voteAverage / 10) * 0.1;
      const quality =
        clamp01((movie.voteAverage - 5) / 4) * 0.65 +
        normalizedLog(movie.voteCount, maxVoteCount) * 0.35;
      const genreRelevance = Math.max(
        0,
        ...movie.genreIds.map((id) => genreCounts.get(id) ?? 0),
      );
      const keywordRelevance = Math.max(
        0,
        ...(movie.keywordIds ?? []).map((id) => keywordCounts.get(id) ?? 0),
      );
      const divisive = (movie.keywordNames ?? []).some((keyword) =>
        DIVISIVE_KEYWORDS.has(keyword.toLowerCase()),
      );
      const niche = 1 - normalizedLog(movie.popularity, maxPopularity);

      let score = recognition;
      if (stage === "calibration") score = recognition * 1.5 + quality * 0.15;
      if (stage === "exploration") {
        score = recognition * 0.62 + quality * 0.28;
        score += Math.min(genreRelevance, 3) * 0.07;
        score += Math.min(keywordRelevance, 2) * 0.05;
      }
      if (stage === "boundary") {
        const middleRating =
          1 - Math.min(1, Math.abs(movie.voteAverage - 6.4) / 3);
        score =
          recognition * 0.52 + middleRating * 0.28 + (divisive ? 0.28 : 0);
      }
      if (stage === "depth") {
        score = quality * 0.65 + niche * 0.28;
        score += Math.min(genreRelevance, 3) * 0.05;
        score += Math.min(keywordRelevance, 2) * 0.04;
      }

      // Rolling penalties matter more than global quotas: repetition is most
      // noticeable when similar films touch, even if the full deck is balanced.
      const recentGenreMatches = recent.filter((picked) =>
        picked.genreIds.some((genre) => movie.genreIds.includes(genre)),
      ).length;
      score -= recentGenreMatches * 0.12;
      if (recentGenreMatches === 4) score -= 1.25;

      if (movie.director) {
        const recentDirectorMatches = recent.filter(
          (picked) => picked.director === movie.director,
        ).length;
        score -= recentDirectorMatches * 0.5;
        score -= (directorCounts.get(movie.director) ?? 0) * 0.04;
      }
      if (movie.franchiseId) {
        const recentFranchiseMatches = recent.filter(
          (picked) => picked.franchiseId === movie.franchiseId,
        ).length;
        score -= recentFranchiseMatches * 0.85;
        score -= (franchiseCounts.get(movie.franchiseId) ?? 0) * 0.1;
      }

      const movieDecade = decade(movie.releaseYear);
      if (movieDecade !== null) {
        const recentDecadeMatches = recent.filter(
          (picked) => decade(picked.releaseYear) === movieDecade,
        ).length;
        score -= recentDecadeMatches * 0.08;
        score -= (decadeCounts.get(movieDecade) ?? 0) * 0.008;
      }

      score += seededNoise(seed, movie.id, position) * 0.075;
      if (score > bestScore) {
        best = movie;
        bestScore = score;
      }
    }

    // A very small pool may hit the franchise cap. Relax only that hard cap;
    // all soft diversity penalties continue to apply deterministically.
    if (!best) {
      best = pool.find((movie) => !selectedIds.has(movie.id));
    }
    if (!best) throw new Error("Could not complete the movie deck.");

    const picked = { ...best, stage };
    selected.push(picked);
    selectedIds.add(best.id);
    best.genreIds.forEach((id) =>
      genreCounts.set(id, (genreCounts.get(id) ?? 0) + 1),
    );
    (best.keywordIds ?? []).forEach((id) =>
      keywordCounts.set(id, (keywordCounts.get(id) ?? 0) + 1),
    );
    if (best.franchiseId) {
      franchiseCounts.set(
        best.franchiseId,
        (franchiseCounts.get(best.franchiseId) ?? 0) + 1,
      );
    }
    if (best.director) {
      directorCounts.set(
        best.director,
        (directorCounts.get(best.director) ?? 0) + 1,
      );
    }
    const pickedDecade = decade(best.releaseYear);
    if (pickedDecade !== null) {
      decadeCounts.set(pickedDecade, (decadeCounts.get(pickedDecade) ?? 0) + 1);
    }
  }

  return selected;
}

export function buildDeterministicDeck<T>(
  candidates: readonly T[],
  count: number,
  seed: string,
): T[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Deck size must be a positive integer.");
  }

  if (candidates.length < count) {
    throw new RangeError(
      `Movie library has ${candidates.length} candidates; ${count} are required.`,
    );
  }

  if (!seed.trim()) throw new TypeError("A deck seed is required.");

  const shuffled = [...candidates];
  const random = createRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

export function generateInviteCode(
  randomIndex: (upperBound: number) => number,
  length = 6,
): string {
  if (!Number.isInteger(length) || length < 5 || length > 10) {
    throw new RangeError("Invite code length must be between 5 and 10.");
  }

  return Array.from(
    { length },
    () => INVITE_ALPHABET[randomIndex(INVITE_ALPHABET.length)],
  ).join("");
}
