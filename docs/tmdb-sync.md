# TMDB movie sync

The movie sync builds and stores vidi's curated MVP movie pool. It uses movie endpoints only; television data is never requested.

## Before running

1. Apply the migrations in `supabase/migrations` to the target Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the target project.
4. Set `TMDB_ACCESS_TOKEN` (preferred) or `TMDB_API_KEY`.

The service-role key and TMDB credentials are server secrets. Never prefix them with `NEXT_PUBLIC_`, commit `.env.local`, or invoke the ingestion service from a Client Component.

## Commands

```bash
# Build a 4,000-film pool and ingest it
npm run movies

# Verify pool selection without writing to Supabase
npm run movies -- --dry-run

# Small end-to-end development run
npm run movies -- --limit=25

# Choose a pool size (supported range: 3,000–5,000)
npm run movies -- --target=3500

# Start over with a newly selected pool
npm run movies -- --reset
```

Concurrency defaults to four workers and is capped at eight:

```bash
npm run movies -- --concurrency=6
```

## How selection works

The pool combines:

- current and enduring popular movies;
- highly rated movies with meaningful vote counts;
- decade-aware discovery from the 1950s onward;
- major franchise and culturally important anchor films;
- recommendations and similar films around those anchors;
- popular Japanese animated films.

Candidates are deduplicated and ranked using source coverage, vote volume, rating, popularity, poster availability, and release metadata. Adult titles and video releases are rejected. International films can qualify through recognition and quality, but the MVP does not add a dedicated Nollywood or obscure-world-cinema collection.

## API and database behavior

- TMDB responses are validated with Zod before normalization.
- Requests start at most eight times per second, comfortably below TMDB's approximate upper limit.
- `429` and server failures use `Retry-After` where available and exponential backoff otherwise.
- Movie details, keywords, and credits are fetched together with `append_to_response` to reduce API traffic and retain director and franchise diversity signals.
- Movie, genre, keyword, and join-table writes are idempotent upserts.
- Stale genre and keyword links are removed only after current links have been stored.
- A failed film does not stop the remaining pool.

The script writes its checkpoint to `.cache/vidi/movie-sync-state.json`. Successful TMDB IDs are skipped on later runs, while failed IDs are retried. The directory is ignored by Git.

## Updating the pool

Rerunning the command refreshes details for IDs not yet marked complete. Use `--reset` when intentionally rebuilding the candidate pool from current TMDB rankings. For a full metadata refresh of all existing IDs, reset the checkpoint and run the sync again. After applying a migration that adds cached TMDB fields, run `npm run movies -- --reset` once so existing films receive those fields.
