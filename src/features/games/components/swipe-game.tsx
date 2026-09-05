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
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { ProgressBar } from "@/components/ui/progress-bar";
import Stack, { type StackDirection } from "@/components/ui/Stack";
import {
  ensureGameResultsAction,
  recordAnswerAction,
} from "@/features/games/gameplay-actions";
import type {
  GameplayData,
  GameplayMovie,
} from "@/features/games/gameplay-data";
import { cn } from "@/lib/utils";
import {
  removeConfirmedAnswer,
  resolveOptimisticResume,
  retryDelay,
  upsertOfflineAnswer,
  type OfflineAnswer,
} from "@/lib/algorithms/offline-answer-queue";
import type { MovieReaction } from "@/types/database";

const SWIPE_DISTANCE = 88;
const FLICK_DISTANCE = 32;
const FLICK_VELOCITY = 700;
const COMMENTS = ["valid.", "interesting.", "counts. barely."];
const POSTER_SIZES = "(max-width: 448px) calc(100vw - 2rem), 400px";

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

type SyncState = "offline" | "saved" | "syncing";

function ReactionIcon({ name }: { name: MovieReaction }) {
  const paths: Record<MovieReaction, ReactNode> = {
    loved: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.3l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    liked: (
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 11h10.3a2 2 0 0 0 2-1.7l1.4-9A2 2 0 0 0 18.7 9H14l.7-3.6A2.8 2.8 0 0 0 12 2l-5 9v11Z" />
    ),
    meh: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 10h.01M15.5 10h.01M8.5 15h7" />
      </>
    ),
    cant_remember: (
      <>
        <path d="M9.4 9a3 3 0 1 1 4.8 2.4c-1.4 1-2.2 1.6-2.2 3M12 18h.01" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="block h-6 w-6 shrink-0"
      fill="none"
      height="24"
      role="presentation"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
      style={{ color: "inherit", display: "block" }}
      vectorEffect="non-scaling-stroke"
      viewBox="0 0 24 24"
      width="24"
    >
      {paths[name]}
    </svg>
  );
}

const subscribeToBrowser = () => () => undefined;
const getBrowserSnapshot = () => true;
const getServerSnapshot = () => false;

function shouldCommitSwipe(offset: number, velocity: number) {
  return (
    Math.abs(offset) >= SWIPE_DISTANCE ||
    (Math.abs(offset) >= FLICK_DISTANCE && Math.abs(velocity) >= FLICK_VELOCITY)
  );
}

function triggerTactileFeedback(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}

export function SwipeGame({
  defaultLikeOnSwipe,
  game,
}: {
  defaultLikeOnSwipe: boolean;
  game: GameplayData;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(game.currentIndex);
  const [reactionPending, setReactionPending] = useState(game.reactionPending);
  const [comment, setComment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("saved");
  const [resultsReady, setResultsReady] = useState(game.status === "completed");
  const [resultsState, setResultsState] = useState<
    "waiting" | "processing" | "error"
  >("waiting");
  const [draggingRight, setDraggingRight] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<MovieReaction | null>(
    null,
  );
  const offlineQueue = useRef<OfflineAnswer[]>([]);
  const flushPromise = useRef<Promise<void> | null>(null);
  const flushQueueRef = useRef<() => Promise<void>>(async () => undefined);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsCheckPending = useRef(false);
  const reactionDock = useRef<HTMLDivElement>(null);
  const reactionRects = useRef<
    Array<{ reaction: MovieReaction; rect: DOMRect }>
  >([]);
  const committedReaction = useRef<MovieReaction | null>(null);
  const gestureX = useMotionValue(0);
  const unseenBackground = useTransform(
    gestureX,
    [-180, -30, 0],
    [0.36, 0.035, 0],
  );
  const seenBackground = useTransform(gestureX, [0, 30, 180], [0, 0.035, 0.32]);
  const dockOpacity = useTransform(gestureX, [8, 30, 90], [0, 0.82, 1]);
  const currentMovie = game.movies[currentIndex];
  const complete = game.complete || currentIndex >= game.movies.length;
  const storageKey = `vidi:answer-journal:${game.inviteCode}:${game.playerId}:v1`;

  const writeJournal = useCallback(
    (queue: readonly OfflineAnswer[]) => {
      try {
        if (queue.length)
          localStorage.setItem(storageKey, JSON.stringify(queue));
        else localStorage.removeItem(storageKey);
        return true;
      } catch {
        setError("This browser could not safely queue your answer.");
        return false;
      }
    },
    [storageKey],
  );

  const flushQueue = useCallback(async () => {
    if (flushPromise.current) return flushPromise.current;
    const run = async () => {
      if (!navigator.onLine) {
        setSyncState("offline");
        return;
      }
      while (offlineQueue.current.length) {
        setSyncState("syncing");
        const answer = offlineQueue.current[0];
        let result;
        try {
          result = await recordAnswerAction({
            inviteCode: game.inviteCode,
            reaction: answer.reaction,
            seen: answer.seen,
            tmdbId: answer.tmdbId,
          });
        } catch {
          result = { success: false };
        }
        if (!result.success) {
          setSyncState(navigator.onLine ? "syncing" : "offline");
          if (retryTimer.current) window.clearTimeout(retryTimer.current);
          retryTimer.current = window.setTimeout(
            () => void flushQueueRef.current(),
            retryDelay(retryAttempt.current++),
          );
          return;
        }
        retryAttempt.current = 0;
        offlineQueue.current = removeConfirmedAnswer(
          offlineQueue.current,
          answer,
        );
        writeJournal(offlineQueue.current);
        setQueuedCount(offlineQueue.current.length);
      }
      setSyncState("saved");
      setError(null);
    };
    flushPromise.current = run().finally(() => {
      flushPromise.current = null;
    });
    return flushPromise.current;
  }, [game.inviteCode, writeJournal]);

  useEffect(() => {
    flushQueueRef.current = flushQueue;
  }, [flushQueue]);

  useEffect(() => {
    let restored: OfflineAnswer[] = [];
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(raw)) {
        restored = raw.filter(
          (item): item is OfflineAnswer =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as OfflineAnswer).tmdbId === "number" &&
            typeof (item as OfflineAnswer).seen === "boolean" &&
            ((item as OfflineAnswer).reaction === null ||
              ["loved", "liked", "meh", "cant_remember"].includes(
                String((item as OfflineAnswer).reaction),
              )),
        );
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    const validMovieIds = new Set(
      game.movies.slice(game.currentIndex).map((movie) => movie.tmdbId),
    );
    offlineQueue.current = restored.filter((answer) =>
      validMovieIds.has(answer.tmdbId),
    );
    writeJournal(offlineQueue.current);
    setQueuedCount(offlineQueue.current.length);
    const resume = resolveOptimisticResume(
      game.movies.map((movie) => movie.tmdbId),
      game.currentIndex,
      game.reactionPending,
      offlineQueue.current,
    );
    setCurrentIndex(resume.currentIndex);
    setReactionPending(resume.reactionPending);
    setSyncState(
      navigator.onLine
        ? offlineQueue.current.length
          ? "syncing"
          : "saved"
        : "offline",
    );
    void flushQueue();

    const online = () => void flushQueue();
    const offline = () => setSyncState("offline");
    const visible = () =>
      document.visibilityState === "visible" && void flushQueue();
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, [
    flushQueue,
    game.currentIndex,
    game.movies,
    game.reactionPending,
    storageKey,
    writeJournal,
  ]);

  useEffect(() => {
    const nextPoster = game.movies[currentIndex + 1]?.posterUrl;
    if (!nextPoster) return;

    const { props } = getImageProps({
      alt: "",
      height: 1170,
      sizes: POSTER_SIZES,
      src: nextPoster,
      width: 780,
    });
    const image = new window.Image();
    image.decoding = "async";
    image.fetchPriority = "high";
    image.sizes = props.sizes ?? POSTER_SIZES;
    image.srcset = props.srcSet ?? "";
    image.src = props.src;
    void image.decode().catch(() => undefined);
  }, [currentIndex, game.movies]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      htmlScrollBehavior: html.style.scrollBehavior,
    };

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, scrollY);
      html.style.scrollBehavior = previous.htmlScrollBehavior;
    };
  }, []);

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
        await flushQueue();
        if (offlineQueue.current.length) return;
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
  }, [complete, flushQueue, game.inviteCode, resultsReady]);

  function persist(
    movie: GameplayMovie,
    seen: boolean,
    reaction: MovieReaction | null,
  ) {
    const next = upsertOfflineAnswer(offlineQueue.current, {
      createdAt: Date.now(),
      reaction,
      seen,
      tmdbId: movie.tmdbId,
    });
    if (!writeJournal(next)) return;
    offlineQueue.current = next;
    setQueuedCount(next.length);
    setSyncState(navigator.onLine ? "syncing" : "offline");
    void flushQueue();
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
    if (!reduceMotion) triggerTactileFeedback(7);
    advance(currentMovie, false, null);
  }

  function answerSeen() {
    if (!currentMovie || reactionPending) return;
    if (!reduceMotion) triggerTactileFeedback(7);
    persist(currentMovie, true, null);
    setReactionPending(true);
  }

  function answerReaction(reaction: MovieReaction) {
    if (!currentMovie || !reactionPending) return;
    if (!reduceMotion) triggerTactileFeedback(9);
    advance(currentMovie, true, reaction);
  }

  function reactionAtPoint(point: { x: number; y: number }) {
    for (const { reaction, rect } of reactionRects.current) {
      const horizontalSlop = 28;
      if (
        point.x >= rect.left - horizontalSlop &&
        point.x <= rect.right + horizontalSlop &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      ) {
        return reaction;
      }
    }
    return null;
  }

  function handleDragStart() {
    if (!reactionDock.current) return;
    reactionRects.current = Array.from(
      reactionDock.current.querySelectorAll<HTMLElement>("[data-reaction]"),
      (slot) => ({
        reaction: slot.dataset.reaction as MovieReaction,
        rect: slot.getBoundingClientRect(),
      }),
    );
  }

  function handleDrag(info: PanInfo) {
    gestureX.set(info.offset.x);
    const movingRight = info.offset.x > 18;
    setDraggingRight(movingRight);
    setHoveredReaction(
      movingRight && info.offset.x >= 54 ? reactionAtPoint(info.point) : null,
    );
  }

  function handleDragEnd(info: PanInfo) {
    const selectedReaction =
      info.offset.x >= 54 ? reactionAtPoint(info.point) : null;
    committedReaction.current = selectedReaction;
    gestureX.set(0);
    reactionRects.current = [];
    setDraggingRight(false);
    setHoveredReaction(null);
  }

  function handleStackSwipe(stackDirection: StackDirection, info: PanInfo) {
    if (
      !shouldCommitSwipe(info.offset.x, info.velocity.x) &&
      Math.abs(info.offset.x + info.velocity.x * 0.12) < SWIPE_DISTANCE * 1.35
    )
      return;
    if (stackDirection === "left") answerUnseen();
    else if (committedReaction.current && currentMovie) {
      if (!reduceMotion) triggerTactileFeedback(9);
      advance(currentMovie, true, committedReaction.current);
    } else if (defaultLikeOnSwipe && currentMovie) {
      if (!reduceMotion) triggerTactileFeedback(9);
      advance(currentMovie, true, "liked");
    } else answerSeen();
    committedReaction.current = null;
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
            {queuedCount > 0
              ? syncState === "offline"
                ? `${queuedCount} answer${queuedCount === 1 ? " is" : "s are"} safely queued on this device. Reconnect to finish.`
                : `Syncing ${queuedCount} remaining answer${queuedCount === 1 ? "" : "s"}.`
              : resultsReady
                ? "The verdict is ready."
                : resultsState === "processing"
                  ? "Everyone is done. Putting the verdict together."
                  : resultsState === "error"
                    ? "Still reconnecting. Your answers are safely queued."
                    : "Your answers are saved. Waiting for everyone else to finish."}
          </p>
          {!resultsReady ? (
            <div
              className="mt-9 flex flex-col items-center"
              role="status"
              aria-live="polite"
            >
              <motion.div
                animate={reduceMotion ? undefined : { rotate: 360 }}
                className="border-muted/30 border-t-accent size-11 rounded-full border-2"
                transition={{ duration: 0.8, ease: "linear", repeat: Infinity }}
              />
              <span className="text-label text-muted mt-4">
                {queuedCount > 0 ? "Saving answers" : "Preparing results"}
              </span>
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
    <main className="font-ui bg-background relative h-dvh [touch-action:pan-x_pinch-zoom] overflow-hidden overscroll-none">
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
          <div className="flex items-center gap-3">
            <span
              aria-live="polite"
              className={cn(
                "text-label",
                syncState === "offline"
                  ? "text-danger"
                  : syncState === "syncing"
                    ? "text-accent"
                    : "text-muted",
              )}
            >
              {syncState === "offline"
                ? `Offline · ${queuedCount} queued`
                : syncState === "syncing"
                  ? `Syncing ${queuedCount}`
                  : "Saved"}
            </span>
            <p className="font-display text-xl font-bold tabular-nums">
              {currentIndex + 1}{" "}
              <span className="text-muted">/ {game.movies.length}</span>
            </p>
          </div>
        </header>
        <ProgressBar className="mb-4" label="" value={progress} />

        {syncState === "offline" ? (
          <p
            aria-live="polite"
            className="border-danger/60 bg-danger/10 mb-3 border-l-2 px-3 py-2 text-xs leading-5"
            role="status"
          >
            Offline. Keep playing—answers will sync when your connection
            returns.
          </p>
        ) : null}

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
          <Stack
            cards={game.movies
              .slice(currentIndex, currentIndex + 3)
              .map((movie, index) => ({
                id: movie.tmdbId,
                content: (
                  <MovieCardContent
                    gestureX={index === 0 ? gestureX : undefined}
                    movie={movie}
                    priority={index === 0 && currentIndex === game.currentIndex}
                  />
                ),
              }))}
            className="relative mx-auto w-full flex-1"
            disabled={reactionPending}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onSwipe={handleStackSwipe}
            reducedMotion={Boolean(reduceMotion)}
            sensitivity={SWIPE_DISTANCE}
            velocityThreshold={FLICK_VELOCITY}
          />

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

        <div className="mt-3 shrink-0">
          <AnimatePresence mode="wait" initial={false}>
            {reactionPending ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-14 items-center justify-center text-center"
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
                  className="font-accent border-border text-foreground min-h-14 cursor-pointer rounded-md border px-3 text-sm tracking-[0.02em] uppercase active:scale-[0.98]"
                  onClick={answerUnseen}
                  type="button"
                >
                  Haven&apos;t seen
                </button>
                <button
                  className="font-accent bg-accent text-background min-h-14 cursor-pointer rounded-md px-3 text-base tracking-[0.02em] uppercase active:scale-[0.98]"
                  onClick={answerSeen}
                  type="button"
                >
                  Seen
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {error ? (
            <p
              aria-live="assertive"
              className="text-danger mt-2 text-center text-xs"
              role="alert"
            >
              {error}
            </p>
          ) : null}
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
        {REACTIONS.map((reaction, index) => {
          const selected = hoveredReaction === reaction.value;
          return (
            <motion.button
              aria-label={reaction.label}
              animate={{
                opacity: selected ? 1 : pending ? 1 : 0.94,
                scale: selected ? 1.06 : 1,
                x: selected ? -8 : 0,
              }}
              className={cn(
                "flex min-h-13 cursor-pointer items-center justify-center rounded-l-md border px-3 text-center font-extrabold shadow-lg backdrop-blur-md transition-colors",
                selected
                  ? "border-accent bg-accent text-background"
                  : "border-muted/70 bg-background/95 text-foreground hover:border-accent",
              )}
              data-reaction={reaction.value}
              key={reaction.value}
              onClick={() => onSelect(reaction.value)}
              tabIndex={pending ? 0 : -1}
              transition={{
                bounce: selected ? 0.12 : 0,
                delay: pending ? index * 0.025 : 0,
                duration: 0.18,
                type: "spring",
              }}
              type="button"
            >
              {selected ? (
                <span className="font-accent text-[0.7rem] tracking-[0.02em] uppercase">
                  {reaction.label}
                </span>
              ) : (
                <ReactionIcon name={reaction.value} />
              )}
            </motion.button>
          );
        })}
      </motion.div>,
      document.body,
    );
  },
);

interface MovieCardContentProps {
  gestureX?: MotionValue<number>;
  movie: GameplayMovie;
  priority: boolean;
}

function MovieCardContent({
  gestureX: sharedX,
  movie,
  priority,
}: MovieCardContentProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const fallbackX = useMotionValue(0);
  const x = sharedX ?? fallbackX;
  const unseenOpacity = useTransform(x, [-104, -28, 0], [1, 0.12, 0]);
  const seenOpacity = useTransform(x, [0, 28, 104], [0, 0.12, 1]);
  const unseenWash = useTransform(x, [-180, -32, 0], [0.3, 0.03, 0]);
  const seenWash = useTransform(x, [0, 32, 180], [0, 0.03, 0.26]);
  const unseenLabelScale = useTransform(x, [-104, -28, 0], [1, 0.9, 0.88]);
  const seenLabelScale = useTransform(x, [0, 28, 104], [0.88, 0.9, 1]);
  const unseenLabelX = useTransform(x, [-104, 0], [0, -8]);
  const seenLabelX = useTransform(x, [0, 104], [8, 0]);

  return (
    <article className="border-border bg-surface relative flex h-full w-full touch-none flex-col overflow-hidden rounded-sm border shadow-2xl shadow-black/40">
      <div className="bg-surface-strong relative min-h-0 w-full flex-1">
        {movie.posterUrl && !posterFailed ? (
          <Image
            alt={`${movie.title} poster`}
            className="h-full w-full object-cover"
            draggable={false}
            height={1170}
            onError={() => setPosterFailed(true)}
            priority={priority}
            sizes={POSTER_SIZES}
            src={movie.posterUrl}
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
        <motion.div
          aria-hidden="true"
          className="bg-danger pointer-events-none absolute inset-0"
          style={{ opacity: unseenWash }}
        />
        <motion.div
          aria-hidden="true"
          className="bg-accent pointer-events-none absolute inset-0"
          style={{ opacity: seenWash }}
        />
        <motion.span
          className="font-accent bg-background text-foreground absolute top-5 left-5 rounded-sm px-3 py-2 text-xs tracking-[0.02em] uppercase"
          style={{
            opacity: unseenOpacity,
            scale: unseenLabelScale,
            x: unseenLabelX,
          }}
        >
          Haven&apos;t seen
        </motion.span>
        <motion.span
          className="font-accent bg-accent text-background absolute top-5 right-5 rounded-sm px-3 py-2 text-sm tracking-[0.02em] uppercase"
          style={{ opacity: seenOpacity, scale: seenLabelScale, x: seenLabelX }}
        >
          Seen
        </motion.span>
      </div>
      <div className="flex min-h-22 shrink-0 items-end justify-between gap-4 p-4">
        <h1 className="text-title line-clamp-2">{movie.title}</h1>
        <p className="text-muted shrink-0 pb-0.5 text-right text-sm">
          {movie.releaseYear ?? "—"}
          <span className="block">{movie.genre}</span>
        </p>
      </div>
    </article>
  );
}
