# GitHub Card

A public site that makes a terminal-style profile card for a GitHub README from a username. No sign-in and no database: the card is an SVG at `/api/gh/<username>.svg`, and the text and look travel in the link.

It lives next to the Elite 1337 app but is a separate Next.js project with its own `package.json`. Nothing here imports from `../src`.

## Run it

```sh
cd github-card
npm install
cp .env.example .env.local   # optional: add GITHUB_TOKEN
npm run dev                  # http://localhost:3400
npm run typecheck && npm test
```

## Deploy it on its own (Vercel, same repo)

1. Vercel → Add New Project → pick this repository.
2. Set **Root Directory** to `github-card`. The framework is detected as Next.js.
3. Environment variables: `GITHUB_TOKEN` (strongly recommended, see below) and `NEXT_PUBLIC_SITE_URL` (the public address).
4. Under **Settings → Git → Ignored Build Step** you can skip builds when `github-card/` did not change: `git rev-parse --verify HEAD^ >/dev/null 2>&1 || exit 1; git diff --quiet HEAD^ HEAD -- .`. A checkout without a parent commit now builds normally instead of failing with Git exit 128.
5. Give it its own domain. The domain is inside every card link people paste into their README, so pick it once: changing it later breaks the cards already published.

It needs no `AUTH_SECRET`, 42 keys or `DATABASE_URL`.

## What it calls

- GitHub API: `users/<name>` and `users/<name>/repos` (two requests per username, cached an hour). Without `GITHUB_TOKEN` GitHub allows 60 requests an hour for the whole server, so set one.
- `search/commits?q=author:<name>` for the commit count (one request, cached six hours).
- With `GITHUB_TOKEN` only: `repos/<name>/<repo>/stats/contributors` for up to 10 recent repositories, to sum the lines added and removed (`+1,545 -485`). Without a token the card shows commits but no lines row. GitHub computes these statistics on first request, so a first card can lack them until the next visit.
- `github.com/<name>.png` for the avatar, through an SSRF-safe downloader limited to GitHub hosts (cached a day).

## Layout

| Path | Holds |
|---|---|
| `src/app/page.tsx`, `src/components/card-maker.tsx` | The page |
| `src/app/api/gh/[file]/route.ts` | The public SVG route |
| `src/lib/terminal-card.ts` | The renderer (layouts, themes, the CRT look) |
| `src/lib/github.ts`, `github-input.ts` | GitHub lookup, the card rows, input cleaning |
| `src/lib/photo.ts`, `card-art.ts`, `safe-image-fetch.ts` | The ASCII portrait |
