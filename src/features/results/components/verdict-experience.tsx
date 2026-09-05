"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MoviePoster } from "@/components/ui/movie-poster";
import { createChallengeAction } from "@/features/challenges/actions";
import { ShareResultCard } from "@/features/results/components/share-result-card";
import type {
  VerdictData,
  VerdictMovie,
} from "@/features/results/results-data";
import {
  savePersonalGameWatchlistAction,
  saveSharedGameWatchlistAction,
} from "@/features/watchlists/actions";
import { trackAnalyticsOnce } from "@/lib/analytics/client";

const reactionLabel = {
  cant_remember: "Can't remember",
  liked: "Like",
  loved: "Love",
  meh: "Meh",
} as const;

function verdictCopy(score: number) {
  if (score >= 90) return "suspiciously compatible.";
  if (score >= 76) return "yeah, you basically share a brain.";
  if (score >= 58) return "good enough to survive movie night.";
  if (score >= 38) return "keep the remote somewhere neutral.";
  return "maybe stick to talking about music.";
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      transition={{ bounce: 0, delay, duration: 0.38, type: "spring" }}
      viewport={{ amount: 0.2, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.section>
  );
}

function PosterStrip({ movies }: { movies: VerdictMovie[] }) {
  if (!movies.length)
    return <p className="text-muted mt-5">Nothing made the cut.</p>;
  return (
    <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
      {movies.slice(0, 8).map((movie) => (
        <figure className="w-28 shrink-0" key={movie.id}>
          <MoviePoster
            alt={`${movie.title} poster`}
            className="rounded-sm border-0"
            sizes="112px"
            src={movie.posterUrl ?? undefined}
          />
          <figcaption className="mt-2 line-clamp-2 text-xs font-semibold">
            {movie.title}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function VerdictExperience({
  challengesEnabled,
  verdict,
}: {
  challengesEnabled: boolean;
  verdict: VerdictData;
}) {
  const reduceMotion = useReducedMotion();
  const target = Math.round(verdict.overallScore);
  const [displayScore, setDisplayScore] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    trackAnalyticsOnce(
      `results-viewed:${verdict.inviteCode}`,
      "results_viewed",
      {},
      verdict.inviteCode,
    );
  }, [verdict.inviteCode]);

  useEffect(() => {
    if (reduceMotion) return;
    const started = performance.now();
    const duration = 700;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setDisplayScore(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, target]);

  return (
    <main className="editorial-screen font-ui bg-background min-h-dvh overflow-x-hidden">
      <div className="mx-auto w-full max-w-xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex items-center justify-between">
          <Link className="font-accent text-accent text-2xl" href="/">
            vidi<span className="text-purple">.</span>
          </Link>
          <span className="text-label text-muted">The verdict</span>
        </header>

        <section className="flex min-h-[82dvh] flex-col justify-center py-16 text-center">
          <motion.p
            className="text-label text-purple mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            The verdict
          </motion.p>
          <motion.h1
            animate={{ opacity: 1, scale: 1 }}
            className="font-display text-accent text-[clamp(7rem,38vw,13rem)] leading-[0.7] font-black tracking-[-0.08em]"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.86 }}
            transition={{ bounce: 0.12, duration: 0.55, type: "spring" }}
          >
            {displayScore}
            <span className="text-[0.28em]">%</span>
          </motion.h1>
          <p className="font-display mt-8 text-3xl font-extrabold tracking-[-0.04em] uppercase">
            Movie match
          </p>
          <p className="text-muted mx-auto mt-4 max-w-sm text-lg">
            {verdictCopy(target)}
          </p>
          <p className="text-subtle mt-7 text-xs">
            {verdict.playerNames.join(" × ")}
          </p>
        </section>

        <div className="border-border divide-border divide-y border-y">
          <Reveal>
            <div className="grid grid-cols-2 gap-8 py-12">
              <Metric
                label="Taste match"
                value={`${Math.round(verdict.tasteScore)}%`}
              />
              <Metric
                label="Movie knowledge"
                value={`${Math.round(verdict.knowledgeScore)}%`}
                tone="purple"
              />
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <p className="text-label text-muted">
                {verdict.playerNames.length > 2
                  ? "Movies everyone has seen"
                  : "Movies both seen"}
              </p>
              <p className="font-display text-accent mt-4 text-8xl font-black tracking-[-0.06em]">
                {verdict.moviesBothSeen}
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <p className="text-label text-purple">Your movie personality</p>
              <h2 className="font-display text-accent mt-5 text-[clamp(2.5rem,13vw,3rem)] leading-[0.86] font-black tracking-[-0.05em] break-words uppercase">
                {verdict.personality.displayName}
              </h2>
              <p className="text-foreground mt-5 max-w-md text-lg leading-relaxed">
                {verdict.personality.description}
              </p>
              <ul className="text-muted mt-7 space-y-2 text-sm leading-relaxed">
                {verdict.personality.reasons.map((reason) => (
                  <li className="border-border border-l-2 pl-4" key={reason}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <h2 className="font-display text-4xl font-extrabold uppercase">
                Shared favourites
              </h2>
              <PosterStrip movies={verdict.sharedFavourites} />
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <p className="text-label text-purple">Biggest disagreement</p>
              {verdict.disagreement ? (
                <>
                  <h2 className="font-display mt-5 text-[clamp(2.5rem,13vw,3rem)] leading-[0.86] font-black tracking-[-0.05em] break-words uppercase">
                    {verdict.disagreement.movie.title}
                  </h2>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    {verdict.disagreement.reactions.slice(0, 2).map((item) => (
                      <div key={item.name}>
                        <p className="text-muted text-sm">{item.name}</p>
                        <p className="font-display mt-1 text-3xl font-bold uppercase">
                          {reactionLabel[item.reaction]}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted mt-8 italic">
                    “this conversation is between you two.”
                  </p>
                </>
              ) : (
                <p className="text-muted mt-5">
                  No dramatic disagreements. Slightly disappointing.
                </p>
              )}
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <p className="text-label text-muted">Who knows movies?</p>
              <h2 className="font-display text-accent mt-5 text-[clamp(3rem,16vw,3.75rem)] leading-[0.85] font-black break-words uppercase">
                {verdict.knowledgeWinner ?? "It's a tie"}
              </h2>
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <p className="text-label text-purple">Picked for you</p>
              <h2 className="font-display mt-3 text-4xl font-extrabold uppercase">
                My watchlist
              </h2>
              <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
                Movies your friends rate highly that you have not marked as
                seen.
              </p>
              <PosterStrip movies={verdict.myWatchlist} />
              {verdict.isAuthenticated && verdict.myWatchlist.length ? (
                <form action={savePersonalGameWatchlistAction} className="mt-7">
                  <input
                    name="inviteCode"
                    type="hidden"
                    value={verdict.inviteCode}
                  />
                  <Button
                    disabled={verdict.myWatchlistSaved}
                    fullWidth
                    type="submit"
                  >
                    {verdict.myWatchlistSaved
                      ? "Saved to my watchlist"
                      : "Add to watchlist"}
                  </Button>
                </form>
              ) : null}
              {!verdict.isAuthenticated ? (
                <p className="border-purple/40 text-muted mt-7 border-l-2 pl-4 text-sm leading-relaxed">
                  Playing as a guest. Create an account to save these
                  permanently.
                </p>
              ) : null}
            </div>
          </Reveal>
          <Reveal>
            <div className="py-14">
              <p className="text-label text-muted">The group assignment</p>
              <h2 className="font-display mt-3 text-4xl font-extrabold uppercase">
                Our watchlist
              </h2>
              <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
                The strongest recommendations across everyone in this game.
              </p>
              <PosterStrip movies={verdict.ourWatchlist} />
              {verdict.isAuthenticated && verdict.ourWatchlist.length ? (
                <form action={saveSharedGameWatchlistAction} className="mt-7">
                  <input
                    name="inviteCode"
                    type="hidden"
                    value={verdict.inviteCode}
                  />
                  <Button
                    disabled={verdict.ourWatchlistSaved}
                    fullWidth
                    type="submit"
                    variant="purple"
                  >
                    {verdict.ourWatchlistSaved
                      ? "Our watchlist saved"
                      : "Save our watchlist"}
                  </Button>
                </form>
              ) : null}
            </div>
          </Reveal>
        </div>

        {!verdict.isAuthenticated ? (
          <Reveal>
            <section className="border-purple/40 mt-14 border-y py-12 text-center">
              <p className="text-label text-purple">Keep the evidence</p>
              <h2 className="font-display mt-4 text-[clamp(2.5rem,13vw,3rem)] leading-[0.9] font-black uppercase">
                Save your movie profile
              </h2>
              <p className="text-muted mt-5">
                You&apos;ve already rated {verdict.moviesRated} movies.
              </p>
              <Link
                className="bg-accent text-background mt-8 inline-flex min-h-14 items-center rounded-md px-7 text-sm font-extrabold uppercase"
                href={`/auth?next=${encodeURIComponent(`/results/${verdict.inviteCode}`)}`}
              >
                Create account
              </Link>
            </section>
          </Reveal>
        ) : null}

        <Reveal>
          <div className="grid gap-3 pt-16">
            {challengesEnabled && verdict.isAuthenticated ? (
              <form action={createChallengeAction}>
                <input
                  name="inviteCode"
                  type="hidden"
                  value={verdict.inviteCode}
                />
                <button
                  className="bg-accent text-background min-h-14 w-full rounded-md text-sm font-extrabold uppercase"
                  type="submit"
                >
                  Challenge someone
                </button>
              </form>
            ) : challengesEnabled ? (
              <Link
                className="bg-accent text-background flex min-h-14 items-center justify-center rounded-md text-sm font-extrabold uppercase"
                href={`/auth?next=${encodeURIComponent(`/results/${verdict.inviteCode}`)}`}
              >
                Sign up to challenge
              </Link>
            ) : null}
            <ShareResultCard inviteCode={verdict.inviteCode} />
            <Link
              className="border-border flex min-h-14 items-center justify-center rounded-md border text-sm font-bold uppercase"
              href="/games/new"
            >
              Play again
            </Link>
            <Link
              className="text-muted hover:text-foreground flex min-h-12 items-center justify-center text-sm font-bold uppercase transition-colors"
              href="/"
            >
              Home
            </Link>
          </div>
        </Reveal>
      </div>
    </main>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "purple";
  value: string;
}) {
  return (
    <div>
      <p className="text-label text-muted">{label}</p>
      <p
        className={`font-display mt-4 text-5xl font-black tracking-[-0.05em] ${tone ? "text-purple" : "text-accent"}`}
      >
        {value}
      </p>
    </div>
  );
}
