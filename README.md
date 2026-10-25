# Elite 1337

A Next.js leaderboard for people with 42 Intra accounts. It uses 42 OAuth and live 42 API data to rank students at configured 1337 campuses. Optional Supabase Storage and one mapping table support student-uploaded avatars. This is an independent community project.

## Local setup

Requires Node.js 20+ and a 42 API application.

```sh
npm install
cp .env.example .env.local
# Add your 42 application ID and secret to .env.local.
# Generate AUTH_SECRET with: openssl rand -base64 32
npm run dev
```

The 42 application's registered redirect URI must be **exactly** `http://localhost:3000/api/auth/callback/42` for local sign-in. If the developer portal permits only one redirect URI, use a separate 42 development application. The production URI for this app is `https://www.elite1337.app/api/auth/callback/42`. A site root URL alone does not complete Auth.js OAuth. The provider ID is `42`, which determines the callback path. Keep `.env.local` private; it is ignored by Git.

The live 42 API was queried to verify the 1337 campus IDs `16` (Khouribga), `21` (Benguerir), `55` (Tétouan), `75` (Rabat), and Common Core `42cursus` ID `21`. The app always includes these four campuses. An optional `FORTYTWO_CAMPUS_IDS` value is validated against this list. `FORTYTWO_CURSUS_ID` should be `21`.

Any authenticated 42 Intra account can open the leaderboard. Ranking eligibility is separate: only current students in the configured campus dataset appear in the results.

## How rankings work

The server fetches every page of `/v2/cursus_users` filtered by campus and canonical cursus, using `page[size]=100` and stable ID ordering. The API responses include the cursus level and nested user `active?` field, so thousands of individual profile requests are unnecessary. It verifies the reported `X-Total` count and unique cursus record IDs for each campus before showing ranks. If any page fails or the count changes, it shows an explicit incomplete-data state and publishes no partial ranking.

An eligible student must have a verified student account, active Common Core enrollment, and a finite level in the configured cursus. The classifier excludes API-marked staff, nonstudents, alumni, ended enrollments, inactive users, and IDs in the optional auditable `FORTYTWO_EXCLUDED_USER_IDS` configuration. A second distinct active record in that cursus is ambiguous and excluded. The `blackholed_at` field is a deadline on many active records, so it is not used alone to label or exclude a student. Students with multiple 1337 campus memberships have one global rank and one rank per campus. Ranks use competition ties; login and immutable 42 user ID make display order stable. Search and pagination happen after complete scope ranks are calculated.

The cohort is the UTC year of the Common Core `cursus_users.begin_at` field, verified against live student samples; it is shown as Unknown when absent. This is an enrollment year, and the API does not confirm a separate official campus promotion label. The leaderboard defaults to the signed-in student's primary campus and Common Core entry cohort. Every visit opens on that view, and Reset returns to it; other campuses and cohorts remain available for comparison. Every selected population restarts ranks at #1, while ties retain competition ranks. Login search does not change rank numbers.

The `/piscines` page queries complete, bounded lists of users by verified 42 Piscine year, month and primary campus. A Common Core enrollment verifies an Accepted label, including former students. The current API data does not prove rejection; those candidates remain Unknown and the Not accepted filter has no results. Piscine levels are omitted until they can be retrieved reliably within the API budget. Student photos follow the rules in the avatar section below. On-site and external Intra links are separate, and external links open in a new tab.

The private dashboard and each on-site student profile show the latest updated project plus workstation session time from 42 locations. This is an API-derived total, not an official Intra accounting figure. Weekly progress uses Monday–Sunday UTC with a 30-hour target. Monthly progress preserves the 28th–27th UTC cycle with a 120-hour target. Wallet and correction points appear on the signed-in student's dashboard. Profile and project details cache for ten minutes; session time caches for five minutes. If an optional 42 endpoint fails, its card shows an unavailable state without hiding the ranking dataset.

## Cluster Explorer (V3)

The protected `/clusters` route supports Khouribga, Benguerir, Tétouan, and Rabat. It requires a 42 session and verified membership in at least one of those campuses. Members can switch among the four campuses. The 42 API's `/v2/campus/:id/locations?filter[active]=true` endpoint supplies active sessions; the server verifies every active page before publishing occupancy. Host groups are discovered from observed workstation names, so campuses need not share the same cluster IDs. The browser receives workstation IDs and anonymous states only, never user IDs, logins, photos, raw location records, or precise session timestamps.

The directory combines current active hosts with a bounded sample of the 100 most recent campus location records. That sample is **not** a complete enabled-seat inventory. Occupied means one valid open session on a host from a complete, fresh snapshot. Conflicts, malformed or stale sessions, incomplete API pages, and old snapshots are Unknown. Available requires a verified enabled inventory entry and no active session; because no authoritative inventory has been provided yet, the current deployment cannot certify empty seats. The Find Empty Seats control therefore reports zero verified available seats rather than guessing from absence of a session.

The screenshots supplied for Khouribga are a visual reference, not verified workstation coordinates. `src/lib/cluster-layout.ts` defines a version-controlled layout registry with campus, cluster, workstation, x/y position, optional rotation and room label, and enabled status. It is intentionally empty. The UI uses an explicitly labeled directory fallback on every campus. Add a physical map only after an authoritative layout and enabled-seat inventory have been supplied and checked against 42 host IDs.

The client checks for updates every 60 seconds while visible and avoids overlapping requests. Anonymous active-host snapshots are cached server-side for 180 seconds; the recent-host sample is cached for one day. The UI shows the actual snapshot time and marks states Unknown after four minutes or an API failure. These caches limit API traffic but, like the ranking cache, do not provide a global request budget across all serverless instances. If traffic outgrows the current setup, the smallest viable addition is a shared cache and distributed rate limiter; a database is not needed just to render anonymous occupancy.

## API limits and caching

The shared server-side 42 client spaces requests at least 600 ms apart and caps its own traffic at 1,180 requests per hour per server instance, leaving a small margin under the stated 1,200/hour application limit. HTTP 429 and transient server failures use bounded exponential backoff. The initial complete fetch is about a few dozen paginated requests and can take tens of seconds.

Next.js Data Cache retains successful complete ranking and Piscine datasets for one hour. Failed or partial refreshes are not cached as complete data. Cache freshness is displayed on the leaderboard. Serverless instances do not share the in-memory request pacer, and cache behavior depends on deployment infrastructure; this MVP cannot guarantee a global application-wide request limit or durable rankings without shared infrastructure. Heavy concurrent cold starts can hit the 42 limit. The UI shows a rate-limit or incomplete-data state in that case. If traffic grows, move the API pacer and complete snapshots to shared persistent infrastructure.

## Student-uploaded avatars (V3.1)

By default, each student shows their 42 Intra photo. The 42 API returns `user.image` URLs on `cdn.intra.42.fr`, which answer HTTP 403 to a browser without an Intra session. The server keeps only the validated `small` (175 × 175) CDN path in the cached datasets. Pages emit HMAC-signed `/api/photos/:userId` references. That route requires the 42 session, then downloads the photo with the application token, checks its image bytes, and returns it with `private, max-age=86400, immutable` caching (the CDN path changes when a student changes their photo). CDN downloads are not 42 API calls and do not use the API request budget. If the CDN refuses a photo, the avatar falls back to initials. As of 2026-10-22, token-authenticated CDN reads succeeded consistently; an earlier test on 2026-10-19 saw repeated 403s, so watch for regressions.

An uploaded avatar replaces the 42 photo. A signed-in 42 student can upload, preview, replace, or remove their own avatar on `/me`. The app accepts JPEG, PNG, or WebP files up to 4 MB, checks the bytes and dimensions, strips metadata, crops to 256 × 256, and stores an optimized WebP in private Supabase Storage. It does not accept image URLs for upload.

The server stores objects as `42-user-id/random-version.webp` in the private `student-avatars` bucket. The `student_avatars` table maps immutable 42 user IDs to the current version and object path. Upload and delete routes derive the owner from the existing Auth.js 42 session; the browser never receives a Supabase key. All signed-in Elite 1337 users may see uploaded avatars through `/api/avatars/:userId`. The route requires the 42 session and a one-hour server-signed version reference. A page looks up to 25 avatar mappings with one table query, then the browser requests only images that exist. Each image read checks the current database version before downloading bytes, so an old Storage cache entry cannot be served after replacement or deletion. Browser image responses use `private, no-store` to avoid serving a removed image from browser cache; Supabase retains the optimized object cache. Replacement uses a new path and URL. The Cluster Explorer still exposes no student identities.

To configure a new Supabase project:

1. Create a Supabase project and open its **SQL Editor**. Run [`supabase/avatars.sql`](supabase/avatars.sql). This creates the **private** `student-avatars` bucket, limits stored objects to 1 MB WebP, and creates the `student_avatars` table with RLS enabled and no browser policies. Do not make the bucket public.
2. In Supabase **Project Settings → API**, copy the project URL and server-side service-role key. Put them in `.env.local` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never use a `NEXT_PUBLIC_` name for the key or paste it in chat. Existing `AUTH_SECRET` must remain configured.
3. Set the same two variables as **private** Vercel environment variables for the intended deployment environment, then redeploy. The 42 OAuth callback and existing authentication setup remain the same.
4. Sign in locally with 42, upload a photo from `/me`, and check `/me`, `/leaderboard`, `/piscines`, and a student profile. Replace and remove the image; check a fresh browser session signed in only to Elite 1337. Repeat this walkthrough in production before reporting that the feature works there.

If Supabase is not configured, avatar surfaces show 42 photos (or initials) and `/me` explains that avatar storage is unavailable. Storage errors also fall back to initials rather than blocking rankings. A failed object cleanup can leave a private orphan object; remove it from the bucket during maintenance. Future authorized imports may reuse the `user_id` mapping and immutable version paths, but no importer is implemented. Any future importer must first establish redistribution permission and a reliable authorized image source, then use idempotent, rate-limited, resumable jobs.

## Career survey submissions

The career survey sends selected answers directly from the browser to [Web3Forms](https://docs.web3forms.com/getting-started/api-reference). It sends no name, login, or 42 account details. The configured public access key is included by default; optionally override it with `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` and rebuild. Web3Forms delivers submissions to the email associated with that key. The thank-you step appears only after a successful response; failed requests preserve answers for retry. Students who select “Not working” submit only their employment status.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm run verify:api  # optional live check; uses your 42 API request budget
```

Tests cover cohort semantics, Piscine filters and admission uncertainty, ties, campus scope, eligibility, pagination, incomplete pages, HTTP 429 retry, logtime boundaries and overlap, and the local hourly budget. V3 tests cover workstation normalization, campus groups, session conflicts and staleness, availability versus Unknown, disabled seats, privacy, membership checks, authenticated endpoint behavior, and API failure fallback. V3.1 tests cover upload validation, owner checks, private reads, replacement, deletion, batched mapping, missing objects, and storage errors. Mock fixtures exist only in tests and never appear as real student records.

## Vercel deployment

Set `FORTYTWO_CLIENT_ID`, `FORTYTWO_CLIENT_SECRET`, `FORTYTWO_CURSUS_ID=21`, `AUTH_SECRET`, and `AUTH_URL=https://www.elite1337.app` as private Vercel environment variables. `FORTYTWO_CAMPUS_IDS=16,21,55,75` and `FORTYTWO_EXCLUDED_USER_IDS` are optional. V3.1 avatars additionally require private `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values plus the one-time SQL setup above. Register `https://www.elite1337.app/api/auth/callback/42` as the exact 42 redirect URI. Redeploy after changing Vercel environment variables, then check a real 1337 sign-in. The protected pages allow up to 60 seconds for a cold complete refresh; verify that your Vercel plan supports that function duration. Use HTTPS in production.
