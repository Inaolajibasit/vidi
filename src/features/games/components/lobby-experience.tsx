"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusAction, StatusState } from "@/components/ui/status-state";
import { InviteActions } from "@/features/games/components/share-invite-button";
import { JoinLobbyForm } from "@/features/games/components/join-lobby-form";
import {
  leaveGameAction,
  startGameAction,
} from "@/features/games/lobby-actions";
import type { LobbyData } from "@/features/games/lobby-data";
import { lobbyTopic } from "@/features/games/realtime-topic";
import { GAME_MODE_DETAILS } from "@/features/games/validation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { trackAnalyticsOnce } from "@/lib/analytics/client";

function WaitingAnimation() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-label="Waiting for more players"
      className="border-border my-8 border-y py-5 text-center"
      role="status"
    >
      <div
        className="flex h-5 items-center justify-center gap-3"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <motion.span
            animate={
              reduceMotion
                ? undefined
                : {
                    opacity: [0.28, 1, 0.28],
                    scale: [1, 1.65, 1],
                  }
            }
            className="bg-accent size-1.5 rounded-full"
            key={index}
            transition={{
              delay: index * 0.14,
              duration: 1.4,
              ease: [0.2, 0.8, 0.2, 1],
              repeat: Infinity,
            }}
          />
        ))}
      </div>
      <p className="text-label text-muted mt-3">Warming up the group chat.</p>
    </div>
  );
}

function StartButton({ canStart }: { canStart: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      disabled={!canStart || pending}
      loadingLabel="Starting game…"
      fullWidth
      size="lg"
      type="submit"
    >
      {pending ? "Starting…" : "Start game"}
    </Button>
  );
}

export function LobbyExperience({ lobby }: { lobby: LobbyData }) {
  const router = useRouter();
  const [startState, startAction] = useActionState(startGameAction, {});
  const [connectionState, setConnectionState] = useState(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? "Connecting"
      : "Offline",
  );
  const [onlineCount, setOnlineCount] = useState(0);
  const presenceKey = useId();
  const mode = GAME_MODE_DETAILS[lobby.mode];
  const waitingSlots = Math.max(0, lobby.maxPlayers - lobby.players.length);
  const canStart = lobby.isHost && lobby.players.length >= 2;
  const isFull = lobby.players.length >= lobby.maxPlayers;

  useEffect(() => {
    if (!lobby.isParticipant) {
      trackAnalyticsOnce(
        `join-opened:${lobby.inviteCode}`,
        "join_page_opened",
        {},
        lobby.inviteCode,
      );
    }
  }, [lobby.inviteCode, lobby.isParticipant]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = lobby.isParticipant
      ? supabase.channel(lobbyTopic(lobby.inviteCode), {
          config: { presence: { key: presenceKey } },
        })
      : supabase.channel(lobbyTopic(lobby.inviteCode));

    const refreshLobby = () => router.refresh();
    channel
      .on("broadcast", { event: "player_joined" }, refreshLobby)
      .on("broadcast", { event: "player_left" }, refreshLobby)
      .on("broadcast", { event: "game_started" }, refreshLobby)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.values(state).flat().length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("Live");
          // The game may have changed before this subscription was ready.
          refreshLobby();
          if (lobby.isParticipant) {
            await channel.track({ online_at: new Date().toISOString() });
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("Reconnecting");
        } else if (status === "CLOSED") {
          setConnectionState("Reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lobby.inviteCode, lobby.isParticipant, presenceKey, router]);

  useEffect(() => {
    if (!lobby.isParticipant || lobby.status !== "waiting") return;

    // Broadcasts are best-effort. Recover missed starts without requiring a
    // manual reload, including when a background tab becomes visible again.
    const refreshWaitingLobby = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refreshWaitingLobby, 20_000);
    document.addEventListener("visibilitychange", refreshWaitingLobby);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWaitingLobby);
    };
  }, [lobby.inviteCode, lobby.isParticipant, lobby.status, router]);

  if (!lobby.isParticipant) {
    const unavailable = lobby.status !== "waiting" || isFull;
    return (
      <LobbyShell inviteCode={lobby.inviteCode}>
        <div className="py-12">
          <p className="text-label text-purple mb-4">You’re invited</p>
          <h1 className="font-display text-[clamp(3.5rem,19vw,7rem)] leading-[0.8] font-extrabold tracking-[-0.055em] uppercase">
            Join the
            <span className="text-accent block">people.</span>
          </h1>
          <p className="text-muted mt-6 text-base leading-6">
            {mode.title} · {mode.movieCount} movies · {mode.duration}
          </p>
          <div className="border-border my-8 border-y py-6 text-center">
            <p className="text-label text-muted">Invite code</p>
            <p className="font-display mt-3 text-5xl font-extrabold tracking-[0.09em]">
              {lobby.inviteCode}
            </p>
          </div>
          {unavailable ? (
            <StatusState
              action={
                <StatusAction href="/games/new">Create a game</StatusAction>
              }
              className="border-border border-y py-8"
              description={
                lobby.status === "expired"
                  ? "This invite has expired. Start a new room to keep playing."
                  : lobby.status === "completed"
                    ? "This game has finished. Only its players can open the results."
                    : lobby.status !== "waiting"
                      ? "The host has already started this game. Create a new room or ask for another invite."
                      : "This room has reached its player limit. Start another room to play."
              }
              eyebrow={
                lobby.status === "expired"
                  ? "Expired room"
                  : lobby.status === "completed"
                    ? "Game completed"
                    : lobby.status !== "waiting"
                      ? "Game in progress"
                      : "Room full"
              }
              title={
                lobby.status === "expired"
                  ? "This invite has ended."
                  : lobby.status === "completed"
                    ? "The verdict is in."
                    : lobby.status !== "waiting"
                      ? "You missed the start."
                      : "No seats left."
              }
              tone="purple"
            />
          ) : (
            <JoinLobbyForm
              authenticated={lobby.authenticated}
              inviteCode={lobby.inviteCode}
            />
          )}
        </div>
      </LobbyShell>
    );
  }

  return (
    <LobbyShell inviteCode={lobby.inviteCode}>
      <section className="py-10">
        <div className="mb-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-label text-purple">
              {lobby.isHost ? "Your lobby" : "Game lobby"}
            </p>
            <span className="text-label text-muted flex items-center gap-2">
              <span
                className={`size-1.5 rounded-full ${connectionState === "Live" ? "bg-accent" : "bg-purple"}`}
              />
              {connectionState}
            </span>
          </div>
          <h1 className="font-display text-[clamp(3.5rem,19vw,7rem)] leading-[0.8] font-extrabold tracking-[-0.055em] uppercase">
            Bring the
            <span className="text-accent block">people.</span>
          </h1>
        </div>

        <section
          aria-labelledby="invite-heading"
          className="border-border border-y py-6 text-center"
        >
          <h2 className="text-label text-muted" id="invite-heading">
            Invite code
          </h2>
          <p className="font-display mt-3 text-6xl leading-none font-extrabold tracking-[0.09em]">
            {lobby.inviteCode}
          </p>
        </section>

        <div className="mt-6 flex items-center justify-between text-sm">
          <div>
            <p className="font-bold">{mode.title}</p>
            <p className="text-muted mt-1">
              {mode.movieCount} movies · {mode.duration}
            </p>
          </div>
          <span className="text-label text-accent">Classic</span>
        </div>

        <section aria-labelledby="players-heading" className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-label text-muted" id="players-heading">
              Players
            </h2>
            <span className="text-label">
              {lobby.players.length}/{lobby.maxPlayers} · {onlineCount} online
            </span>
          </div>
          <ul className="grid gap-3">
            <AnimatePresence initial={false}>
              {lobby.players.map((player, index) => (
                <motion.li
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="border-border bg-background/70 flex min-h-16 items-center gap-3 rounded-sm border px-4 backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  key={`${player.displayName}-${index}`}
                  layout
                  transition={{ bounce: 0, duration: 0.3, type: "spring" }}
                >
                  <Avatar
                    name={player.displayName}
                    src={player.avatarUrl ?? undefined}
                  />
                  <span className="text-sm font-semibold">
                    {player.displayName}
                    {index === 0 ? (
                      <span className="text-muted ml-2 font-normal">Host</span>
                    ) : null}
                    {player.isCurrent ? (
                      <span className="text-accent ml-2 font-normal">You</span>
                    ) : null}
                  </span>
                </motion.li>
              ))}
              {Array.from({ length: waitingSlots }, (_, index) => (
                <motion.li
                  className="border-border text-muted flex min-h-16 items-center gap-3 rounded-sm border border-dashed px-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={`waiting-${index}`}
                >
                  <span className="border-border grid size-11 place-items-center rounded-full border border-dashed">
                    <span className="bg-muted/50 size-1.5 rounded-full" />
                  </span>
                  <span className="text-sm">Waiting for player…</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>

        {connectionState !== "Live" ? (
          <div
            aria-live="polite"
            className="border-purple/50 bg-purple/10 mt-6 border-l-2 px-4 py-3"
            role="status"
          >
            <p className="text-sm font-bold">
              {connectionState === "Offline"
                ? "Live updates are unavailable."
                : "Connection interrupted."}
            </p>
            <p className="text-muted mt-1 text-xs leading-5">
              {connectionState === "Offline"
                ? "Refresh the page after checking your connection."
                : "Reconnecting automatically. You can stay on this screen."}
            </p>
          </div>
        ) : null}

        {lobby.status === "waiting" ? <WaitingAnimation /> : null}

        <div aria-live="polite" className="mt-8 grid gap-4">
          {lobby.status === "active" ? (
            <div className="border-accent bg-accent/5 rounded-md border p-5 text-center">
              <p className="text-label text-accent">Game started</p>
              <p className="text-muted mt-2 text-sm">
                The shared deck is ready.
              </p>
            </div>
          ) : lobby.isHost ? (
            <form action={startAction}>
              <input name="inviteCode" type="hidden" value={lobby.inviteCode} />
              <StartButton canStart={canStart} />
              {!canStart ? (
                <p className="text-muted mt-3 text-center text-xs">
                  At least 2 players are needed.
                </p>
              ) : null}
            </form>
          ) : (
            <div className="border-border bg-surface rounded-md border p-5 text-center">
              <p className="text-label text-accent">Waiting for host</p>
              <p className="text-muted mt-2 text-xs">
                The game will begin here automatically.
              </p>
            </div>
          )}

          {startState.message ? (
            <p className="text-danger text-center text-sm" role="alert">
              {startState.message}
            </p>
          ) : null}

          <InviteActions inviteCode={lobby.inviteCode} />

          {!lobby.isHost && lobby.status === "waiting" ? (
            <form
              action={leaveGameAction}
              className="text-center"
              suppressHydrationWarning
            >
              <input name="inviteCode" type="hidden" value={lobby.inviteCode} />
              <Button
                variant="ghost"
                loadingLabel="Leaving lobby…"
                className="tap-target text-muted hover:text-foreground cursor-pointer text-xs underline underline-offset-4"
                type="submit"
              >
                Leave lobby
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </LobbyShell>
  );
}

function LobbyShell({
  children,
  inviteCode,
}: {
  children: React.ReactNode;
  inviteCode: string;
}) {
  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            aria-label="Back to home"
            className="tap-target text-muted hover:text-foreground grid size-11 place-items-center rounded-full transition-colors"
            href="/"
          >
            <Icon name="close" size={21} />
          </Link>
          <Link
            aria-label={`vidi lobby ${inviteCode}`}
            className="font-accent text-accent text-2xl tracking-[-0.05em]"
            href="/"
          >
            vidi<span className="text-purple">.</span>
          </Link>
        </header>
        <div className="flex flex-1 flex-col justify-center">{children}</div>
      </div>
    </main>
  );
}
