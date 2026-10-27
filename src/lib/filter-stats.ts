import { sql } from './db';
import { z } from 'zod';

/**
 * Experiment: on phones and tablets the leaderboard filters open as a dialog. Each time it opens and closes is one
 * session; counting the filters tapped in between tells whether closing it after the first filter would help.
 */
export const filterSessionSchema = z.object({
  page: z.enum(['leaderboard']),
  clicks: z.number().int().min(0).max(50),
  durationMs: z.number().int().min(0).max(3_600_000),
  ended: z.enum(['close', 'outside', 'button', 'left']),
});
export type FilterSession = z.infer<typeof filterSessionSchema>;
const DAILY_LIMIT = 200;

let ready: Promise<unknown> | undefined;
/** Created on first use (see neon/filter-sessions.sql). */
function ensureTable() {
  ready ??= sql()`
    create table if not exists filter_sessions (
      id bigserial primary key,
      user_id bigint not null,
      page text not null,
      clicks integer not null,
      duration_ms integer not null,
      ended text not null,
      created_at timestamptz not null default now()
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/** Stores one session; at most DAILY_LIMIT per student per day, checked in the same statement. */
export async function saveFilterSession(userId: number, input: unknown): Promise<boolean> {
  const parsed = filterSessionSchema.safeParse(input);
  if (!parsed.success || !process.env.DATABASE_URL) return false;
  const { page, clicks, durationMs, ended } = parsed.data;
  try {
    await ensureTable();
    const rows = await sql()`
      insert into filter_sessions (user_id, page, clicks, duration_ms, ended)
      select ${userId}, ${page}, ${clicks}, ${durationMs}, ${ended}
      where (select count(*) from filter_sessions where user_id = ${userId} and created_at > now() - interval '1 day') < ${DAILY_LIMIT}
      returning id`;
    return rows.length > 0;
  } catch (error) {
    console.error('Filter session unavailable:', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

export type FilterStats = { sessions: number; students: number; none: number; one: number; several: number; avgClicks: number; medianSeconds: number; ended: Record<string, number> };

/** Totals for the admin page; null when the database is unavailable. */
export async function filterStats(): Promise<FilterStats | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const [totals, ends] = await Promise.all([
      sql()`select count(*)::int as sessions, count(distinct user_id)::int as students,
          (count(*) filter (where clicks = 0))::int as none, (count(*) filter (where clicks = 1))::int as one,
          (count(*) filter (where clicks >= 2))::int as several, coalesce(avg(clicks), 0)::float as avg_clicks,
          coalesce(percentile_cont(0.5) within group (order by duration_ms), 0)::float / 1000 as median_seconds
        from filter_sessions where page = 'leaderboard'`,
      sql()`select ended, count(*)::int as n from filter_sessions where page = 'leaderboard' group by ended`,
    ]);
    const row = totals[0];
    return { sessions: row.sessions, students: row.students, none: row.none, one: row.one, several: row.several, avgClicks: row.avg_clicks, medianSeconds: row.median_seconds, ended: Object.fromEntries(ends.map((end) => [end.ended, end.n])) };
  } catch (error) {
    console.error('Filter stats unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
