import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountMenu } from "@/components/layout/account-menu";
import { getAccountAttention } from "@/components/layout/account-attention";
import { AvatarGroup } from "@/components/ui/avatar-group";
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

function gameHref(game: {
  invite_code: string;
  status: keyof typeof statusLabels;
}) {
  if (game.status === "completed" || game.status === "waiting_results") {
    return `/results/${game.invite_code}`;
  }
  if (game.status === "active") return `/play/${game.invite_code}`;
  return `/join/${game.invite_code}`;
}

function participantLabel(names: readonly string[]) {
  if (names.length <= 3) return names.join(" × ");
  return `${names.slice(0, 2).join(" × ")} +${names.length - 2}`;
}

export default async function GamesPage() {
  const client = await createSupabaseServerClient();
  const { data: authData } = client
    ? await client.auth.getUser()
    : { data: { user: null } };

  if (!authData.user || !client) redirect("/auth?next=/games");

  const [{ data: profile }, { data: players }, attention] = await Promise.all([
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
    getAccountAttention(authData.user.id),
  ]);

  const gameIds = (players ?? []).map((player) => player.game_id);
  const { data: games } = gameIds.length
    ? await client
        .from("games")
        .select("id, invite_code, mode, status, created_at")
        .in("id", gameIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const { data: gamePlayers } = gameIds.length
    ? await client
        .from("game_players")
        .select("display_name, game_id, profile_id")
        .in("game_id", gameIds)
        .order("joined_at", { ascending: true })
    : { data: [] };
  const participantProfileIds = [
    ...new Set(
      (gamePlayers ?? [])
        .map((player) => player.profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: participantProfiles } = participantProfileIds.length
    ? await client
        .from("profiles")
        .select("avatar_url, id")
        .in("id", participantProfileIds)
    : { data: [] };
  const avatarByProfile = new Map(
    (participantProfiles ?? []).map((item) => [item.id, item.avatar_url]),
  );
  const participantsByGame = new Map<
    string,
    Array<{ avatarUrl: string | null; displayName: string }>
  >();
  for (const player of gamePlayers ?? []) {
    participantsByGame.set(player.game_id, [
      ...(participantsByGame.get(player.game_id) ?? []),
      {
        avatarUrl: player.profile_id
          ? (avatarByProfile.get(player.profile_id) ?? null)
          : null,
        displayName: player.display_name,
      },
    ]);
  }
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
            friendRequests={attention.friendRequests}
            incompleteGames={attention.incompleteGames}
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
              <GameHistoryItem
                game={game}
                key={game.id}
                participants={participantsByGame.get(game.id) ?? []}
                progress={progressByGame.get(game.id) ?? 0}
              />
            ))}
          </div>
        ) : (
          <section className="border-foreground/20 border-y py-10">
            <p className="font-editorial text-3xl uppercase">No games yet.</p>
            <p className="text-muted mt-3 text-sm">
              Create a game and invite a friend to start your history.
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

function GameHistoryItem({
  game,
  participants,
  progress,
}: {
  game: {
    invite_code: string;
    mode: keyof typeof modeLabels;
    status: keyof typeof statusLabels;
  };
  participants: Array<{ avatarUrl: string | null; displayName: string }>;
  progress: number;
}) {
  const names = participants.map((player) => player.displayName);
  return (
    <Link
      className="group border-foreground/20 grid min-h-28 grid-cols-[auto_1fr_auto] items-center gap-4 border-b py-5"
      href={gameHref(game)}
    >
      <AvatarGroup
        avatars={participants.map((player) => ({
          name: player.displayName,
          src: player.avatarUrl ?? undefined,
        }))}
        max={3}
        size="sm"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold">
          {participantLabel(names) || "Waiting for players"}
        </p>
        <p className="text-muted mt-1 text-xs">
          {modeLabels[game.mode]} · {statusLabels[game.status]} · {progress}{" "}
          rated
        </p>
      </div>
      <Icon
        className="text-accent transition-transform group-hover:translate-x-1"
        name="chevron-right"
        size={20}
      />
    </Link>
  );
}
