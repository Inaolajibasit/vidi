"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { BottomNav, type BottomNavItem } from "@/components/layout/bottom-nav";
import { Icon } from "@/components/ui/icon";
import PixelBlast from "@/components/ui/PixelBlast";
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
        "tap-target group flex h-15 w-full items-center justify-between rounded-sm border px-5 text-xs font-extrabold tracking-[0.09em] uppercase shadow-[0_0_0_0_transparent] transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.965]",
        primary
          ? "border-accent bg-accent text-background hover:bg-accent-strong hover:shadow-[5px_5px_0_#2227F7]"
          : "border-foreground/55 bg-background/70 text-foreground hover:border-foreground hover:bg-foreground hover:text-background backdrop-blur-sm",
      )}
      href={href}
    >
      <span>{children}</span>
      <Icon
        className="transition-transform duration-150 group-hover:translate-x-1"
        name="chevron-right"
        size={18}
      />
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
      className="border-foreground/25 border-t pt-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-label text-muted" id="recent-game-title">
          Recent game
        </h2>
        <span className="text-label text-accent bg-accent/10 px-2 py-1">
          {statusLabels[game.status]}
        </span>
      </div>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="font-editorial text-foreground text-2xl uppercase">
            {modeLabels[game.mode]}
          </p>
          <p className="text-muted mt-1 text-sm">
            {game.progress} of {movieCount} movies
          </p>
        </div>
        <div
          aria-label={`${progress}% complete`}
          className="bg-purple grid size-12 place-items-center rounded-sm"
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
        "font-ui bg-background relative min-h-dvh overflow-hidden [--accent-personality-soft:#111469] [--accent-personality:#2227F7] [--action-primary-hover:#ffe05c] [--action-primary:#FFD628] [--focus-ring:#FFD628]",
        authenticated && "pb-24",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)] opacity-45"
      >
        <PixelBlast
          antialias={false}
          color="#2227F7"
          edgeFade={0.18}
          enableRipples={!reduceMotion}
          patternDensity={0.72}
          patternScale={2.4}
          pixelSize={5}
          pixelSizeJitter={0.18}
          rippleIntensityScale={1.15}
          rippleSpeed={0.34}
          rippleThickness={0.1}
          speed={reduceMotion ? 0 : 0.16}
          transparent
          variant="square"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#090909_0%,transparent_45%,#090909_100%)] opacity-80"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 sm:px-8 md:justify-center md:py-14">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between md:absolute md:inset-x-8 md:top-8"
          initial={initial}
          transition={transition}
        >
          <Link
            aria-label="vidi home"
            className="font-accent text-accent inline-flex min-h-11 items-center text-2xl tracking-[-0.06em] transition-transform active:scale-95"
            href="/"
          >
            vidi<span className="text-foreground">.</span>
          </Link>
          <span className="text-label text-foreground/60">
            seen it? prove it.
          </span>
        </motion.header>

        <div className="flex flex-1 flex-col justify-center pt-12 pb-7 md:flex-none md:pt-20 md:pb-0">
          <motion.section
            animate={{ opacity: 1, y: 0 }}
            initial={initial}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.05 }}
          >
            <h1 className="font-editorial text-[clamp(5.35rem,26vw,9rem)] leading-[0.72] tracking-[-0.055em] uppercase">
              <span className="block">Seen a</span>
              <span className="text-accent ml-[3%] block">Movie?</span>
              <span className="bg-purple text-foreground -mx-2 mt-3 block w-fit -rotate-[2.5deg] px-2.5 pt-2 pb-3 text-[0.74em] tracking-[-0.045em]">
                Prove it.
              </span>
            </h1>
          </motion.section>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 grid gap-8 sm:grid-cols-[0.8fr_1.2fr] sm:items-end"
            initial={initial}
            transition={{ ...transition, delay: reduceMotion ? 0 : 0.1 }}
          >
            <p className="text-muted border-l-accent border-l-2 pl-4 text-sm leading-6 font-medium">
              play with friends.
              <br />
              compare taste.
              <br />
              see who knows movies.
            </p>

            <div className="grid gap-3">
              <ActionLink href="/games/new" primary>
                Create game
              </ActionLink>
              <ActionLink href="/join">Join game</ActionLink>
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
        <footer className="text-muted relative flex justify-center gap-5 pb-2 text-[0.65rem] font-semibold tracking-[0.04em] uppercase">
          <Link
            className="hover:text-foreground min-h-8 content-center"
            href="/privacy"
          >
            Privacy
          </Link>
          <Link
            className="hover:text-foreground min-h-8 content-center"
            href="/terms"
          >
            Terms
          </Link>
        </footer>
      </div>

      {authenticated ? <BottomNav activeHref="/" items={navigation} /> : null}
    </main>
  );
}
