# How authentication works

1337 Ranks uses **42 Intra OAuth 2.0** through [Auth.js](https://authjs.dev) (`next-auth` v5). People sign in with their 42 account. The app has no passwords, no user database and no local accounts.

All of the auth configuration is in `src/auth.ts`.

## Two kinds of 42 credentials

The app talks to 42 in two separate ways. It helps to keep them apart:

| | User sign-in (OAuth "authorization code") | App data access ("client credentials") |
|---|---|---|
| Purpose | Prove who the visitor is | Fetch rankings, profiles, locations and photos |
| Where | `src/auth.ts` | `src/lib/fortytwo-api.ts` (`FortyTwoClient`) |
| Token belongs to | The visitor | The 42 application itself |
| Stored | Not kept; only the 42 user ID and login go into the session | In server memory, refreshed before it expires |

The visitor's own 42 access token is **not** saved or reused. After sign-in, every 42 API call is made with the app token from `FortyTwoClient`, using the same `FORTYTWO_CLIENT_ID` and `FORTYTWO_CLIENT_SECRET`.

## Sign-in flow

```
Browser                     1337 Ranks (Next.js)                 42 Intra
   |  click "Continue with 42"  |                                    |
   |--------------------------->| signIn('42')                       |
   |   302 to /oauth/authorize?client_id&redirect_uri&scope=public&state
   |<---------------------------|                                    |
   |------------------------------------------------------------------>| user logs in / approves
   |   302 to /api/auth/callback/42?code=...&state=...                 |
   |<------------------------------------------------------------------|
   |--------------------------->| check state                        |
   |                            | POST /oauth/token (code + secret) ->|
   |                            |<----------------- access_token -----|
   |                            | GET /v2/me (Bearer token) -------->|
   |                            |<----------------- { id, login } ---|
   |   Set-Cookie: session JWT  |                                    |
   |<---------------------------| redirect /leaderboard              |
```

Step by step:

1. **Start.** The home page (`src/app/page.tsx`) has a server-action form that calls `signIn('42', { redirectTo: '/leaderboard' })`. If the visitor already has a session, the page redirects straight to `/leaderboard`.
2. **Authorize.** Auth.js redirects to `https://api.intra.42.fr/oauth/authorize` with `scope=public`. It also sends a random `state` value (`checks: ['state']`) to protect against CSRF.
3. **Callback.** 42 redirects back to `/api/auth/callback/42`, which is handled by `src/app/api/auth/[...nextauth]/route.ts`. The `42` in the path is the provider `id`. That is why the redirect URI registered on the 42 app must match **exactly**:
   - local: `http://localhost:3000/api/auth/callback/42`
   - production: `https://www.elite1337.app/api/auth/callback/42`
4. **Token exchange.** The server sends the code, client ID and secret to `https://api.intra.42.fr/oauth/token` (`client_secret_post`). A custom `conform` step checks that the response is JSON. If 42 returns HTML instead (for example a Cloudflare page or an error page), sign-in fails with a detailed error that includes the status code, host, server and the page title.
5. **Profile.** Auth.js calls `https://api.intra.42.fr/v2/me` with the user's token. `profile()` uses zod to check the response, keeps only the numeric `id` and the `login`, and sets `email` and `image` to `null`.
6. **Session.** The `jwt` callback stores `fortyTwoId` (the immutable 42 user ID) and `login` in the token. The `session` callback exposes them as `session.user.id` and `session.user.login` (types are in `src/types/next-auth.d.ts`).

## Sessions

- **Strategy:** a JWT (`session: { strategy: 'jwt' }`) kept in an encrypted, HTTP-only cookie. There is no session table.
- **Lifetime:** 7 days (`maxAge: 60 * 60 * 24 * 7`).
- **Secret:** `AUTH_SECRET` encrypts the cookie. Changing it signs everyone out. The same secret also signs avatar and photo URLs (see below).
- **Contents:** only the 42 user ID and login. No tokens, email or photo.
- **Sign-out:** the nav "Log out" button calls `signOut({ redirectTo: '/' })`, which clears the cookie.

## Protecting pages and APIs

**Pages.** Everything under `src/app/(app)/` (`/leaderboard`, `/piscines`, `/clusters`, `/me`, `/students/[login]`) is wrapped by `src/app/(app)/layout.tsx`. That layout calls `requireStudent()` from `src/lib/guard.ts`:

```ts
const session = await auth();
if (!session?.user?.id) redirect('/');
```

Pages also call `requireStudent()` themselves to get the user.

**API routes** call `auth()` directly and return errors instead of redirecting:

| Route | Check |
|---|---|
| `/api/clusters` | Session required (401). The user must also have a verified 1337 campus membership, looked up with the app token (403 if not, 503 if it can't be checked). |
| `/api/avatars` (upload/delete) | Session required. The owner always comes from `session.user.id`, never from the request. A same-`Origin` check blocks cross-site requests (403). |
| `/api/avatars/:userId` | Session required, plus a valid HMAC signature in the URL. |
| `/api/photos/:userId` | Session required, plus a valid HMAC signature (`AUTH_SECRET`) over the user ID and CDN path. |

**Signed-in is not the same as ranked.** Any 42 account can sign in. Appearing in the rankings is decided separately by the eligibility rules in `src/lib/classification.ts`. A signed-in staff member or alumnus can browse the site but won't be ranked, and `/me` says so.

## Errors

`pages: { signIn: '/', error: '/denied' }` sends failed sign-ins to `src/app/denied/page.tsx`. A `Configuration` error usually means one of these:

- wrong or missing `FORTYTWO_CLIENT_ID` / `FORTYTWO_CLIENT_SECRET`
- a redirect URI mismatch on the 42 app
- a non-JSON token response (the server log has the details from `conform`)

## Environment variables

| Variable | Used for |
|---|---|
| `FORTYTWO_CLIENT_ID` | OAuth sign-in and the app token |
| `FORTYTWO_CLIENT_SECRET` | OAuth sign-in and the app token (keep private) |
| `AUTH_SECRET` | Encrypting session cookies and signing avatar/photo URLs (`openssl rand -base64 32`) |
| `AUTH_URL` | The site's public base URL, used to build the callback URL (`http://localhost:3000` locally, `https://www.elite1337.app` in production) |

## Tests

`src/auth.test.ts` runs a full local 42 OAuth callback against a mocked 42 server and checks that it creates a session. The route tests (`src/app/api/**/route.test.ts`) check that anonymous requests are rejected before any data or storage is touched.
