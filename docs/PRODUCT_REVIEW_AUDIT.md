# vidi Product Review Audit

Updated after the successful 2–5 player multiplayer results verification.

## Audit

| Requirement | Implemented? | Quality | Problems | Recommended fix |
| --- | --- | --- | --- | --- |
| Core game | Yes | Good | Main Quick-game path works; Proper and No Life have less real-world testing. | Smoke-test the longer modes. |
| Guest flow | Yes | Good | Guest creation, joining, and gameplay work. | Test guest-to-account conversion through the browser. |
| Multiplayer | Yes | Good | The complete 2–5 player path has been verified. | Monitor realtime errors after launch. |
| Movie deck | Yes | Good | Deterministic selection and diversity rules exist. | Periodically review the quality of the synced movie pool. |
| Swipe speed | Yes | Good | The optimistic answer queue is fast. | Continue testing on slower Android devices and networks. |
| Results | Yes | Good | Group calculations and personal result views have been corrected. | Decide whether historical completed games need recalculation. |
| Compatibility | Yes | Good | Pair and group calculations are deterministic. | Product-test whether scores feel believable with real users. |
| Movie knowledge | Yes | Good | The score is based on actual deck exposure. | Explain the score more clearly if users misunderstand it. |
| Shared favourites | Yes | Good | Group favourites require every participant to rate the movie Loved. | No immediate change needed. |
| Disagreements | Yes | Good | Personal disagreements involve the viewer and identify both players. | No immediate change needed. |
| Watchlists | Yes | Good | Personal and shared lists are generated and can be saved. | Add browser coverage for saving and reopening lists. |
| Profiles | Yes | Fair | Profiles and public username routes exist. | Perform a focused profile privacy and empty-state review. |
| Friends | Yes | Fair | Requests, acceptance, and notification markers exist. | Add E2E coverage for requests, acceptance, and notification clearing. |
| Challenges | Partial | Experimental | Implemented behind `ENABLE_CHALLENGES=false` and not validated as a core flow. | Keep disabled until separately reviewed. |
| Sharing | Yes | Good | PNG share cards work in E2E testing. | Test native sharing on Android and iPhone. |
| Brand consistency | Mostly | Good | Main screens follow the dark editorial vidi identity. | Review secondary pages for typography and spacing drift. |
| Mobile responsiveness | Mostly | Good | Small screens and mobile safe areas are supported. | Perform another physical-device pass at 320–430px widths. |
| Installable PWA | Yes | Good | Manifest, icons, install prompt, and offline fallback exist. | Reverify after major layout or service-worker changes. |
| Failure states | Mostly | Good | Branded error, loading, and empty states exist. | Verify that every state can be triggered and recovered from correctly. |
| Performance | Mostly | Good | The WebGL background is deferred and now remains unloaded when reduced motion or reduced data is requested. Physical-device swipe profiling is still outstanding. | Profile swipe rendering on a low-end Android device. |
| Accessibility | Mostly | Good | Global skip navigation, visible focus, accessible contrast, reduced-motion handling, and keyboard-safe install-modal behavior are implemented. A manual screen-reader pass remains outstanding. | Test the core journey with VoiceOver and TalkBack on physical devices. |
| Security | Mostly | Good | RLS hardening, answer protection, and database-backed rate limiting exist. | Run the security probe after every database migration. |
| Testing | Yes | Good | There are 87 automated tests and complete 2–5 player E2E coverage. | Add Friends, authentication, and watchlist E2E flows. |
| Analytics | Yes | Good | Allowlisted, privacy-conscious analytics events exist. | Validate analytics after choosing a production provider. |
| Monthly recap | Foundation only | Incomplete | Calculation foundations exist without a complete user-facing experience. | Leave this until after core product validation. |

## Latest verification

- ESLint passed.
- Strict TypeScript checking passed.
- Unit and integration suite: `87 passed`.
- Production build passed.
- Isolated deployed E2E suite: `4 passed (3.4m)`.
- Verified Quick games with 2, 3, 4, and 5 players.
- Verified group result unlocking and PNG share-card generation.
- Production was manually smoke-tested after merge.

## Highest-priority remaining work

1. Test performance on a real lower-end Android device.
2. Complete a physical-device VoiceOver and TalkBack pass.
3. Add E2E coverage for friends, authentication, and watchlist saving.
4. Add a guest-to-account conversion browser test.
5. Physically test Proper and No Life modes.

## Serious issues addressed

- Added a keyboard-visible skip link and stable page-content target.
- Added focus containment, initial focus, Escape dismissal, focus restoration,
  and an accessible description to the install dialog.
- Removed incorrect menu roles from the account navigation disclosure and
  restored focus to its trigger when Escape closes it.
- Corrected normal-text contrast for personality-purple and tertiary-gray
  text while preserving the stronger original purple for surfaces.
- Prevented the decorative WebGL background from loading or rendering when
  reduced motion is requested.
- Hid the decorative WebGL canvas from assistive technology.
- Verified the landing page at 320, 360, 375, 390, and 430px with no
  horizontal overflow.

## Current recommendation

The core game is in a strong MVP state. The next phase should validate these
accessibility and performance protections on physical iOS and lower-end
Android devices rather than adding another feature.
