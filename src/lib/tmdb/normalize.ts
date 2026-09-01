import type {
  RawCredits,
  RawMovieBundle,
  RawMovieDetails,
  RawMovieSummary,
  RawPaginatedMovies,
} from "@/lib/tmdb/schemas";
import type {
  MovieBundle,
  MovieCredits,
  MovieDetails,
  MovieSummary,
  PaginatedMovies,
} from "@/lib/tmdb/types";

function normalizeDate(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function normalizeMovieSummary(movie: RawMovieSummary): MovieSummary {
  return {
    adult: movie.adult,
    backdropPath: movie.backdrop_path,
    genreIds: movie.genre_ids,
    id: movie.id,
    originalLanguage: movie.original_language,
    originalTitle: movie.original_title,
    overview: movie.overview,
    popularity: movie.popularity,
    posterPath: movie.poster_path,
    releaseDate: normalizeDate(movie.release_date),
    title: movie.title,
    video: movie.video,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
  };
}

export function normalizeMovieDetails(movie: RawMovieDetails): MovieDetails {
  return {
    adult: movie.adult,
    backdropPath: movie.backdrop_path,
    collection: movie.belongs_to_collection
      ? {
          id: movie.belongs_to_collection.id,
          name: movie.belongs_to_collection.name,
        }
      : null,
    genres: movie.genres,
    id: movie.id,
    originalLanguage: movie.original_language,
    originalTitle: movie.original_title,
    overview: movie.overview,
    popularity: movie.popularity,
    posterPath: movie.poster_path,
    releaseDate: normalizeDate(movie.release_date),
    runtime: movie.runtime,
    title: movie.title,
    video: movie.video,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
  };
}

export function normalizePaginatedMovies(
  page: RawPaginatedMovies,
): PaginatedMovies {
  return {
    page: page.page,
    results: page.results.map(normalizeMovieSummary),
    totalPages: page.total_pages,
    totalResults: page.total_results,
  };
}

export function normalizeMovieCredits(credits: RawCredits): MovieCredits {
  return {
    movieId: credits.id,
    cast: credits.cast.map((person) => ({
      character: person.character,
      id: person.id,
      name: person.name,
      order: person.order,
      profilePath: person.profile_path,
    })),
    crew: credits.crew.map((person) => ({
      department: person.department,
      id: person.id,
      job: person.job,
      name: person.name,
      profilePath: person.profile_path,
    })),
  };
}

export function normalizeMovieBundle(bundle: RawMovieBundle): MovieBundle {
  return {
    details: normalizeMovieDetails(bundle),
    directorName:
      bundle.credits?.crew.find((person) => person.job === "Director")?.name ??
      null,
    keywords: bundle.keywords?.keywords ?? [],
  };
}
