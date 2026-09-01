import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getCreateGameIdentity() {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const metadataName = data.user?.user_metadata.display_name;

  const { data: genres } = await getSupabaseAdmin()
    .from("genres")
    .select("name, tmdb_id")
    .order("name");

  return {
    authenticated: Boolean(data.user),
    defaultDisplayName:
      typeof metadataName === "string" && metadataName.trim()
        ? metadataName.slice(0, 50)
        : data.user
          ? "Player"
          : "",
    genres: genres ?? [],
  };
}
