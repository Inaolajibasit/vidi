import Link from "next/link";

import { Icon } from "@/components/ui/icon";

export default function NotFound() {
  return (
    <main className="editorial-screen font-ui bg-background relative grid min-h-dvh overflow-hidden px-5 py-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[max(1rem,calc(50%-15rem))] border-l border-white/[0.035]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[max(1rem,calc(50%-15rem))] border-r border-white/[0.035]"
      />

      <div className="relative mx-auto flex w-full max-w-[28rem] flex-col">
        <header>
          <Link
            aria-label="vidi home"
            className="font-accent text-accent inline-flex min-h-11 items-center text-2xl tracking-[-0.04em]"
            href="/"
          >
            vidi<span className="text-purple">.</span>
          </Link>
        </header>

        <section
          className="flex flex-1 flex-col justify-center py-12"
          aria-labelledby="not-found-title"
        >
          <p className="text-label text-purple mb-4">Scene missing</p>
          <h1
            className="font-display text-accent text-[clamp(8rem,46vw,15rem)] leading-[0.68] font-extrabold tracking-[-0.075em]"
            id="not-found-title"
          >
            404
          </h1>

          <div className="border-border mt-10 border-t pt-5">
            <p className="text-title max-w-sm">
              This page hasn&apos;t seen the movie.
            </p>
            <p className="text-muted mt-3 max-w-xs text-base leading-6">
              Either the link is wrong, or the scene was cut.
            </p>
          </div>

          <Link
            className="tap-target border-accent bg-accent hover:bg-accent-strong mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-md border px-5 text-sm font-bold tracking-[0.07em] text-[var(--text-inverse)] uppercase transition-[background-color,transform] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.975]"
            href="/"
          >
            Back home
            <Icon name="chevron-right" size={17} />
          </Link>
        </section>

        <footer className="pb-[max(0rem,env(safe-area-inset-bottom))]">
          <p className="text-label text-subtle">seen it? prove it.</p>
        </footer>
      </div>
    </main>
  );
}
