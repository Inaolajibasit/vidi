import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/features/auth/actions";
import { updateProfileAction } from "@/features/profiles/actions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const client = await createSupabaseServerClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  if (!data.user) redirect("/auth?next=/profile");
  const admin = getSupabaseAdmin();
  const [{ data: profile }, { data: players }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", data.user.id).single(),
    admin
      .from("game_players")
      .select("id, game_id, joined_at")
      .eq("profile_id", data.user.id)
      .order("joined_at", { ascending: false }),
  ]);
  if (!profile) return null;
  const playerIds = (players ?? []).map((player) => player.id);
  const { data: ratings } = playerIds.length
    ? await admin
        .from("ratings")
        .select("movie_id")
        .in("game_player_id", playerIds)
        .eq("seen", true)
    : { data: [] };
  const movieIds = [
    ...new Set((ratings ?? []).map((rating) => rating.movie_id)),
  ];
  const { data: mappings } = movieIds.length
    ? await admin
        .from("movie_genres")
        .select("genre_id")
        .in("movie_id", movieIds)
    : { data: [] };
  const counts = new Map<number, number>();
  for (const row of mappings ?? [])
    counts.set(row.genre_id, (counts.get(row.genre_id) ?? 0) + 1);
  const topIds = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
  const { data: genres } = topIds.length
    ? await admin.from("genres").select("name, tmdb_id").in("tmdb_id", topIds)
    : { data: [] };
  const gameIds = [...new Set((players ?? []).map((player) => player.game_id))];
  const { data: games } = gameIds.length
    ? await admin
        .from("games")
        .select("id, invite_code, mode, status, created_at")
        .in("id", gameIds)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  return (
    <main className="page-container min-h-dvh max-w-xl py-10">
      <header className="flex justify-between">
        <Link className="text-accent text-xl font-bold" href="/">
          vidi.
        </Link>
        <form action={signOutAction}>
          <button className="text-muted min-h-11 text-sm">Sign out</button>
        </form>
      </header>
      <section className="py-14">
        <div className="bg-purple text-background grid size-20 place-items-center rounded-full text-3xl font-black">
          {profile.display_name[0]?.toUpperCase()}
        </div>
        <h1 className="font-display mt-6 text-6xl font-black uppercase">
          {profile.display_name}
        </h1>
        <p className="text-muted mt-2">
          {profile.username ? `@${profile.username}` : "Choose a username"}
        </p>
        <div className="border-border mt-10 grid grid-cols-2 border-y py-7">
          <div>
            <b className="text-accent text-4xl">{profile.movies_seen_count}</b>
            <p className="text-label text-muted mt-2">Movies seen</p>
          </div>
          <div>
            <b className="text-purple text-4xl">{gameIds.length}</b>
            <p className="text-label text-muted mt-2">Games played</p>
          </div>
        </div>
      </section>
      <section className="border-border border-b pb-10">
        <p className="text-label text-purple">Movie personality</p>
        <h2 className="font-display mt-3 text-4xl font-black uppercase">
          {profile.current_personality?.replaceAll("_", " ") ??
            "Still developing"}
        </h2>
        <p className="text-muted mt-5">
          Strongest genres:{" "}
          {(genres ?? []).map((genre) => genre.name).join(" · ") ||
            "Play more to find out"}
        </p>
      </section>
      <section className="py-10">
        <h2 className="font-display text-3xl font-bold uppercase">
          Edit profile
        </h2>
        <form action={updateProfileAction} className="mt-6 grid gap-3">
          <input
            aria-label="Display name"
            className="border-border bg-surface min-h-12 rounded-md border px-4"
            name="displayName"
            defaultValue={profile.display_name}
            maxLength={50}
            required
          />
          <input
            aria-label="Username"
            className="border-border bg-surface min-h-12 rounded-md border px-4"
            name="username"
            defaultValue={profile.username ?? ""}
            pattern="[a-zA-Z0-9_]{3,24}"
            placeholder="username"
            required
          />
          <input
            aria-label="Avatar URL"
            className="border-border bg-surface min-h-12 rounded-md border px-4"
            defaultValue={profile.avatar_url ?? ""}
            name="avatarUrl"
            placeholder="https://…"
            type="url"
          />
          <button className="bg-accent text-background min-h-12 rounded-md font-bold uppercase">
            Save profile
          </button>
        </form>
      </section>
      <section className="border-border border-t py-10">
        <h2 className="font-display text-3xl font-bold uppercase">
          Recent games
        </h2>
        <div className="mt-5 grid gap-3">
          {(games ?? []).map((game) => (
            <Link
              className="border-border flex justify-between rounded-md border p-4"
              key={game.id}
              href={
                game.status === "completed"
                  ? `/results/${game.invite_code}`
                  : `/join/${game.invite_code}`
              }
            >
              <span className="capitalize">{game.mode.replace("_", " ")}</span>
              <span className="text-muted capitalize">
                {game.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="border-border border-t py-10">
        <p className="text-label text-muted">Achievements</p>
        <p className="text-muted mt-3">
          Achievement slots are ready for a future release.
        </p>
      </section>
    </main>
  );
}
