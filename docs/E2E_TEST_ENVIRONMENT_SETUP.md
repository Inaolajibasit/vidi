# vidi isolated E2E test environment

This runbook creates a disposable Supabase backend and Vercel deployment for
vidi's Playwright critical-path test. It is intentionally separate from
production because the test creates games, guest players, ratings, results, and
share images.

## Before you begin: rotate the exposed secret

The Supabase secret key previously shared in chat must be treated as exposed.
Do not paste it into this file, commit it, or continue using it.

1. Open the test project in Supabase.
2. Go to **Settings → API Keys**.
3. Create a new secret key.
4. Replace the old key anywhere it was already configured.
5. Verify the application works with the replacement.
6. Delete the exposed secret key.

The `sb_publishable_...` key is intended for browser use. The
`sb_secret_...` key bypasses Row Level Security and must remain server-only.

Official reference: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## What you will create

- Supabase project: `vidi-e2e`
- A separate Vercel project, also named something like `vidi-e2e`
- A local `.env.e2e.local` file that is never committed
- At least 30 eligible movies; 300 is a healthier test sample
- One isolated Playwright run using two browser contexts

Keep this information handy:

| Item                     | Value                                           |
| ------------------------ | ----------------------------------------------- |
| Supabase project URL     | `https://gugfrvtsjnflttgyreat.supabase.co`      |
| Supabase publishable key | Copy it again from **Settings → API Keys**      |
| Supabase secret key      | Use the newly rotated key; never record it here |
| TMDB credential          | API key or access token from your TMDB account  |
| Vercel test URL          | Fill this in after deployment                   |

## 1. Confirm the Supabase test project

If `vidi-e2e` has already been created, confirm that it is not the production
project. Otherwise:

1. Open the Supabase dashboard.
2. Select **New project**.
3. Name it `vidi-e2e`.
4. Generate a unique database password and save it in a password manager.
5. Choose the nearest practical region.
6. Wait until project provisioning completes.
7. Open **Settings → API Keys**.
8. Copy the project URL, publishable key, and newly rotated secret key into a
   password manager or temporary local environment file.

Do not use production credentials at any point in this guide.

## 2. Apply every database migration

The migrations are in [`supabase/migrations`](../supabase/migrations). Run them
in filename order. Later files depend on tables and functions created earlier.

### Apply a migration using SQL Editor

For each file below:

1. Open it locally in the editor.
2. Select and copy the complete file contents.
3. In Supabase, open **SQL Editor**.
4. Select **New query**.
5. Give the query a recognizable name, such as the migration filename.
6. Paste the SQL.
7. Select **Run** once.
8. Confirm that the query succeeds before continuing.

Run these files in this exact order:

1. `202608250001_initial_schema.sql`
2. `202608250002_create_game_rpc.sql`
3. `202608260001_gameplay_answers.sql`
4. `202608260002_deck_candidates.sql`
5. `202608310001_account_conversion.sql`
6. `202609010001_personality_system.sql`
7. `202609020001_friendships_security.sql`
8. `202609040001_google_profile_avatars.sql`
9. `202609040002_structured_watchlists.sql`
10. `202609040003_challenges.sql`
11. `202609040004_monthly_recap_foundation.sql`
12. `202609040005_product_analytics.sql`
13. `202609040006_fast_gameplay_answers.sql`
14. `202609050001_security_hardening.sql`
15. `202609050002_account_attention_reads.sql`

If one fails, stop. Save the exact filename and error message. Do not run the
remaining migrations against a partially prepared project.

### Verify the resulting schema

Run this query in SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Every application table in `public` should have `rowsecurity = true`.

Confirm the critical tables exist:

```sql
select to_regclass('public.games') as games,
       to_regclass('public.game_players') as game_players,
       to_regclass('public.game_movies') as game_movies,
       to_regclass('public.ratings') as ratings,
       to_regclass('public.compatibility_results') as compatibility_results,
       to_regclass('public.account_attention_reads') as attention_reads;
```

Each result should contain its table name rather than `null`.

Confirm the security and gameplay functions exist:

```sql
select routine_schema, routine_name
from information_schema.routines
where routine_schema in ('public', 'private')
  and routine_name in (
    'consume_request_rate_limit',
    'create_classic_game',
    'get_deck_candidates',
    'record_game_answer_by_identity',
    'results_visible'
  )
order by routine_schema, routine_name;
```

The security migration is mandatory. It prevents participants from reading
another player's raw answers before the game reaches `completed`, removes
direct rating mutations, and installs database-backed rate limiting.

## 3. Create the local test environment file

From the repository root, copy the example file:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.e2e.local
```

Edit `.env.e2e.local` and use this structure:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://gugfrvtsjnflttgyreat.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_TEST_PUBLISHABLE_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=PASTE_NEWLY_ROTATED_TEST_SECRET_KEY_HERE
TMDB_API_KEY=PASTE_TMDB_API_KEY_HERE
TMDB_ACCESS_TOKEN=PASTE_TMDB_ACCESS_TOKEN_HERE
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100
NEXT_PUBLIC_LEGAL_EMAIL=your-monitored-email@example.com
ANALYTICS_PROVIDER=disabled
ANALYTICS_HASH_SECRET=replace-with-at-least-32-random-characters
ENABLE_CHALLENGES=false
ENABLE_DEFAULT_LIKE_ON_SWIPE=false
MOVIE_SYNC_TARGET=3000
```

Notes:

- Use either `TMDB_API_KEY` or `TMDB_ACCESS_TOKEN`; providing both is fine.
- The existing code still expects the variable names
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, even when
  their values use Supabase's newer publishable and secret key formats.
- `MOVIE_SYNC_TARGET=300` is invalid in this repository. The sync script
  requires a target between 3,000 and 5,000.
- There must be no comments or extra words on credential lines.
- Never prefix the secret key with `NEXT_PUBLIC_`.

The repository ignores `.env*` except `.env.example`. Confirm the test file is
not tracked:

```powershell
git status --short
git check-ignore -v .env.e2e.local
git ls-files .env.e2e.local
```

Expected results:

- `git check-ignore` identifies the `.env*` rule.
- `git ls-files` prints nothing.

## 4. Load the test variables safely

The movie sync script loads `.env.local`; it does not automatically load
`.env.e2e.local`. Preserve any existing development `.env.local` before using
the test credentials.

```powershell
Copy-Item -LiteralPath .env.local -Destination .env.local.backup -ErrorAction SilentlyContinue
Copy-Item -LiteralPath .env.e2e.local -Destination .env.local -Force
```

Both files remain ignored by Git. Verify again with `git status --short`.

After syncing and testing locally, restore the previous file:

```powershell
if (Test-Path -LiteralPath .env.local.backup) {
  Move-Item -LiteralPath .env.local.backup -Destination .env.local -Force
}
```

Do not restore it until the local sync process has finished.

## 5. Populate the movie library

The application can create a Quick game with 30 eligible movies. A 300-movie
test sample gives deck generation enough variety without requiring the full
3,000-movie ingestion run.

First perform a dry run:

```powershell
npm.cmd run movies -- --dry-run --target=3000
```

Then ingest the first 300 selected movies:

```powershell
npm.cmd run movies -- --target=3000 --limit=300
```

The script stores a resumable checkpoint in `.cache/vidi/movie-sync-state.json`.
If TMDB throttles or the command is interrupted, rerun the same command. Do not
use `--reset` unless you intentionally want to discard the checkpoint.

Expected final output includes values similar to:

```text
Pool ready: 3000 total, 0 previously stored, 300 selected this run.
Sync finished: 300 stored, 0 failed, 0 skipped.
```

Some skipped or failed titles may be normal, but at least 30 eligible records
must exist. Verify in Supabase SQL Editor:

```sql
select count(*) as movies from public.movies;
select count(distinct movie_id) as movies_with_genres from public.movie_genres;
select count(distinct movie_id) as movies_with_keywords from public.movie_keywords;
```

Also verify deck candidates directly:

```sql
select count(*)
from public.get_deck_candidates(3000);
```

The candidate count must be at least 30 for the Quick test. Aim for 100 or
more so the diversity logic has room to work.

## 6. Create the isolated Vercel project

1. Push the branch you want to test to GitHub.
2. Sign in to Vercel.
3. Select **Add New → Project**.
4. Import the vidi repository.
5. Name the project `vidi-e2e` or another clearly non-production name.
6. Confirm the framework preset is **Next.js**.
7. Keep the repository root as the Root Directory.
8. Do not connect the project to the production Supabase environment.

Open **Project → Settings → Environment Variables** and add:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://gugfrvtsjnflttgyreat.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TEST_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=NEW_TEST_SECRET_KEY
TMDB_API_KEY=TMDB_API_KEY
TMDB_ACCESS_TOKEN=TMDB_ACCESS_TOKEN
NEXT_PUBLIC_APP_URL=https://YOUR-VIDI-E2E-DOMAIN.vercel.app
NEXT_PUBLIC_LEGAL_EMAIL=YOUR_EMAIL
ANALYTICS_PROVIDER=disabled
ANALYTICS_HASH_SECRET=AT_LEAST_32_RANDOM_CHARACTERS
ENABLE_CHALLENGES=false
ENABLE_DEFAULT_LIKE_ON_SWIPE=false
MOVIE_SYNC_TARGET=3000
```

Apply the variables only to the environment you are using for this isolated
deployment. Mark server credentials as sensitive where Vercel offers that
option. Environment changes apply only to new deployments, so redeploy after
editing them.

Official references:

- [Vercel project settings](https://vercel.com/docs/project-configuration/project-settings)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

## 7. Configure Supabase URLs for the test deployment

After Vercel provides the stable test URL:

1. Open Supabase **Authentication → URL Configuration**.
2. Set **Site URL** to the stable `vidi-e2e` Vercel URL.
3. Add these allowed redirect URLs, replacing the example domain:

```text
http://127.0.0.1:3100/**
http://localhost:3100/**
https://YOUR-VIDI-E2E-DOMAIN.vercel.app/auth/callback
https://YOUR-VIDI-E2E-DOMAIN.vercel.app/auth/confirm
```

Authentication is not required by the current guest E2E test, but correct URL
configuration prevents later authenticated tests from using production.

## 8. Deploy and smoke-test the environment

Deploy the selected branch. If the first generated domain differs from
`NEXT_PUBLIC_APP_URL`, update that variable and redeploy.

Before Playwright, manually verify in a private browser window:

1. Open the landing page.
2. Select **Create game**.
3. Enter a guest name.
4. Choose **Quick**.
5. Create the game.
6. Confirm the browser reaches `/join/XXXXXX`.
7. Confirm the lobby says `30 movies`.
8. Confirm no missing RPC, rate-limit, or movie-library error appears.

If game creation fails, inspect the Vercel function logs and Supabase Postgres
logs before running Playwright.

## 9. Install Playwright Chromium

From the vidi repository, run this once per Playwright version:

```powershell
npx.cmd playwright install chromium
```

Confirm the browser is available:

```powershell
npx.cmd playwright install --list
```

Official reference: [Playwright browsers](https://playwright.dev/docs/browsers)

## 10. Run the E2E critical path

Set the environment flags in the same PowerShell window:

```powershell
$env:VIDI_RUN_E2E = "true"
$env:VIDI_E2E_BASE_URL = "https://vidi-e2e.vercel.app"
npm.cmd run test:e2e
```

The test in [`tests/e2e/quick-game.spec.ts`](../tests/e2e/quick-game.spec.ts)
will:

1. Open two isolated browser contexts.
2. Create a Quick game as Player A.
3. Join as Player B.
4. Wait for realtime lobby synchronization.
5. Start the shared game.
6. Submit 30 unseen answers from each player.
7. Wait for results to unlock.
8. Open results for both players.
9. Confirm `Movie match` renders.
10. Request the story-format share card and confirm it is a PNG.

Success should end with:

```text
4 passed
```

If it reports `1 skipped`, either `VIDI_RUN_E2E` was not set to the exact string
`true`, or it was set in a different terminal session.

### Run only the 3–5-player group tests

The group suite creates three additional Quick games with 3, 4, and 5 players.
Each player uses a separate browser context, so guest cookies and sessions do
not overlap.

Use the same isolated deployment variables, then filter by the suite title:

```powershell
$env:VIDI_RUN_E2E = "true"
$env:VIDI_E2E_BASE_URL = "https://YOUR-VIDI-E2E-DOMAIN.vercel.app"
npm.cmd run test:e2e -- --grep "group Quick games"
```

Expected output:

```text
3 passed
```

For every group size, the test verifies:

1. The host creates a Quick room with the correct maximum player count.
2. Every guest joins with an isolated browser session.
3. Realtime updates make every guest visible in the host's lobby.
4. The host starts the game and all players reach the same play URL.
5. Every player submits all 30 answers.
6. All but the final player finish first, and results remain locked.
7. The final player answers the last card and unlocks the verdict.
8. Every player can open the completed verdict.
9. Movie match, personality, shared favourites, My watchlist, and Our
   watchlist render for every participant.
10. Every verdict includes the complete player roster.
11. The five-player result produces a valid PNG share card.

These tests can take several minutes because the largest case submits 150
answers to the deployed application. Do not run them against production. A
timeout of four minutes is configured per group size.

The latest verified group run against the isolated deployment completed with
`3 passed (2.6m)`: the 3-player case took 48.9 seconds, the 4-player case took
51.7 seconds, and the 5-player case took 53.7 seconds. Runtime can vary with
deployment cold starts and network conditions.

The final combined regression run on 5 September 2026 completed with
`4 passed (3.4m)`: 3 players in 53.6 seconds, 4 players in 49.1 seconds,
5 players in 54.0 seconds, and the original 2-player flow in 46.2 seconds.
Run the suite sequentially (`--workers=1`) so concurrent test games do not add
unnecessary load to the disposable backend.

To run one size while diagnosing a failure:

```powershell
npm.cmd run test:e2e -- --grep "3 players finish"
npm.cmd run test:e2e -- --grep "4 players finish"
npm.cmd run test:e2e -- --grep "5 players finish"
```

The all-unseen answer pattern deliberately makes the test focus on multiplayer
synchronization, completion, result availability, and group rendering. It does
not yet prove the mathematical correctness of different taste combinations;
that belongs in deterministic algorithm tests and a later scenario with a
controlled seeded deck.

Clear the temporary flags afterward:

```powershell
Remove-Item Env:VIDI_RUN_E2E -ErrorAction SilentlyContinue
Remove-Item Env:VIDI_E2E_BASE_URL -ErrorAction SilentlyContinue
```

## 11. Diagnose failures

Playwright stores artifacts under `test-results/playwright` when a test fails.

List the artifacts:

```powershell
Get-ChildItem -LiteralPath test-results/playwright -Recurse
```

Open a recorded trace:

```powershell
npx.cmd playwright show-trace "test-results/playwright/PATH-TO-trace.zip"
```

Official reference: [Playwright command line](https://playwright.dev/docs/test-cli)

Use the failure point to narrow the investigation:

| Failure                     | First checks                                                                    |
| --------------------------- | ------------------------------------------------------------------------------- |
| Create Game fails           | Movie candidate count, Vercel logs, `create_classic_game`, rate-limit migration |
| Player B does not appear    | Supabase Realtime status, broadcast subscription, deployment console errors     |
| Start button stays disabled | Both players joined the same invite and host page received the realtime refresh |
| Answers fail                | `record_game_answer_by_identity`, active game status, Vercel runtime logs       |
| Results never unlock        | Both players reached 30, game status, compatibility-result insert errors        |
| Results return 404          | Participant cookie was lost or result calculation did not reach `completed`     |
| Share card fails            | Share route logs, completed status, font files in deployment bundle             |
| Test times out              | Save the trace and note the last successful numbered step                       |

When reporting a failure, include:

- The full `npm.cmd run test:e2e` output
- The test deployment URL
- The failing step
- The trace ZIP path
- Relevant Vercel and Supabase log excerpts with all secrets removed

## 12. Verify the security invariant separately

The E2E test verifies the happy path. It does not itself prove that Player A
cannot query Player B's answers early.

Run the existing security probe only against this disposable Supabase project:

```powershell
npx.cmd tsx scripts/security-probe.ts
```

The probe must show that:

- During `active`, Player A sees only Player A's rating.
- During `waiting_results`, Player B's rating remains hidden.
- Direct client rating mutation is rejected.
- During `completed`, both participant ratings become visible.

Never point this probe at production because it creates and removes temporary
users and game data.

## 13. Clean up test data

Do not clean up until failure traces and database state have been inspected.
For routine cleanup, use Supabase Table Editor or a reviewed SQL query against
the `vidi-e2e` project only.

Before deleting anything, confirm the project reference displayed in the
dashboard is:

```text
gugfrvtsjnflttgyreat
```

Deleting a game cascades to its players, deck, ratings, results, and related
game-scoped records according to the schema. Prefer deleting specific test
games by known invite code instead of broad date-based deletion.

Example inspection query:

```sql
select id, invite_code, status, created_at
from public.games
order by created_at desc
limit 25;
```

After identifying an exact test invite code, delete only that game:

```sql
delete from public.games
where invite_code = 'REPLACE_WITH_EXACT_TEST_CODE';
```

Do not run cleanup SQL against production.

## Completion checklist

- [ ] The exposed Supabase secret was rotated and retired.
- [ ] The Supabase project is confirmed as non-production.
- [ ] All 15 migrations were applied in order.
- [ ] Every public application table has RLS enabled.
- [ ] Required RPCs and security functions exist.
- [ ] `.env.e2e.local` is ignored by Git.
- [ ] The local sync uses test credentials only.
- [ ] At least 30 deck candidates exist; 100–300 is preferred.
- [ ] The Vercel project uses only test Supabase credentials.
- [ ] `NEXT_PUBLIC_APP_URL` exactly matches the test deployment URL.
- [ ] The deployment smoke test creates a 30-movie Quick lobby.
- [ ] Playwright Chromium is installed.
- [ ] The complete E2E command reports `4 passed`, not skipped tests.
- [ ] The filtered group command reports `3 passed`.
- [ ] The early-rating security probe passes against the test project.
- [ ] Any failure artifacts were collected before cleanup.

Once every item is checked, provide the isolated Vercel URL and the complete
E2E output for review.
