-- Admin-only live presence for signed-in students using Elite 1337 itself.
-- One row per student is updated by a heartbeat; rows are online only for five minutes after last_seen.
create table if not exists site_presence (
  user_id bigint primary key check (user_id > 0),
  login text not null,
  path text not null,
  last_seen timestamptz not null default now()
);

create index if not exists site_presence_last_seen on site_presence (last_seen desc);
