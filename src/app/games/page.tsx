import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountMenu } from "@/components/layout/account-menu";
import { Icon } from "@/components/ui/icon";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Games" };

const modeLabels = {
  no_life: "No Life",
  proper: "Proper",
  quick: "Quick",
} as const;

const statusLabels = {
  active: "In progress",
  completed: "Completed",
  expired: "Expired",
  waiting: "Waiting",
  waiting_results: "Calculating results",
} as const;

function gameHref(game: { invite_code: string; status: keyof typeof statusLabels }) {
  if (game.status === "completed" || game.status === "waiting_results") {
    return `/results/${game.invite_code}`;
  }
  if (game.status === "active") return `/play/${game.invite_code}`;
  return `/join/${game.invite_code}`;
}

export default async function GamesPage() {
  const client = await createSupabaseServerClient();
  const { data: authData } = client
    ? await client.auth.getUser()
    : { data: { user: null } };

  if (!authData.user || !client) redirect("/auth?next=/games");

  const [{ data: profile }, { data: players }] = await Promise.all([
    client
      .from("profiles")
      .select("avatar_url, display_name")
      .eq("id", authData.user.id)
      .maybeSingle(),
    client
      .from("game_players")
      .select("game_id, joined_at, progress")
      .eq("profile_id", authData.user.id)
      .order("joined_at", { ascending: false }),
  ]);

  const gameIds = (players ?? []).map((player) => player.game_id);
  const { data: games } = gameIds.length
    ? await client
        .from("games")
        .select("id, invite_code, mode, status, created_at")
        .in("id", gameIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const progressByGame = new Map(
    (players ?? []).map((player) => [player.game_id, player.progress]),
  );
  const displayName =
    profile?.display_name ??
    authData.user.user_metadata.full_name ??
    authData.user.email?.split("@")[0] ??
    "Player";

  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16 sm:px-8">
        <header className="flex items-center justify-between">
          <Link className="font-accent text-accent text-2xl" href="/">
            vidi<span className="text-purple">.</span>
          </Link>
          <AccountMenu
            avatarUrl={
              profile?.avatar_url ??
              authData.user.user_metadata.avatar_url ??
              authData.user.user_metadata.picture ??
              null
            }
            displayName={displayName}
          />
        </header>

        <section className="pt-14 pb-10">
          <p className="text-label text-purple">Your history</p>
          <div className="mt-3 flex items-end justify-between gap-5">
            <h1 className="font-display text-[clamp(4.5rem,22vw,7rem)] leading-[0.78] tracking-[-0.05em] uppercase">
              Games
            </h1>
            <Link
              aria-label="Create game"
              className="bg-accent text-background grid size-12 shrink-0 place-items-center rounded-sm shadow-[4px_4px_0_#2227F7] transition-transform active:scale-95"
              href="/games/new"
            >
              <Icon name="plus" size={23} />
            </Link>
          </div>
        </section>

        {games?.length ? (
          <div className="border-foreground/20 border-t">
            {games.map((game) => (
              <Link
                className="group border-foreground/20 flex min-h-24 items-center justify-between gap-4 border-b py-5"
                href={gameHref(game)}
                key={game.id}
              >
                <div>
                  <p className="font-editorial text-2xl uppercase">
                    {modeLabels[game.mode]}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    {statusLabels[game.status]} · {progressByGame.get(game.id) ?? 0}{" "}
                    rated
                  </p>
                </div>
                <Icon
                  className="text-accent transition-transform group-hover:translate-x-1"
                  name="chevron-right"
                  size={20}
                />
              </Link>
            ))}
          </div>
        ) : (
          <section className="border-foreground/20 border-y py-10">
            <p className="font-editorial text-3xl uppercase">No games yet.</p>
            <p className="text-muted mt-3 text-sm">
              A remarkably clean record. Let&apos;s ruin it.
            </p>
            <Link
              className="bg-accent text-background mt-7 flex min-h-12 items-center justify-center rounded-sm text-xs font-extrabold tracking-[0.08em] uppercase"
              href="/games/new"
            >
              Create game
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
