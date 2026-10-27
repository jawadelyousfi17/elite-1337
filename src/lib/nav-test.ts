import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql } from './db';

/**
 * A/B test in the navigation: half the students see "XP calculator" where "Offers" was. Each student gets a fixed
 * half from their 42 id; the nav reports once per browser session that it was seen, and every click on either link.
 */
export type NavVariant = 'offers' | 'xp';
export function assignedNavVariant(userId: number): NavVariant {
  return parseInt(createHash('sha256').update(`nav-xp:v1:${userId}`).digest('hex').slice(0, 8), 16) % 2 ? 'xp' : 'offers';
}

export const navEventSchema = z.object({ event: z.enum(['seen', 'xp', 'offers']) });

let ready: Promise<unknown> | undefined;
/** Created on first use (see neon/nav-test.sql). */
function ensureTable() {
  ready ??= sql()`
    create table if not exists nav_test (
      user_id bigint primary key,
      login text not null,
      variant text not null check (variant in ('offers', 'xp')),
      sessions integer not null default 0,
      xp_clicks integer not null default 0,
      offers_clicks integer not null default 0,
      first_seen timestamptz not null default now(),
      last_seen timestamptz not null default now(),
      first_xp_at timestamptz
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/** Counts one event for the student; the half always comes from their id, never from the browser. */
export async function recordNavEvent(userId: number, login: string, input: unknown): Promise<boolean> {
  const parsed = navEventSchema.safeParse(input);
  if (!parsed.success || !process.env.DATABASE_URL) return false;
  const { event } = parsed.data, seen = event === 'seen' ? 1 : 0, xp = event === 'xp' ? 1 : 0, offers = event === 'offers' ? 1 : 0;
  try {
    await ensureTable();
    await sql()`
      insert into nav_test (user_id, login, variant, sessions, xp_clicks, offers_clicks, first_xp_at)
      values (${userId}, ${login}, ${assignedNavVariant(userId)}, ${seen}, ${xp}, ${offers}, ${xp ? new Date().toISOString() : null})
      on conflict (user_id) do update set
        sessions = least(nav_test.sessions + ${seen}, 100000), xp_clicks = least(nav_test.xp_clicks + ${xp}, 100000),
        offers_clicks = least(nav_test.offers_clicks + ${offers}, 100000), last_seen = now(), login = excluded.login,
        first_xp_at = coalesce(nav_test.first_xp_at, excluded.first_xp_at)`;
    return true;
  } catch (error) {
    console.error('Nav test unavailable:', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

export type NavTestGroup = { variant: NavVariant; students: number; sessions: number; xpStudents: number; offersStudents: number; xpClicks: number; offersClicks: number };

/** Totals per half for the admin page; null when the database is unavailable. */
export async function navTestResults(): Promise<NavTestGroup[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const rows = await sql()`
      select variant, count(*)::int as students, coalesce(sum(sessions), 0)::int as sessions,
        (count(*) filter (where xp_clicks > 0))::int as xp_students, (count(*) filter (where offers_clicks > 0))::int as offers_students,
        coalesce(sum(xp_clicks), 0)::int as xp_clicks, coalesce(sum(offers_clicks), 0)::int as offers_clicks
      from nav_test group by variant`;
    const empty = (variant: NavVariant): NavTestGroup => ({ variant, students: 0, sessions: 0, xpStudents: 0, offersStudents: 0, xpClicks: 0, offersClicks: 0 });
    const found = new Map(rows.map((row) => [row.variant as NavVariant, { variant: row.variant, students: row.students, sessions: row.sessions, xpStudents: row.xp_students, offersStudents: row.offers_students, xpClicks: row.xp_clicks, offersClicks: row.offers_clicks } as NavTestGroup]));
    return (['xp', 'offers'] as const).map((variant) => found.get(variant) ?? empty(variant));
  } catch (error) {
    console.error('Nav test results unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
