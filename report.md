# Elite 1337 — historical project report

> Historical snapshot, not current deployment instructions. See [implementation status](docs/implementation-status.md) and README for the reviewed fork changes.

Rankings and Common Core stats for 1337 students, built on the 42 Intra API.

- **Site:** https://www.elite-1337.app
- **Repository:** https://github.com/jawadelyousfi17/elite-1337
- **Last update to this report:** 2026-11-07 (code state at commit `9388b95` plus the Corrections campus fix pending)
- **Stack:** Next.js 15 (App Router), React 19, TypeScript (strict), Zod 4, Auth.js v5 with the 42 provider, Neon Postgres, Vercel (region `cdg1`), Vitest. Optional self-hosting with Docker.

This replaces the older V2/V3 report, which described the first prototype (another repository and domain, Supabase avatars). See [What was removed](#what-was-removed).

## Features

### Rankings
- Leaderboard with a podium, campus, Common Core cohort and status filters (including All), login search and infinite scroll with a Back to top button.
- Campuses: Khouribga (16), Benguerir (21), Tétouan (55), Rabat (75); Common Core cursus 21. Rankings are deduplicated across campus memberships and equal levels share a rank.
- Cohort is the UTC year of the Common Core `begin_at`. Blackholed, alumni and likely-frozen students have their own views. The Frozen view runs from the most recently seen: each frozen student's last session is read once from 42 (`users/:id/locations`, 1 request) and cached 60 days; students not fetched yet are listed last until a later visit loads them (about 15 s of fetching per visit).
- Race page: compares students' Common Core paths.
- Rankings are cached per campus and refreshed every 30 minutes (about 53 42-API requests per refresh).

### Stats and Corrections
- Stats: leaders, latest validations, return rate, Hardest projects (return rate per project, split by campus), validated projects and correctors, scoped by campus and period. A group project counts once per team, not once per member. Heavy slices are cached by fixed time slices (past slices for a month).
- Corrections: tabs for Waiting, Validated, Failed (graded, not yet retried) and Locked teams, grouped by team, filtered by campus, cohort, project and search. Validated and Failed offer 14, 30 and 60 days (14 by default, each window fetched only when opened); Locked offers 30 and 60 days. Waiting is a live queue refreshed every 5 minutes.
- Pending fix: rows now show only students the rankings list at the selected campus, so students from another campus (for example Rabat under Khouribga) do not appear.

### Rank card for GitHub (`/card`)
- A student opens `/card` (profile menu, "Rank card for GitHub"), picks a look and copies a Markdown or HTML snippet for their profile README. The image is an 840x320 SVG at `/api/card/<id>.svg?t=<signature>`: an ASCII portrait on the left, `login@elite-1337` key/value lines on the right (status, campus, cohort, level bar, ranks in cohort, campus and all of 1337 with top %) and the 1337 logo.
- **Picture:** the student's 42 photo by default, or an uploaded image (turned into ASCII in the browser, the file never leaves the device), their GitHub avatar, or any https image link. Chosen pictures are kept only as 80x40 gray cells in Neon (`card_art`, one row per student, see `neon/card-art.sql`); the 42 photo is not stored. Link and GitHub downloads are done on the server with SSRF guards (https only, no IP literals, every address and redirect must be public, 2 MB cap, no SVG).
- **Tweaks:** theme (Auto, Dark, Light, Black, Midnight, Forest, Plum), accent colour, monospace font, ASCII or block characters, and the logo. They travel in the link (`&theme=…&accent=…&font=…&art=…&logo=0`), so nothing is stored for them; unknown values fall back to the default.
- The route is public, because GitHub's image proxy sends no cookies. The signed token is the permission: an HMAC of the student's id, so only students who opened `/card` have a working link. Changing `AUTH_SECRET` revokes every link. Removed (anonymized) students have no card.
- Data comes from the cached rankings, so a card costs no 42 requests (a cold rankings refresh aside). The 42 photo comes from the CDN (not the API, so no request budget), is turned into gray cells with `sharp` (a pure-JavaScript JPEG decoder if that fails) and cached a month per photo; failed downloads are not cached. Responses are cached an hour on the CDN and 5 minutes in browsers (a placeholder for one minute while rankings load).

### XP calculator (`/xp`)
- Starts empty. Pick projects (core and advanced views, per-promo project lists), set a mark with a slider or the 100 / 125 presets.
- Hero card: level now → level after, rank among cohort and campus peers, and the **total XP gained** from the added projects.
- Each project card shows its changing "+N XP". A validated project only adds the XP of the extra mark; a lower mark adds nothing.
- Optional coalition bonus (percentage on top of every gain).
- Your level comes from your own journey data; the rank line streams in when the rankings are ready, so the page does not wait on them.

### Piscines, clusters and offers
- `/piscines`: Piscine Explorer by campus, year and month. `/clusters`: privacy-filtered cluster occupancy (no logins or user ids). `/offers`: student offers.

### Student pages
- `/me` and `/students/<login>`: Common Core journey, rank, logtime (shown only to the student), project history.
- Photos go through signed proxies; uploaded avatars are no longer used.

### Look and feel
- Dark Black surface with Round corners and the Mint accent are the defaults; the Tweaks panel offers six surfaces, six accents and four radii. Saved settings use a versioned `localStorage` key, so a changed default reaches everyone.
- Responsive: bottom bar on phones with the GitHub logo kept at the top, iPad landscape keeps the five top links on one line. Details in `AGENTS_DESIGN.md`.
- Landing page with a shiny-border GitHub star button, custom 404, privacy and terms pages.

### Community and admin
- Feedback dialog stored in Neon with a Discord alert, and an admin inbox.
- Admin pages (feedback, experiments, site stats) are limited to `ADMIN_LOGINS`, not indexed, and return 404 to everyone else.
- Campus promos and navbar announcements, "Try hack me" and HACKER badges.
- **Remove me:** a student can ask to be removed. The request is stored in Neon (`hide_requests`) and posted to Discord. The admin adds the login to `ANONYMIZED_LOGINS` and redeploys; the student then shows as "Anonymous student" with only their rank, and can no longer sign in (they see `/removed` and are told to contact the admin to join again).

## Architecture notes

- **One 42 client** (`src/lib/fortytwo-api.ts`): paces requests (2 per second), retries short waits, throws `RateBudgetError` at the hourly cap. `FORTYTWO_DEBUG=1` logs each request (path, page, wait, duration) without tokens.
- **Budget:** 1,200 requests per hour for everyone. Every 42 read is cached with `unstable_cache` inside `singleFlight`, with stable inputs and versioned keys. A cold stats page costs about 280 requests; a cold ranking about 53.
- **Data:** all database access goes through `sql()` (Neon HTTP client; a local proxy in Docker). Tables are created on first use and documented in `neon/*.sql`.
- **Auth:** the student id always comes from the session; sign-in is separate from ranking eligibility.
- **Side features fail soft** when the database, Discord or 42 is unavailable.

## Configuration

Private variables (see `.env.example`): `FORTYTWO_CLIENT_ID`, `FORTYTWO_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL`, `FORTYTWO_CAMPUS_IDS`, `FORTYTWO_CURSUS_ID`, `FORTYTWO_EXCLUDED_USER_IDS`, `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `ADMIN_LOGINS`, `DISCORD_FEEDBACK_WEBHOOK_URL`, `HACKER_LOGINS`, `ANONYMIZED_LOGINS`, and the optional `FORTYTWO_DEBUG`. The 42 redirect URI is `<site>/api/auth/callback/42`. Secrets live only in `.env.local` and Vercel. Local runs use their own 42 application, never the production key.

## Quality checks

- `npx tsc --noEmit` and `npx vitest run` must pass before finishing (157 tests at the last run).
- UI and caching changes are tried in a production build in a copy of the repo, with cold and warm 42 request counts reported.
- Test rows use fake ids (`9000000xx`) and are deleted afterwards.

## Known limits

- The request pacer is per server instance; a shared limiter would be needed for stronger traffic guarantees.
- 42 hides some data from apps (XP/level table, upcoming evaluation slots, freezes and closes), so some values are estimated or unavailable.
- The first visit after a deploy or an empty cache can be slow while shared data loads at 2 requests per second; the XP project list is cached for 30 days.
- Students listed at two campuses by the rankings appear under both, as on the leaderboard.
- The Remove me flow is manual: an admin must update `ANONYMIZED_LOGINS` and redeploy.

## What was removed

- Supabase-based uploaded avatars (dropped on 2026-11-05); photos now come only from the signed 42 photo proxy.

## Timeline

| Date | Milestone |
|---|---|
| 2026-10-24 | First version: rankings, Common Core progress, feedback stored in Neon with an admin inbox |
| 2026-10-25 | Alumni and frozen students, hacker badges, Vercel Analytics, move to elite-1337.app, caching and 42-request cuts, rankings refresh every 30 minutes |
| 2026-10-26 | Leaderboard A/B test (pages vs infinite scroll), corrections refresh, glass bottom bar |
| 2026-10-27 | XP calculator, validation feed |
| 2026-10-28 | Remove me, anonymized students, 404 page, dark and round defaults, iPad nav fix |
| 2026-10-29 | Promo XP projects, coalition bonus, landing emblem |
| 2026-11-01 | Campus promos, announcements, admin site stats |
| 2026-11-04 | Advanced XP calculator (community pull request) |
| 2026-11-05 | XP gain per project and total, grouped correction teams, infinite scroll, Supabase dropped |
