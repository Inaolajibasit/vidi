# vidi session handoff

Last updated: 2026-09-08 (Africa/Lagos)

## Email templates and OTP input update

Also fixed the profile movies-seen display: both owner and public profile pages
now count distinct seen movie IDs from account-linked ratings using a paginated
query. The stored `movies_seen_count` field was updated only during guest-history
claims, so it was stale after ordinary gameplay. No database change or backfill
was made. Lint, typecheck, and all 91 tests passed, including new pagination,
deduplication, empty-history, and query-error checks. This fix is not deployed.

Added hosted Supabase email templates in `supabase/templates` for signup and
magic-link sign-in, using the user's blue/yellow palette. The user reports the
emails work but Supabase sends eight-digit codes. Updated the auth form's input
limit to eight and validation to accept six or eight digits; corrected the
six-digit-only instructions. These app changes are local and not deployed.
Production deployment still requires the user's command review.

## Data and permission review — current next task

The user explicitly requested preserving all existing data. The inventory found
2 accounts and 39 games, with no checked seed/E2E signatures. No cleanup is
proposed. See [PRODUCTION_READINESS_REVIEW.md](./PRODUCTION_READINESS_REVIEW.md).

Prepared `202609060001_browser_privilege_hardening.sql` to narrow excessive
browser table/sequence grants and require explicit browser privileges for new
postgres-owned public tables/sequences. Production dry run lists only this
migration. Lint, typecheck, and 88 application tests passed. Transactional SQL
regression on the separate `vidi-e2e` project failed before the fix and passed
after it, then rolled back. Docker testing was blocked by an unresponsive engine;
Docker Desktop was restarted and the hosted E2E tests supplied validation.

The user approved the permission change, and the guarded push applied only
`202609060001_browser_privilege_hardening.sql` on 2026-09-07. All 16 migration
versions now match; the subsequent dry run returned no migrations, seeds, or
roles. Read-only verification confirmed the intended browser grants, unchanged
service table/function grants, and RLS on every application table. All inventory
counts remained unchanged except analytics (522 to 531) and rate-limit rows
(15 to 24), which increased since the earlier inventory. The migration contains
no application data-writing statements. No data deletion or deployment ran.

Exact next task: continue production conversion from Deployment section 3.E:
verify movie readiness and production Auth/SMTP configuration, then isolated
Vercel environment setup and release gates. Preserve existing data and show any
production-changing command for review before execution. Do not rerun the repair
or the already-applied permission migration.
This section supersedes the older next-task notes below.

## Reconciliation completed — exact next task

See [MIGRATION_RECONCILIATION_REVIEW.md](./MIGRATION_RECONCILIATION_REVIEW.md)
for the completed offline replay, backup comparison, live read-only checks,
remaining release findings, and exact reviewed command.

The user confirmed a second backup copy and explicitly approved the reviewed
history repair. On 2026-09-06, the repair succeeded for all 12 versions on
`xgjhqpowxcomaorcuqgp`. Post-repair migration history matches all 15 local files;
`db push --dry-run` returned `upToDate: true` with no migrations, seeds, or roles
pending. Only migration tracking was changed; no migration SQL was replayed,
application data cleaned, or application deployed.

Exact next task: review existing data and production permissions, including the
inherited broad grants identified in the report. Prepare any required fixes for
review before production writes. Do not repeat the repair or replay the 12 files.

This section supersedes the earlier next-task notes below.

## Backup and migration review update (supersedes next task below)

- Confirmed original linked project: `vidi`, `xgjhqpowxcomaorcuqgp`.
- Docker is running. The default cached CLI lacks its Windows binary; use:
  `npm.cmd exec --yes --package=supabase@2.116.0 --package=@supabase/cli-windows-x64@2.116.0 -- supabase`
  followed by the desired subcommand.
- Roles, schema, and data exports completed successfully outside Git at
  `C:\Users\basit\Documents\vidi-backups\2026-09-06-171955`.
- Verified non-empty files: roles 370 bytes, schema 92,468 bytes, data
  8,179,793 bytes. SHA-256 hashes are saved beside them in `SHA256SUMS.txt`.
- A restore test and a second protected copy have not been completed.
- Migration history records only `202608250001`, `202608250002`, and
  `202608260001`. `db push --dry-run` proposes the remaining 12 migrations.
- **Do not push:** exported schema already contains later objects including
  `achievements`, `watchlists_one_personal_per_profile_idx`,
  `private.request_rate_limits`, and `account_attention_reads`. History and
  schema disagree. `202608310001` contains an unconditional achievements table
  creation, so replay is unsafe. Presence of objects does not establish that
  every migration definition or grant matches.
- Exact next task: compare existing schema, functions, constraints, policies,
  and grants with the immutable migration chain; prepare a reviewed history
  reconciliation or forward-fix proposal. Do not use migration repair merely
  to suppress missing history.
- No migration push, cleanup, reset, or deployment was run. Show the user the
  reviewed command before any production database change or deployment.
- Existing user changes in `DEPLOYMENT.md` and `next-env.d.ts` were preserved.
- Do not share `db dump --dry-run` output: it prints a database login credential.

## Current state

- Repository: `C:\Users\basit\Desktop\vidi`
- Branch: `main`
- Last committed revision: `81cc537`
- Production has not been deployed.
- No production Supabase migrations or database commands were run in this phase.
- Local environment files and credentials must remain untracked.

## Work completed in Phase 31

- Created a production-focused `README.md`.
- Rebuilt `DEPLOYMENT.md` as the production deployment runbook.
- Updated `.env.example` with public versus server-only variable guidance.
- Removed the hardcoded localhost fallback from `src/app/layout.tsx`.
- Documented all 15 migrations, RLS checks, TMDB sync, Vercel setup, custom
  domains, and final release checks.
- Added the procedure for promoting the original vidi Supabase project when the
  project limit prevents creating another project.
- Added Windows instructions for exporting roles, schema, and data with
  `supabase db dump` before promoting that project.

## Verification already completed

- `npm.cmd run lint` passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd test` passed: 87 tests.
- `npm.cmd run build` passed.
- Prettier passed for the changed documentation and layout.
- `git diff --check` passed.
- All 15 migration files are listed in `DEPLOYMENT.md`.
- No live credentials were found in the repository scan; matches were example
  placeholders.
- No development, E2E, or old Vercel URL remains hardcoded in application
  source.

## Uncommitted files at handoff

```text
M  .env.example
M  DEPLOYMENT.md
M  src/app/layout.tsx
?? README.md
?? docs/SESSION_HANDOFF.md
```

Run `git status --short` after restarting because this list describes the state
at the moment this handoff was written.

## Exact next task

Promote the original vidi Supabase project safely:

1. Start Docker Desktop.
2. Follow **Promoting the original vidi project** in `DEPLOYMENT.md`.
3. Create the roles, schema, and data exports outside the Git repository.
4. Verify all three SQL files are non-empty and generate SHA-256 hashes.
5. Run `npx.cmd supabase migration list` against the linked original project.
6. Review the list before running `npx.cmd supabase db push --dry-run`.
7. Do not run `db push`, cleanup SQL, or `db reset --linked` until the backup
   and dry-run migration review are complete.

## Resume instructions

Open this repository and tell Codex:

> Read `AGENTS.md`, `docs/SESSION_HANDOFF.md`, and `DEPLOYMENT.md`, inspect Git
> status, and continue from the exact next task. Do not deploy or change the
> production database without showing me the reviewed command first.

Then run:

```powershell
cd C:\Users\basit\Desktop\vidi
git status --short
git branch --show-current
```
