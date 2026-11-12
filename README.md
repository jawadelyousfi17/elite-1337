# Elite 1337

A Next.js leaderboard for people with 42 Intra accounts. It uses 42 OAuth and live 42 API data to rank students at configured 1337 campuses. This is an independent community project.

## Local setup

Requires Node.js 20+ and a 42 API application.

```sh
npm install
cp .env.example .env.local
# Add your 42 application ID and secret to .env.local.
# Generate AUTH_SECRET with: openssl rand -base64 32
npm run dev
```

The 42 application's registered redirect URI must be **exactly** `http://localhost:3000/api/auth/callback/42` for local sign-in. If the developer portal permits only one redirect URI, use a separate 42 development application. The production URI for this app is `https://www.elite-1337.app/api/auth/callback/42`. A site root URL alone does not complete Auth.js OAuth. The provider ID is `42`, which determines the callback path. Keep `.env.local` private; it is ignored by Git.

The live 42 API was queried to verify the 1337 campus IDs `16` (Khouribga), `21` (Benguerir), `55` (Tétouan), `75` (Rabat), and Common Core `42cursus` ID `21`. The app always includes these four campuses. An optional `FORTYTWO_CAMPUS_IDS` value is validated against this list. `FORTYTWO_CURSUS_ID` should be `21`.

Any authenticated 42 Intra account can open the leaderboard. Ranking eligibility is separate: only current students in the configured campus dataset appear in the results.

## How rankings work

The server fetches every page of `/v2/cursus_users` filtered by campus and canonical cursus, using `page[size]=100` and stable ID ordering. The API responses include the cursus level and nested user `active?` field, so thousands of individual profile requests are unnecessary. It verifies the reported `X-Total` count and unique cursus record IDs for each campus before showing ranks. If any page fails or the count changes, it shows an explicit incomplete-data state and publishes no partial ranking.

An eligible student must have a verified student account, active Common Core enrollment, and a finite level in the configured cursus. The classifier excludes API-marked staff, nonstudents, alumni, ended enrollments, inactive users, and IDs in the optional auditable `FORTYTWO_EXCLUDED_USER_IDS` configuration. A second distinct active record in that cursus is ambiguous and excluded. The `blackholed_at` field is a deadline on many active records, so it is not used alone to label or exclude a student. Students with multiple 1337 campus memberships have one global rank and one rank per campus. Ranks use competition ties; login and immutable 42 user ID make display order stable. Search and pagination happen after complete scope ranks are calculated.

Cohorts follow HUB’s promo grouping of the Common Core `cursus_users.begin_at` field: March 2019 is `2019-03`, every other 2019 start belongs to `2019-10`, and all other years use `YYYY`. Missing or invalid dates show as Unknown. Promo options are discovered from the shared ranked and blackholed population, so new years appear without a hardcoded list. The same cohort is used for leaderboard filters and ranks, profiles, corrections, XP comparisons, and stats. This grouping does not change ranking eligibility. It is computed from the existing raw campus caches, so it adds no 42 requests and needs no cache-key change. The leaderboard defaults to the signed-in student's primary campus and Common Core entry cohort. Every visit opens on that view, and Reset returns to it; other campuses and cohorts remain available for comparison. Every selected population restarts ranks at #1, while ties retain competition ranks. Login search does not change rank numbers.

The `/piscines` page ranks poolers by their C Piscine level for a verified year, month and primary campus. Candidate lists, Piscine progress and Common Core enrollment checks are complete, bounded, cached reads fetched in batches of 100 rather than per student. The selected session shows accepted/not-accepted totals and matching row symbols; “not accepted” means no Common Core enrollment was found because the 42 API does not expose an official rejection result. Accounts without a readable Piscine level are counted but not ranked. Student photos follow the rules in the avatar section below, and profile links open 42 Intra in a new tab.

The private dashboard and each on-site student profile show the latest updated project plus workstation session time from 42 locations. This is an API-derived total, not an official Intra accounting figure. Weekly progress uses Monday–Sunday UTC with a 30-hour target. Monthly progress preserves the 28th–27th UTC cycle with a 120-hour target. Wallet and correction points appear on the signed-in student's dashboard. Profile and project details cache for ten minutes; session time caches for five minutes. If an optional 42 endpoint fails, its card shows an unavailable state without hiding the ranking dataset.

The XP calculator supports a student's progress or a custom starting level. Click the pencil beside the starting level, type a value such as `10.89` (0–30, up to two decimal places), then press Enter or click away to save; Escape cancels. Custom plans offer both Common Core tracks and Advanced projects, count each project's full XP, and carry no personal completion history, rank, or automatic coalition bonus. The coalition bonus toggle and percentage remain available for custom plans, with the clan row hidden; the bonus starts off until enabled. Changing the custom starting level keeps the selected projects and marks. `/xp?level=10.89` opens that starting point directly. It uses the existing project catalogs without fetching a student's journey or coalition.

## Cluster Explorer (V3)

The protected `/clusters` route supports Khouribga, Benguerir, Tétouan, and Rabat. It requires a 42 session and verified membership in at least one of those campuses. Members can switch among the four campuses. The 42 API's `/v2/campus/:id/locations?filter[active]=true` endpoint supplies active sessions; the server verifies every active page before publishing occupancy. Host groups, rows and positions are derived from workstation names, so campuses need not share cluster IDs or prefixes. Occupied seats show the student login, signed-proxy Intra avatar and relative login time already included in the active-location response; this adds no per-student API reads. Raw location records and photo CDN URLs never reach the browser.

The logical map combines current active hosts with a bounded sample of up to 500 recent campus location records. That sample is **not** a complete enabled-seat inventory. Occupied means one valid open session on a host from a complete, fresh snapshot. Conflicts, malformed or stale sessions, incomplete API pages, and old snapshots are Unknown. Available still requires a verified enabled inventory entry and no active session; because no authoritative inventory has been provided yet, outlined posts are observed workstations rather than a claim that every one is vacant.

The Intra cluster screens supplied for Khouribga are the interaction reference: cluster tabs, descending row labels and avatar-filled occupied desks. They are not verified workstation coordinates. `src/lib/cluster-layout.ts` defines a version-controlled physical-layout registry with campus, cluster, workstation, x/y position, optional rotation and room label, and enabled status. It remains empty until an authoritative layout is supplied; meanwhile the UI renders an explicitly labeled logical map from each hostname's cluster, row and position.

The client checks for updates every 60 seconds while visible and avoids overlapping requests. Active-host snapshots are cached server-side for 180 seconds; the recent-host sample is cached for one day. The UI shows the actual snapshot time and marks states Unknown after four minutes or an API failure. These caches limit API traffic but, like the ranking cache, do not provide a global request budget across all serverless instances. If traffic outgrows the current setup, the smallest viable addition is a shared cache and distributed rate limiter; a database is not needed for cluster occupancy.

## Admin live presence

`/admin/online` shows students actively using Elite 1337 itself, not 42 campus locations. A signed-in browser sends a private heartbeat once a minute while visible. Neon keeps one row per student with their 42 id, login, normalized current section and last-seen time; the page treats heartbeats from the last five minutes as online. The view uses the same `ADMIN_LOGINS` guard as feedback and site stats, and the heartbeat does not create extra page views. General analytics remain anonymous/keyed counts.

## API limits and caching

The shared server-side 42 client spaces requests at least 600 ms apart and caps its own traffic at 1,180 requests per hour per server instance, leaving a small margin under the stated 1,200/hour application limit. HTTP 429 and transient server failures use bounded exponential backoff. The initial complete fetch is about a few dozen paginated requests and can take tens of seconds.

Next.js Data Cache retains successful complete ranking and Piscine datasets for one hour. Failed or partial refreshes are not cached as complete data. Cache freshness is displayed on the leaderboard. Serverless instances do not share the in-memory request pacer, and cache behavior depends on deployment infrastructure; this MVP cannot guarantee a global application-wide request limit or durable rankings without shared infrastructure. Heavy concurrent cold starts can hit the 42 limit. The UI shows a rate-limit or incomplete-data state in that case. If traffic grows, move the API pacer and complete snapshots to shared persistent infrastructure.

## Student photos

By default, each student shows their 42 Intra photo. The 42 API returns `user.image` URLs on `cdn.intra.42.fr`, which answer HTTP 403 to a browser without an Intra session. The server keeps only the validated `small` (175 × 175) CDN path in the cached datasets. Pages emit HMAC-signed `/api/photos/:userId` references. That route requires the 42 session, then downloads the photo with the application token, checks its image bytes, and returns it with `private, max-age=86400, immutable` caching (the CDN path changes when a student changes their photo). CDN downloads are not 42 API calls and do not use the API request budget. If the CDN refuses a photo, the avatar falls back to initials. As of 2026-10-22, token-authenticated CDN reads succeeded consistently; an earlier test on 2026-10-19 saw repeated 403s, so watch for regressions.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm run verify:api  # optional live check; uses your 42 API request budget
```

Tests cover cohort semantics, Piscine filters and admission uncertainty, ties, campus scope, eligibility, pagination, incomplete pages, HTTP 429 retry, logtime boundaries and overlap, and the local hourly budget. V3 tests cover workstation normalization, campus groups, session conflicts and staleness, availability versus Unknown, disabled seats, privacy, membership checks, authenticated endpoint behavior, and API failure fallback. V3.1 tests cover upload validation, owner checks, private reads, replacement, deletion, batched mapping, missing objects, and storage errors. Mock fixtures exist only in tests and never appear as real student records.

## Vercel deployment

Set `FORTYTWO_CLIENT_ID`, `FORTYTWO_CLIENT_SECRET`, `FORTYTWO_CURSUS_ID=21`, `FORTYTWO_PISCINE_CURSUS_ID=9`, `AUTH_SECRET`, and `AUTH_URL=https://www.elite-1337.app` as private Vercel environment variables. `FORTYTWO_CAMPUS_IDS=16,21,55,75` and `FORTYTWO_EXCLUDED_USER_IDS` are optional. V3.1 avatars additionally require private `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values plus the one-time SQL setup above. Register `https://www.elite-1337.app/api/auth/callback/42` as the exact 42 redirect URI. Redeploy after changing Vercel environment variables, then check a real 1337 sign-in. The protected pages allow up to 60 seconds for a cold complete refresh; verify that your Vercel plan supports that function duration. Use HTTPS in production.
