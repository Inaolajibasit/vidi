# vidi

> seen it? prove it.

vidi is a mobile-first social movie game for two to five players. Everyone
receives the same movie deck, marks each film Seen or Haven't Seen, and rates
seen films with one quick reaction. When the group finishes, vidi calculates
compatibility, movie knowledge, shared favourites, disagreements, movie
personalities, and personal and shared watchlists.

## Technology

- Next.js App Router, React, strict TypeScript, and Tailwind CSS
- Supabase PostgreSQL, Auth, Realtime, database functions, and RLS
- TMDB for movie metadata and posters
- Vercel for the production web application

## Requirements

- Node.js 20.9 or newer
- npm
- A Supabase project
- A TMDB API Read Access Token or v3 API key

## Local development

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and provide development or isolated-test
   credentials. Never use production credentials for routine development.

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Apply the migrations to that Supabase project as described in
   [DEPLOYMENT.md](./DEPLOYMENT.md).

4. Populate the movie library:

   ```powershell
   npm run movies -- --limit=25
   npm run movies
   ```

5. Start vidi and open the origin configured in `NEXT_PUBLIC_APP_URL`:

   ```powershell
   npm run dev
   ```

## Verification

Run these checks before opening or merging a pull request:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Run the multiplayer browser suite only against the isolated E2E environment:

```powershell
$env:VIDI_RUN_E2E = "true"
$env:VIDI_E2E_BASE_URL = "https://YOUR-E2E-DOMAIN"
npm run test:e2e -- --workers=1
```

See [the E2E environment runbook](./docs/E2E_TEST_ENVIRONMENT_SETUP.md). Do not
run its 2–5 player workload against production.

## Database and security

All schema changes live in [`supabase/migrations`](./supabase/migrations) and
must be applied in filename order through Supabase migration history. Browser
clients use the publishable key and RLS. The service-role key is used only by
trusted server code and maintenance scripts.

The critical invariant is that one participant cannot retrieve another
participant's answers before results unlock. Review
[`docs/SECURITY_REVIEW.md`](./docs/SECURITY_REVIEW.md) before changing ratings,
game state, results, guest identity, or service-role code.

## Documentation

- [Production deployment](./DEPLOYMENT.md)
- [Supabase and TMDB setup](./docs/live-services-setup.md)
- [TMDB movie sync](./docs/tmdb-sync.md)
- [Security review](./docs/SECURITY_REVIEW.md)
- [Product review audit](./docs/PRODUCT_REVIEW_AUDIT.md)

## Product constraints

- Quick: 30 movies
- Proper: 100 movies
- No Life: 200 movies
- Minimum players for multiplayer results: 2
- Maximum players: 5
- Guests can play without creating an account

Challenges remain disabled for the production MVP unless explicitly enabled
and separately verified.
