# Original vidi migration-history review

Reviewed 2026-09-06. Target: `vidi` (`xgjhqpowxcomaorcuqgp`).

## Decision

The 12 migrations missing from remote history have their resulting application
schema and checked data effects present. The user approved the command below,
and it executed successfully on 2026-09-06, marking all 12 versions applied
without replaying their SQL. Post-repair migration history matches all 15 local
files. The final dry run returned `upToDate: true`, with empty migrations, seeds,
and roles lists. No application data cleanup or deployment was performed.

This is a migration-history decision, not production release approval.

## Evidence

- Roles, schema, and data exports succeeded at
  `C:\Users\basit\Documents\vidi-backups\2026-09-06-171955`.
  Non-empty file sizes and SHA-256 hashes were verified; `SHA256SUMS.txt` is
  beside the exports. The user confirmed making a second backup copy.
- Replayed all 15 immutable migrations successfully into an isolated PostgreSQL
  17.6 container with networking disabled and minimal Auth platform scaffolding.
- Restored the backup schema into a second local database and compared canonical
  PostgreSQL dumps, including columns, indexes, constraints, triggers, policies,
  RLS, ownership, and grants across `public` and `private`.
- Compared 22 application tables, 19 functions, and 29 policies. Replayed again
  with the backup's Supabase default privileges to distinguish inherited grants
  from migration drift.
- The backup's `get_deck_candidates` body omits redundant casts and aliases.
  Both versions returned identical ordered JSON results using the backed-up
  movie catalog for limits -1, 1, 30, 3000, 5000, and 6000. The full eligible
  catalog contains 3,999 movies.
- The score constraint has equivalent parentheses. Dump/restore normalization
  reproduces this difference; it does not alter accepted score ranges.
- `private.request_rate_limits` additionally has RLS enabled in the original
  database. Preserve this extra restriction; do not remove it to match the chain.
- All 10 personality definitions match migration metadata, including criteria
  and display copy. No backed-up profile has a null avatar when its Auth
  metadata supplies an avatar covered by the migration backfill.
- Structured watchlist columns, indexes, and validated constraints match the
  migration's final state. This does not reconstruct historical deleted duplicate
  rows or prove the original execution date of any migration.
- Live read-only checks confirmed only the first three migration versions are
  recorded; every public table has RLS; the Auth signup trigger is enabled and
  calls `private.handle_new_user`; and Realtime includes `games`, `game_players`,
  and `game_movies`.
- Individually compared 140 live function/constraint definitions to the restored
  backup: differences were line endings in nine functions and equivalent
  parentheses in the score constraint. Live policy fingerprints match.

## Reviewed command — executed with user approval

Executed from the repository root. The explicit project reference fixed the
target. Retained here for audit; do not rerun it as a next step.

```powershell
npm.cmd exec --yes --package=supabase@2.116.0 --package=@supabase/cli-windows-x64@2.116.0 -- supabase migration repair --linked --project-ref xgjhqpowxcomaorcuqgp --status applied 202608260002 202608310001 202609010001 202609020001 202609040001 202609040002 202609040003 202609040004 202609040005 202609040006 202609050001 202609050002
```

This updates migration tracking only. It does not replay migration SQL or change
application rows. The CLI help confirms multi-version repair and explicit
project targeting are supported in this version.

Post-repair verification completed successfully with:

```powershell
npm.cmd exec --yes --package=supabase@2.116.0 --package=@supabase/cli-windows-x64@2.116.0 -- supabase migration list
npm.cmd exec --yes --package=supabase@2.116.0 --package=@supabase/cli-windows-x64@2.116.0 -- supabase db push --dry-run
```

Expected: all 15 versions match, with no pending migration. Stop on any mismatch.
Do not run an actual `db push` merely to verify the repair.

## Remaining release work

- This was a schema restore/comparison and selected data-effect verification,
  not a complete Auth/Storage/platform disaster-recovery rehearsal.
- The Supabase defaults grant broad browser-role table privileges on
  `achievements`, `profile_achievements`, and `account_attention_reads`, and
  sequence privileges on the challenge/analytics sequences. These are also
  produced by the existing chain under those defaults, so history repair will
  not change them. Review and narrow these grants before release; in particular,
  table-level `TRUNCATE` is not constrained by row policies.
- Continue the runbook's data review, RLS/permission review, Auth/SMTP,
  environment isolation, and release gates. No deployment is authorized by this
  report.
- Local comparison scripts and schema-only diffs are in ignored
  `.cache/schema-review`. No backup data or credentials were added to Git.

Reference: [Supabase migration-history repair guidance](https://supabase.com/docs/guides/deployment/database-migrations).
