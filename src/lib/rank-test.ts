import { createHash } from 'node:crypto';
import { sql } from './db';
import { withTimeout } from './timeout';

/**
 * A/B test on the leaderboard: page numbers against infinite scroll. Each student gets a fixed half from their
 * 42 id, is asked once whether to keep it or switch, and from then on gets what they chose.
 */
export type ScrollMode = 'pages' | 'infinite';
export type RankTestChoice = 'keep' | 'switch';
export type RankTestState = { variant: ScrollMode; mode: ScrollMode; answered: boolean };

export const otherMode = (mode: ScrollMode): ScrollMode => mode === 'pages' ? 'infinite' : 'pages';

/** Same student, same half, on every server and every visit. */
export function assignedVariant(userId: number): ScrollMode {
  return parseInt(createHash('sha256').update(`rank-scroll:v1:${userId}`).digest('hex').slice(0, 8), 16) % 2 ? 'infinite' : 'pages';
}


let ready: Promise<unknown> | undefined;
/** The table is created on first use, so the experiment needs no manual migration (see neon/rank-test.sql). */
function ensureTable() {
  ready ??= sql()`
    create table if not exists rank_scroll_test (
      user_id bigint primary key,
      login text not null,
      variant text not null check (variant in ('pages', 'infinite')),
      views integer not null default 1,
      first_seen timestamptz not null default now(),
      last_seen timestamptz not null default now(),
      choice text check (choice in ('keep', 'switch')),
      mode text check (mode in ('pages', 'infinite')),
      answered_at timestamptz
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/**
 * Counts a leaderboard visit and returns the student's mode; null (page numbers, no question) when the database
 * is unavailable or slower than 2.5 s, such as a sleeping Neon compute waking up, so it never holds the page.
 */
export function visitRankTest(userId: number, login: string): Promise<RankTestState | null> {
  return withTimeout(recordVisit(userId, login), 2500, null);
}

async function recordVisit(userId: number, login: string): Promise<RankTestState | null> {
  if (!process.env.DATABASE_URL || !Number.isSafeInteger(userId) || userId <= 0) return null;
  try {
    await ensureTable();
    const rows = await sql()`
      insert into rank_scroll_test (user_id, login, variant) values (${userId}, ${login}, ${assignedVariant(userId)})
      on conflict (user_id) do update set views = rank_scroll_test.views + 1, last_seen = now(), login = excluded.login
      returning variant, mode, answered_at`;
    const row = rows[0];
    return { variant: row.variant, mode: row.mode ?? row.variant, answered: !!row.answered_at };
  } catch (error) {
    console.error('Rank test unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/** Saves the one answer a student gives; a second answer is ignored. Returns the mode they now get. */
export async function answerRankTest(userId: number, choice: RankTestChoice): Promise<ScrollMode | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const rows = await sql()`
      update rank_scroll_test set choice = ${choice}, answered_at = now(),
        mode = case when ${choice} = 'keep' then variant when variant = 'pages' then 'infinite' else 'pages' end
      where user_id = ${userId} and answered_at is null
      returning mode`;
    return rows[0]?.mode ?? null;
  } catch (error) {
    console.error('Rank test answer failed:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

export type RankTestSummary = { variant: ScrollMode; seen: number; answered: number; keep: number; switched: number; avgViews: number };
export type RankTestAnswer = { login: string; variant: ScrollMode; choice: RankTestChoice | null; views: number; firstSeen: string; answeredAt: string | null };

/** Totals per half and the latest students, for the admin page; null when the database is unavailable. */
export async function rankTestResults(limit = 200): Promise<{ summary: RankTestSummary[]; people: RankTestAnswer[] } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const [summary, people] = await Promise.all([
      sql()`select variant, count(*)::int as seen, count(answered_at)::int as answered,
          (count(*) filter (where choice = 'keep'))::int as keep, (count(*) filter (where choice = 'switch'))::int as switched,
          coalesce(avg(views), 0)::float as avg_views
        from rank_scroll_test group by variant`,
      sql()`select login, variant, choice, views, first_seen, answered_at from rank_scroll_test
        order by answered_at desc nulls last, last_seen desc limit ${limit}`,
    ]);
    const empty = (variant: ScrollMode): RankTestSummary => ({ variant, seen: 0, answered: 0, keep: 0, switched: 0, avgViews: 0 });
    const byVariant = new Map(summary.map((row) => [row.variant as ScrollMode, { variant: row.variant, seen: row.seen, answered: row.answered, keep: row.keep, switched: row.switched, avgViews: row.avg_views } as RankTestSummary]));
    return {
      summary: (['pages', 'infinite'] as const).map((variant) => byVariant.get(variant) ?? empty(variant)),
      people: people.map((row) => ({ login: row.login, variant: row.variant, choice: row.choice, views: row.views, firstSeen: new Date(row.first_seen).toISOString(), answeredAt: row.answered_at ? new Date(row.answered_at).toISOString() : null })),
    };
  } catch (error) {
    console.error('Rank test results unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
