"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { GameModeCard } from "@/components/ui/game-mode-card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { createGameAction } from "@/features/games/actions";
import { GAME_MODE_DETAILS } from "@/features/games/validation";
import { cn } from "@/lib/utils";
import type { GameMode } from "@/types/database";

const modes = ["quick", "proper", "no_life"] as const;
const playerCounts = [2, 3, 4, 5] as const;

interface CreateGameFormProps {
  authenticated: boolean;
  defaultDisplayName: string;
  genres: Array<{ name: string; tmdb_id: number }>;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      loadingLabel="Building deck…"
      disabled={pending}
      fullWidth
      size="lg"
      type="submit"
    >
      {pending ? "Building deck…" : "Create game"}
    </Button>
  );
}

export function CreateGameForm({
  authenticated,
  defaultDisplayName,
  genres,
}: CreateGameFormProps) {
  const [state, formAction] = useActionState(createGameAction, {});
  const [mode, setMode] = useState<GameMode>("quick");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const reduceMotion = useReducedMotion();

  return (
    <form action={formAction} className="grid gap-10 md:gap-12" noValidate>
      <input name="mode" type="hidden" value={mode} />
      <input name="maxPlayers" type="hidden" value={maxPlayers} />

      {!authenticated ? (
        <Input
          autoComplete="nickname"
          defaultValue={defaultDisplayName}
          error={state.fieldErrors?.displayName}
          label="Your name"
          maxLength={50}
          name="displayName"
          placeholder="What should friends call you?"
          required
        />
      ) : (
        <input name="displayName" type="hidden" value={defaultDisplayName} />
      )}

      <fieldset>
        <legend className="text-label text-muted mb-4">Game length</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {modes.map((value, index) => {
            const details = GAME_MODE_DETAILS[value];
            return (
              <motion.div
                key={value}
                initial={reduceMotion ? false : { opacity: 1, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  bounce: 0,
                  delay: reduceMotion ? 0 : index * 0.04,
                  duration: 0.3,
                  type: "spring",
                }}
              >
                <GameModeCard
                  aria-label={`${details.title}, ${details.movieCount} movies, ${details.duration}`}
                  description="Classic shared deck"
                  duration={details.duration}
                  movieCount={details.movieCount}
                  onClick={() => setMode(value)}
                  selected={mode === value}
                  title={details.title}
                />
              </motion.div>
            );
          })}
        </div>
        {state.fieldErrors?.mode ? (
          <p className="text-danger mt-2 text-sm">{state.fieldErrors.mode}</p>
        ) : null}
      </fieldset>

      <fieldset>
        <div className="mb-4 flex items-end justify-between gap-4">
          <legend className="text-label text-muted">Movie genres</legend>
          <span className="text-muted text-xs">
            {selectedGenres.length
              ? `${selectedGenres.length}/6 selected`
              : "Surprise me"}
          </span>
        </div>
        <p className="text-muted mb-5 text-sm leading-5">
          Pick a few directions, or leave everything open for the full mix.
        </p>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => {
            const selected = selectedGenres.includes(genre.tmdb_id);
            const disabled = !selected && selectedGenres.length >= 6;
            return (
              <label
                className={cn(
                  "tap-target inline-flex cursor-pointer items-center rounded-full border px-4 text-xs font-bold tracking-[0.04em] transition-colors",
                  selected
                    ? "border-purple bg-purple text-foreground"
                    : "border-border bg-surface text-muted hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-35",
                )}
                key={genre.tmdb_id}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={disabled}
                  name="genreIds"
                  onChange={() =>
                    setSelectedGenres((current) =>
                      selected
                        ? current.filter((id) => id !== genre.tmdb_id)
                        : [...current, genre.tmdb_id],
                    )
                  }
                  type="checkbox"
                  value={genre.tmdb_id}
                />
                {genre.name}
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.genreIds ? (
          <p className="text-danger mt-3 text-sm">
            {state.fieldErrors.genreIds}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="text-label text-muted mb-4">Maximum players</legend>
        <div className="grid grid-cols-4 gap-3">
          {playerCounts.map((count) => (
            <button
              aria-pressed={maxPlayers === count}
              className={cn(
                "tap-target h-14 cursor-pointer rounded-md border text-base font-bold transition-[color,background-color,border-color,transform] duration-(--duration-fast) active:scale-95",
                maxPlayers === count
                  ? "border-accent bg-accent text-[var(--text-inverse)]"
                  : "border-border bg-surface text-foreground hover:border-foreground/30",
              )}
              key={count}
              onClick={() => setMaxPlayers(count)}
              type="button"
            >
              {count}
            </button>
          ))}
        </div>
        {state.fieldErrors?.maxPlayers ? (
          <p className="text-danger mt-2 text-sm">
            {state.fieldErrors.maxPlayers}
          </p>
        ) : null}
      </fieldset>

      <section
        aria-labelledby="game-type-title"
        className="border-border border-y py-6"
      >
        <div className="flex items-start gap-4">
          <span className="bg-purple-soft text-purple grid size-10 shrink-0 place-items-center rounded-full">
            <Icon name="users" size={19} />
          </span>
          <div>
            <h2 className="text-sm font-bold" id="game-type-title">
              Classic mode
            </h2>
            <p className="text-muted mt-1 text-sm leading-5">
              Everyone gets the same movies. Fair, fast, mildly exposing.
            </p>
          </div>
        </div>
      </section>

      {state.message ? (
        <div
          className="border-danger/40 bg-danger/10 text-foreground rounded-md border p-4 text-sm leading-5"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
