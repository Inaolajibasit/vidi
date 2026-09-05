import type { ResultPlayer } from "@/lib/algorithms/compatibility";

function seenMovieIds(player: ResultPlayer) {
  return new Set(
    player.ratings
      .filter((rating) => rating.seen)
      .map((rating) => rating.movieId),
  );
}

export function calculatePlayerKnowledge(
  player: ResultPlayer,
  deckSize: number,
) {
  if (deckSize <= 0) return 0;
  return (seenMovieIds(player).size / deckSize) * 100;
}

export function calculateGroupKnowledge(
  players: readonly ResultPlayer[],
  deckSize: number,
) {
  if (!players.length) return 0;
  return (
    players.reduce(
      (sum, player) => sum + calculatePlayerKnowledge(player, deckSize),
      0,
    ) / players.length
  );
}

export function moviesSeenByEveryone(players: readonly ResultPlayer[]) {
  if (!players.length) return [];
  const [first, ...rest] = players.map(seenMovieIds);
  return [...first].filter((movieId) =>
    rest.every((movieIds) => movieIds.has(movieId)),
  );
}

export function sharedGroupFavouriteIds(players: readonly ResultPlayer[]) {
  if (!players.length) return [];
  const lovedByPlayer = players.map(
    (player) =>
      new Set(
        player.ratings
          .filter((rating) => rating.seen && rating.reaction === "loved")
          .map((rating) => rating.movieId),
      ),
  );
  const [first, ...rest] = lovedByPlayer;
  return [...first]
    .filter((movieId) => rest.every((movieIds) => movieIds.has(movieId)))
    .sort();
}

interface PairResultSummary {
  compared_player_id: string | null;
  disagreement_movie_ids: string[];
  overall_score: number;
  subject_player_id: string | null;
}

export function selectViewerDisagreementPair<TPair extends PairResultSummary>(
  pairs: readonly TPair[],
  viewerPlayerId: string,
): TPair | null {
  return (
    pairs
      .filter(
        (pair) =>
          pair.disagreement_movie_ids.length > 0 &&
          (pair.subject_player_id === viewerPlayerId ||
            pair.compared_player_id === viewerPlayerId),
      )
      .toSorted((a, b) => a.overall_score - b.overall_score)[0] ?? null
  );
}
