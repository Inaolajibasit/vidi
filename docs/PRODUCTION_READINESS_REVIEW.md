# Production data and permission review

Target: original `vidi`, `xgjhqpowxcomaorcuqgp`.
Inventory collected 2026-09-06; permission fix prepared 2026-09-07.

## Existing data — preserve

The owner explicitly chose to preserve all existing accounts and games.
No deletion, expiration, or cleanup command is proposed.

The read-only inventory found 2 Auth users, 2 profiles, 39 games, 74 players
(60 guest players), 1,761 ratings, 46 results, 7 watchlists, 143 watchlist items,
1 friendship, 8 attention-read records, 2 challenges, 522 analytics events,
15 rate-limit rows, and 3,999 movies. Games comprised 5 waiting, 11 active, and
23 completed games.

No accounts matched the repository's security-probe email pattern or reserved
example domains. No seed game, seed-marked result, or guest-name combination
matched the checked E2E fixtures. This does not prove every row is real traffic;
the preservation decision supersedes test-data cleanup. Historical analytics
may include development usage and should not be interpreted as launch metrics.

Foreign-key relationships were reviewed. Game/profile deletion would affect
dependent participants, ratings, results, watchlists, achievements, friendships,
and challenges through cascades or nulling references. There is no reason to
take that risk when ownership is uncertain and preservation was requested.

## Permissions

All public and private application tables have RLS enabled in production.
All 10 public RPCs deny execution to `anon` and `authenticated`, allow
`service_role`, and pin their search path. Private predicate helpers retain the
authenticated grants required by RLS. Private trigger functions have inherited
execution grants but return `trigger`; they are not ordinary browser RPCs.

Three tables inherited excessive browser privileges: `achievements`,
`profile_achievements`, and `account_attention_reads`. These include `TRUNCATE`,
`REFERENCES`, `TRIGGER`, and `MAINTAIN`. RLS does not constrain table-wide
`TRUNCATE` or `REFERENCES`. This finding is excess database-role privilege, not
evidence that the public REST API exposes a truncate operation.

Both browser roles also hold privileges on `challenge_events_id_seq` and
`product_analytics_events_id_seq`, although their writes are server-only.

## Permission fix — applied with user approval

Migration: `supabase/migrations/202609060001_browser_privilege_hardening.sql`.

- Achievements and earned achievements: browser roles retain SELECT only.
- Attention state: authenticated users retain SELECT, INSERT, UPDATE; existing
  owner-only RLS stays in place. Anonymous access is removed.
- Internal challenge/analytics sequences: browser privileges are removed.
- Future public tables/sequences created by `postgres`: explicit browser grants
  are required. Service-role defaults and current service access are preserved.
- No application rows, policies, or existing functions are changed.
- Function default privileges are outside this migration's scope. New RPCs must
  continue to revoke default execution and explicitly grant intended roles.

## Validation and application

Validation completed on 2026-09-07:

- Lint and TypeScript checks passed; all 88 application tests passed.
- Docker was unresponsive, so the SQL regression was run on the explicitly
  targeted isolated `vidi-e2e` project (`gugfrvtsjnflttgyreat`). It correctly
  failed before the fix and passed with the identical migration inside a
  transaction that rolled back the permission changes and fixtures.
- Checks covered anonymous achievement reads, owner-only attention upsert,
  blocked cross-user reads/writes, blocked truncation and forged achievements,
  blocked browser sequence access, preserved server writes/defaults, unchanged
  server-only RPC execution, and explicit grants required for future objects.
- The E2E analytics identity sequence may have advanced during the server-write
  test; sequence increments are not transactional. No production tests ran.
- Production `db push --dry-run` listed exactly
  `202609060001_browser_privilege_hardening.sql`, with no seeds or roles.
- After explicit user approval, the guarded push applied only this migration on
  2026-09-07. All 16 versions match and the subsequent dry run has no migrations,
  seeds, or roles pending.
- Post-application read-only checks confirmed the intended browser grants,
  unchanged service-role table privileges and function execution grants, and RLS
  on every application table.
- Account, game, player, movie, rating, result, watchlist, friendship, challenge,
  and attention-read counts match the original inventory. Analytics increased
  from 522 to 531 and rate-limit rows from 15 to 24 since that inventory. The
  migration has no application data-writing statements; no cleanup ran.
- E2E rollback verification found no fixture users, achievements, or test table,
  and confirmed its original permissions were restored.

The reviewed command below was executed with user approval and is retained for
audit. The target guard prevented accidentally using a differently linked
project. Do not rerun it as a next step.

```powershell
if ((Get-Content supabase/.temp/project-ref -Raw).Trim() -ne 'xgjhqpowxcomaorcuqgp') { throw 'Unexpected linked project; stopping.' }
npm.cmd exec --yes --package=supabase@2.116.0 --package=@supabase/cli-windows-x64@2.116.0 -- supabase db push --linked
```

Verification of all 16 versions, the empty dry run, and the read-only inventory
is complete. The approval covered permission hardening only, not cleanup or
deployment. Continue the remaining movie, Auth/SMTP, Vercel, and release checks.

`scripts/production-readiness-review.sql` is a reusable read-only inventory.
`tests/sql/browser-privileges.sql` is a transactional regression suite for an
isolated database; it is separate from `npm test` and must never run on production.

References: [PostgreSQL RLS boundaries](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
