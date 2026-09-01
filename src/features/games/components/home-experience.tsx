"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { BottomNav, type BottomNavItem } from "@/components/layout/bottom-nav";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { RecentGame } from "@/features/games/home-data";

interface HomeExperienceProps {
  authenticated: boolean;
  recentGame: RecentGame | null;
}

const navigation: BottomNavItem[] = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/games", icon: "game", label: "Games" },
  { emphasis: true, href: "/games/new", icon: "plus", label: "Create game" },
  { href: "/profile", icon: "profile", label: "Profile" },
];

const modeLabels = {
  no_life: "No Life",
  proper: "Proper",
  quick: "Quick",
} as const;

const statusLabels = {
  active: "In progress",
  completed: "Completed",
  expired: "Expired",
  waiting: "Waiting for players",
  waiting_results: "Waiting for results",
} as const;

function ActionLink({
  children,
  href,
  primary = false,
}: {
  children: React.ReactNode;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={cn(
        "tap-target flex h-14 w-full items-center justify-center rounded-md border px-5 text-sm font-bold tracking-[0.07em] uppercase transition-[color,background-color,border-color,transform] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.975]",
        primary
          ? "border-accent bg-accent text-background hover:bg-accent-strong"
          : "border-border text-foreground hover:border-foreground/35 hover:bg-surface bg-transparent",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function RecentGameCard({ game }: { game: RecentGame }) {
  const movieCount =
    game.mode === "quick" ? 30 : game.mode === "proper" ? 100 : 200;
  const progress = Math.min(
    100,
    Math.round((game.progress / movieCount) * 100),
  );

  return (
    <section
      aria-labelledby="recent-game-title"
      className="border-border border-t pt-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-label text-muted" id="recent-game-title">
          Recent game
        </h2>
        <span className="text-label text-accent">
          {statusLabels[game.status]}
        </span>
      </div>
      <div className="border-border bg-surface flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-title text-xl">{modeLabels[game.mode]}</p>
          <p className="text-muted mt-1 text-sm">
            {game.progress} of {movieCount} movies
          </p>
        </div>
        <div
          aria-label={`${progress}% complete`}
          className="border-border grid size-12 place-items-center rounded-full border"
          role="img"
        >
          <span className="text-label text-foreground">{progress}%</span>
        </div>
      </div>
    </section>
  );
}

export function HomeExperience({
  authenticated,
  recentGame,
}: HomeExperienceProps) {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? false : { opacity: 1, y: 18 };
  const transition = { duration: 0.36, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <main
      className={cn(
        "bg-background relative min-h-dvh overflow-hidden",
        authenticated && "pb-24",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[max(1rem,calc(50%-15rem))] border-l border-white/[0.035]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[max(1rem,calc(50%-15rem))] border-r border-white/[0.035]"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[32rem] flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 sm:px-8 md:justify-center md:py-12">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="md:absolute md:top-10"
          initial={initial}
          transition={transition}
        >
          <Link
            aria-label="vidi home"
            className="text-accent inline-flex min-h-11 items-center text-lg font-bold tracking-[-0.04em]"
            href="/"
          >
            vidi<span className="text-purple">.</span>
          </Link>
        </motion.header>

        <div className="flex flex-1 flex-col justify-center py-8 md:flex-none md:py-0">
          <motion.section
            animate={{ opacity: 1, y: 0 }}
            initial={initial}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.05 }}
          >
            <h1 className="font-display text-[clamp(3.55rem,18vw,5.65rem)] leading-[0.79] font-extrabold tracking-[-0.06em] uppercase">
              <span className="block">Movies</span>
              <span className="block">bring us</span>
              <span className="block">together.</span>
              <span className="text-accent mt-2 block">Prove it.</span>
            </h1>
          </motion.section>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-7"
            initial={initial}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.1 }}
          >
            <p className="text-body text-muted">
              play with friends.
              <br />
              compare taste.
              <br />
              see who knows movies.
            </p>

            <div className="mt-7 grid gap-3">
              <ActionLink href="/games/new" primary>
                Create game
              </ActionLink>
              <ActionLink href="/join">
                <span className="flex items-center gap-2">
                  Join game <Icon name="chevron-right" size={17} />
                </span>
              </ActionLink>
            </div>
          </motion.div>

          {recentGame ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
              initial={initial}
              transition={{ ...transition, delay: reduceMotion ? 0 : 0.15 }}
            >
              <RecentGameCard game={recentGame} />
            </motion.div>
          ) : null}
        </div>
      </div>

      {authenticated ? <BottomNav activeHref="/" items={navigation} /> : null}
    </main>
  );
}
