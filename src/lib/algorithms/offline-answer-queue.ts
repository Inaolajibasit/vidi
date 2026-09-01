import type { MovieReaction } from "@/types/database";

export interface OfflineAnswer {
  createdAt: number;
  reaction: MovieReaction | null;
  seen: boolean;
  tmdbId: number;
}

export interface OptimisticResumeState {
  currentIndex: number;
  reactionPending: boolean;
}

export function upsertOfflineAnswer(
  queue: readonly OfflineAnswer[],
  answer: OfflineAnswer,
) {
  const existingIndex = queue.findIndex(
    (item) => item.tmdbId === answer.tmdbId,
  );
  if (existingIndex < 0) return [...queue, answer];
  const next = [...queue];
  next[existingIndex] = {
    ...answer,
    createdAt: queue[existingIndex].createdAt,
  };
  return next;
}

export function removeConfirmedAnswer(
  queue: readonly OfflineAnswer[],
  confirmed: OfflineAnswer,
) {
  return queue.filter(
    (item) =>
      item.tmdbId !== confirmed.tmdbId ||
      item.seen !== confirmed.seen ||
      item.reaction !== confirmed.reaction,
  );
}

export function resolveOptimisticResume(
  movieTmdbIds: readonly number[],
  serverIndex: number,
  serverReactionPending: boolean,
  queue: readonly OfflineAnswer[],
): OptimisticResumeState {
  const answers = new Map(queue.map((answer) => [answer.tmdbId, answer]));
  let currentIndex = serverIndex;
  let reactionPending = serverReactionPending;

  while (currentIndex < movieTmdbIds.length) {
    const answer = answers.get(movieTmdbIds[currentIndex]);
    if (!answer) break;
    if (answer.seen && answer.reaction === null) {
      reactionPending = true;
      break;
    }
    currentIndex += 1;
    reactionPending = false;
  }

  return { currentIndex, reactionPending };
}

export function retryDelay(attempt: number) {
  return Math.min(30_000, 750 * 2 ** Math.min(attempt, 6));
}
