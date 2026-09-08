# vidi test suite

For the complete isolated-environment walkthrough, see
[`docs/E2E_TEST_ENVIRONMENT_SETUP.md`](../docs/E2E_TEST_ENVIRONMENT_SETUP.md).

Run deterministic unit and domain-integration tests:

```bash
npm test
```

The SQL permission regression is separate from `npm test`. On an isolated
database with the full migration chain applied and an administrative test
connection configured through PostgreSQL environment variables, run:

```powershell
psql --set ON_ERROR_STOP=1 --file tests/sql/browser-privileges.sql
```

Never target production. The test creates synthetic fixtures and rolls back
table changes; identity sequences may advance. It checks browser denial paths,
owner-only attention state, server writes, and defaults for future tables.

Run the browser suite against an isolated test deployment:

```bash
npx playwright install chromium
VIDI_RUN_E2E=true VIDI_E2E_BASE_URL=https://your-test-deployment.example npm run test:e2e
```

The deployment must use a disposable Supabase project with all migrations
applied and at least 30 eligible movies. Do not point the E2E suite at
production: it creates games, guest players, ratings, and results.

The Playwright test is reported as skipped unless `VIDI_RUN_E2E=true` is
explicitly set.



=============================================================================================

## 1. Create a Supabase test project

  In the Supabase dashboard:

  1. Create a new project named something like vidi-e2e.
  2. Use a separate database password.
  3. Wait for the project to finish provisioning.
  4. Open Project Settings → API.
  5. Save these test-project values:
      - Project URL
      - Anonymous/public key
      - Service-role key

  These values must come from the new test project—not production.

  ## 2. Apply every database migration

  The test project needs all migrations from:

  supabase/migrations

  Because the local Supabase CLI previously had Windows compatibility problems, the safest current option is:

  1. Open the new project in Supabase.
  2. Open SQL Editor.
  3. Run each migration in filename order:

  202608250001_initial_schema.sql
  202608250002_create_game_rpc.sql
  202608260001_gameplay_answers.sql
  202608260002_deck_candidates.sql
  202608310001_account_conversion.sql
  202609010001_personality_system.sql
  202609020001_friendships_security.sql
  202609040001_google_profile_avatars.sql
  202609040002_structured_watchlists.sql
  202609040003_challenges.sql
  202609040004_monthly_recap_foundation.sql
  202609040005_product_analytics.sql
  202609040006_fast_gameplay_answers.sql
  202609050001_security_hardening.sql

  Run them one at a time. Stop if any migration fails rather than continuing with a partially migrated database.

  The final security migration is especially important because it:

  - Protects ratings until results unlock
  - Adds secure game operations
  - Adds database-backed rate limiting
  - Tightens permissions and RLS

  ## 3. Populate the test movie library

  A Quick game needs at least 30 eligible movies, although I recommend syncing at least 100–300 so deck generation can properly apply diversity rules.

  Create a dedicated environment file such as .env.e2e.local:

  NEXT_PUBLIC_SUPABASE_URL=https://YOUR-TEST-PROJECT.supabase.co melt
  NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_TEST_ANON_KEY piger
  SUPABASE_SERVICE_ROLE_KEY=YOUR_TEST_SERVICE_ROLE_KEY
  TMDB_API_KEY=YOUR_TMDB_API_KEY Blackjack
  TMDB_ACCESS_TOKEN=YOUR_TMDB_ACCESS_TOKEN
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100_acl
  ANALYTICS_PROVIDER=disabled
  ANALYTICS_HASH_SECRET=replace-with-at-least-32-random-characters
  ENABLE_CHALLENGES=false Lel
  ENABLE_DEFAULT_LIKE_ON_SWIPE=false
  MOVIE_SYNC_TARGET=300

  Remove the accidental words after values in the example above; each line must contain only the actual value. A clean version should look like:

  NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=example-keydato
  SUPABASE_SERVICE_ROLE_KEY=example-service-key
  TMDB_API_KEY=example-tmdb-key
  TMDB_ACCESS_TOKEN=example-tmdb-tokenLIB
  NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100
  ANALYTICS_PROVIDER=disabled
  ANALYTICS_HASH_SECRET=a-random-string-that-is-at-least-32-characters
  ENABLE_CHALLENGES=false
  ENABLE_DEFAULT_LIKE_ON_SWIPE=false anv
  MOVIE_SYNC_TARGET=300

  Do not commit this file. The existing .gitignore should protect local environment files, but confirm with:

  git status --short

  Then temporarily copy the test values into .env.local or load them into your shell before syncing:

  npm.cmd run moviesushi

  Confirm the command completes without errors and reports enough synced movies.

  ## 4. Deploy an isolated Vercel test environment

  The easiest reliable arrangement is a separate Vercel project, for example vidi-e2e.

  Add the test Supabase and TMDB variables under:

  Vercel Project → Settings → Environment Variables

  Use the same variables listed above, but set:

  NEXT_PUBLIC_APP_URL=https://your-vidi-e2e-domain.vercel.app

  Deploy the current branch to that project.

  Before running the E2E suite, manually verify:

  - The landing page opens.
  - You can reach Create Game.
  - A Quick game can be created.
  - The generated room does not report a missing rate-limit migration.
  - The game has 30 movie cards.

  ## 5. Install the Playwright browser

  This is required once on your machine:

  npx.cmd playwright install chromium

  Playwright’s test runner is installed already, but its Chromium binary may not be.

  ## 6. Run the E2E critical path

  From the vidi project directory:

  $env:VIDI_RUN_E2E = "true"
  $env:VIDI_E2E_BASE_URL = "https://your-vidi-e2e-domain.vercel.app"
  npm.cmd run test:e2e

  The test should:

  1. Open two isolated browser sessions.
  2. Create a Quick game as Player A.
  3. Join as Player B.
  4. Start the game.
  5. Submit 30 answers from both players.
  6. Wait for result generation.
  7. Open results for both players.
  8. Confirm “Movie match” renders.
  9. Request the share card.
  10. Confirm the response is a PNG.

  A successful run should end with:

  1 passed

  ## 7. If it fails

  Playwright stores debugging artifacts in:

  test-results/playwright

  Depending on the failure, this can contain:

  - Failure screenshots
  - Browser traces
  - Network information
  - DOM snapshots

  Open a recorded trace with:

  npx.cmd playwright show-trace test-results/playwright/<trace-file>.zip

  Send me the failing output and trace path. I can then determine whether the failure is caused by the test, realtime timing, a database migration, result generation, or the application itself.

  ## 8. Clean up afterward

  Since this is a disposable test environment, periodically remove test games and guest players through the Supabase test project. Never perform that cleanup against production.

  The immediate thing I need from you is the URL of the isolated deployed test application after:

  - All migrations are applied
  - At least 30 movies are synced
  - The test environment variables are configured

  Once you provide that test URL, I can run and debug the complete E2E path.
