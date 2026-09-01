export interface PersistedGameAnswer {
  movieId: string;
  reaction: string | null;
  seen: boolean;
}

export interface GameResumeState {
  complete: boolean;
  currentIndex: number;
  reactionPending: boolean;
}

export function isAnswerComplete(answer: PersistedGameAnswer) {
  return !answer.seen || answer.reaction !== null;
}

export function resolveGameResume(
  orderedMovieIds: readonly string[],
  answers: readonly PersistedGameAnswer[],
): GameResumeState {
  const answersByMovie = new Map(
    answers.map((answer) => [answer.movieId, answer]),
  );

  for (let index = 0; index < orderedMovieIds.length; index += 1) {
    const answer = answersByMovie.get(orderedMovieIds[index]);

    if (!answer) {
      return { complete: false, currentIndex: index, reactionPending: false };
    }

    if (!isAnswerComplete(answer)) {
      return { complete: false, currentIndex: index, reactionPending: true };
    }
  }

  return {
    complete: true,
    currentIndex: orderedMovieIds.length,
    reactionPending: false,
  };
}
