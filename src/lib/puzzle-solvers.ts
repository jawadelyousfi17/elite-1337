import { sql } from './db';
import { anonymizedLogins } from './anonymous';
import { userControlSets } from './user-controls';
import { withTimeout } from './timeout';
import type { Solver } from './puzzle';

/**
 * Best result per student for the Wedesign challenge logo puzzle. A side feature: every helper returns null or false
 * when DATABASE_URL is missing or Neon fails, and the puzzle keeps working without the solvers list.
 */

let ready: Promise<unknown> | undefined;
/** The table is created on first use (see neon/puzzle-solvers.sql). */
function ensureTable() {
  ready ??= sql()`
    create table if not exists puzzle_solvers (
      user_id bigint primary key check (user_id > 0),
      login text not null,
      best_moves integer not null check (best_moves between 1 and 1000),
      best_ms integer not null check (best_ms >= 0),
      solves integer not null default 1,
      best_at timestamptz not null default now(),
      last_at timestamptz not null default now()
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/**
 * Records one verified solve and keeps only the student's best (fewest moves, then fastest). One row per student, and
 * a second save within three seconds is ignored in the same statement, so a script cannot flood the table.
 */
export async function saveSolve(userId: number, login: string, moves: number, ms: number): Promise<{ moves: number; ms: number } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const rows = await sql()`
      insert into puzzle_solvers as p (user_id, login, best_moves, best_ms)
      values (${userId}, ${login}, ${moves}, ${ms})
      on conflict (user_id) do update set
        login = excluded.login, solves = p.solves + 1, last_at = now(),
        best_moves = case when (excluded.best_moves, excluded.best_ms) < (p.best_moves, p.best_ms) then excluded.best_moves else p.best_moves end,
        best_ms = case when (excluded.best_moves, excluded.best_ms) < (p.best_moves, p.best_ms) then excluded.best_ms else p.best_ms end,
        best_at = case when (excluded.best_moves, excluded.best_ms) < (p.best_moves, p.best_ms) then now() else p.best_at end
      where p.last_at < now() - interval '3 seconds'
      returning best_moves, best_ms`;
    return rows.length ? { moves: rows[0].best_moves, ms: rows[0].best_ms } : null;
  } catch (error) {
    console.error('Puzzle solvers unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/**
 * A student's place among all solvers (fewest moves, then fastest, then who got there first) and how many solvers
 * there are, so the page can say "#4 of 23" right after a solve; null when they have no saved solve or Neon is down.
 */
export async function solverStanding(userId: number): Promise<{ place: number; total: number } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const rows = await sql()`
      select (select count(*) from puzzle_solvers o where (o.best_moves, o.best_ms, o.best_at) < (p.best_moves, p.best_ms, p.best_at))::int + 1 as place,
        (select count(*) from puzzle_solvers)::int as total
      from puzzle_solvers p where p.user_id = ${userId}`;
    return rows.length ? { place: rows[0].place, total: rows[0].total } : null;
  } catch (error) {
    console.error('Puzzle solvers unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/** The best solvers for signed-in students; students who asked to be removed show without a login. */
export async function topSolvers(limit = 3): Promise<Solver[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const [rows, controls] = await Promise.all([
      sql()`select login, best_moves, best_ms from puzzle_solvers order by best_moves, best_ms, best_at limit ${limit}`,
      withTimeout(userControlSets().then((sets) => sets.anonymized).catch(() => anonymizedLogins()), 1500, anonymizedLogins()),
    ]);
    return rows.map((row) => ({ login: controls.has(String(row.login).toLowerCase()) ? null : row.login, moves: row.best_moves, ms: row.best_ms }));
  } catch (error) {
    console.error('Puzzle solvers unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
