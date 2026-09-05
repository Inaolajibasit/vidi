import "server-only";

import {
  getGameIdentity,
  identityMatchesPlayer,
} from "@/features/games/identity";
import { inviteCodeSchema } from "@/features/games/validation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MovieReaction } from "@/types/database";

export interface VerdictMovie {
  id: string;
  posterUrl: string | null;
  title: string;
}

export interface VerdictData {
  disagreement: null | {
    movie: VerdictMovie;
    reactions: Array<{ name: string; reaction: MovieReaction }>;
  };
  inviteCode: string;
  isAuthenticated: boolean;
  moviesRated: number;
  knowledgeScore: number;
  knowledgeWinner: string | null;
  moviesBothSeen: number;
  overallScore: number;
  personality: {
    description: string;
    displayName: string;
    reasons: string[];
    score: number;
  };
  playerNames: string[];
  sharedFavourites: VerdictMovie[];
  tasteScore: number;
  myWatchlist: VerdictMovie[];
  myWatchlistSaved: boolean;
  ourWatchlist: VerdictMovie[];
  ourWatchlistSaved: boolean;
}

function playerPersonality(metrics: unknown, playerId: string) {
  const fallback = {
    description: "Rate a few more films and vidi will make the call.",
    displayName: "STILL FIGURING YOU OUT",
    reasons: ["There is not enough evidence yet."],
    score: 0,
  };
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics))
    return fallback;
  const personalities = (metrics as Record<string, unknown>).personalities;
  if (
    !personalities ||
    typeof personalities !== "object" ||
    Array.isArray(personalities)
  )
    return fallback;
  const value = (personalities as Record<string, unknown>)[playerId];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fallback;
  const personality = value as Record<string, unknown>;
  return {
    description:
      typeof personality.description === "string"
        ? personality.description
        : fallback.description,
    displayName:
      typeof personality.displayName === "string"
        ? personality.displayName
        : fallback.displayName,
    reasons: Array.isArray(personality.reasons)
      ? personality.reasons.filter(
          (reason): reason is string => typeof reason === "string",
        )
      : fallback.reasons,
    score:
      typeof personality.score === "number" ? personality.score : fallback.score,
  };
}

function personalWatchlistIds(metrics: unknown, playerId: string) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics))
    return [];
  const lists = (metrics as Record<string, unknown>).personalWatchlists;
  if (!lists || typeof lists !== "object" || Array.isArray(lists)) return [];
  const ids = (lists as Record<string, unknown>)[playerId];
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];
}

function posterUrl(path: string | null) {
  const file = path?.split("/").at(-1);
  return file ? `/api/posters/${encodeURIComponent(file)}` : null;
}

export async function getVerdictData(
  rawCode: string,
): Promise<VerdictData | null> {
  const code = inviteCodeSchema.safeParse(rawCode);
  if (!code.success) return null;
  const admin = getSupabaseAdmin();
  const [{ data: game }, identity] = await Promise.all([
    admin
      .from("games")
      .select("id, invite_code, status")
      .eq("invite_code", code.data)
      .maybeSingle(),
    getGameIdentity({ loadDisplayName: false }),
  ]);
  if (!game || game.status !== "completed") return null;

  const { data: players } = await admin
    .from("game_players")
    .select("id, display_name, guest_session_id, profile_id, progress")
    .eq("game_id", game.id)
    .order("joined_at");
  const currentPlayer = players?.find((player) =>
    identityMatchesPlayer(identity, player),
  );
  if (!players || !currentPlayer) return null;

  const { data: results } = await admin
    .from("compatibility_results")
    .select("*")
    .eq("game_id", game.id);
  const pairResults = (results ?? []).filter(
    (result) => result.subject_player_id,
  );
  const groupResult = (results ?? []).find(
    (result) => !result.subject_player_id,
  );
  const displayPair = pairResults.toSorted(
    (a, b) => b.overall_score - a.overall_score,
  )[0];
  const primary =
    players.length === 2 ? displayPair : (groupResult ?? displayPair);
  if (!primary) return null;
  if (!displayPair) return null;

  const ourWatchlistIds =
    groupResult?.watchlist_movie_ids ?? displayPair.watchlist_movie_ids;
  const myWatchlistIds = groupResult
    ? personalWatchlistIds(groupResult.metrics, currentPlayer.id)
    : [];
  const resolvedMyWatchlistIds = myWatchlistIds.length
    ? myWatchlistIds
    : displayPair.watchlist_movie_ids;

  const disagreementId = pairResults
    .flatMap((result) => result.disagreement_movie_ids)
    .sort()[0];
  const movieIds = [
    ...new Set([
      ...displayPair.shared_favourite_movie_ids,
      ...ourWatchlistIds,
      ...resolvedMyWatchlistIds,
      ...(disagreementId ? [disagreementId] : []),
    ]),
  ];
  const { data: movies } = movieIds.length
    ? await admin
        .from("movies")
        .select("id, poster_path, title")
        .in("id", movieIds)
    : { data: [] };
  let savedMovieIds = new Set<string>();
  let sharedWatchlistSaved = false;
  if (identity?.profileId) {
    const { data: lists } = await admin
      .from("watchlists")
      .select("id, kind, source_game_id")
      .eq("profile_id", identity.profileId);
    const personalListIds = (lists ?? [])
      .filter((list) => list.kind === "personal")
      .map((list) => list.id);
    const sharedListIds = (lists ?? [])
      .filter(
        (list) => list.kind === "shared" && list.source_game_id === game.id,
      )
      .map((list) => list.id);
    const savedListIds = [...personalListIds, ...sharedListIds];
    if (savedListIds.length) {
      const { data: items } = await admin
        .from("watchlist_items")
        .select("movie_id, watchlist_id")
        .in("watchlist_id", savedListIds);
      savedMovieIds = new Set(
        (items ?? [])
          .filter((item) => personalListIds.includes(item.watchlist_id))
          .map((item) => item.movie_id),
      );
      const sharedMovieIds = new Set(
        (items ?? [])
          .filter((item) => sharedListIds.includes(item.watchlist_id))
          .map((item) => item.movie_id),
      );
      sharedWatchlistSaved =
        ourWatchlistIds.length > 0 &&
        ourWatchlistIds.every((id) => sharedMovieIds.has(id));
    }
  }
  const movieMap = new Map(
    (movies ?? []).map((movie) => [
      movie.id,
      {
        id: movie.id,
        posterUrl: posterUrl(movie.poster_path),
        title: movie.title,
      },
    ]),
  );
  const nameMap = new Map(
    players.map((player) => [player.id, player.display_name]),
  );
  const { data: disagreementRatings } = disagreementId
    ? await admin
        .from("ratings")
        .select("game_player_id, reaction")
        .eq("game_id", game.id)
        .eq("movie_id", disagreementId)
        .not("reaction", "is", null)
    : { data: [] };
  const winnerId =
    groupResult?.knowledge_winner_player_id ??
    primary.knowledge_winner_player_id;

  return {
    disagreement:
      disagreementId && movieMap.has(disagreementId)
        ? {
            movie: movieMap.get(disagreementId)!,
            reactions: (disagreementRatings ?? [])
              .filter(
                (
                  rating,
                ): rating is typeof rating & { reaction: MovieReaction } =>
                  Boolean(rating.reaction),
              )
              .map((rating) => ({
                name: nameMap.get(rating.game_player_id) ?? "Player",
                reaction: rating.reaction,
              })),
          }
        : null,
    inviteCode: game.invite_code,
    isAuthenticated: Boolean(identity?.profileId),
    moviesRated: currentPlayer.progress,
    knowledgeScore: Number(primary.knowledge_score),
    knowledgeWinner: winnerId ? (nameMap.get(winnerId) ?? null) : null,
    moviesBothSeen: primary.shared_seen_count,
    overallScore: Number(primary.overall_score),
    personality: playerPersonality(groupResult?.metrics, currentPlayer.id),
    playerNames: players.map((player) => player.display_name),
    sharedFavourites: displayPair.shared_favourite_movie_ids.flatMap(
      (id) => movieMap.get(id) ?? [],
    ),
    tasteScore: Number(primary.taste_score),
    myWatchlist: resolvedMyWatchlistIds.flatMap((id) => movieMap.get(id) ?? []),
    myWatchlistSaved:
      resolvedMyWatchlistIds.length > 0 &&
      resolvedMyWatchlistIds.every((id) => savedMovieIds.has(id)),
    ourWatchlist: ourWatchlistIds.flatMap((id) => movieMap.get(id) ?? []),
    ourWatchlistSaved: sharedWatchlistSaved,
  };
}
