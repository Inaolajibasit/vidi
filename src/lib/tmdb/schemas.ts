import { z } from "zod";

const nullablePath = z.string().nullable().default(null);

export const genreSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});

export const keywordSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});

export const movieSummarySchema = z.object({
  adult: z.boolean().default(false),
  backdrop_path: nullablePath,
  genre_ids: z.array(z.number().int().positive()).default([]),
  id: z.number().int().positive(),
  original_language: z.string().min(1),
  original_title: z.string().min(1),
  overview: z.string().default(""),
  popularity: z.number().nonnegative().default(0),
  poster_path: nullablePath,
  release_date: z.string().default(""),
  title: z.string().min(1),
  video: z.boolean().default(false),
  vote_average: z.number().min(0).max(10).default(0),
  vote_count: z.number().int().nonnegative().default(0),
});

export const movieDetailsSchema = movieSummarySchema
  .omit({ genre_ids: true })
  .extend({
    belongs_to_collection: z
      .object({ id: z.number().int().positive(), name: z.string().min(1) })
      .nullable()
      .default(null),
    genres: z.array(genreSchema).default([]),
    runtime: z.number().int().positive().nullable().default(null),
  });

export const paginatedMoviesSchema = z.object({
  page: z.number().int().positive(),
  results: z.array(movieSummarySchema),
  total_pages: z.number().int().nonnegative(),
  total_results: z.number().int().nonnegative(),
});

export const genreListSchema = z.object({ genres: z.array(genreSchema) });
export const keywordListSchema = z.object({
  id: z.number().int().positive(),
  keywords: z.array(keywordSchema),
});

const personBaseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  profile_path: nullablePath,
});

export const creditsSchema = z.object({
  id: z.number().int().positive(),
  cast: z.array(
    personBaseSchema.extend({
      character: z.string().default(""),
      order: z.number().int().nonnegative().default(0),
    }),
  ),
  crew: z.array(
    personBaseSchema.extend({
      department: z.string().default(""),
      job: z.string().default(""),
    }),
  ),
});

export const movieBundleSchema = movieDetailsSchema.extend({
  credits: z.object({ crew: creditsSchema.shape.crew }).optional(),
  keywords: z.object({ keywords: z.array(keywordSchema) }).optional(),
});

export type RawMovieSummary = z.infer<typeof movieSummarySchema>;
export type RawMovieDetails = z.infer<typeof movieDetailsSchema>;
export type RawPaginatedMovies = z.infer<typeof paginatedMoviesSchema>;
export type RawCredits = z.infer<typeof creditsSchema>;
export type RawMovieBundle = z.infer<typeof movieBundleSchema>;
