import Image from "next/image";
import Link from "next/link";

import { AccountMenu } from "@/components/layout/account-menu";
import { Icon } from "@/components/ui/icon";
import {
  manuallyAddWatchlistItemAction,
  markWatchlistItemWatchedAction,
  removeWatchlistItemAction,
} from "@/features/watchlists/actions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Watchlists" };

interface SavedItem {
  id: string;
  movie: {
    posterPath: string | null;
    releaseYear: number | null;
    title: string;
  };
  watchedAt: string | null;
}

function posterSource(path: string | null) {
  const file = path?.split("/").at(-1);
  return file ? `/api/posters/${encodeURIComponent(file)}` : null;
}

function SavedMovie({ item }: { item: SavedItem }) {
  const poster = posterSource(item.movie.posterPath);
  return (
    <article className="border-foreground/20 flex items-center gap-4 border-b py-4">
      <div className="bg-surface-strong relative h-24 w-16 shrink-0 overflow-hidden rounded-sm">
        {poster ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="64px"
            src={poster}
            unoptimized
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-bold">{item.movie.title}</h3>
        <p className="text-muted mt-1 text-xs">
          {item.movie.releaseYear ?? "—"}
        </p>
        {item.watchedAt ? (
          <p className="text-accent mt-2 text-[0.65rem] font-extrabold tracking-[0.08em] uppercase">
            Watched
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!item.watchedAt ? (
          <form action={markWatchlistItemWatchedAction}>
            <input name="itemId" type="hidden" value={item.id} />
            <button
              aria-label={`Mark ${item.movie.title} as watched`}
              className="border-foreground/25 text-muted hover:border-accent hover:bg-accent hover:text-background focus-visible:outline-accent grid size-11 place-items-center rounded-sm border transition-[color,background-color,border-color,transform] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
              title="Mark watched"
              type="submit"
            >
              <Icon name="check" size={18} />
            </button>
          </form>
        ) : null}
        <form action={removeWatchlistItemAction}>
          <input name="itemId" type="hidden" value={item.id} />
          <button
            aria-label={`Remove ${item.movie.title} from watchlist`}
            className="border-foreground/25 text-muted hover:border-purple hover:bg-purple hover:text-foreground focus-visible:outline-purple grid size-11 place-items-center rounded-sm border transition-[color,background-color,border-color,transform] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
            title="Remove"
            type="submit"
          >
            <Icon name="trash" size={17} />
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const client = await createSupabaseServerClient();
  const { data: authData } = client
    ? await client.auth.getUser()
    : { data: { user: null } };
  const user = authData.user;
  const params = await searchParams;
  const activeTab = params.tab === "friends" ? "friends" : "my";
  const query = params.q?.trim().slice(0, 80) ?? "";
  const admin = getSupabaseAdmin();

  const { data: lists } = user
    ? await admin
        .from("watchlists")
        .select("id, kind, name, participant_names, source_game_id, updated_at")
        .eq("profile_id", user.id)
        .order("updated_at", { ascending: false })
    : { data: [] };
  const listIds = (lists ?? []).map((list) => list.id);
  const { data: rawItems } = listIds.length
    ? await admin
        .from("watchlist_items")
        .select("id, movie_id, watched_at, watchlist_id, created_at")
        .in("watchlist_id", listIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const movieIds = [...new Set((rawItems ?? []).map((item) => item.movie_id))];
  const { data: savedMovies } = movieIds.length
    ? await admin
        .from("movies")
        .select("id, poster_path, release_year, title")
        .in("id", movieIds)
    : { data: [] };
  const movieMap = new Map((savedMovies ?? []).map((movie) => [movie.id, movie]));
  const itemsByList = new Map<string, SavedItem[]>();
  for (const item of rawItems ?? []) {
    const movie = movieMap.get(item.movie_id);
    if (!movie) continue;
    const mapped = {
      id: item.id,
      movie: {
        posterPath: movie.poster_path,
        releaseYear: movie.release_year,
        title: movie.title,
      },
      watchedAt: item.watched_at,
    };
    itemsByList.set(item.watchlist_id, [
      ...(itemsByList.get(item.watchlist_id) ?? []),
      mapped,
    ]);
  }

  const personal = (lists ?? []).find((list) => list.kind === "personal");
  const shared = (lists ?? []).filter((list) => list.kind === "shared");
  const { data: searchResults } =
    user && activeTab === "my" && query.length >= 2
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
  const displayName =
    user?.user_metadata.full_name ?? user?.email?.split("@")[0] ?? "Player";
  const avatarUrl =
    user?.user_metadata.avatar_url ?? user?.user_metadata.picture ?? null;

  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-20 sm:px-8">
        <header className="flex items-center justify-between">
          <Link className="font-accent text-accent text-2xl" href="/">
            vidi<span className="text-purple">.</span>
          </Link>
          <AccountMenu
            authenticated={Boolean(user)}
            avatarUrl={avatarUrl}
            displayName={displayName}
          />
        </header>

        <section className="pt-14 pb-8">
          <p className="text-label text-purple">What&apos;s next</p>
          <h1 className="font-display mt-3 text-[clamp(4.5rem,24vw,7rem)] leading-[0.72] font-black tracking-[-0.055em] uppercase">
            <span className="block">Watch</span>
            <span className="text-accent block">lists.</span>
          </h1>
        </section>

        <nav aria-label="Watchlist sections" className="border-foreground/20 grid grid-cols-2 border-y">
          <Link
            aria-current={activeTab === "my" ? "page" : undefined}
            className={`min-h-14 content-center text-center text-xs font-extrabold uppercase ${activeTab === "my" ? "bg-accent text-background" : "text-muted"}`}
            href="/watchlist?tab=my"
          >
            My watchlist
          </Link>
          <Link
            aria-current={activeTab === "friends" ? "page" : undefined}
            className={`min-h-14 content-center text-center text-xs font-extrabold uppercase ${activeTab === "friends" ? "bg-purple text-foreground" : "text-muted"}`}
            href="/watchlist?tab=friends"
          >
            Friends&apos; lists
          </Link>
        </nav>

        {!user ? (
          <section className="border-foreground/20 mt-10 border-y py-10">
            <h2 className="font-editorial text-3xl uppercase">Keep the picks.</h2>
            <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
              Sign up to keep one personal watchlist and save shared lists from every game.
            </p>
            <Link
              className="bg-accent text-background mt-7 flex min-h-12 items-center justify-center rounded-sm text-xs font-extrabold uppercase"
              href="/auth?next=/watchlist"
            >
              Sign up
            </Link>
          </section>
        ) : activeTab === "my" ? (
          <>
            <section className="pt-10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-label text-muted">Your permanent list</p>
                  <h2 className="font-editorial mt-2 text-4xl uppercase">My watchlist</h2>
                </div>
                <span className="text-accent text-sm font-bold">
                  {(personal && itemsByList.get(personal.id)?.length) ?? 0}
                </span>
              </div>
              <div className="mt-6 border-t border-foreground/20">
                {personal && itemsByList.get(personal.id)?.length ? (
                  itemsByList
                    .get(personal.id)!
                    .map((item) => <SavedMovie item={item} key={item.id} />)
                ) : (
                  <p className="text-muted py-10 text-sm">Nothing saved yet. Your restraint is noted.</p>
                )}
              </div>
            </section>

            <section className="border-foreground/20 mt-12 border-t pt-10">
              <p className="text-label text-purple">Add a movie</p>
              <form className="mt-4 flex gap-2" role="search">
                <input name="tab" type="hidden" value="my" />
                <label className="sr-only" htmlFor="movie-search">Search movies</label>
                <input
                  className="border-border bg-surface focus:border-accent min-h-12 min-w-0 flex-1 rounded-sm border px-4 outline-none"
                  defaultValue={query}
                  id="movie-search"
                  name="q"
                  placeholder="Search a movie"
                />
                <button className="bg-accent text-background min-h-12 rounded-sm px-5 text-xs font-extrabold uppercase" type="submit">
                  Search
                </button>
              </form>
              <div className="mt-6 grid gap-1">
                {(searchResults ?? []).map((movie) => (
                  <form
                    action={manuallyAddWatchlistItemAction}
                    className="border-foreground/15 flex min-h-14 items-center justify-between border-b"
                    key={movie.id}
                  >
                    <input name="movieId" type="hidden" value={movie.id} />
                    <span className="min-w-0 truncate pr-4 text-sm font-bold">{movie.title}</span>
                    <button className="text-accent min-h-11 shrink-0 text-xs font-extrabold uppercase" type="submit">+ Add</button>
                  </form>
                ))}
                {query.length >= 2 && !searchResults?.length ? (
                  <p className="text-muted py-8 text-sm">No cached movies found.</p>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <section className="pt-10">
            <p className="text-label text-muted">Saved from completed games</p>
            <h2 className="font-editorial mt-2 text-4xl uppercase">Our watchlists</h2>
            <div className="mt-8 grid gap-12">
              {shared.length ? (
                shared.map((list) => (
                  <section key={list.id}>
                    <div className="border-purple border-l-2 pl-4">
                      <h3 className="font-editorial text-2xl uppercase">
                        {list.participant_names.join(" × ") || list.name}
                      </h3>
                      <p className="text-muted mt-1 text-xs">
                        {itemsByList.get(list.id)?.length ?? 0} movies
                      </p>
                    </div>
                    <div className="mt-5 border-t border-foreground/20">
                      {(itemsByList.get(list.id) ?? []).map((item) => (
                        <SavedMovie item={item} key={item.id} />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="border-foreground/20 border-y py-10">
                  <Icon className="text-purple" name="users" size={24} />
                  <p className="font-editorial mt-4 text-3xl uppercase">No shared lists yet.</p>
                  <p className="text-muted mt-3 text-sm">Finish a game and save “Our watchlist” from the verdict.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
