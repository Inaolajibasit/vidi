"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import PixelBlast from "@/components/ui/PixelBlast";
import {
  startChallengeAction,
  trackChallengeOpenedAction,
} from "@/features/challenges/actions";
import type { ChallengeData } from "@/features/challenges/data";

import { Button } from "@/components/ui/button";
import { useFeedbackAction } from "@/lib/hooks/use-feedback-action";

const modeNames = {
  no_life: "No Life",
  proper: "Proper",
  quick: "Quick",
} as const;

export function ChallengeExperience({
  challenge,
}: {
  challenge: ChallengeData;
}) {
  const [state, action, pending] = useActionState(startChallengeAction, {});
  const { pending: sharing, run } = useFeedbackAction();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const key = `vidi:challenge-opened:${challenge.code}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackChallengeOpenedAction(challenge.code);
  }, [challenge.code]);

  function shareChallenge() {
    return run(
      "share",
      async () => {
        if (navigator.share) {
          await navigator.share({
            text: `${challenge.creator.displayName} challenged you. Think you know movies better?`,
            title: "A vidi movie challenge",
            url: window.location.href,
          });
          return "Challenge shared.";
        }
        await navigator.clipboard.writeText(window.location.href);
        return "Challenge link copied.";
      },
      "Couldn't share the challenge. Please try again.",
    );
  }

  return (
    <main className="editorial-screen font-ui bg-background relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 opacity-35">
        <PixelBlast
          color="#2227F7"
          enableRipples={!reduceMotion}
          patternDensity={0.68}
          patternScale={2.6}
          pixelSize={5}
          speed={reduceMotion ? 0 : 0.13}
          transparent
          variant="square"
        />
      </div>
      <div className="bg-background/25 absolute inset-0 backdrop-blur-[1px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex items-center justify-between">
          <Link className="font-accent text-accent text-2xl" href="/">
            vidi<span className="text-purple">.</span>
          </Link>
          <span className="text-label text-muted">Movie challenge</span>
        </header>

        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 flex-col justify-center py-12"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Avatar
            className="border-accent shadow-[5px_5px_0_#2227F7]"
            name={challenge.creator.displayName}
            size="xl"
            src={challenge.creator.avatarUrl ?? undefined}
          />
          <p className="text-label text-purple mt-8">
            {challenge.creator.displayName} challenged you
          </p>
          <h1 className="font-display mt-4 text-[clamp(4.5rem,22vw,7.5rem)] leading-[0.76] tracking-[-0.055em] uppercase">
            Think you
            <span className="block">know movies</span>
            <span className="text-accent block">better?</span>
          </h1>
          <div className="border-foreground/20 mt-8 flex items-center justify-between border-y py-4 text-sm">
            <span>{modeNames[challenge.mode]}</span>
            <span className="text-muted">
              {challenge.movieCount} movies · same deck
            </span>
          </div>

          <form action={action} className="mt-8 grid gap-3">
            <input name="code" type="hidden" value={challenge.code} />
            <label className="text-label text-muted" htmlFor="challenge-name">
              Your name
            </label>
            <input
              autoComplete="nickname"
              className="border-foreground/30 bg-background/80 focus:border-accent min-h-14 rounded-sm border px-4 text-base font-bold outline-none"
              id="challenge-name"
              maxLength={50}
              name="displayName"
              placeholder="What should we call you?"
              required
            />
            {state.message ? (
              <p aria-live="polite" className="text-danger text-sm">
                {state.message}
              </p>
            ) : null}
            <Button
              className="bg-accent text-background mt-2 min-h-14 rounded-sm text-sm font-extrabold uppercase shadow-[5px_5px_0_#2227F7] transition-transform active:scale-[0.97] disabled:opacity-50"
              disabled={pending}
              loadingLabel="Building your deck…"
              type="submit"
            >
              {pending ? "Building your deck…" : "Start challenge"}
            </Button>
          </form>
          <Button
            className="border-foreground/30 mt-3 flex min-h-12 items-center justify-center gap-2 rounded-sm border text-xs font-bold uppercase"
            loading={Boolean(sharing)}
            loadingLabel="Opening share…"
            onClick={shareChallenge}
            variant="outline"
            type="button"
          >
            <Icon name="copy" size={16} />
            Share challenge
          </Button>
        </motion.section>
      </div>
    </main>
  );
}
