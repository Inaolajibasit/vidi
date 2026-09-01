import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMovieBundle,
  normalizeMovieSummary,
  normalizePaginatedMovies,
} from "@/lib/tmdb/normalize";
import {
  movieBundleSchema,
  movieSummarySchema,
  paginatedMoviesSchema,
} from "@/lib/tmdb/schemas";

const rawMovie = {
  adult: false,
  backdrop_path: "/backdrop.jpg",
  genre_ids: [18, 878],
  id: 27205,
  original_language: "en",
  original_title: "Inception",
  overview: "A test overview.",
  popularity: 80,
  poster_path: "/poster.jpg",
  release_date: "2010-07-16",
  title: "Inception",
  video: false,
  vote_average: 8.4,
  vote_count: 37_000,
};

test("normalizes TMDB snake_case movie summaries", () => {
  const parsed = movieSummarySchema.parse(rawMovie);
  const movie = normalizeMovieSummary(parsed);

  assert.equal(movie.id, 27205);
  assert.equal(movie.backdropPath, "/backdrop.jpg");
  assert.equal(movie.releaseDate, "2010-07-16");
  assert.deepEqual(movie.genreIds, [18, 878]);
});

test("normalizes blank TMDB dates to null", () => {
  const parsed = movieSummarySchema.parse({ ...rawMovie, release_date: "" });
  assert.equal(normalizeMovieSummary(parsed).releaseDate, null);
});

test("rejects malformed external scores", () => {
  assert.throws(() =>
    movieSummarySchema.parse({ ...rawMovie, vote_average: 12 }),
  );
});

test("normalizes paginated movie responses", () => {
  const parsed = paginatedMoviesSchema.parse({
    page: 2,
    results: [rawMovie],
    total_pages: 10,
    total_results: 200,
  });
  const page = normalizePaginatedMovies(parsed);

  assert.equal(page.page, 2);
  assert.equal(page.totalPages, 10);
  assert.equal(page.results[0]?.title, "Inception");
});

test("normalizes appended keywords in ingestion bundles", () => {
  const parsed = movieBundleSchema.parse({
    ...rawMovie,
    genres: [
      { id: 18, name: "Drama" },
      { id: 878, name: "Science Fiction" },
    ],
    keywords: { keywords: [{ id: 123, name: "dream" }] },
    runtime: 148,
  });
  const bundle = normalizeMovieBundle(parsed);

  assert.equal(bundle.details.runtime, 148);
  assert.deepEqual(bundle.keywords, [{ id: 123, name: "dream" }]);
});
