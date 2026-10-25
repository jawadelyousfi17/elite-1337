import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { fortyTwoApi, RateBudgetError } from './fortytwo-api';
import { intraPhotoPath, intraPhotoUrl } from './avatars/intra-photo';

const HOUR = 3_600_000, ZONE = 'Africa/Casablanca';
/** A session longer than this is a forgotten logout; only this much of it counts. */
const MAX_SESSION = 16 * HOUR;

export type Session = { host: string; begin: string; end: string | null; campus?: number };
export type Presence = {
  totalHours: number; activeDays: number; longestStreak: number; currentStreak: number;
  bestDay: { date: string; hours: number } | null;
  seats: { host: string; hours: number }[]; cluster: { name: string; hours: number } | null;
  days: Record<string, number>; months: { key: string; hours: number }[]; hours: number[]; weekdays: number[];
};

const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
function local(time: number) {
  const p = Object.fromEntries(parts.formatToParts(time).map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) };
}
const nextDate = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/** Cluster of a seat such as "e3r3p6" → "e3". */
export const clusterOf = (host: string) => host.match(/^([a-z]+\d+)r\d+/i)?.[1] ?? host;

/** Seats and hours of the day come from raw sessions, which cost a request per 100; only this recent window is fetched. */
export const SESSION_DAYS = 90;

/** "06:59:44.125713" → hours. 42 reports each day's logtime as a duration string. */
export function durationHours(value: string): number {
  const [h, m, s] = value.split(':').map(Number);
  return [h, m, s].every(Number.isFinite) ? h + m / 60 + s / 3600 : 0;
}
const weekdayOf = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

/**
 * Logtime habits split by Morocco local day and hour. `daily` (42's per-day totals since `from`) drives every
 * day-based figure; without it they come from the sessions. Seats and hours of the day always come from the sessions.
 */
export function computePresence(sessions: Session[], from: string, now = Date.now(), monthsBack = 12, daily?: Record<string, number>): Presence {
  const start = Date.parse(from);
  const days: Record<string, number> = {}, hours = Array(24).fill(0), weekdays = Array(7).fill(0), byHost = new Map<string, number>(), byMonth = new Map<string, number>();
  for (const session of sessions) {
    let begin = Math.max(Date.parse(session.begin), start);
    const end = Math.min(session.end ? Date.parse(session.end) : now, Date.parse(session.begin) + MAX_SESSION, now);
    if (!(end > begin)) continue;
    byHost.set(session.host, (byHost.get(session.host) ?? 0) + (end - begin) / HOUR);
    // walk the session hour by hour so each slice lands on the right local day and hour
    while (begin < end) {
      const slice = Math.min(end, Math.floor(begin / HOUR) * HOUR + HOUR) - begin, at = local(begin), h = slice / HOUR;
      days[at.date] = (days[at.date] ?? 0) + h; hours[at.hour] += h; weekdays[at.weekday] += h;
      byMonth.set(at.date.slice(0, 7), (byMonth.get(at.date.slice(0, 7)) ?? 0) + h);
      begin += slice;
    }
  }
  if (daily) {
    const first = local(start).date;
    for (const key of Object.keys(days)) delete days[key];
    weekdays.fill(0); byMonth.clear();
    for (const [date, h] of Object.entries(daily)) {
      if (date < first || !(h > 0)) continue;
      days[date] = h; weekdays[weekdayOf(date)] += h;
      byMonth.set(date.slice(0, 7), (byMonth.get(date.slice(0, 7)) ?? 0) + h);
    }
  }
  const active = Object.keys(days).filter((date) => days[date] >= .25).sort();
  let longest = 0, run = 0, previous = '';
  for (const date of active) { run = previous && nextDate(previous) === date ? run + 1 : 1; longest = Math.max(longest, run); previous = date; }
  const today = local(now).date, yesterday = local(now - 86_400_000).date, set = new Set(active);
  let current = 0, cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : '';
  while (cursor && set.has(cursor)) { current++; cursor = new Date(Date.parse(`${cursor}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10); }
  const best = Object.entries(days).sort((a, b) => b[1] - a[1])[0];
  const seats = [...byHost].map(([host, h]) => ({ host, hours: h })).sort((a, b) => b.hours - a.hours);
  const clusters = new Map<string, number>(); for (const seat of seats) clusters.set(clusterOf(seat.host), (clusters.get(clusterOf(seat.host)) ?? 0) + seat.hours);
  const topCluster = [...clusters].sort((a, b) => b[1] - a[1])[0];
  const thisMonth = today.slice(0, 7), [y, m] = thisMonth.split('-').map(Number);
  const months = Array.from({ length: monthsBack }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (monthsBack - 1 - i), 1)); const key = d.toISOString().slice(0, 7); return { key, hours: byMonth.get(key) ?? 0 }; });
  return {
    totalHours: Object.values(days).reduce((sum, h) => sum + h, 0), activeDays: active.length, longestStreak: longest, currentStreak: current,
    bestDay: best ? { date: best[0], hours: best[1] } : null, seats: seats.slice(0, 5), cluster: topCluster ? { name: topCluster[0], hours: topCluster[1] } : null,
    days, months, hours, weekdays,
  };
}

const locationSchema = z.object({ host: z.string(), begin_at: z.string(), end_at: z.string().nullish(), campus_id: z.number().nullish() });

const fetchSessions = unstable_cache(async (userId: number, from: string): Promise<Session[]> => {
  const path = `users/${userId}/locations`, base = { 'range[begin_at]': `${from},${new Date(Date.now() + 86_400_000).toISOString()}`, sort: '-begin_at', 'page[size]': '100' };
  const first = await fortyTwoApi.request(path, z.array(locationSchema), { ...base, 'page[number]': '1' });
  const pages = Math.min(10, Math.ceil((first.total ?? first.data.length) / 100));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fortyTwoApi.request(path, z.array(locationSchema), { ...base, 'page[number]': String(i + 2) })));
  return [first.data, ...rest.map((page) => page.data)].flat().map((row) => ({ host: row.host, begin: row.begin_at, end: row.end_at ?? null, campus: row.campus_id ?? undefined }));
}, ['1337-presence-v3'], { revalidate: 21_600 });

const YEAR = 365 * 86_400_000;
const dailySchema = z.record(z.string(), z.string());
/** 42's logtime per day, one request per year of history instead of one per 100 sessions. */
const fetchDaily = unstable_cache(async (userId: number, from: string): Promise<Record<string, number>> => {
  const end = Date.now() + 86_400_000, ranges: [number, number][] = [];
  for (let begin = Date.parse(from); begin < end; begin += YEAR) ranges.push([begin, Math.min(begin + YEAR, end)]);
  const day = (time: number) => new Date(time).toISOString().slice(0, 10);
  const parts = await Promise.all(ranges.slice(-4).map(([begin, stop]) => fortyTwoApi.request(`users/${userId}/locations_stats`, dailySchema, { begin_at: day(begin), end_at: day(stop) })));
  const daily: Record<string, number> = {};
  for (const part of parts) for (const [date, value] of Object.entries(part.data)) if (/^\d{4}-\d{2}-\d{2}$/.test(date)) daily[date] = Math.min(24, durationHours(value));
  return daily;
}, ['1337-presence-daily-v1'], { revalidate: 21_600 });

/** Day-aligned so the cache key (userId, from) stays the same for a whole day instead of changing every request. */
const dayStart = (time: number) => Math.floor(time / 86_400_000) * 86_400_000;
const recentFrom = (from: string) => new Date(Math.max(Date.parse(from), dayStart(Date.now() - SESSION_DAYS * 86_400_000))).toISOString();

export async function loadPresence(userId: number, from: string): Promise<{ status: 'ready'; presence: Presence } | { status: 'rate-limited' | 'unavailable' }> {
  try {
    const [sessions, daily] = await Promise.all([fetchSessions(userId, recentFrom(from)), fetchDaily(userId, from)]);
    return { status: 'ready', presence: computePresence(sessions, from, Date.now(), 12, daily) };
  }
  catch (error) {
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('Presence failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}

/** The seats on either side in the same row: "e3r3p9" → ["e3r3p8", "e3r3p10"]. */
export function neighborSeats(host: string): string[] {
  const match = host.match(/^(.*p)(\d+)$/i);
  if (!match) return [];
  const post = Number(match[2]);
  return [post - 1, post + 1].filter((n) => n > 0).map((n) => `${match[1]}${n}`);
}

export type SeatSession = Session & { userId: number; login: string; photo: string | null };
export type Neighbor = { userId: number; login: string; photo: string | null; hours: number; seats: string[] };

const span = (session: Session, now: number) => [Date.parse(session.begin), Math.min(session.end ? Date.parse(session.end) : now, Date.parse(session.begin) + MAX_SESSION, now)] as const;

/** Hours each person sat beside you, counting only the time you were in the next seat too. */
export function computeNeighbors(mine: Session[], theirs: SeatSession[], selfId: number, now = Date.now()): Neighbor[] {
  const byHost = new Map<string, (readonly [number, number])[]>();
  for (const session of mine) byHost.set(session.host, [...(byHost.get(session.host) ?? []), span(session, now)]);
  const people = new Map<number, Neighbor>();
  for (const session of theirs) {
    if (session.userId === selfId) continue;
    const [begin, end] = span(session, now);
    let together = 0;
    for (const seat of neighborSeats(session.host)) for (const [b, e] of byHost.get(seat) ?? []) together += Math.max(0, Math.min(end, e) - Math.max(begin, b));
    if (together <= 0) continue;
    const person = people.get(session.userId) ?? { userId: session.userId, login: session.login, photo: session.photo, hours: 0, seats: [] };
    person.hours += together / HOUR;
    if (!person.seats.includes(session.host)) person.seats.push(session.host);
    people.set(session.userId, person);
  }
  return [...people.values()].filter((person) => person.hours >= .5).sort((a, b) => b.hours - a.hours);
}

const seatSchema = z.object({ host: z.string(), begin_at: z.string(), end_at: z.string().nullish(), user: z.object({ id: z.number(), login: z.string(), image: z.unknown().optional() }) });

const fetchSeat = unstable_cache(async (campus: number, host: string, from: string): Promise<SeatSession[]> => {
  const path = `campus/${campus}/locations`, base = { 'filter[host]': host, 'range[begin_at]': `${from},${new Date(Date.now() + 86_400_000).toISOString()}`, sort: '-begin_at', 'page[size]': '100' };
  const first = await fortyTwoApi.request(path, z.array(seatSchema), { ...base, 'page[number]': '1' });
  const pages = Math.min(8, Math.ceil((first.total ?? first.data.length) / 100));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fortyTwoApi.request(path, z.array(seatSchema), { ...base, 'page[number]': String(i + 2) })));
  return [first.data, ...rest.map((page) => page.data)].flat().map((row) => ({ host: row.host, begin: row.begin_at, end: row.end_at ?? null, userId: row.user.id, login: row.user.login, photo: intraPhotoPath(row.user.image) }));
}, ['1337-seat-v1'], { revalidate: 21_600 });

/** Your most frequent seat neighbors over the last year, from the seats beside your top three seats. */
export async function loadNeighbors(userId: number, from: string): Promise<{ status: 'ready'; neighbors: Neighbor[] } | { status: 'rate-limited' | 'unavailable' }> {
  try {
    const since = new Date(Math.max(Date.parse(from), dayStart(Date.now() - 365 * 86_400_000))).toISOString();
    const mine = (await fetchSessions(userId, recentFrom(from))).filter((session) => Date.parse(session.begin) >= Date.parse(since));
    const top = computePresence(mine, since).seats.slice(0, 3).map((seat) => seat.host);
    const campus = mine.find((session) => session.campus)?.campus;
    if (!campus || !top.length) return { status: 'ready', neighbors: [] };
    const hosts = [...new Set(top.flatMap(neighborSeats))];
    const theirs = (await Promise.all(hosts.map((host) => fetchSeat(campus, host, since)))).flat();
    const neighbors = computeNeighbors(mine.filter((session) => top.includes(session.host)), theirs, userId).slice(0, 5)
      .map((person) => ({ ...person, photo: intraPhotoUrl(person.userId, person.photo) }));
    return { status: 'ready', neighbors };
  } catch (error) {
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('Neighbors failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
