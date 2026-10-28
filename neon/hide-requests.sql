-- "Hide me" requests: students asking to be removed from the app (handled by hand).
-- The app creates this table on first use (src/lib/hide-requests.ts); this file documents it.
create table if not exists hide_requests (
  user_id bigint primary key,
  login text not null,
  reason text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now()
);
