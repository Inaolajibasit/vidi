import Link from "next/link";

import { AccountMenu } from "@/components/layout/account-menu";
import { DeferredPixelBlast } from "@/components/ui/deferred-pixel-blast";
import { HomeViewTracker } from "@/features/analytics/home-view-tracker";
import { HomeActionLink } from "@/features/games/components/home-action-link";
import type { RecentGame } from "@/features/games/home-data";
import type { AccountAttention } from "@/components/layout/account-attention";

interface HomeExperienceProps {
  attention: AccountAttention;
  authenticated: boolean;
  profile: { avatarUrl: string | null; displayName: string } | null;
  recentGame: RecentGame | null;
}

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
  attention,
  authenticated,
  profile,
  recentGame,
}: HomeExperienceProps) {
  return (
    <main className="font-ui bg-background relative min-h-dvh overflow-hidden [--accent-personality-soft:#111469] [--accent-personality:#2227F7] [--action-primary-hover:#ffe05c] [--action-primary:#FFD628] [--focus-ring:#FFD628]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,39,247,0.55)_0_1px,transparent_1.5px)] [mask-image:linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)] [background-size:17px_17px] opacity-45"
      >
        <DeferredPixelBlast />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#090909_0%,transparent_45%,#090909_100%)] opacity-80"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 sm:px-8 md:justify-center md:py-14">
        <header className="vidi-enter relative z-50 flex items-center justify-between md:absolute md:inset-x-8 md:top-8">
          <Link
            aria-label="vidi home"
            className="font-accent text-accent inline-flex min-h-11 items-center text-2xl tracking-[-0.06em] transition-transform active:scale-95"
            href="/"
          >
            vidi<span className="text-foreground">.</span>
          </Link>
          <AccountMenu
            authenticated={authenticated}
            avatarUrl={profile?.avatarUrl}
            displayName={profile?.displayName}
            friendRequests={attention.friendRequests}
            incompleteGames={attention.incompleteGames}
          />
        </header>

        <div className="flex flex-1 flex-col justify-center pt-12 pb-7 md:flex-none md:pt-20 md:pb-0">
          <section className="vidi-enter [animation-delay:50ms]">
            <h1 className="font-editorial text-[clamp(5.35rem,26vw,9rem)] leading-[0.72] tracking-[-0.055em] uppercase">
              <span className="block">Seen a</span>
              <span className="text-accent ml-[3%] block">Movie?</span>
              <span className="bg-purple text-foreground -mx-2 mt-3 block w-fit -rotate-[2.5deg] px-2.5 pt-2 pb-3 text-[0.74em] tracking-[-0.045em]">
                Prove it.
              </span>
            </h1>
          </section>

          <div className="vidi-enter mt-8 grid gap-8 [animation-delay:100ms] sm:grid-cols-[0.8fr_1.2fr] sm:items-end">
            <p className="text-muted border-l-accent border-l-2 pl-4 text-sm leading-6 font-medium">
              play with friends.
              <br />
              compare taste.
              <br />
              see who knows movies.
            </p>

            <div className="grid gap-3">
              <HomeActionLink
                href="/games/new"
                label="Create game"
                primary
                trackCreate
              />
              <HomeActionLink href="/join" label="Join game" />
            </div>
          </div>

          {recentGame ? (
            <div className="vidi-enter mt-8 [animation-delay:150ms]">
              <RecentGameCard game={recentGame} />
            </div>
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
        <HomeViewTracker />
      </div>
    </main>
  );
}
