import { createHmac, randomUUID } from 'node:crypto';
import { sql } from './db';
import { PERIOD_DAYS, type PromoEventOutcome, type StatsPeriod } from './site-stats-core';

/**
 * First-party site stats in Neon: page views, visits and promo clicks. Visitors and visits are random cookie ids;
 * a signed-in student is stored only as a keyed hash of their 42 id, so the admin page shows counts, never people.
 */

export const VISITOR_COOKIE = 'e1337_v';
export const VISIT_COOKIE = 'e1337_s';
/** A visit ends after 30 idle minutes, the usual web analytics definition. */
export const VISIT_IDLE_SECONDS = 30 * 60;
const TZ = 'Africa/Casablanca';

const idPattern = /^[0-9a-f-]{36}$/;
export const cookieId = (value: string | undefined) => value && idPattern.test(value) ? value : randomUUID();

/** Same student, same opaque key; unreadable without AUTH_SECRET. */
export function viewerKey(userId: string | undefined | null) {
  if (!userId || !process.env.AUTH_SECRET) return null;
  return createHmac('sha256', process.env.AUTH_SECRET).update(`site-stats:v1:${userId}`).digest('hex').slice(0, 24);
}

let ready: Promise<unknown> | undefined;
/** Created on first use (see neon/site-events.sql). */
function ensureTable() {
  ready ??= (async () => {
    await sql()`
      create table if not exists site_events (
        id bigserial primary key,
        at timestamptz not null default now(),
        kind text not null check (kind in ('view', 'promo')),
        path text,
        visitor text not null,
        visit text not null,
        viewer text,
        promo text,
        outcome text check (outcome in ('signin', 'allowed', 'denied', 'error')),
        after_signin boolean not null default false
      )`;
    await sql()`create index if not exists site_events_at on site_events (at)`;
    await sql()`create index if not exists site_events_visitor_at on site_events (visitor, at)`;
  })().catch((error) => { ready = undefined; throw error; });
  return ready;
}

type Who = { visitor: string; visit: string; viewer: string | null };

/** Records one page view. At most 30 per visitor and 1,500 site-wide per minute, checked in the same statement. */
export async function recordView(path: string, who: Who) {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensureTable();
    await sql()`
      insert into site_events (kind, path, visitor, visit, viewer)
      select 'view', ${path}, ${who.visitor}, ${who.visit}, ${who.viewer}
      where (select count(*) from site_events where visitor = ${who.visitor} and at > now() - interval '1 minute') < 30
        and (select count(*) from site_events where at > now() - interval '1 minute') < 1500`;
  } catch (error) {
    console.error('Site stats view failed:', error instanceof Error ? error.name : 'unknown');
  }
}

/** Records a promo click and where it ended: sent to sign in, allowed, denied (other campus) or error. */
export async function recordPromo(promo: string, outcome: PromoEventOutcome, afterSignin: boolean, who: Who) {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensureTable();
    await sql()`
      insert into site_events (kind, promo, outcome, after_signin, visitor, visit, viewer)
      select 'promo', ${promo}, ${outcome}, ${afterSignin}, ${who.visitor}, ${who.visit}, ${who.viewer}
      where (select count(*) from site_events where visitor = ${who.visitor} and at > now() - interval '1 minute') < 30`;
  } catch (error) {
    console.error('Site stats promo failed:', error instanceof Error ? error.name : 'unknown');
  }
}

export type Totals = { views: number; visitors: number; visits: number; students: number; studentVisits: number };
export type DayPoint = { key: string; views: number; visitors: number; students: number };
export type PromoRow = { promo: string; clicks: number; signin: number; returned: number; allowed: number; denied: number; error: number; students: number };
export type SiteStats = { totals: Totals; previous: Totals; series: DayPoint[]; hourly: boolean; pages: { path: string; views: number; visitors: number }[]; promos: PromoRow[]; online: number };

const n = (value: unknown) => Number(value ?? 0);
const totalsOf = (row: Record<string, unknown> | undefined): Totals => ({ views: n(row?.views), visitors: n(row?.visitors), visits: n(row?.visits), students: n(row?.students), studentVisits: n(row?.student_visits) });

/** Everything the admin stats page shows for one period, in Morocco time. Null when the database is unavailable. */
export async function siteStats(period: StatsPeriod): Promise<SiteStats | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    await ensureTable();
    const days = PERIOD_DAYS[period], hourly = period === 'today';
    // Start of the window: midnight Morocco time, `days - 1` days ago; the previous window is the same length before it.
    const [bounds] = await sql()`
      select (date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1})) at time zone ${TZ} as start,
             (date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days * 2 - 1})) at time zone ${TZ} as prev_start`;
    const start = bounds.start as Date, prevStart = bounds.prev_start as Date;
    const totals = (from: Date, to: Date | null) => sql()`
      select count(*) as views, count(distinct visitor) as visitors, count(distinct visit) as visits,
             count(distinct viewer) as students, count(distinct visit) filter (where viewer is not null) as student_visits
      from site_events where kind = 'view' and at >= ${from} and (${to}::timestamptz is null or at < ${to})`;
    const [now, before, series, pages, promos, online] = await Promise.all([
      totals(start, null),
      // Same elapsed time in the previous window, so "today so far" compares with "yesterday by this hour".
      totals(prevStart, new Date(Date.now() - days * 86_400_000)),
      hourly
        ? sql()`
          select to_char(h, 'HH24') as key, count(e.id) as views, count(distinct e.visitor) as visitors, count(distinct e.viewer) as students
          from generate_series(date_trunc('day', now() at time zone ${TZ}), date_trunc('day', now() at time zone ${TZ}) + interval '23 hours', interval '1 hour') as h
          left join site_events e on e.kind = 'view' and date_trunc('hour', e.at at time zone ${TZ}) = h
          group by h order by h`
        : sql()`
          select to_char(d, 'YYYY-MM-DD') as key, count(e.id) as views, count(distinct e.visitor) as visitors, count(distinct e.viewer) as students
          from generate_series(date_trunc('day', now() at time zone ${TZ}) - make_interval(days => ${days - 1}), date_trunc('day', now() at time zone ${TZ}), interval '1 day') as d
          left join site_events e on e.kind = 'view' and e.at >= ${start} and date_trunc('day', e.at at time zone ${TZ}) = d
          group by d order by d`,
      sql()`
        select path, count(*) as views, count(distinct visitor) as visitors from site_events
        where kind = 'view' and at >= ${start} group by path order by views desc limit 8`,
      sql()`
        select promo,
          count(*) filter (where not after_signin) as clicks,
          count(*) filter (where outcome = 'signin') as signin,
          count(*) filter (where after_signin) as returned,
          count(*) filter (where outcome = 'allowed') as allowed,
          count(*) filter (where outcome = 'denied') as denied,
          count(*) filter (where outcome = 'error') as error,
          count(distinct viewer) as students
        from site_events where kind = 'promo' and at >= ${start} group by promo order by clicks desc`,
      sql()`select count(distinct visitor) as online from site_events where kind = 'view' and at > now() - interval '5 minutes'`,
    ]);
    // Keep about a year of rows; cheap thanks to the index, and the admin page is the only reader.
    if (Math.random() < .05) await sql()`delete from site_events where at < now() - interval '400 days'`.catch(() => undefined);
    return {
      totals: totalsOf(now[0]), previous: totalsOf(before[0]), hourly,
      series: series.map((row) => ({ key: String(row.key), views: n(row.views), visitors: n(row.visitors), students: n(row.students) })),
      pages: pages.map((row) => ({ path: String(row.path), views: n(row.views), visitors: n(row.visitors) })),
      promos: promos.map((row) => ({ promo: String(row.promo), clicks: n(row.clicks), signin: n(row.signin), returned: n(row.returned), allowed: n(row.allowed), denied: n(row.denied), error: n(row.error), students: n(row.students) })),
      online: n(online[0]?.online),
    };
  } catch (error) {
    console.error('Site stats unavailable:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

type CookieJar = { get(name: string): { value: string } | undefined };
type CookieSink = { set(name: string, value: string, options: Record<string, unknown>): unknown };

/** Reads (or starts) the visitor and visit ids, and returns a function that refreshes both cookies on a response. */
export function visitIds(cookies: CookieJar, userId: string | undefined | null) {
  const who: Who = { visitor: cookieId(cookies.get(VISITOR_COOKIE)?.value), visit: cookieId(cookies.get(VISIT_COOKIE)?.value), viewer: viewerKey(userId) };
  const base = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
  const apply = (sink: CookieSink) => {
    sink.set(VISITOR_COOKIE, who.visitor, { ...base, maxAge: 60 * 60 * 24 * 365 });
    sink.set(VISIT_COOKIE, who.visit, { ...base, maxAge: VISIT_IDLE_SECONDS });
  };
  return { who, apply };
}
