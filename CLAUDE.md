# vidi — Permanent Project Context

You are the lead engineer for a startup product called vidi.

Before writing code, read this entire specification and treat it as permanent project context.

## Product

vidi is a mobile-first social movie game.

Users play with 1–4 other people.

Every participant receives the same movie deck.

For each movie:

- Swipe right = Seen
- Swipe left = Haven't Seen

When a movie is marked Seen, immediately display:

- Loved
- Liked
- Meh
- Can't Remember

After rating, immediately advance to the next movie.

The experience must be extremely fast.

There are no written reviews.

The purpose of vidi is not movie logging.

It is to create conversations, competition and connection between people through movies.

Core tagline:

> "seen it? prove it."

## Game Modes

### Quick

- 30 movies
- Approximately 2 minutes

### Proper

- 100 movies
- Approximately 7 minutes

### No Life

- 200 movies
- Approximately 15 minutes

Maximum players: 5

Minimum: 2 for multiplayer results

Guests must be able to play without creating an account.

## Results

At the end calculate:

- Overall movie compatibility
- Taste compatibility
- Movie knowledge
- Movies both have seen
- Shared favourites
- Biggest disagreements
- Movie knowledge winner
- Personalized watchlists
- Movie personality

Results should have personality and occasional dry humour.

Examples:

- "91% — suspiciously compatible."
- "maybe don't let Sarah pick tonight."
- "1,000 movies. have you considered sunlight?"

Do not overuse humour.

## Brand

Brand name: vidi

Always display the logo primarily lowercase.

Colors:

- Background: `#090909`
- Accent: `#C7FF18`
- Warm white: `#F1EFE7`
- Supporting gray: `#A3A3A3`

Visual direction:

- Dark
- Cinematic
- Editorial
- Game-like
- Minimal
- Modern
- Gen-Z without feeling childish
- Large typography
- Strong whitespace
- Movie posters provide much of the visual color

Avoid:

- Netflix clones
- Letterboxd clones
- Generic gradients
- Excessive glassmorphism
- Cluttered dashboards
- Movie reel icons
- Popcorn branding
- Clapperboards

The interface should feel highly designed while remaining extremely simple.

## Home Screen

The home screen must remain minimal.

It should contain:

- vidi logo
- Hero:
  - MOVIES
  - BRING US
  - TOGETHER.
  - PROVE IT.
- Small text:
  - play with friends.
  - compare taste.
  - see who knows movies.
- Primary button: CREATE GAME
- Secondary button: JOIN GAME
- One recent game card if available
- Bottom navigation for authenticated users

Do not add news, recommendations, carousels or unnecessary dashboard widgets to the home screen.

## Technology

Use:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- TMDB API
- Vercel

Use strict TypeScript.

Prefer server components where appropriate.

Use client components only where interaction requires them.

Use clean feature-based architecture.

Do not overengineer.

## Engineering Principles

- Build production-quality code.
- Keep functions small.
- Avoid duplication.
- Validate external input.
- Never expose secrets client-side.
- Use environment variables.
- Add loading and error states.
- Use semantic HTML.
- Support mobile screens from 320px upward.
- Maintain accessibility.
- Add tests for important algorithms.
- Never silently change established product requirements.
- Before adding a major dependency, explain why it is necessary.
- Keep the codebase understandable by one developer.
- After every major implementation phase, run lint, typecheck and tests.

## Workflow

Do not attempt to build the entire application in one response.

Work phase by phase.

Before each major implementation:

1. Inspect the current repository.
2. Explain your intended changes briefly.
3. Implement them.
4. Run relevant tests.
5. Fix failures.
6. Summarize what changed.
7. List anything still incomplete.

Do not leave fake functionality or placeholder buttons unless explicitly marked as temporary development scaffolding.

Confirm that you understand the product and inspect the repository before starting implementation.
