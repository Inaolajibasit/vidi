export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

export interface MovieSummary {
  adult: boolean;
  backdropPath: string | null;
  genreIds: number[];
  id: number;
  originalLanguage: string;
  originalTitle: string;
  overview: string;
  popularity: number;
  posterPath: string | null;
  releaseDate: string | null;
  title: string;
  video: boolean;
  voteAverage: number;
  voteCount: number;
}

export interface MovieDetails extends Omit<MovieSummary, "genreIds"> {
  collection: { id: number; name: string } | null;
  genres: TmdbGenre[];
  runtime: number | null;
}

export interface CastCredit {
  character: string;
  id: number;
  name: string;
  order: number;
  profilePath: string | null;
}

export interface CrewCredit {
  department: string;
  id: number;
  job: string;
  name: string;
  profilePath: string | null;
}

export interface MovieCredits {
  cast: CastCredit[];
  crew: CrewCredit[];
  movieId: number;
}

export interface PaginatedMovies {
  page: number;
  results: MovieSummary[];
  totalPages: number;
  totalResults: number;
}

export interface MovieBundle {
  details: MovieDetails;
  directorName: string | null;
  keywords: TmdbKeyword[];
}

export interface DiscoverMovieOptions {
  page?: number;
  primaryReleaseDateGte?: string;
  primaryReleaseDateLte?: string;
  sortBy?: "popularity.desc" | "vote_average.desc" | "vote_count.desc";
  voteCountGte?: number;
  withGenres?: number[];
  withOriginalLanguage?: string;
}
