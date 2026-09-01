# vidi authentication setup and testing

This guide configures guest-to-account conversion, Google sign-in, email magic links, six-digit email OTPs, profiles, and public profile pages.

## 1. Prerequisites

- A live Supabase project containing the earlier vidi migrations.
- A Google Cloud project if Google authentication will be tested.
- Node.js 20.9 or newer.
- The vidi application dependencies installed with `npm install`.

Never expose `SUPABASE_SERVICE_ROLE_KEY`. It belongs only in server environments such as `.env.local` and Vercel environment variables.

## 2. Apply the account migration

Open Supabase Dashboard → SQL Editor → New query. Copy and run:

```text
supabase/migrations/202608310001_account_conversion.sql
```

The migration:

- Adds the service-role-only `claim_guest_history` function.
- Makes safe profile fields publicly readable.
- Adds achievement and profile-achievement tables for future awarding logic.
- Enables RLS on the new tables.

Confirm it succeeded with:

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'claim_guest_history';

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'achievements', 'profile_achievements');
```

Expected: one function row and `rowsecurity = true` for all three tables.

## 3. Configure local environment variables

Create `.env.local` from `.env.example` and supply real values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
TMDB_API_KEY=YOUR_TMDB_API_KEY
TMDB_ACCESS_TOKEN=YOUR_TMDB_ACCESS_TOKEN
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Restart `npm run dev` after changing environment variables.

## 4. Configure Supabase redirect URLs

In Supabase Dashboard, open Authentication → URL Configuration.

Set the Site URL for local development:

```text
http://localhost:3000
```

Add these Redirect URLs:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/confirm
http://192.168.8.150:3000/auth/callback
http://192.168.8.150:3000/auth/confirm
https://YOUR_PRODUCTION_DOMAIN/auth/callback
https://YOUR_PRODUCTION_DOMAIN/auth/confirm
```

Replace placeholders with exact addresses. Supabase rejects redirects that are not allow-listed. For production, use HTTPS.

## 5. Configure email magic links and OTPs

Email authentication is normally enabled by default under Authentication → Providers → Email. Keep email confirmation enabled.

Open Authentication → Email Templates → Magic Link and use a template containing both the code and link:

```html
<h2>Your vidi sign-in</h2>
<p>Your one-time code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>Or use this secure link:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    Sign in to vidi
  </a>
</p>
```

The code is entered on `/auth`. The link is handled by `/auth/confirm`. Codes and links are single-use and expiration is enforced by Supabase.

For real users, configure custom SMTP under Project Settings → Authentication → SMTP. Supabase's default test mailer has delivery and recipient limitations.

## 6. Configure Google authentication

### Google Cloud

1. Open Google Auth Platform.
2. Configure Branding, Audience, and Data Access.
3. Include scopes `openid`, `userinfo.email`, and `userinfo.profile`.
4. Create an OAuth Client ID with application type **Web application**.
5. Add authorized JavaScript origins:

```text
http://localhost:3000
https://YOUR_PRODUCTION_DOMAIN
```

6. Add the Supabase callback URI displayed in Supabase Dashboard → Authentication → Providers → Google. It normally resembles:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

### Supabase

1. Open Authentication → Providers → Google.
2. Enable Google.
3. Paste the Google Client ID and Client Secret.
4. Save.

The Google secret stays in Supabase and must not be added to browser environment variables.

## 7. Start the application

```bash
npm run dev
```

Open:

```text
http://localhost:3000/auth
```

For phone testing, start Next.js on the LAN interface if necessary:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then use `http://YOUR_PHONE_LAN_IP:3000`. The phone and computer must be on the same network, and the Windows firewall must permit Node.js on the private network.

## 8. Test email OTP

1. Open `/auth` in a private browser window.
2. Enter a valid email.
3. Select **Email me a sign-in link**.
4. Confirm the success message appears.
5. Enter the six-digit code from the email.
6. Select **Verify code**.
7. Confirm the browser redirects to `/profile`.
8. Confirm the new row exists:

```sql
select id, email, email_confirmed_at
from auth.users
order by created_at desc
limit 5;
```

Invalid, incomplete, expired, and reused codes should remain rejected without creating an application session.

## 9. Test the magic link

1. Sign out or use another private window.
2. Request an email sign-in from `/auth`.
3. Open the link once.
4. Confirm it redirects through `/auth/confirm` and ends at `/profile`.
5. Try opening the same link again; it should be rejected as expired or already used.

## 10. Test Google sign-in

1. Open `/auth` and select **Continue with Google**.
2. Complete Google's consent screen.
3. Confirm the browser returns through `/auth/callback` and opens `/profile`.
4. Confirm `auth.users` and `public.profiles` contain the same user ID.

If Google reports `redirect_uri_mismatch`, compare the Google authorized redirect URI with the Supabase provider callback character-for-character.

## 11. Test guest-to-account conversion

Use a fresh private browser window so it has a new guest cookie.

1. Create or join a game as a guest.
2. Complete the game and open the verdict.
3. Confirm **Save your movie profile** displays the number already rated.
4. Create an account using OTP, magic link, or Google.
5. Open `/profile`.
6. Confirm movies seen and games played include the guest game.
7. Confirm the recent game opens correctly.

Database verification:

```sql
select id, game_id, profile_id, guest_session_id, progress
from public.game_players
where profile_id = 'AUTH_USER_UUID';

select count(*) as duplicate_ratings
from (
  select game_player_id, movie_id
  from public.ratings
  group by game_player_id, movie_id
  having count(*) > 1
) duplicates;
```

Expected: claimed players have `profile_id` populated and `guest_session_id` cleared; duplicate count is zero.

## 12. Test profiles

1. Open `/profile` while authenticated.
2. Set a username containing 3–24 letters, digits, or underscores.
3. Update display name and optionally an HTTPS avatar URL.
4. Confirm invalid usernames and malformed URLs are rejected.
5. Open `/profile/YOUR_USERNAME` in a signed-out browser.
6. Confirm the public profile loads without exposing email or authentication information.
7. Confirm no written-review or follower-count fields appear.

## 13. Security checks

- Attempt `/profile` signed out: it must redirect to `/auth`.
- Change a profile update request to another user ID: the server ignores client identity and updates only the authenticated user's row.
- Try calling `claim_guest_history` with the anon key: PostgreSQL should deny execution.
- Verify the guest cookie is HttpOnly and disappears after a successful claim.
- Verify public profile requests never return `auth.users.email`.
- Verify malformed `next` parameters such as `https://attacker.example` do not redirect off-site.
- Verify service-role credentials do not appear in browser bundles, browser storage, logs, or network responses.

## 14. Production configuration

In Vercel, add the same environment variables for Production and Preview as appropriate. Use the production application URL for `NEXT_PUBLIC_APP_URL`. Add every legitimate preview/production callback URL to Supabase's redirect allow list, but avoid unnecessarily broad wildcard redirects.

Before release, configure custom SMTP, Google consent-screen branding, HTTPS, and production Site URL. Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four commands should succeed before deployment.

## Troubleshooting

- **No email arrives:** check Supabase Auth logs, spam, SMTP configuration, and default-mailer recipient limits.
- **OTP rejected:** request a fresh code and use only the latest email.
- **Magic link opens the wrong host:** correct Site URL, redirect allow list, and the email template.
- **Google redirect mismatch:** fix the Google OAuth redirect URI using Supabase's provider callback, not the app callback.
- **Guest history missing:** confirm authentication occurred in the same browser with the original guest cookie and that the account migration was applied.
- **Mobile callback fails:** add the exact LAN URL to Supabase redirects and ensure the phone can still reach the development server.
