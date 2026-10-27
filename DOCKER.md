# Self-hosting with Docker (optional)

Production runs on **Vercel + Neon**. Nothing here is needed for that. Use this only to run everything on one machine of your own.

`docker-compose.yml` starts four containers:

| Service | Image | Role |
|---|---|---|
| `app` | built from `Dockerfile` | Next.js standalone server on port 3000 (internal only) |
| `postgres` | `postgres:17-alpine` | Database for feedback and experiments (internal only) |
| `neon-proxy` | `ghcr.io/timowilhelm/local-neon-http-proxy` | Lets the app's Neon HTTP driver talk to plain Postgres |
| `caddy` | `caddy:2-alpine` | Reverse proxy on ports 80/443 with automatic HTTPS |

Why the proxy: the app uses Neon's HTTP driver (`src/lib/db.ts`), which can't open a normal Postgres connection. The proxy speaks Neon's HTTP protocol in front of Postgres. Compose gives it the network alias `db.localtest.me` and sets `DATABASE_HTTP_ENDPOINT` so the driver uses it. Tables are created by the app on first use.

## Run it

```sh
cp .env.docker.example .env.docker      # gitignored; fill in every value
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f app
```

- `DOMAIN` must point at the machine (DNS A record) for Caddy to get a Let's Encrypt certificate. Use `localhost` to try it locally (Caddy issues a local certificate; your browser will warn).
- `SITE_URL` is the public URL. Register `SITE_URL/api/auth/callback/42` as a redirect URI in your 42 application.
- Use a **separate 42 application** from production: the 1,200 requests/hour budget is per application.
- Ports 80/443 can be changed with `HTTP_PORT` / `HTTPS_PORT`.

## Data and updates

- Postgres data lives in the `pgdata` volume, the app's data cache (rankings, stats) in `next-cache`, certificates in `caddy-data`. A restart keeps all three, so the rankings are not downloaded again.
- Update: `git pull && docker compose --env-file .env.docker up -d --build`.
- Back up the database: `docker compose --env-file .env.docker exec postgres pg_dump -U elite elite > backup.sql`.
- Remove everything, including data: `docker compose --env-file .env.docker down -v`.

Uploaded avatars still need Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); without them, 42 photos are shown.
