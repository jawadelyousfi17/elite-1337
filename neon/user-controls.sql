-- Admin-managed overrides for environment-defined roles and site access.
create table if not exists user_controls (
  login text primary key,
  admin boolean,
  hacker boolean,
  anonymized boolean,
  allowed boolean,
  updated_at timestamptz not null default now(),
  updated_by text not null
);
