import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { CreateGameForm } from "@/features/games/components/create-game-form";
import { getCreateGameIdentity } from "@/features/games/create-game-data";

export const metadata = { title: "Create game" };

export default async function CreateGamePage() {
  const identity = await getCreateGameIdentity();

  return (
    <main className="bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-3xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-8 md:py-14">
        <header className="mb-12 flex items-center justify-between md:mb-16">
          <Link
            aria-label="Back to home"
            className="tap-target text-muted hover:text-foreground grid size-11 place-items-center rounded-full transition-colors"
            href="/"
          >
            <Icon name="arrow-left" size={22} />
          </Link>
          <span className="text-accent text-lg font-bold tracking-[-0.04em]">
            vidi<span className="text-purple">.</span>
          </span>
        </header>

        <section className="mb-12 md:mb-16">
          <p className="text-label text-purple mb-4">New game</p>
          <h1 className="font-display text-[clamp(4rem,18vw,7.5rem)] leading-[0.78] font-extrabold tracking-[-0.06em] uppercase">
            Make your
            <span className="text-accent block">vidi.</span>
          </h1>
        </section>

        <CreateGameForm {...identity} />
      </div>
    </main>
  );
}
