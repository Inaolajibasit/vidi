# vidi session handoff

Last updated: 2026-09-06 (Africa/Lagos)

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
