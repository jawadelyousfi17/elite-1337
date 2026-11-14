-- Created automatically on first use (src/lib/puzzle-solvers.ts); kept here as documentation.
-- One row per student: their best verified solve of the Wedesign challenge logo puzzle (fewest moves, then fastest).
create table if not exists puzzle_solvers (
  user_id bigint primary key check (user_id > 0),
  login text not null,
  best_moves integer not null check (best_moves between 1 and 1000),
  best_ms integer not null check (best_ms >= 0),
  solves integer not null default 1,
  best_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
