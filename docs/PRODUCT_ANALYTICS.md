# vidi product analytics

vidi uses a first-party, server-side Supabase analytics provider. Analytics is
best-effort: a provider outage never blocks signup, gameplay, results, sharing,
watchlists, or friendships.

## Configure

1. Run `supabase/migrations/202609040005_product_analytics.sql` in the Supabase
   SQL editor (or apply it with your normal migration workflow).
2. Generate a private hashing secret, for example with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Add these server-only variables locally and in Vercel:

   ```env
   ANALYTICS_PROVIDER=supabase
   ANALYTICS_HASH_SECRET=your-random-secret-of-at-least-32-characters
   ```

Set `ANALYTICS_PROVIDER=disabled` to turn collection off without changing code.
Never prefix the hashing secret with `NEXT_PUBLIC_`.

## Privacy model

The browser sends events only to vidi's same-origin `/api/analytics` endpoint.
Both the endpoint and server actions validate event properties against strict
allowlists. The database receives keyed HMAC hashes for the anonymous actor and
game/challenge correlation key—not their raw identifiers.

The analytics system does **not** collect movie IDs, movie titles, swipe
direction, reactions, ratings, email addresses, display names, profile IDs,
invite codes, IP addresses, or user-agent strings. In particular,
`movie_swiped` contains only `progress` and `deckSize`.

The table and its RPC functions are inaccessible to `anon` and `authenticated`.
Only the server-side Supabase service role can insert events or read aggregate
metrics.

## Metric definitions

- Game completion rate: games created in the period that also completed in it.
- Invite conversion rate: shared game invites with at least one player join.
- Average deck completion: average highest progress percentage per anonymous
  actor and game.
- Share rate: viewed result sets that were shared.
- Challenge conversion: opened challenges that were completed.
- Guest-to-account conversion: guest actors later emitting a completed signup
  after their history was claimed.
- Rematch rate: game creators who created at least two games in the period.

Call `getProductAnalyticsMetrics(periodStart, periodEnd)` from server-only code
to retrieve these aggregates. No analytics dashboard is exposed publicly.

## Provider changes

Application code calls the typed helpers in `src/lib/analytics`. To adopt a
different provider, implement the small `AnalyticsProvider` interface and
select it in `getAnalyticsProvider()`. Event validation and instrumentation do
not need to change.

## Verify locally

After applying the migration and setting the environment variables:

1. Start the app with `npm run dev` and use a private/incognito window.
2. Open the home page, create and share a game, join from a second private
   window, and swipe a few movies.
3. In the Supabase SQL editor, inspect only event names and approved properties:

   ```sql
   select event_name, properties, occurred_at
   from public.product_analytics_events
   order by occurred_at desc
   limit 50;
   ```

4. Confirm that `actor_hash` and `entity_hash` are 64-character hashes and that
   no personal or movie-level data appears.
5. Query a metric window:

   ```sql
   select public.get_product_analytics_metrics(
     now() - interval '30 days',
     now() + interval '1 minute'
   );
   ```

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` after
changes to event schemas or instrumentation.
