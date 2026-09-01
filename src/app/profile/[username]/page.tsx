import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const parsed = z
    .string()
    .regex(/^[A-Za-z0-9_]{3,24}$/)
    .safeParse((await params).username);
  if (!parsed.success) notFound();
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, movies_seen_count, current_personality",
    )
    .eq("username", parsed.data)
    .maybeSingle();
  if (!profile) notFound();
  const { count } = await admin
    .from("game_players")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  return (
    <main className="editorial-screen font-ui page-container min-h-dvh max-w-xl py-10">
      <Link className="font-accent text-accent text-2xl" href="/">
        vidi.
      </Link>
      <section className="py-20">
        <div className="bg-purple text-foreground grid size-20 place-items-center rounded-sm text-3xl font-black shadow-[5px_5px_0_#FFD628]">
          {profile.display_name[0]?.toUpperCase()}
        </div>
        <h1 className="font-display mt-7 text-6xl font-black uppercase">
          {profile.display_name}
        </h1>
        <p className="text-muted mt-2">@{profile.username}</p>
        <div className="border-border mt-10 grid grid-cols-2 border-y py-7">
          <div>
            <b className="text-accent text-4xl">{profile.movies_seen_count}</b>
            <p className="text-label text-muted mt-2">Movies seen</p>
          </div>
          <div>
            <b className="text-purple text-4xl">{count ?? 0}</b>
            <p className="text-label text-muted mt-2">Games played</p>
          </div>
        </div>
        <p className="text-label text-purple mt-12">Movie personality</p>
        <h2 className="font-display mt-3 text-4xl font-black uppercase">
          {profile.current_personality?.replaceAll("_", " ") ??
            "Still developing"}
        </h2>
      </section>
    </main>
  );
}
