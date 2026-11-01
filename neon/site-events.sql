-- First-party site stats: page views, visits and landing promo clicks.
-- The app creates this table on first use (src/lib/site-stats.ts); this file documents it.
-- visitor / visit are random cookie ids; viewer is an HMAC of the 42 id (never the id or login itself).
create table if not exists site_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('view', 'promo')),
  path text,
  visitor text not null,
  visit text not null,
  viewer text,
  promo text,
  outcome text check (outcome in ('signin', 'allowed', 'denied', 'error')),
  after_signin boolean not null default false
);
create index if not exists site_events_at on site_events (at);
create index if not exists site_events_visitor_at on site_events (visitor, at);
