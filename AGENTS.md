# AGENTS.md

Guide for AI agents and people contributing to Elite 1337: rankings and Common Core stats for 1337 students, built on the 42 Intra API. Read this before changing code. `README.md` covers setup, `AUTH_DOCS.md` covers sign-in.

## Stack

- Next.js 15 App Router, React 19, TypeScript (strict), Zod 4.
- Auth.js v5 with the 42 provider. The session holds `user.id` (42 id) and `user.login`.
- 42 Intra API through one client: `src/lib/fortytwo-api.ts`.
- Neon Postgres (feedback, experiments), Supabase Storage (uploaded avatars).
- Hosted on Vercel, region `cdg1`. Tests: Vitest. Optional self-hosting with Docker: see `DOCKER.md`.

## Commands

```sh
npm run dev                            # http://localhost:3000
npx tsc --noEmit                       # type check
npx vitest run                         # tests
node scripts/generate-tweaks-css.mjs   # after ANY change to src/app/globals.css
```

Before you finish, the type check and every test must pass.

## Layout

| Path | Holds |
|---|---|
| `src/app/(app)/` | Signed-in pages. Every page starts with `await requireStudent()` (`src/lib/guard.ts`). |
| `src/app/(app)/admin/` | Admin pages. Guard with `isFeedbackAdmin(user.login)` and call `notFound()` for everyone else. Mark them `robots: { index: false }`. |
| `src/app/api/` | Route handlers. Check `auth()` first and return `Cache-Control: private, no-store`. |
| `src/lib/` | Data, 42 API access, caching and pure logic. Tests sit next to the code (`x.ts` → `x.test.ts`). |
| `src/components/` | UI. Server components by default; `'use client'` only when the component needs state or browser APIs. |
| `src/app/globals.css` | All styles. |
| `src/app/tweaks.generated.css` | Generated light/dark/accent overrides. Never edit it by hand. |
| `neon/*.sql` | Documents each Neon table. The app creates its tables on first use. |

## The 42 API budget (read this first)

The app shares **1,200 requests per hour and 2 per second** for every visitor. Running out shows every student "42 Intra is busy". Every change that calls 42 must respect it:

- **Go through `fortyTwoApi`.** It paces requests, retries short waits, and throws `RateBudgetError` when the hourly cap is hit. Never call `api.intra.42.fr` with `fetch` directly.
- **Cache every 42 read** with `unstable_cache` wrapped in `singleFlight`, so concurrent visitors share one fetch:
  ```ts
  const cached = singleFlight(unstable_cache(async (campus: number) => {
    // ...fortyTwoApi.request(...)
  }, ['1337-thing-v1'], { revalidate: 1800 }));
  ```
- **Cache inputs must be stable.** Never pass `Date.now()` or a millisecond timestamp as an argument. Round to the day (see `recentFrom` in `presence.ts`), or every request becomes a new cache entry.
- **Change the key version** (`-v1` → `-v2`) when the shape of the cached data changes. Changing the code inside the cached function also creates a new entry. Both mean one cold fetch after deploy, so say how many requests it costs.
- **Prefer shared data over per-student data.** Rankings, stats and corrections are fetched once for everyone. Per-student fetches (journey, logtime) must stay at a few requests and be cached.
- **Data that never changes after the fact** (finished evaluations, graded projects) is cached in fixed time slices: past slices for a month, only the current slice refreshes. See `validated.ts` and `correctors.ts`.
- **Pages must not wait on slow side services.** Wrap optional lookups in `withTimeout` (`src/lib/timeout.ts`) with a safe fallback.
- **Rankings** (`dataset.ts`) are cached per campus and refreshed every 30 minutes, about 53 requests per refresh. Don't add a second cache layer on top of them.
- **Test against a separate 42 application**, never the production key: give local runs their own `FORTYTWO_CLIENT_ID` and secret. A cold stats page costs about 280 requests.
- **42 hides some data from apps:** the XP/level table, upcoming evaluation slots, freezes and closes return 403 or nothing. Don't try to work around that.

## Data rules

- A Vercel cache entry must stay under **2 MB**. The per-campus rankings entries are 0.25–0.9 MB.
- The student id always comes from the session (`auth()`), never from a form, URL or request body.
- All database access goes through `sql()` from `src/lib/db.ts` (one Neon HTTP client; Docker points it at a local proxy). Use the tagged template (`` sql()`... ${value}` ``) only. Never build SQL strings.
- Limit writes per student inside the same statement (see `saveFeedback`, `saveFilterSession`).
- Side features fail soft: if `DATABASE_URL`, Supabase or 42 is unavailable, the page still renders without that part.
- Privacy: don't build public lists that name or shame students (unfilled evaluations, missing feedback, logtime of others). A student's own logtime is shown only to them.
- Photos go through the signed proxies (`intraPhotoUrl`, uploaded avatars), never raw 42 CDN links.

## UI and CSS

- **Every CSS change:** run `node scripts/generate-tweaks-css.mjs` and commit both CSS files.
- The default palette is dark (`#141414` cards, `#202020` raised, `#cafbd2` mint accent). The generator maps neutral colours to light mode automatically. Accent-coloured **text** (mint on white) does not map, so add an explicit `html[data-tw-light]:not(:has(.landing))` rule for it.
- Rules are compact, one selector per line, grouped with a short `/* comment */` per feature. Prefix classes per feature (`pl-` leaderboard, `st-` stats, `pc-` corrections, `xp-` calculator, `ex-` experiments).
- Reuse what exists before adding styles: `pl-chip`, `pl-token`, `fa-filter`, `ex-table`, `sv-*` dialogs, `KiwiNote` and `KiwiLoader` for empty and loading states.
- Icons come from `src/components/icons.tsx` (Phosphor). Add a named export there instead of importing Phosphor in a component. Use real icons, not text characters like ✓ or ✗.
- Phones: check 375 px width. Floating elements must clear the bottom bar (`bottom: calc(max(16px, env(safe-area-inset-bottom)) + 76px)` below 760 px).
- Respect `prefers-reduced-motion` for every animation.
- Filter and period links that sit deep in a page get `scroll={false}`, and their container gets `data-keep-scroll`.

## Code style

- Match the surrounding code: dense, small functions, early returns, `type` over `interface`.
- One short doc comment on each exported function or component, saying **why**, not how. No comments that restate the code.
- Name things for what they are in the product: `blackholed`, `cohort`, `circle`, `evaluation`.
- Parse every external input with Zod, both 42 responses and request bodies.
- Pure logic goes in `src/lib/*.ts` with a test. A browser component must never import a module that pulls in server code (`fortytwo-api`, `next/cache`, `node:crypto`); split pure helpers into their own file (see `xp-math.ts`).

## Testing changes for real

- Unit tests cover logic (`npx vitest run`). For UI or caching changes, run a production build (`npx next build && npx next start -p 3399`) in a **copy** of the repo with its own `.next`. Two Next servers sharing one `.next` folder corrupt each other.
- Measure 42 cost by logging inside `fortyTwoApi.request` in that copy. Report both cold and warm numbers.
- Never write test rows into Neon under a real student's id. Use fake ids (`9000000xx`) and delete them afterwards.
- Don't hammer third-party services (Web3Forms, Discord, 42) with repeated test requests.

## Git

- Branch from `main` for experiments; commit to `main` only when asked.
- Commit messages: a short imperative title (under about 72 characters), a blank line, then `-` bullets explaining what changed and why.
- Stage files by name. Never commit `.env*`, `.tmp/`, screenshots or local scratch files.
- Secrets live only in `.env.local` and Vercel. Never print or commit them.
