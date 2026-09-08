# vidi authentication emails

These are copy-and-paste templates for hosted Supabase. Files in this folder
do not automatically update the dashboard. No email settings have been changed.

Colours match the current app: blue `#2227F7` background, yellow `#FFD628`
buttons and accents, warm-white `#F1EFE7` text, and dark `#090909` button labels.

| Supabase template | Body file | Subject |
| --- | --- | --- |
| Confirm signup | `confirm-signup.html` | `one last thing — confirm your email` |
| Magic Link | `magic-link.html` | `your way back into vidi` |

In the original vidi project, open Authentication → Email → Templates. Select
the matching template, paste the complete HTML file into the body editor, enter
the subject above, preview it, and save when ready.

Keep `{{ .ConfirmationURL }}` and `{{ .Token }}` exactly as written. Supabase
fills them at send time. The existing app sends `emailRedirectTo` to
`/auth/callback?next=...`, exchanges the returned authorization code, and also
accepts six- or eight-digit email OTPs. Using `ConfirmationURL` preserves that flow and
the requested destination. The code provides an alternative if the link cannot
complete in a different browser. The input supports the current eight-digit
Supabase codes and remains compatible with six-digit codes.

Before launch, confirm the Site URL and permitted redirects match your final
website. Test signup and returning-user sign-in on the isolated environment,
including both the button and code paths using separate fresh emails: successful
verification consumes the credential. Use the OTP code if a mail scanner has
already consumed a link only if the code remains valid; otherwise request a fresh
email and enter its code. Do not promise a fixed expiry time in the copy because
expiry depends on Supabase settings.

The layout uses presentation tables, inline CSS, system fonts, explicit colours,
and no external images or tracking. Preview at narrow widths and send a real
test to Gmail and Outlook before launch; email clients can alter dark colours.
Keep Resend click tracking disabled for authentication emails.

The lowercase logo is rendered as text so it works with images blocked; it does
not reproduce the app's custom font. These templates cover signup and magic-link
login only, not password recovery or invitations.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
