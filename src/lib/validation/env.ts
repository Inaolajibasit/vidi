import { z } from "zod";

const environmentSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    TMDB_API_KEY: z.string().min(1).optional(),
    TMDB_ACCESS_TOKEN: z.string().min(1).optional(),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_LEGAL_EMAIL: z.email().optional(),
    ENABLE_CHALLENGES: z.enum(["true", "false"]).optional(),
    MOVIE_SYNC_TARGET: z.coerce.number().int().min(3_000).max(5_000).optional(),
  })
  .refine(
    (environment) => environment.TMDB_ACCESS_TOKEN || environment.TMDB_API_KEY,
    {
      message: "Set TMDB_ACCESS_TOKEN or TMDB_API_KEY.",
      path: ["TMDB_ACCESS_TOKEN"],
    },
  );

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): Environment {
  return environmentSchema.parse(environment);
}
