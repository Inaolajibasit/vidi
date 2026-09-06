# vidi production deployment

This runbook prepares and releases vidi on Vercel with a production Supabase
project. That can be a new project or an existing vidi project that has been
carefully promoted to production. Production, Preview, E2E, and local data must
remain separate after promotion.

Do not deploy until every item in the final checklist is complete.

## 1. Architecture

```text
Browser or installed PWA
          |
          v
Vercel: Next.js application
          |
          +-- Supabase Auth
          +-- Supabase PostgreSQL, RLS, and database functions
          +-- Supabase Realtime
          +-- TMDB API and poster images
```

A Preview deployment can mutate data just like Production. Preview must use
isolated test credentials or no write-capable credentials; it must never inherit
the production service-role key.

## 2. Environment variables

| Variable                        | Exposure    | Required                | Purpose                                                     |
| ------------------------------- | ----------- | ----------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser     | Yes                     | Production Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser     | Yes                     | Supabase publishable key; RLS is the authorization boundary |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only | Yes                     | Trusted server actions, result calculation, and maintenance |
| `TMDB_ACCESS_TOKEN`             | Server only | One TMDB credential     | Preferred TMDB API Read Access Token                        |
| `TMDB_API_KEY`                  | Server only | One TMDB credential     | Supported v3-key alternative                                |
| `NEXT_PUBLIC_APP_URL`           | Browser     | Yes                     | Exact canonical origin, including `https://`                |
| `NEXT_PUBLIC_LEGAL_EMAIL`       | Browser     | Recommended             | Monitored privacy and support contact                       |
| `ENABLE_CHALLENGES`             | Server      | Recommended             | Keep `false` for MVP                                        |
| `ENABLE_DEFAULT_LIKE_ON_SWIPE`  | Server      | Recommended             | Keep `false` unless the product decision changes            |
| `ANALYTICS_PROVIDER`            | Server      | Recommended             | `disabled` or `supabase`                                    |
| `ANALYTICS_HASH_SECRET`         | Server only | With Supabase analytics | Random value of at least 32 characters                      |
| `MOVIE_SYNC_TARGET`             | Script      | Optional                | Movie pool from 3,000 to 5,000; default 4,000               |

Never prefix a secret with `NEXT_PUBLIC_`. Never put real secrets in examples,
documentation, screenshots, issues, client components, or browser responses.
Use the stable production domain for `NEXT_PUBLIC_APP_URL`, including `https://`.
Vercel environment changes apply only to subsequent deployments.

## 3. Supabase production project

1. Create a Supabase project dedicated to production.
2. Store its database password in a password manager.
3. Record its Project URL, publishable key, and secret/service-role key.
4. Verify scheduled backups or enable Point-in-Time Recovery when available.
5. Open Security Advisor and resolve unexpected findings.
6. Configure appropriate usage and spending alerts.

Do not copy test users, games, E2E rate-limit rows, or seed data into production.

### Promoting the original vidi project

Use this path when the Supabase project limit prevents creating another project.
After promotion, the original project becomes production and must no longer be
used for automated E2E testing.

#### A. Protect the project first

1. Open the original vidi project in Supabase and confirm its name and project
   reference under **Project Settings > General**.
2. Record the project reference, Project URL, publishable key, and secret/service
   role key in a password manager. Do not paste them into documentation.
3. Enable MFA for the Supabase account and any linked GitHub account.
4. Open **Database > Backups** and confirm a recoverable backup exists.
5. If the current plan does not provide the required backup or export, create a
   database export before cleaning data or applying migrations.

Do not delete test data or change the schema until the backup step is complete.

##### Create a logical export on plans without downloadable backups

prompt to give chat when i start again 
Read AGENTS.md, docs/SESSION_HANDOFF.md, and DEPLOYMENT.md, inspect Git status, and continue from the exact next task. Do not deploy or change the production database without showing me the reviewed command first


Supabase recommends regular CLI exports for free-plan projects. The Supabase CLI
runs `pg_dump` in a Docker container, so install and start Docker Desktop first:

```powershell
docker --version
docker info
```

Create the backup outside the Git repository. Change the dated directory for
each export:

```powershell
$vidiBackupDir = Join-Path $env:USERPROFILE "Documents\vidi-backups\2026-09-06"
New-Item -ItemType Directory -Path $vidiBackupDir -Force
```

In Supabase, select **Connect** and record the project reference. Find or reset
the database password under **Project Settings > Database**. This password is
different from the publishable key, service-role key, and Supabase account
password. Never place it in the repository or documentation.

Link and verify the correct project:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_ORIGINAL_PROJECT_REF
npx.cmd supabase projects list
npx.cmd supabase db dump --linked --dry-run
```

Confirm the linked indicator identifies the original vidi project. Then export
roles, schema, and data one at a time:

```powershell
npx.cmd supabase db dump --linked --file "$vidiBackupDir\roles.sql" --role-only
npx.cmd supabase db dump --linked --file "$vidiBackupDir\schema.sql"
npx.cmd supabase db dump --linked --file "$vidiBackupDir\data.sql" --data-only --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Verify that all three files exist and are non-empty, then generate hashes:

```powershell
Get-ChildItem -LiteralPath $vidiBackupDir |
  Select-Object Name, Length, LastWriteTime

Get-FileHash -Algorithm SHA256 -LiteralPath "$vidiBackupDir\roles.sql"
Get-FileHash -Algorithm SHA256 -LiteralPath "$vidiBackupDir\schema.sql"
Get-FileHash -Algorithm SHA256 -LiteralPath "$vidiBackupDir\data.sql"
```

Keep two protected copies, such as one local copy and one encrypted cloud or
external-drive copy. Database exports contain sensitive user data and must never
be committed, uploaded publicly, or shared in support messages.

This is a logical application backup, not a complete Supabase platform snapshot.
It does not include Vercel variables, project secrets, Auth provider settings,
SMTP configuration, or the actual files in Storage buckets. Export Storage
objects separately if vidi begins using Supabase Storage.

The direct database endpoint requires IPv6 on free projects. If it is
unreachable, copy the **Session pooler** connection from Supabase's **Connect**
dialog and follow the CLI's `--db-url` workflow. Use session mode on port 5432,
not transaction mode on port 6543, for backup operations. Avoid putting a
connection string containing the password into shell history.

Never run this command against the promoted project:

```powershell
npx.cmd supabase db reset --linked
```

It destroys remote data and replays local migrations. After verifying the three
export files, continue with the migration inspection in subsection C.

#### B. Retire it as a test environment

- Never point `VIDI_E2E_BASE_URL` at the production application.
- Never run the Playwright multiplayer suite or security probe against this
  project after promotion.
- Never apply `supabase/seed.sql` to it.
- Keep the existing E2E project for destructive automated tests, if available.
- Use production only for real traffic and small, deliberate smoke tests.

#### C. Link and inspect migration history

From the repository root:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_ORIGINAL_PROJECT_REF
npx.cmd supabase migration list
```

Compare the remote history with the authoritative list in section 4. Before any
write, preview exactly what Supabase intends to apply:

```powershell
npx.cmd supabase db push --dry-run
```

Stop if the output contains unexpected migrations, destructive SQL, or a history
mismatch. Do not blindly rerun the migration files in SQL Editor. If the dry run
contains only reviewed missing migrations, apply and verify them:

```powershell
npx.cmd supabase db push
npx.cmd supabase migration list
```

The two final security migrations are mandatory:

```text
202609050001_security_hardening.sql
202609050002_account_attention_reads.sql
```

#### D. Review existing data

The project may contain test accounts, guests, games, ratings, results,
watchlists, friendships, and rate-limit rows. Keep legitimate user data. Remove
known test data only after creating a backup and reviewing foreign-key
relationships. If ownership is uncertain, leaving harmless rows temporarily is
safer than issuing broad deletion statements.

From this point onward, do not create new E2E data in the project.

#### E. Finish the production conversion

1. Complete the RLS and permission checks in section 5.
2. Check the movie counts and perform any required sync from section 7.
3. Configure the exact production Site URL and callbacks in section 6.
4. Add this project's credentials only to Vercel's Production environment.
5. Give Preview isolated E2E credentials or no write-capable credentials.
6. Run the release gate from section 8.
7. Complete the checklist in section 12 before deploying.

## 4. Database migrations

The authoritative migration chain is:

```text
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
202609050002_account_attention_reads.sql
```

### Migration safety

- Never edit an applied migration. Add a new forward-only migration.
- Never paste the complete chain into the production SQL Editor.
- Never rerun `initial_schema.sql` against an existing database.
- Never apply `supabase/seed.sql` to production.
- Test the identical immutable files on the isolated E2E project first.
- `202609040002_structured_watchlists.sql` removes duplicate personal watchlist
  rows before adding its uniqueness constraint. Back up an existing database and
  inspect those duplicates before applying that migration.
- Verify a recoverable backup before deleting data, changing column types,
  adding potentially blocking constraints, or rewriting large tables.
- Review dry-run output and stop on unexpected or destructive SQL.
- If local and remote histories disagree, investigate. Do not use
  `migration repair` merely to suppress the warning.

Use a current Supabase CLI from the repository root:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

The initial chain applies once to a new project. Later pushes use migration
history and apply only new files.

## 5. RLS and permissions

After migration, run these read-only checks in Supabase SQL Editor.

Every public table must have RLS enabled:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Inspect policies:

```sql
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Inspect browser-role function grants:

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname;
```

`202609050001_security_hardening.sql` is mandatory. It protects ratings until
results unlock, revokes direct browser mutations, and restricts trusted
operations to the service role.

Run `scripts/security-probe.ts` only against the isolated E2E project after
changes to ratings, results, games, guest identity, RLS, or service-role code.

## 6. Supabase Auth

In **Authentication → URL Configuration**:

- Set Site URL to the exact production origin.
- Add exact production callbacks:

  ```text
  https://YOUR-DOMAIN/auth/callback
  https://YOUR-DOMAIN/auth/confirm
  ```

- Keep local and Preview redirects separate. Use wildcard redirects only for
  controlled Preview origins, not the production origin.

For Google authentication, configure this provider callback in Google Cloud:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Configure custom SMTP before relying on email authentication for real users.
The default Supabase mail service is suitable only for limited testing.

## 7. TMDB and movie sync

Store a TMDB API Read Access Token as `TMDB_ACCESS_TOKEN`. A v3 key in
`TMDB_API_KEY` is supported as an alternative. Both are server-only.

Do not run movie ingestion in the Vercel build. Run it from a trusted machine
deliberately connected to production:

```powershell
npm run movies -- --dry-run
npm run movies -- --limit=25
npm run movies
```

Before every write, inspect `NEXT_PUBLIC_SUPABASE_URL` and confirm its host is
the intended production project. The launch target is 3,000–5,000 eligible
movies.

```sql
select count(*) as movies from public.movies;
select count(*) as genres from public.genres;
select count(*) as genre_links from public.movie_genres;
select count(*) as keyword_links from public.movie_keywords;
```

See [docs/tmdb-sync.md](./docs/tmdb-sync.md) for checkpoint, retry, reset, and
concurrency behavior.

## 8. Local development and testing

Use `.env.local` for development or an isolated test project:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Run the release gate:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git status --short
```

The Playwright suite creates many games and answers. Run it only against the
environment in [docs/E2E_TEST_ENVIRONMENT_SETUP.md](./docs/E2E_TEST_ENVIRONMENT_SETUP.md),
never against production.

## 9. Vercel setup

1. Import the GitHub repository into a dedicated Vercel project.
2. Confirm Next.js framework detection and repository-root configuration.
3. Set `main` as the Production Branch.
4. Keep `npm install` and `npm run build` as the standard commands.
5. Configure section 2 variables separately for Production and Preview.
6. Give Production only production Supabase credentials.
7. Give Preview isolated test credentials or no write-capable credentials.
8. Protect `main` and require verification checks before merging.

Vercel creates Preview deployments for non-production branches and deploys the
Production Branch after merge. Do not run `vercel --prod` during preparation.

## 10. Custom domain

1. Open **Vercel → Project → Settings → Domains**.
2. Add the apex domain or chosen subdomain.
3. Apply the DNS records shown by Vercel at the DNS provider.
4. Wait for Vercel to confirm the domain and issue HTTPS.
5. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin.
6. Update Supabase Site URL and exact callback URLs.
7. Update Google OAuth JavaScript origins if Google sign-in is enabled.
8. Redeploy only after every URL agrees.
9. Choose either apex or `www` as canonical and redirect the other.

Never hardcode a deployment domain in application source.

## 11. Release procedure

1. Freeze changes for the release candidate.
2. Confirm the E2E project has the pending migration chain.
3. Deploy a Preview with isolated credentials.
4. Run lint, typecheck, tests, build, the security probe, and 2–5 player E2E.
5. Verify the production database backup.
6. Apply reviewed migrations to production with `supabase db push`.
7. Repeat the RLS and permission checks.
8. Merge the reviewed release commit into `main`.
9. Let the Vercel Git integration create the Production deployment.
10. Smoke-test one two-player Quick game in independent browser sessions.
11. Verify authentication callbacks, results sharing, and poster delivery.
12. Inspect Vercel and Supabase runtime logs.

A Vercel rollback does not reverse a database migration. Repair database issues
with a separately reviewed forward migration.

## 12. Final readiness checklist

### Repository

- [ ] `main` contains only reviewed commits and `git status --short` is empty.
- [ ] No local env file, `.vercel`, trace, screenshot, or test artifact is tracked.
- [ ] A tracked-file secret scan finds no real credentials.
- [ ] No development or deployment URL is hardcoded in application source.
- [ ] Lint, strict TypeScript, tests, and production build pass.

### Supabase

- [ ] A dedicated production project and recoverable backup exist.
- [ ] Migration history matches every file in section 4.
- [ ] Both `202609050001_security_hardening.sql` and
      `202609050002_account_attention_reads.sql` are applied.
- [ ] RLS is enabled on every public table.
- [ ] Policies and function grants match the reviewed migrations.
- [ ] Production contains no seed or E2E data.
- [ ] Auth URLs, providers, and SMTP are configured.

### Movie data

- [ ] TMDB credentials are server-only.
- [ ] Dry-run and 25-movie sample syncs succeed against the intended target.
- [ ] Production contains 3,000–5,000 eligible movies.

### Vercel

- [ ] The project is linked to the correct GitHub repository.
- [ ] `main` is the Production Branch.
- [ ] Production and Preview use different Supabase credentials.
- [ ] Every required Production variable is configured.
- [ ] `NEXT_PUBLIC_APP_URL` includes `https://` and matches the canonical host.
- [ ] Custom-domain HTTPS is healthy, if used.
- [ ] Supabase and Google callback settings match the canonical host.

### Product

- [ ] Guest create and join work.
- [ ] Two authenticated users can sign in independently.
- [ ] Realtime lobby updates work.
- [ ] A Quick game completes and results stay locked until everyone finishes.
- [ ] Results, watchlists, and share PNGs render.
- [ ] Installable PWA behavior works on Android and iPhone.
- [ ] Production logs contain no unexpected errors after the smoke test.

## Official references

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [TMDB authentication](https://developer.themoviedb.org/v4/docs/authentication-application)
