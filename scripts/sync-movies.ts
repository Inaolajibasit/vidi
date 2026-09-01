import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { buildCuratedMoviePool } from "@/lib/tmdb/curated-pool";
import { ingestMovies, syncMovieGenres } from "@/lib/tmdb/ingestion";

const STATE_VERSION = 1;
const STATE_DIRECTORY = path.join(process.cwd(), ".cache", "vidi");
const STATE_PATH = path.join(STATE_DIRECTORY, "movie-sync-state.json");

interface SyncState {
  completedTmdbIds: number[];
  failedTmdbIds: number[];
  poolTmdbIds: number[];
  target: number;
  updatedAt: string;
  version: number;
}

interface CliOptions {
  concurrency: number;
  dryRun: boolean;
  limit?: number;
  reset: boolean;
  target: number;
}

const logger = {
  error(message: string) {
    process.stderr.write(`${new Date().toISOString()} ERROR ${message}\n`);
  },
  info(message: string) {
    process.stdout.write(`${new Date().toISOString()} ${message}\n`);
  },
};

function integerArgument(name: string, fallback?: number): number | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix));
  if (!argument) return fallback;

  const value = Number(argument.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`--${name} must be a positive integer.`);
  return value;
}

function parseOptions(): CliOptions {
  const target =
    integerArgument("target", Number(process.env.MOVIE_SYNC_TARGET ?? 4_000)) ??
    4_000;
  if (target < 3_000 || target > 5_000)
    throw new Error("--target must be between 3000 and 5000.");

  const concurrency = integerArgument("concurrency", 4) ?? 4;
  if (concurrency > 8) throw new Error("--concurrency cannot exceed 8.");

  return {
    concurrency,
    dryRun: process.argv.includes("--dry-run"),
    limit: integerArgument("limit"),
    reset: process.argv.includes("--reset"),
    target,
  };
}

function emptyState(target: number): SyncState {
  return {
    completedTmdbIds: [],
    failedTmdbIds: [],
    poolTmdbIds: [],
    target,
    updatedAt: new Date().toISOString(),
    version: STATE_VERSION,
  };
}

async function loadState(target: number): Promise<SyncState> {
  try {
    const state = JSON.parse(await readFile(STATE_PATH, "utf8")) as SyncState;
    if (
      state.version !== STATE_VERSION ||
      state.target !== target ||
      !Array.isArray(state.poolTmdbIds)
    ) {
      logger.info(
        "Existing checkpoint does not match this sync configuration; starting a new pool.",
      );
      return emptyState(target);
    }
    return state;
  } catch (error) {
    const code =
      error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT")
      logger.error(
        `Could not read the checkpoint; starting clean. ${String(error)}`,
      );
    return emptyState(target);
  }
}

async function saveState(state: SyncState): Promise<void> {
  await mkdir(STATE_DIRECTORY, { recursive: true });
  const temporaryPath = `${STATE_PATH}.tmp`;
  state.updatedAt = new Date().toISOString();
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporaryPath, STATE_PATH);
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const options = parseOptions();

  if (options.reset) {
    await rm(STATE_PATH, { force: true });
    logger.info("Removed the previous movie-sync checkpoint.");
  }

  const state = await loadState(options.target);

  if (state.poolTmdbIds.length === 0) {
    logger.info(
      `Building a curated pool of approximately ${options.target} films.`,
    );
    const pool = await buildCuratedMoviePool(options.target, logger);
    state.poolTmdbIds = pool.map((candidate) => candidate.tmdbId);
    await saveState(state);
  } else {
    logger.info(`Resuming the saved ${state.poolTmdbIds.length}-movie pool.`);
  }

  const completed = new Set(state.completedTmdbIds);
  const remaining = state.poolTmdbIds.filter(
    (tmdbId) => !completed.has(tmdbId),
  );
  const selected = options.limit
    ? remaining.slice(0, options.limit)
    : remaining;

  logger.info(
    `Pool ready: ${state.poolTmdbIds.length} total, ${completed.size} previously stored, ${selected.length} selected this run.`,
  );

  if (options.dryRun) {
    logger.info("Dry run complete. No Supabase writes were attempted.");
    return;
  }

  const genreCount = await syncMovieGenres();
  logger.info(`Upserted ${genreCount} TMDB movie genres.`);

  let checkpointQueue = Promise.resolve();
  const result = await ingestMovies(selected, {
    concurrency: options.concurrency,
    logger,
    onMovieStored(tmdbId, runCompleted) {
      completed.add(tmdbId);
      if (runCompleted % 20 !== 0) return;

      checkpointQueue = checkpointQueue.then(async () => {
        state.completedTmdbIds = [...completed].sort((a, b) => a - b);
        await saveState(state);
      });
      return checkpointQueue;
    },
  });

  await checkpointQueue;
  result.succeeded.forEach((tmdbId) => completed.add(tmdbId));
  state.completedTmdbIds = [...completed].sort((a, b) => a - b);
  state.failedTmdbIds = result.failed
    .map((failure) => failure.tmdbId)
    .sort((a, b) => a - b);
  await saveState(state);

  logger.info(
    `Sync finished: ${result.succeeded.length} stored, ${result.failed.length} failed, ${result.skipped} skipped.`,
  );

  if (result.failed.length > 0) {
    logger.error(
      `Failed IDs are saved in ${STATE_PATH}; rerun npm run movies to retry them.`,
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
