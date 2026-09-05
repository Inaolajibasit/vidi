# vidi security review — Phase 22

Date: 2026-09-05

## Critical invariant

A participant must not be able to retrieve another participant's ratings until
the game status is `completed`.

The live probe found that the previous `private.results_visible` RLS helper also
accepted `waiting_results`. An authenticated participant could therefore query
every rating in the game after the last player finished but before result
calculation completed. The same participant could directly mutate owned
ratings through Supabase instead of using the ordered gameplay RPC.

Migration `202609050001_security_hardening.sql` changes cross-player visibility
to `completed` only and removes direct authenticated writes to games,
game_players, and ratings. Trusted server actions and service-role-only RPCs
remain the sole mutation path.

## Live exploit result before remediation

The isolated probe created two temporary authenticated users and one game, then
queried Supabase as player A:

- `active`: one visible rating; player B remained private.
- `waiting_results`: two visible ratings; player B was exposed.
- Direct rating mutation: allowed.
- `completed`: two visible ratings, as intended.

The probe deletes its temporary game and users in a `finally` block. Run it
again after applying the migration with:

```bash
npx tsx scripts/security-probe.ts
```

The post-migration probe succeeds only if `active` and `waiting_results` hide
player B, direct mutation is denied, and `completed` reveals both ratings.

## Other controls reviewed

- Guest identity uses a random UUID in an HttpOnly, SameSite=Lax cookie and is
  matched server-side. Browser-supplied guest IDs are never trusted directly.
- Invite codes use cryptographic randomness and a 34-character unambiguous
  alphabet. Lobby reads and joins are now database-rate-limited to reduce
  enumeration.
- Auth callback destinations now reject external, protocol-relative, control
  character, and backslash-based redirect targets.
- Server-only modules contain the service-role client. No tracked file contains
  a service-role key, and Supabase `.temp` connection metadata is no longer
  tracked.
- Gameplay actions validate invite codes, TMDB IDs, seen/reaction consistency,
  participant identity, active state, deck membership, and answer order.
- Verdict reads require both `completed` status and participant identity.
  Public share images expose only a narrow aggregate completed-game model.
- Analytics now enforces its body limit even when Content-Length is absent or
  false, and expensive/write-heavy endpoints have database-backed throttles.
- Database constraints cover player identity exclusivity, game capacity,
  rating/deck ownership, score ranges, timestamps, code shape, and uniqueness.

## Residual risks

- The security migration must be applied before deploying the accompanying
  application code. The rate-limit helper intentionally fails closed if its RPC
  is unavailable.
- IP-based throttling reduces ordinary abuse but does not stop a distributed
  botnet. Production should also enable Vercel firewall/rate-limit rules and
  monitor Supabase usage.
- Anyone holding a completed game's invite code can request its deliberately
  public aggregate share image. Raw ratings remain participant-only.
- Possession of a guest cookie grants access to that guest's games. HTTPS,
  HttpOnly, SameSite, and high-entropy identifiers reduce but cannot eliminate
  device/session theft risk.
