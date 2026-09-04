export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type GameMode = "quick" | "proper" | "no_life";
export type GameStatus =
  "waiting" | "active" | "waiting_results" | "completed" | "expired";
export type MovieReaction = "loved" | "liked" | "meh" | "cant_remember";
export type WatchlistKind = "personal" | "shared";
export type FriendshipStatus = "pending" | "accepted" | "blocked";

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

export interface PersonalityRow {
  created_at: string;
  criteria: Json;
  description: string;
  name: string;
  result_copy: string;
  slug: string;
  updated_at: string;
}

export type PersonalityInsert = Pick<
  PersonalityRow,
  "description" | "name" | "result_copy" | "slug"
> &
  Partial<Pick<PersonalityRow, "created_at" | "criteria" | "updated_at">>;

export interface ProfileRow {
  avatar_url: string | null;
  created_at: string;
  current_personality: string | null;
  display_name: string;
  id: string;
  movies_seen_count: number;
  updated_at: string;
  username: string | null;
}

export type ProfileInsert = Pick<ProfileRow, "display_name" | "id"> &
  Partial<Omit<ProfileRow, "display_name" | "id">>;

export interface FriendshipRow {
  addressee_id: string;
  created_at: string;
  id: string;
  requester_id: string;
  status: FriendshipStatus;
  updated_at: string;
}

export type FriendshipInsert = Pick<
  FriendshipRow,
  "addressee_id" | "requester_id"
> &
  Partial<Omit<FriendshipRow, "addressee_id" | "requester_id">>;

export interface MovieRow {
  backdrop_path: string | null;
  collection_name: string | null;
  collection_tmdb_id: number | null;
  created_at: string;
  director_name: string | null;
  id: string;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string | null;
  release_year: number | null;
  runtime: number | null;
  search_vector: unknown;
  title: string;
  tmdb_id: number;
  updated_at: string;
  vote_average: number;
  vote_count: number;
}

export type MovieInsert = Pick<
  MovieRow,
  "original_language" | "original_title" | "title" | "tmdb_id"
> &
  Partial<
    Omit<
      MovieRow,
      | "id"
      | "original_language"
      | "original_title"
      | "search_vector"
      | "title"
      | "tmdb_id"
    >
  > & {
    id?: string;
  };

export interface GenreRow {
  created_at: string;
  name: string;
  tmdb_id: number;
}

export type GenreInsert = Pick<GenreRow, "name" | "tmdb_id"> &
  Partial<Pick<GenreRow, "created_at">>;

export interface MovieGenreRow {
  created_at: string;
  genre_id: number;
  movie_id: string;
  position: number;
}

export type MovieGenreInsert = Pick<MovieGenreRow, "genre_id" | "movie_id"> &
  Partial<Pick<MovieGenreRow, "created_at" | "position">>;

export interface MovieKeywordRow {
  created_at: string;
  movie_id: string;
  name: string;
  tmdb_keyword_id: number;
}

export type MovieKeywordInsert = Pick<
  MovieKeywordRow,
  "movie_id" | "name" | "tmdb_keyword_id"
> &
  Partial<Pick<MovieKeywordRow, "created_at">>;

export interface GameRow {
  completed_at: string | null;
  created_at: string;
  host_profile_id: string | null;
  id: string;
  invite_code: string;
  max_players: number;
  mode: GameMode;
  started_at: string | null;
  status: GameStatus;
  updated_at: string;
}

export type GameInsert = Pick<GameRow, "invite_code" | "mode"> &
  Partial<Omit<GameRow, "invite_code" | "mode">>;

export interface GamePlayerRow {
  display_name: string;
  finished_at: string | null;
  game_id: string;
  guest_session_id: string | null;
  id: string;
  joined_at: string;
  profile_id: string | null;
  progress: number;
  updated_at: string;
}

export type GamePlayerInsert = Pick<GamePlayerRow, "display_name" | "game_id"> &
  Partial<Omit<GamePlayerRow, "display_name" | "game_id">>;

export interface GameMovieRow {
  created_at: string;
  game_id: string;
  movie_id: string;
  position: number;
}

export type GameMovieInsert = Pick<
  GameMovieRow,
  "game_id" | "movie_id" | "position"
> &
  Partial<Pick<GameMovieRow, "created_at">>;

export interface RatingRow {
  created_at: string;
  game_id: string;
  game_player_id: string;
  movie_id: string;
  reaction: MovieReaction | null;
  seen: boolean;
  updated_at: string;
}

export type RatingInsert = Pick<
  RatingRow,
  "game_id" | "game_player_id" | "movie_id" | "seen"
> &
  Partial<Pick<RatingRow, "created_at" | "reaction" | "updated_at">>;

export interface WatchlistRow {
  created_at: string;
  id: string;
  kind: WatchlistKind;
  name: string;
  participant_names: string[];
  profile_id: string;
  source_game_id: string | null;
  updated_at: string;
}

export type WatchlistInsert = Pick<WatchlistRow, "profile_id"> &
  Partial<Omit<WatchlistRow, "profile_id">>;

export interface WatchlistItemRow {
  created_at: string;
  id: string;
  movie_id: string;
  source_game_id: string | null;
  watchlist_id: string;
  watched_at: string | null;
}

export type WatchlistItemInsert = Pick<
  WatchlistItemRow,
  "movie_id" | "watchlist_id"
> &
  Partial<Omit<WatchlistItemRow, "movie_id" | "watchlist_id">>;

export interface CompatibilityResultRow {
  compared_player_id: string | null;
  created_at: string;
  disagreement_movie_ids: string[];
  game_id: string;
  id: string;
  knowledge_score: number;
  knowledge_winner_player_id: string | null;
  metrics: Json;
  overall_score: number;
  personality_slug: string | null;
  result_copy: string | null;
  shared_favourite_movie_ids: string[];
  shared_seen_count: number;
  subject_player_id: string | null;
  taste_score: number;
  updated_at: string;
  watchlist_movie_ids: string[];
}

export type CompatibilityResultInsert = Pick<
  CompatibilityResultRow,
  "game_id" | "knowledge_score" | "overall_score" | "taste_score"
> &
  Partial<
    Omit<
      CompatibilityResultRow,
      "game_id" | "knowledge_score" | "overall_score" | "taste_score"
    >
  >;

export interface Database {
  public: {
    Tables: {
      compatibility_results: TableDefinition<
        CompatibilityResultRow,
        CompatibilityResultInsert
      >;
      friendships: TableDefinition<FriendshipRow, FriendshipInsert>;
      game_movies: TableDefinition<GameMovieRow, GameMovieInsert>;
      game_players: TableDefinition<GamePlayerRow, GamePlayerInsert>;
      games: TableDefinition<GameRow, GameInsert>;
      genres: TableDefinition<GenreRow, GenreInsert>;
      movie_genres: TableDefinition<MovieGenreRow, MovieGenreInsert>;
      movie_keywords: TableDefinition<MovieKeywordRow, MovieKeywordInsert>;
      movies: TableDefinition<MovieRow, MovieInsert>;
      personalities: TableDefinition<PersonalityRow, PersonalityInsert>;
      profiles: TableDefinition<ProfileRow, ProfileInsert>;
      ratings: TableDefinition<RatingRow, RatingInsert>;
      watchlist_items: TableDefinition<WatchlistItemRow, WatchlistItemInsert>;
      watchlists: TableDefinition<WatchlistRow, WatchlistInsert>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_guest_history: {
        Args: { p_guest_session_id: string; p_user_id: string };
        Returns: Json;
      };
      create_classic_game: {
        Args: {
          p_display_name: string;
          p_guest_session_id: string | null;
          p_invite_code: string;
          p_max_players: number;
          p_mode: GameMode;
          p_movie_ids: string[];
          p_profile_id: string | null;
        };
        Returns: string;
      };
      get_deck_candidates: {
        Args: { p_limit?: number };
        Returns: Array<{
          director_name: string | null;
          franchise_id: number | null;
          genre_ids: number[];
          id: string;
          keyword_ids: number[];
          keyword_names: string[];
          original_language: string;
          popularity: number;
          release_year: number | null;
          vote_average: number;
          vote_count: number;
        }>;
      };
      record_game_answer: {
        Args: {
          p_game_id: string;
          p_game_player_id: string;
          p_movie_id: string;
          p_reaction: MovieReaction | null;
          p_seen: boolean;
        };
        Returns: Json;
      };
    };
    Enums: {
      friendship_status: FriendshipStatus;
      game_mode: GameMode;
      game_status: GameStatus;
      movie_reaction: MovieReaction;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
