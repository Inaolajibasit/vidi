import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/types/database";

const adminEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
});

let adminClient: SupabaseClient<Database> | undefined;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const environment = adminEnvironmentSchema.parse(process.env);
  adminClient = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  return adminClient;
}
