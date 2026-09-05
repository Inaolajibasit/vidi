import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateGroupCompatibility,
  type ResultMovieAttributes,
  type ResultReaction,
} from "../../src/lib/algorithms/compatibility";
import { buildDeterministicDeck } from "../../src/lib/algorithms/game-deck";
import { resolveGameResume } from "../../src/lib/algorithms/game-progress";
import { assignMoviePersonality } from "../../src/lib/algorithms/personality";
import { generateWatchlists } from "../../src/lib/algorithms/watchlists";

type GameStatus = "active" | "completed" | "waiting";

interface FlowPlayer {
  guestSessionId: string | null;
  id: string;
  profileId: string | null;
  ratings: Array<{
    movieId: string;
    reaction: ResultReaction | null;
    seen: boolean;
  }>;
}

class GameFlow {
  readonly deck: string[];
  readonly inviteCode = "TEST26";
  readonly players: FlowPlayer[] = [];
  status: GameStatus = "waiting";

  constructor(movieIds: string[]) {
    this.deck = buildDeterministicDeck(movieIds, 30, this.inviteCode);
  }

  join(identity: { guestSessionId?: string; profileId?: string }) {
    assert.equal(this.status, "waiting");
    assert.ok(this.players.length < 5);
    const player: FlowPlayer = {
      guestSessionId: identity.guestSessionId ?? null,
      id: `player-${this.players.length + 1}`,
      profileId: identity.profileId ?? null,
      ratings: [],
    };
    this.players.push(player);
    return player;
  }

  start(host: FlowPlayer) {
    assert.equal(this.players[0], host);
    assert.ok(this.players.length >= 2);
    this.status = "active";
  }

  answer(
    player: FlowPlayer,
    movieId: string,
    seen: boolean,
    reaction: ResultReaction | null,
  ) {
    assert.equal(this.status, "active");
    assert.ok(this.deck.includes(movieId));
    assert.ok(!seen ? reaction === null : reaction !== null);
    const existing = player.ratings.findIndex(
      (item) => item.movieId === movieId,
    );
    const answer = { movieId, reaction, seen };
    if (existing >= 0) player.ratings[existing] = answer;
    else player.ratings.push(answer);
  }

  complete() {
    assert.ok(
      this.players.every(
        (player) => resolveGameResume(this.deck, player.ratings).complete,
      ),
    );
    this.status = "completed";
  }

  claimGuest(guestSessionId: string, profileId: string) {
    const matches = this.players.filter(
      (player) => player.guestSessionId === guestSessionId,
    );
    for (const player of matches) {
      player.profileId = profileId;
      player.guestSessionId = null;
    }
    return matches.length;
  }
}

const movieIds = Array.from({ length: 60 }, (_, index) => `movie-${index + 1}`);
const attributes: ResultMovieAttributes[] = movieIds.map((movieId, index) => ({
  genreIds: [index % 5],
  keywordIds: [index % 9],
  movieId,
}));

test("create, join, rate, complete and generate results as one lifecycle", () => {
  const game = new GameFlow(movieIds);
  const host = game.join({ guestSessionId: "guest-host" });
  const friend = game.join({ guestSessionId: "guest-friend" });

  assert.equal(game.deck.length, 30);
  assert.deepEqual(game.deck, new GameFlow(movieIds).deck);
  game.start(host);

  game.deck.forEach((movieId, index) => {
    game.answer(host, movieId, true, index % 3 === 0 ? "loved" : "liked");
    game.answer(
      friend,
      movieId,
      index % 4 !== 0,
      index % 4 === 0 ? null : index % 3 === 0 ? "loved" : "meh",
    );
  });

  assert.equal(resolveGameResume(game.deck, host.ratings).complete, true);
  assert.equal(resolveGameResume(game.deck, friend.ratings).complete, true);
  game.complete();

  const players = game.players.map((player) => ({
    id: player.id,
    ratings: player.ratings,
  }));
  const result = calculateGroupCompatibility(players, attributes);
  const watchlists = generateWatchlists(
    players,
    attributes.map((movie, index) => ({
      ...movie,
      popularity: 100 - index,
      voteAverage: 7 + (index % 10) / 10,
    })),
  );
  const personality = assignMoviePersonality(
    host.ratings,
    attributes.map((movie, index) => ({
      genreIds: movie.genreIds,
      keywordNames: index % 2 ? ["friendship"] : ["mind-bending"],
      movieId: movie.movieId,
      popularity: 80 - index,
      releaseYear: 1990 + index,
    })),
  );

  assert.equal(game.status, "completed");
  assert.equal(result.pairs.length, 1);
  assert.ok(result.groupCompatibility >= 0 && result.groupCompatibility <= 100);
  assert.ok(watchlists.personal[host.id]);
  assert.ok(personality.evidence.answeredCount >= 30);
});

test("results remain locked until every player completes the shared deck", () => {
  const game = new GameFlow(movieIds);
  const host = game.join({ guestSessionId: "guest-host" });
  const friend = game.join({ guestSessionId: "guest-friend" });
  game.start(host);

  for (const movieId of game.deck) game.answer(host, movieId, false, null);
  for (const movieId of game.deck.slice(0, -1))
    game.answer(friend, movieId, false, null);

  assert.throws(() => game.complete());
  assert.equal(game.status, "active");
  game.answer(friend, game.deck.at(-1)!, false, null);
  game.complete();
  assert.equal(game.status, "completed");
});

test("guest history claims are idempotent and preserve player answers", () => {
  const game = new GameFlow(movieIds);
  const guest = game.join({ guestSessionId: "guest-session" });
  const other = game.join({ guestSessionId: "other-session" });
  game.start(guest);
  game.answer(guest, game.deck[0], true, "loved");

  assert.equal(game.claimGuest("guest-session", "profile-1"), 1);
  assert.equal(game.claimGuest("guest-session", "profile-1"), 0);
  assert.equal(guest.profileId, "profile-1");
  assert.equal(guest.guestSessionId, null);
  assert.deepEqual(guest.ratings, [
    { movieId: game.deck[0], reaction: "loved", seen: true },
  ]);
  assert.equal(other.profileId, null);
});
