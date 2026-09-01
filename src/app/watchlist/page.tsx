import Image from "next/image";
import Link from "next/link";

import { manuallyAddWatchlistItemAction } from "@/features/watchlists/actions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const client = await createSupabaseServerClient();
  const { data } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  const query = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const admin = getSupabaseAdmin();
  const { data: movies } =
    data.user && query.length >= 2
      ? await admin
          .from("movies")
          .select("id, poster_path, release_year, title")
          .ilike(
            "title",
            `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
          )
          .order("popularity", { ascending: false })
          .limit(12)
      : { data: [] };

  return (
    <main className="editorial-screen font-ui mx-auto min-h-dvh w-full max-w-xl px-5 py-10 sm:px-8">
      <Link className="font-accent text-accent text-2xl" href="/">
        vidi<span className="text-purple">.</span>
      </Link>
      <p className="text-label text-purple mt-16">Permanent collection</p>
      <h1 className="font-display mt-3 text-6xl font-black tracking-[-0.05em] uppercase">
        My watchlist
      </h1>
      {!data.user ? (
        <div className="border-border mt-10 border-y py-8">
          <p className="text-muted leading-relaxed">
            Create or sign in to an account to build a permanent watchlist.
            Guest recommendations remain visible on each game’s results page.
          </p>
        </div>
      ) : (
        <>
          <form className="mt-10 flex gap-2" role="search">
            <label className="sr-only" htmlFor="movie-search">
              Search movies
            </label>
            <input
              className="border-border bg-surface focus:border-accent min-h-12 min-w-0 flex-1 rounded-md border px-4 outline-none"
              defaultValue={query}
              id="movie-search"
              name="q"
              placeholder="Search a movie"
            />
            <button
              className="bg-accent text-background min-h-12 rounded-md px-5 text-xs font-extrabold uppercase"
              type="submit"
            >
              Search
            </button>
          </form>
          <div className="mt-10 grid gap-3">
            {(movies ?? []).map((movie) => {
              const file = movie.poster_path?.split("/").at(-1);
              return (
                <article
                  className="border-border flex items-center gap-4 border-b pb-3"
                  key={movie.id}
                >
                  <div className="bg-surface-strong relative h-20 w-14 shrink-0 overflow-hidden rounded-sm">
                    {file ? (
                      <Image
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                        src={`/api/posters/${encodeURIComponent(file)}`}
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{movie.title}</h2>
                    <p className="text-muted text-sm">
                      {movie.release_year ?? "—"}
                    </p>
                  </div>
                  <form action={manuallyAddWatchlistItemAction}>
                    <input name="movieId" type="hidden" value={movie.id} />
                    <button
                      className="text-accent min-h-11 px-2 text-xs font-extrabold uppercase"
                      type="submit"
                    >
                      + Add
                    </button>
                  </form>
                </article>
              );
            })}
            {query.length >= 2 && !movies?.length ? (
              <p className="text-muted py-8">No cached movies found.</p>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
