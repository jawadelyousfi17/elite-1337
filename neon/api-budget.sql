-- Shared rolling-hour budget; one row per SHA-256 application ID.
create table if not exists api_budget (
  key text primary key,
  next_at timestamptz not null,
  requests timestamptz[] not null
);
