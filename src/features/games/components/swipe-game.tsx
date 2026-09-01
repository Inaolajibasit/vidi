"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { ProgressBar } from "@/components/ui/progress-bar";
import {
  ensureGameResultsAction,
  recordAnswerAction,
} from "@/features/games/gameplay-actions";
import type {
  GameplayData,
  GameplayMovie,
} from "@/features/games/gameplay-data";
import { cn } from "@/lib/utils";
import type { MovieReaction } from "@/types/database";

const SWIPE_DISTANCE = 88;
const FLICK_DISTANCE = 32;
const FLICK_VELOCITY = 700;
const COMMENTS = ["valid.", "interesting.", "counts. barely."];

const REACTIONS: Array<{
  emoji: string;
  label: string;
  value: MovieReaction;
}> = [
  { emoji: "❤️", label: "Love", value: "loved" },
  { emoji: "👍", label: "Like", value: "liked" },
  { emoji: "😐", label: "Meh", value: "meh" },
  { emoji: "🤔", label: "Can't remember", value: "cant_remember" },
];

type Direction = -1 | 1;

const subscribeToBrowser = () => () => undefined;
const getBrowserSnapshot = () => true;
const getServerSnapshot = () => false;

function shouldCommitSwipe(offset: number, velocity: number) {
  return (
    Math.abs(offset) >= SWIPE_DISTANCE ||
    (Math.abs(offset) >= FLICK_DISTANCE && Math.abs(velocity) >= FLICK_VELOCITY)
  );
}

export function SwipeGame({ game }: { game: GameplayData }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(game.currentIndex);
  const [reactionPending, setReactionPending] = useState(game.reactionPending);
  const [direction, setDirection] = useState<Direction>(1);
  const [comment, setComment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsReady, setResultsReady] = useState(
    game.status === "completed",
  );
  const [resultsState, setResultsState] = useState<
    "waiting" | "processing" | "error"
  >("waiting");
  const [draggingRight, setDraggingRight] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<MovieReaction | null>(
    null,
  );
  const persistenceQueue = useRef(Promise.resolve());
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsCheckPending = useRef(false);
  const reactionDock = useRef<HTMLDivElement>(null);
  const gestureX = useMotionValue(0);
  const unseenBackground = useTransform(
    gestureX,
    [-140, -24, 0],
    [0.3, 0.06, 0],
  );
  const seenBackground = useTransform(gestureX, [0, 24, 140], [0, 0.06, 0.24]);
  const dockOpacity = useTransform(gestureX, [12, 54, 110], [0, 0.5, 1]);
  const currentMovie = game.movies[currentIndex];
  const complete = game.complete || currentIndex >= game.movies.length;

  useEffect(() => {
    const nextPoster = game.movies[currentIndex + 1]?.posterUrl;
    if (!nextPoster) return;

    const image = new window.Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    image.src = nextPoster;
    void image.decode().catch(() => undefined);
  }, [currentIndex, game.movies]);

  useEffect(
    () => () => {
      if (commentTimer.current) clearTimeout(commentTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!complete || resultsReady) return;
    const check = async () => {
      if (resultsCheckPending.current) return;
      resultsCheckPending.current = true;
      try {
        // The UI reaches the end optimistically. Wait until the final queued
        // answer is committed before checking whether every player finished.
        await persistenceQueue.current;
        const status = await ensureGameResultsAction(game.inviteCode);
        if (status === "ready") setResultsReady(true);
        else setResultsState(status);
      } finally {
        resultsCheckPending.current = false;
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 1000);
    return () => window.clearInterval(interval);
  }, [complete, game.inviteCode, resultsReady]);

  function persist(
    movie: GameplayMovie,
    seen: boolean,
    reaction: MovieReaction | null,
  ) {
    persistenceQueue.current = persistenceQueue.current.then(async () => {
      const result = await recordAnswerAction({
        inviteCode: game.inviteCode,
        reaction,
        seen,
        tmdbId: movie.tmdbId,
      });
      if (!result.success) {
        setError(result.error ?? "Your answer didn't save.");
        router.refresh();
      }
    });
  }

  function showOccasionalComment(completedCount: number) {
    if (completedCount === 0 || completedCount % 11 !== 0) return;
    setComment(COMMENTS[(completedCount / 11 - 1) % COMMENTS.length]);
    if (commentTimer.current) clearTimeout(commentTimer.current);
    commentTimer.current = setTimeout(() => setComment(null), 900);
  }

  function advance(
    movie: GameplayMovie,
    seen: boolean,
    reaction: MovieReaction | null,
  ) {
    persist(movie, seen, reaction);
    const completedCount = currentIndex + 1;
    showOccasionalComment(completedCount);
    setReactionPending(false);
    setCurrentIndex(completedCount);
  }

  function answerUnseen() {
    if (!currentMovie || reactionPending) return;
    setDirection(-1);
    advance(currentMovie, false, null);
  }

  function answerSeen() {
    if (!currentMovie || reactionPending) return;
    setDirection(1);
    persist(currentMovie, true, null);
    setReactionPending(true);
  }

  function answerReaction(reaction: MovieReaction) {
    if (!currentMovie || !reactionPending) return;
    setDirection(1);
    advance(currentMovie, true, reaction);
  }

  function reactionAtPoint(point: { x: number; y: number }) {
    if (!reactionDock.current) return null;
    const slots =
      reactionDock.current.querySelectorAll<HTMLElement>("[data-reaction]");
    for (const slot of slots) {
      const rect = slot.getBoundingClientRect();
      const horizontalSlop = 28;
      if (
        point.x >= rect.left - horizontalSlop &&
        point.x <= rect.right + horizontalSlop &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      ) {
        return slot.dataset.reaction as MovieReaction;
      }
    }
    return null;
  }

  function handleDrag(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    gestureX.set(info.offset.x);
    const movingRight = info.offset.x > 18;
    setDraggingRight(movingRight);
    setHoveredReaction(
      movingRight && info.offset.x >= 54 ? reactionAtPoint(info.point) : null,
    );
  }

  function handleDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    const selectedReaction =
      info.offset.x >= 54 ? reactionAtPoint(info.point) : null;
    gestureX.set(0);
    setDraggingRight(false);
    setHoveredReaction(null);

    if (!shouldCommitSwipe(info.offset.x, info.velocity.x)) return;
    if (info.offset.x < 0) answerUnseen();
    else if (selectedReaction && currentMovie) {
      setDirection(1);
      advance(currentMovie, true, selectedReaction);
    } else answerSeen();
  }

  if (complete || !currentMovie) {
    return (
      <main className="editorial-screen font-ui page-container grid min-h-dvh max-w-lg place-items-center py-12 text-center">
        <div>
          <p className="text-label text-purple mb-5">Deck complete</p>
          <h1 className="text-display-lg">
            That&apos;s
            <span className="text-accent block">your lot.</span>
          </h1>
          <p className="text-muted mt-6 leading-6">
            {resultsReady
              ? "The verdict is ready."
              : resultsState === "processing"
                ? "Everyone is done. Putting the verdict together."
                : resultsState === "error"
                  ? "Still reconnecting. Your answers are safely queued."
                  : "Your answers are saved. Waiting for everyone else to finish."}
          </p>
          {!resultsReady ? (
            <div className="mt-9 flex flex-col items-center" role="status" aria-live="polite">
              <motion.div
                animate={reduceMotion ? undefined : { rotate: 360 }}
                className="border-muted/30 border-t-accent size-11 rounded-full border-2"
                transition={{ duration: 0.8, ease: "linear", repeat: Infinity }}
              />
              <span className="text-label text-muted mt-4">Preparing results</span>
            </div>
          ) : (
            <motion.button
              animate={{ opacity: 1, y: 0 }}
              className="bg-accent text-background mt-9 inline-flex min-h-14 cursor-pointer items-center rounded-md px-7 text-sm font-extrabold tracking-[0.05em] uppercase"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              onClick={() => router.push(`/results/${game.inviteCode}`)}
              type="button"
            >
              Show results
            </motion.button>
          )}
        </div>
      </main>
    );
  }

  const progress = (currentIndex / game.movies.length) * 100;

  return (
    <main className="font-ui bg-background relative min-h-dvh overflow-hidden">
      <motion.div
        aria-hidden="true"
        className="bg-danger pointer-events-none fixed inset-0"
        style={{ opacity: unseenBackground }}
      />
      <motion.div
        aria-hidden="true"
        className="bg-accent pointer-events-none fixed inset-0"
        style={{ opacity: seenBackground }}
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="mb-3 flex items-center justify-between">
          <Link
            aria-label="vidi home"
            className="font-accent text-accent tap-target flex items-center text-2xl tracking-[-0.05em]"
            href="/"
          >
            vidi<span className="text-purple">.</span>
          </Link>
          <p
            className="font-display text-xl font-bold tabular-nums"
            aria-live="polite"
          >
            {currentIndex + 1}{" "}
            <span className="text-muted">/ {game.movies.length}</span>
          </p>
        </header>
        <ProgressBar className="mb-4" label="" value={progress} />

        <section
          className="relative flex min-h-0 flex-1 flex-col justify-center"
          aria-label="Movie deck"
        >
          <ReactionDock
            dockOpacity={dockOpacity}
            dragging={draggingRight}
            hoveredReaction={hoveredReaction}
            onSelect={answerReaction}
            pending={reactionPending}
            ref={reactionDock}
          />
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <MovieSwipeCard
              direction={direction}
              key={currentMovie.tmdbId}
              movie={currentMovie}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              reactionPending={reactionPending}
              reduceMotion={Boolean(reduceMotion)}
            />
          </AnimatePresence>

          <AnimatePresence>
            {comment ? (
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="bg-purple text-background pointer-events-none absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-bold"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 4 }}
                role="status"
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
              >
                {comment}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </section>

        <div className="mt-4 min-h-31">
          <AnimatePresence mode="wait" initial={false}>
            {reactionPending ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-28 items-center justify-center text-center"
                exit={{ opacity: 0, y: 6 }}
                initial={{ opacity: 0, y: 6 }}
                key="reactions"
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
              >
                <p className="text-label text-muted max-w-40 leading-5">
                  Pick a reaction from the right
                </p>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3"
                exit={{ opacity: 0, y: 6 }}
                initial={{ opacity: 0, y: 6 }}
                key="answers"
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
              >
                <button
                  className="border-border text-foreground min-h-14 cursor-pointer rounded-md border px-3 text-xs font-bold tracking-[0.05em] uppercase active:scale-[0.98]"
                  onClick={answerUnseen}
                  type="button"
                >
                  Haven&apos;t seen
                </button>
                <button
                  className="bg-accent text-background min-h-14 cursor-pointer rounded-md px-3 text-sm font-extrabold tracking-[0.06em] uppercase active:scale-[0.98]"
                  onClick={answerSeen}
                  type="button"
                >
                  Seen
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <p
            aria-live="assertive"
            className="text-danger mt-2 min-h-5 text-center text-xs"
            role={error ? "alert" : undefined}
          >
            {error}
          </p>
        </div>
      </div>
    </main>
  );
}

interface ReactionDockProps {
  dockOpacity: MotionValue<number>;
  dragging: boolean;
  hoveredReaction: MovieReaction | null;
  onSelect: (reaction: MovieReaction) => void;
  pending: boolean;
}

const ReactionDock = forwardRef<HTMLDivElement, ReactionDockProps>(
  function ReactionDock(
    { dockOpacity, dragging, hoveredReaction, onSelect, pending },
    ref,
  ) {
    const mounted = useSyncExternalStore(
      subscribeToBrowser,
      getBrowserSnapshot,
      getServerSnapshot,
    );
    const visible = dragging || pending;

    if (!mounted) return null;

    return createPortal(
      <motion.div
        animate={pending ? { opacity: 1 } : undefined}
        aria-hidden={!visible}
        aria-label="Movie reaction"
        className={cn(
          "fixed top-1/2 right-0 [isolation:isolate] z-[100] grid w-31 -translate-y-1/2 gap-2",
          pending ? "pointer-events-auto" : "pointer-events-none",
        )}
        initial={false}
        ref={ref}
        role="group"
        style={pending ? undefined : { opacity: dockOpacity }}
        transition={{ bounce: 0, duration: 0.18, type: "spring" }}
      >
        {REACTIONS.map((reaction) => {
          const selected = hoveredReaction === reaction.value;
          return (
            <motion.button
              aria-label={reaction.label}
              animate={{
                opacity: selected ? 1 : pending ? 0.92 : 0.72,
                scale: selected ? 1.06 : 1,
                x: selected ? -8 : 0,
              }}
              className={cn(
                "flex min-h-13 cursor-pointer items-center justify-center rounded-l-md border px-3 text-center font-extrabold shadow-lg backdrop-blur-md transition-colors",
                selected
                  ? "border-accent bg-accent text-background"
                  : "border-border bg-background/88 text-foreground hover:border-accent",
              )}
              data-reaction={reaction.value}
              key={reaction.value}
              onClick={() => onSelect(reaction.value)}
              tabIndex={pending ? 0 : -1}
              transition={{ bounce: 0, duration: 0.14, type: "spring" }}
              type="button"
            >
              {selected ? (
                <span className="text-[0.65rem] tracking-[0.07em] uppercase">
                  {reaction.label}
                </span>
              ) : (
                <span aria-hidden="true" className="text-xl leading-none">
                  {reaction.emoji}
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.div>,
      document.body,
    );
  },
);

interface MovieSwipeCardProps {
  direction: Direction;
  movie: GameplayMovie;
  onDrag: (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  onDragEnd: (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  reactionPending: boolean;
  reduceMotion: boolean;
}

function MovieSwipeCard({
  direction,
  movie,
  onDrag,
  onDragEnd,
  reactionPending,
  reduceMotion,
}: MovieSwipeCardProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-7, 0, 7]);
  const unseenOpacity = useTransform(x, [-100, -30, 0], [1, 0.2, 0]);
  const seenOpacity = useTransform(x, [0, 30, 100], [0, 0.2, 1]);

  return (
    <motion.article
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="border-border bg-surface relative z-10 mx-auto w-full touch-pan-y overflow-hidden rounded-sm border shadow-2xl shadow-black/40"
      custom={direction}
      drag={reactionPending ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.62}
      dragMomentum={false}
      exit={{
        opacity: 0,
        rotate: direction * 7,
        scale: 0.97,
        x: direction * 440,
      }}
      initial={{ opacity: 0, scale: 0.985, x: direction * 22 }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      style={{ rotate, x }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }
      }
      whileDrag={{ cursor: "grabbing", scale: 0.985 }}
    >
      <div className="bg-surface-strong relative h-[clamp(16rem,52dvh,34rem)] w-full shrink-0">
        {movie.posterUrl && !posterFailed ? (
          <Image
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover"
            draggable={false}
            height={1170}
            onError={() => setPosterFailed(true)}
            priority
            sizes="(max-width: 448px) calc(100vw - 2rem), 400px"
            src={movie.posterUrl}
            unoptimized
            width={780}
          />
        ) : (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <span className="font-display text-muted block text-4xl leading-none font-extrabold uppercase">
                {movie.title}
              </span>
              <span className="text-label text-subtle mt-5 block">
                Poster unavailable
              </span>
            </div>
          </div>
        )}
        <motion.span
          className="bg-background text-foreground absolute top-5 left-5 rounded-sm px-3 py-2 text-xs font-extrabold tracking-[0.08em] uppercase"
          style={{ opacity: unseenOpacity }}
        >
          Haven&apos;t seen
        </motion.span>
        <motion.span
          className="bg-accent text-background absolute top-5 right-5 rounded-sm px-3 py-2 text-xs font-extrabold tracking-[0.08em] uppercase"
          style={{ opacity: seenOpacity }}
        >
          Seen
        </motion.span>
      </div>
      <div className="flex min-h-22 items-end justify-between gap-4 p-4">
        <h1 className="text-title line-clamp-2">{movie.title}</h1>
        <p className="text-muted shrink-0 pb-0.5 text-right text-sm">
          {movie.releaseYear ?? "—"}
          <span className="block">{movie.genre}</span>
        </p>
      </div>
    </motion.article>
  );
}
