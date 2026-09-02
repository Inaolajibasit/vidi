# vidi Deployment Guide

This guide deploys vidi for mobile, account, friendship, multiplayer, and authentication testing.

## Hosting architecture

vidi requires two hosted services:

- **Vercel** hosts the Next.js application, server components, route handlers, server actions, poster proxy, and server-side logic.
- **Supabase** hosts PostgreSQL, authentication, Realtime, database functions, and Row Level Security policies.

You do not need to deploy a separate Express or Node.js backend.

```text
Phone or browser
       |
       v
Vercel — vidi Next.js application
       |
       +-- Supabase Auth, PostgreSQL and Realtime
       +-- TMDB API
```

A custom domain is not required. Vercel automatically provides an HTTPS address such as `https://vidi-game.vercel.app`, which is sufficient for mobile, OAuth, accounts, friendships, and Realtime testing.

Official references:

- [Vercel domains](https://vercel.com/docs/domains/working-with-domains)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [Supabase deployment](https://supabase.com/docs/guides/deployment)

## 1. Prepare the repository

Run the complete verification suite:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git status
```

Commit and push the project to a private GitHub repository:

```powershell
git add .
git commit -m "Prepare vidi development deployment"
git push origin main
```

Confirm that `.env.local` is not tracked:

```powershell
git status --ignored
git ls-files .env.local
```

The second command should return nothing.

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TMDB_API_KEY`
- `TMDB_ACCESS_TOKEN`
- Google OAuth client secrets
- SMTP passwords

## 2. Prepare the live Supabase database

The live Supabase project is the vidi backend. It is not deployed through Vercel.

Apply every migration that has not already been executed, in filename order. Do not rerun initial migrations blindly if the tables already exist.

The latest required migrations include:

```text
supabase/migrations/202609010001_personality_system.sql
supabase/migrations/202609020001_friendships_security.sql
```

Because the Supabase CLI has caused Windows binary problems on this machine, using Supabase Dashboard → SQL Editor is acceptable during development.

Verify the friendship policies:

```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'friendships'
order by policyname;
```

Verify that every exposed table uses RLS:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

All application tables in the `public` schema should report `rowsecurity = true`.

Reference: [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)

## 3. Populate the movie library

Do not run the long 3,000–5,000-movie ingestion job as part of a Vercel deployment.

Configure `.env.local` with the live Supabase and TMDB credentials, then run locally:

```powershell
npm run movies
```

Verify the resulting data:

```sql
select count(*) from public.movies;
select count(*) from public.movie_genres;
select count(*) from public.movie_keywords;
```

The MVP target is approximately 3,000–5,000 movie rows.

## 4. Create the Vercel project

1. Sign in to Vercel.
2. Select **Add New → Project**.
3. Import the GitHub repository.
4. Select the vidi repository.
5. Confirm that the framework preset is **Next.js**.
6. Keep the root directory set to the repository root.
7. Keep the standard commands:
   - Install: `npm install`
   - Build: `npm run build`
   - Output: automatic
8. Choose a project name such as `vidi-game`.

Vercel will deploy new commits automatically when they are pushed to the connected production branch.

## 5. Configure Vercel environment variables

Open Vercel → Project → Settings → Environment Variables.

Add:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
TMDB_API_KEY=YOUR_TMDB_API_KEY
TMDB_ACCESS_TOKEN=YOUR_TMDB_ACCESS_TOKEN
NEXT_PUBLIC_APP_URL=https://YOUR_PROJECT_NAME.vercel.app
MOVIE_SYNC_TARGET=4000
```

For the first development deployment, applying these to **Production** is sufficient.

Security rules:

- Variables beginning with `NEXT_PUBLIC_` are available to browser code.
- The Supabase anon or publishable key is designed to be public and protected by RLS.
- The service-role key must never have a `NEXT_PUBLIC_` prefix.
- TMDB credentials must remain server-only.
- Google and SMTP secrets belong in their provider dashboards, not client code.

Environment-variable changes only affect new deployments. Redeploy after changing a value.

Reference: [Vercel environment variables](https://vercel.com/docs/environment-variables)

## 6. Perform the first deployment

Select **Deploy** in Vercel.

After the deployment completes, Vercel will provide an address similar to:

```text
https://vidi-game.vercel.app
```

Open the address on desktop and mobile.

If the real address differs from `NEXT_PUBLIC_APP_URL`:

1. Update `NEXT_PUBLIC_APP_URL` in Vercel.
2. Open **Deployments**.
3. Redeploy the latest deployment.

Before a polished production launch, update `metadataBase` in `src/app/layout.tsx`. It currently uses `http://localhost:3000` and should derive from `NEXT_PUBLIC_APP_URL`. This normally does not prevent authentication, but it can generate incorrect metadata and social links.

## 7. Configure Supabase production URLs

Open Supabase Dashboard → Authentication → URL Configuration.

Set the Site URL:

```text
https://vidi-game.vercel.app
```

Add these redirect URLs:

```text
http://localhost:3000/**
https://vidi-game.vercel.app/auth/callback
https://vidi-game.vercel.app/auth/confirm
```

Replace the example Vercel address with the actual stable deployment address.

The application constructs OAuth and email redirects from `location.origin`, so every legitimate deployment origin must be allowed by Supabase.

Use exact URLs for production. Wildcard patterns may be used for Vercel preview deployments later.

Reference: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## 8. Configure Google authentication

### Google Cloud

1. Open Google Auth Platform.
2. Configure Branding and Audience.
3. If the app is in testing mode, add every Google account that will test vidi.
4. Create an OAuth Client ID.
5. Choose **Web application**.
6. Add authorized JavaScript origins:

```text
http://localhost:3000
https://vidi-game.vercel.app
```

7. Add the Supabase callback as the Authorized redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Google redirects to Supabase first. Do not enter the Vercel `/auth/callback` route as Google's provider callback.

### Supabase

1. Open Authentication → Providers → Google.
2. Enable Google.
3. Enter the Google Client ID.
4. Enter the Google Client Secret.
5. Save.

After Google and Supabase finish authentication, Supabase redirects the browser to:

```text
https://vidi-game.vercel.app/auth/callback
```

Reference: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 9. Decide how to test email authentication

Supabase's default mailer is intended only for development:

- It normally sends only to members of the Supabase organization.
- It has a very low rate limit.
- It has no production delivery guarantee.

Reference: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

Development options:

1. Use Google sign-in with two Google test accounts. This is the simplest option for friendship testing.
2. Add test addresses as Supabase organization members and use the default mailer.
3. Configure a development SMTP service such as Resend, Postmark, Brevo, or Mailtrap.

A custom domain is not required for deploying vidi or testing Google authentication. Some SMTP providers may require a verified sender domain before they will deliver messages broadly.

## 10. Configure authentication email templates

vidi supports:

```text
/auth/callback
/auth/confirm
```

When an email flow supplies `redirectTo`, Supabase templates may need to build the confirmation link from `{{ .RedirectTo }}` rather than `{{ .SiteURL }}`.

Example structure:

```html
<h2>Your vidi sign-in</h2>
<p>Your one-time code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">
  {{ .Token }}
</p>
<p>
  <a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    Sign in to vidi
  </a>
</p>
```

Check the generated link carefully because the current application also passes a callback path through `redirectTo`.

## 11. Test two authenticated accounts

Use genuinely independent browser sessions:

- Account A: desktop Chrome
- Account B: phone, another browser, or a private/incognito window

Two ordinary tabs in the same browser profile share the same Supabase session and cannot represent two users reliably.

Test in this order:

1. Open `/auth`.
2. Create Account A.
3. Set a username on `/profile`.
4. Create Account B in the separate session.
5. Set a different username.
6. From Account A, open `/friends`.
7. Send a request to Account B.
8. Attempt the same request again; it should be rejected.
9. Switch to Account B.
10. Open `/friends`.
11. Accept the request.
12. Open Account A's public profile.
13. Select **Start Game**.
14. Create the game.
15. Copy the lobby link.
16. Open it as Account B.
17. Confirm both players appear through Realtime.
18. Play through the deck.
19. Confirm results and personalities appear.
20. Remove the friendship.
21. Confirm neither user lists the other as a friend.
22. Send another request and test decline.

Also verify:

- Users cannot add themselves.
- Reversed duplicate requests are rejected.
- Only the recipient can accept.
- A third user cannot modify another pair's friendship.
- Blocked rows cannot be modified by normal friendship actions.

## 12. Test guest-to-account conversion

Use a fresh private browser or a browser on another phone:

1. Create or join a game as a guest.
2. Complete the game.
3. Select **Save Your Movie Profile**.
4. Authenticate using Google or email.
5. Confirm the previous game appears on `/profile`.
6. Confirm the ratings and watchlist results remain available.

Complete authentication in the same browser that played as the guest. The guest identity is stored in that browser's secure cookie.

## 13. Verify mobile and multiplayer behavior

On a physical phone, test:

- Home screen layout and safe areas
- Account creation and callback redirects
- Friendship requests and profile links
- Lobby Realtime updates
- Reconnecting after Wi-Fi interruption
- Swipe gestures with vertical scrolling locked
- Offline answer queue and reconnection
- Poster loading performance
- Results appearing without a manual reload
- Sharing and copying lobby links

The HTTPS Vercel address also removes the insecure-network limitations that affected Web Crypto APIs during LAN testing.

## 14. Inspect logs when something fails

### Vercel

```text
Project → Logs
Project → Deployments → Deployment → Runtime Logs
```

### Supabase

```text
Logs → Auth Logs
Logs → Postgres Logs
Logs → API Logs
```

Common failures:

- **Redirect goes to localhost:** incorrect Supabase Site URL.
- **`redirect_uri_mismatch`:** incorrect Google callback URI.
- **Friendship writes fail:** Phase 16 migration is missing.
- **Personality updates fail:** Phase 15 migration is missing.
- **Game creation fails:** a migration/RPC or the movie pool is missing.
- **Email address unauthorized:** Supabase default-mailer restriction.
- **Realtime does not update:** inspect the WebSocket connection and Supabase Realtime logs.
- **Build reports missing variables:** add them in Vercel and redeploy.
- **Deployment uses old values:** environment changes require a new deployment.

## 15. Preview and production environments

For the first development deployment, use:

- `main` branch → Vercel production deployment
- One live Supabase project → development/testing backend
- Vercel's free `.vercel.app` domain
- Google OAuth for account testing
- Local movie ingestion
- Manual SQL migrations through the Supabase dashboard

Avoid connecting arbitrary Vercel preview branches to a real production database later. Preview deployments write data just like production deployments.

When real users are approaching:

1. Create a separate production Supabase project.
2. Keep development data in the existing project.
3. Apply the same migrations to production through an automated workflow.
4. Give Preview and Production deployments separate credentials.
5. Configure custom SMTP.
6. Add a custom domain if desired.
7. Configure backups, monitoring, rate limits, and spending alerts.

Supabase supports Git-based migration deployment and isolated preview environments when the project is ready for a more formal workflow.

## Final pre-deployment checklist

- [ ] All code is committed and pushed.
- [ ] `.env.local` is not tracked.
- [ ] All required Supabase migrations are applied.
- [ ] RLS is enabled on all public tables.
- [ ] Friendship security migration is applied.
- [ ] Personality definitions exist.
- [ ] The movie pool contains at least 3,000 movies.
- [ ] Vercel environment variables are configured.
- [ ] Secrets do not have a `NEXT_PUBLIC_` prefix.
- [ ] `NEXT_PUBLIC_APP_URL` matches the real Vercel domain.
- [ ] Supabase Site URL matches the Vercel domain.
- [ ] Supabase callback URLs are allow-listed.
- [ ] Google uses the Supabase provider callback URI.
- [ ] Google test users are configured if the OAuth app is unpublished.
- [ ] Two independent accounts can authenticate.
- [ ] Friend request, accept, decline, remove, and start-game flows work.
- [ ] Guest history converts successfully after authentication.
- [ ] Realtime lobby updates work across two devices.
- [ ] Swipe gameplay and results work on a physical phone.
- [ ] Vercel and Supabase logs show no unexpected errors.
