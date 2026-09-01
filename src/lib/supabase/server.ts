import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

function hasSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return false;

  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function createSupabaseServerClient() {
  if (!hasSupabaseEnvironment()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            options: CookieOptions;
            value: string;
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, options, value }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot persist refreshed cookies. Middleware can
            // take over this responsibility when authenticated routes are added.
          }
        },
      },
    },
  );
}
