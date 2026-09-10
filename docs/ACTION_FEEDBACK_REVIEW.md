# Action feedback review

Updated 2026-09-10. Work is on the local `test` branch. No push, deployment,
production mutation, or database migration was performed. Earlier uncommitted
release work was preserved.

## User-visible changes

- Shared buttons show a spinner and an action-specific label while their form
  submits, expose `aria-busy`, and disable repeat clicks. Completed watchlist
  actions show a completed label. Reduced motion keeps the status text without
  requiring an animated spinner.
- Profile editing shows saving, saved, field-validation, duplicate-username,
  expired-session, and request-failure feedback. Controlled inputs preserve
  edits after failure. A submission lock prevents queued duplicate saves. Editing
  after a save restores the Save button and shows unsaved-change feedback.
- Watchlist add, save, watched, and remove actions use persistent confirmation
  notifications, including when a successful action removes its row. Failures
  remain actionable and never become a false success. Added status follows the
  saved personal list, so a removed movie can be added again.
- Google/email sign-in, OTP verification, game creation/join/start/leave,
  sign-out, friend actions, challenge actions, and installation have pending
  feedback. Sign-out errors now return a message instead of redirecting as if
  sign-out succeeded.
- Copy/invite/challenge sharing prevents parallel operations and reports actual
  success or failure. Clipboard fallback no longer claims copying succeeded
  after failure. Cancelling a native share sheet is not treated as an error.
- Result-image sharing shows progress, prevents format changes and duplicate
  requests while generating, and distinguishes shared from download started.
- Game-code lookup, movie search, and error retries have loading feedback.
  Normal route loading, selections, and fast swipe/save-queue feedback remain
  the completion signals for navigation and immediate interactions.

Uses existing React/Next.js/Tailwind dependencies and the blue/yellow theme.
New shared pieces are `ActionFeedbackProvider`, `ActionForm`, `NavigationForm`,
`RetryButton`, and `useFeedbackAction`.

## Verification

- Lint, strict TypeScript, and optimized production build passed.
- All 94 unit tests passed. New profile tests exposed and fixed a malformed-URL
  refinement that could throw instead of returning a validation error.
- Mobile profile/watchlist browser test passed at 320px: delayed save, exactly
  one POST for duplicate submissions, saved heading, taken username, HTTPS
  validation, failed request, preserved values, successful retry, no horizontal
  overflow, and watchlist add/watched/remove/re-add availability.
- Auth browser test passed with intercepted Auth requests: duplicate-send guard,
  failed send, successful retry, sent confirmation, expired-code feedback, and
  re-enabled verification. No emails were sent by this test.
- Two-player gameplay and clipboard failure/success regression passed, including
  complete results and PNG generation. The clipboard promise is held open by
  the test until pending feedback is asserted, then deliberately rejected.
  Host-start navigation now uses the same 30-second allowance as group tests;
  the earlier five-second deadline expired while the UI showed Starting game.
- Inspected `test-results/profile-feedback-mobile.png` for readable feedback.

Tests run on a local build with Supabase `gugfrvtsjnflttgyreat` only. Temporary
authenticated fixtures are removed by the profile test's cleanup.

The ignored `.env.e2e.local` contains duplicate Supabase URL entries, including
production. The initial guard refused it before any fixture writes. Feedback
tests instead use the independently checked `.env.local`, with exactly one
test-project URL. Environment files were not modified; do not use the mixed
file for subsequent E2E runs without reviewing its configuration.

## Next

Review the changes on `test`, and obtain the
user's approval before any Preview or Production deployment. Native Google
redirect, installation, and OS share-sheet behavior should also be checked on
the user's device when the reviewed test build is available.
