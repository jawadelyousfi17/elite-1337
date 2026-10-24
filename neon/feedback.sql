-- Run once against the Neon database (DATABASE_URL).
-- One row per report from the in-app feedback dialog; login is only kept when the student opts in.
create table if not exists feedback (
  id bigint generated always as identity primary key,
  user_id bigint not null check (user_id > 0),
  login text,
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 3 and 2000),
  page text not null default '',
  screen text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_recent on feedback (user_id, created_at desc);
