# Live Supabase and TMDB setup

This guide connects vidi to a hosted Supabase project and configures the TMDB credentials required by the movie ingestion pipeline.

## 1. Create the Supabase project

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a project.
3. Save the database password securely.
4. Open **Settings → API Keys**.
5. Copy:
   - the project URL;
   - the publishable key beginning with `sb_publishable_`;
   - the secret key beginning with `sb_secret_`.

Supabase recommends publishable and secret keys over the legacy `anon` and `service_role` keys. vidi's existing environment variable names remain compatible:

- Put the publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Put the secret key in `SUPABASE_SERVICE_ROLE_KEY`.

See the [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

## 2. Create `.env.local`

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_SECRET_KEY

TMDB_ACCESS_TOKEN=YOUR_TMDB_API_READ_ACCESS_TOKEN

NEXT_PUBLIC_APP_URL=http://localhost:3000
MOVIE_SYNC_TARGET=4000
```

Security requirements:

- Never commit `.env.local`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
- Never rename a secret variable with a `NEXT_PUBLIC_` prefix.
- Configure either `TMDB_ACCESS_TOKEN` or `TMDB_API_KEY`.
- Remove the unused TMDB credential instead of leaving a placeholder value.
- Rotate a credential immediately if it is accidentally committed, logged, or shared.

## 3. Configure TMDB

1. Create or sign in to a [TMDB account](https://www.themoviedb.org/).
2. Open account **Settings → API**.
3. Request API access if necessary.
4. Copy the **API Read Access Token**.
5. Store it as `TMDB_ACCESS_TOKEN` in `.env.local`.

The read access token works as a bearer token across TMDB v3 and v4 and is the preferred credential for vidi. See the [TMDB authentication documentation](https://developer.themoviedb.org/v4/docs/authentication-application).

The v3 API key is also supported as an alternative:

```env
TMDB_API_KEY=YOUR_V3_API_KEY
```

Do not configure both unless both values are valid. vidi prefers `TMDB_ACCESS_TOKEN` when both are present.

## 4. Link the Supabase project

From the project root, authenticate the Supabase CLI:

```bash
npx supabase login
```

Link the repository to the hosted project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

The project reference is the portion before `.supabase.co` in the project URL. The CLI may request the database password created with the project.

Preview the pending database migration:

```bash
npx supabase db push --dry-run
```

Review the output, then apply it:

```bash
npx supabase db push
```

Supabase records applied migrations and skips them on subsequent pushes. See the [Supabase migration documentation](https://supabase.com/docs/guides/deployment/database-migrations).

Do not run `db push --include-seed` against production. The repository seed contains a development game and sample ratings.

## 5. Test movie ingestion

Start with a small live sync:

```bash
npm run movies -- --limit=25
```

In the Supabase Table Editor, inspect:

- `movies`
- `genres`
- `movie_genres`
- `movie_keywords`

If the records look correct, ingest the remainder of the curated pool:

```bash
npm run movies
```

The checkpoint created by the first command ensures that successfully ingested movies are skipped. Individual failures are recorded and retried on the next run.

For additional sync options, see [TMDB movie sync](./tmdb-sync.md).

## 6. Configure Vercel later

When deploying, add the same values under **Vercel Project Settings → Environment Variables**.

Only these variables may be visible to browser code:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

These must remain server-only:

```env
SUPABASE_SERVICE_ROLE_KEY
TMDB_ACCESS_TOKEN
TMDB_API_KEY
```

Use the production application URL for the production environment:

```env
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
```

After changing deployment environment variables, redeploy the application so the new values are available to the build and runtime.
