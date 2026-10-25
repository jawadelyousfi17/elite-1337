import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError, type ApiProjectUser } from './fortytwo-api';

const DAY = 86_400_000;
export const VALIDATED_WINDOW_DAYS = 30;
/** No 24-hour window: the current slice refreshes once a day, so "last 24 hours" could be a day old. */
export type ValidatedWindow = 'week' | 'month';
export type ValidatedCounts = Record<ValidatedWindow, number>;
export const WINDOW_DAYS: Record<ValidatedWindow, number> = { week: 7, month: 30 };

/** One finished evaluation of a Common Core project attempt: validated, or returned so the student retries. */
export type MarkedProject = { id: string; campusId: number; at: string; project: string; validated: boolean; internship: boolean };

/** Work Experience (internship) steps are graded by companies, not peers, so they stay out of the return rate. */
const isInternship = (slug: string) => slug.startsWith('work-experience');

/**
 * Every finished evaluation, one per attempt (team), so a fail followed by a pass counts as both.
 * The latest attempt is dated and judged by the record itself (marked_at, validated?): steps such as
 * company evaluations are graded long after their team closed. Earlier attempts use their own closed_at.
 * Enrollments listed at two campuses are kept once.
 */
export function pickMarked(sources: { campusId: number; rows: Pick<ApiProjectUser, 'id' | 'validated?' | 'marked_at' | 'cursus_ids' | 'project' | 'teams'>[] }[], curriculum: number): MarkedProject[] {
  const seen = new Set<number>(), out: MarkedProject[] = [];
  for (const { campusId, rows } of sources) for (const row of rows) {
    if (!row.cursus_ids.includes(curriculum) || seen.has(row.id)) continue;
    seen.add(row.id);
    const earlier = row.teams.filter((team) => team.status === 'finished' && team.closed_at && typeof team['validated?'] === 'boolean').sort((a, b) => a.id - b.id).slice(0, -1);
    const internship = isInternship(row.project.slug);
    for (const team of earlier) out.push({ id: `${row.id}:${team.id}`, campusId, at: team.closed_at!, project: row.project.name, validated: team['validated?']!, internship });
    if (row.marked_at && typeof row['validated?'] === 'boolean') out.push({ id: String(row.id), campusId, at: row.marked_at, project: row.project.name, validated: row['validated?'], internship });
  }
  return out;
}

const inWindow = (record: MarkedProject, days: number, now: number) => { const age = now - Date.parse(record.at); return age >= 0 && age <= days * DAY; };

export function countValidated(records: MarkedProject[], campusId?: number, now = Date.now()): ValidatedCounts {
  const scoped = records.filter((record) => record.validated && (!campusId || record.campusId === campusId));
  const within = (window: ValidatedWindow) => scoped.filter((record) => inWindow(record, WINDOW_DAYS[window], now)).length;
  return { week: within('week'), month: within('month') };
}

/** The most validated projects in a window, most first, ties by name. */
export function topValidated(records: MarkedProject[], window: ValidatedWindow, campusId?: number, limit = 5, now = Date.now()) {
  const counts = new Map<string, number>();
  for (const record of records) if (record.validated && (!campusId || record.campusId === campusId) && inWindow(record, WINDOW_DAYS[window], now)) counts.set(record.project, (counts.get(record.project) ?? 0) + 1);
  return [...counts].map(([project, count]) => ({ project, count })).sort((a, b) => b.count - a.count || a.project.localeCompare(b.project)).slice(0, limit);
}

export type ReturnRate = { marked: number; returned: number; rate: number | null };

/** Share of peer-evaluated attempts that returned the project (not validated) in each window; internships excluded; null rate when nothing was evaluated. */
export function returnRates(records: MarkedProject[], campusId?: number, now = Date.now()): Record<ValidatedWindow, ReturnRate> {
  const scoped = records.filter((record) => !record.internship && (!campusId || record.campusId === campusId));
  const within = (window: ValidatedWindow): ReturnRate => {
    const graded = scoped.filter((record) => inWindow(record, WINDOW_DAYS[window], now));
    const returned = graded.filter((record) => !record.validated).length;
    return { marked: graded.length, returned, rate: graded.length ? returned / graded.length : null };
  };
  return { week: within('week'), month: within('month') };
}

/**
 * Marked projects are fetched in fixed 5-day slices per campus. A finished slice is fetched once more after it ends
 * (the "final" key) and then cached for a month; only the slice containing today refreshes, once a day,
 * instead of all 30 days.
 */
const SLICE_DAYS = 5;
export const sliceOf = (time: number) => Math.floor(time / (SLICE_DAYS * DAY));

const loadSlice = singleFlight(function loadSlice(campusId: number, slice: number, final: boolean) {
  return unstable_cache(async () => {
    const from = new Date(slice * SLICE_DAYS * DAY), to = new Date(final ? (slice + 1) * SLICE_DAYS * DAY : Date.now());
    return fortyTwoApi.markedProjects(campusId, from.toISOString(), to.toISOString());
  }, ['1337-validated-slice-v1', String(campusId), String(slice), final ? 'final' : 'open'], { revalidate: final ? 30 * 86_400 : 86_400 })();
});

/** Newest slices first: a retry moves an enrollment's marked_at forward, and pickMarked keeps the first copy it sees. */
export function sliceRange(now: number) {
  const last = sliceOf(now), first = sliceOf(now - VALIDATED_WINDOW_DAYS * DAY);
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
}

export const loadValidated = cache(async (): Promise<{ status: 'ready'; records: MarkedProject[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> => {
  try {
    const now = Date.now(), current = sliceOf(now), slices = sliceRange(now);
    const sources = (await Promise.all(slices.map((slice) => Promise.all(campusIds().map(async (campusId) => ({ campusId, rows: await loadSlice(campusId, slice, slice !== current) })))))).flat();
    return { status: 'ready', records: pickMarked(sources, cursusId()), fetchedAt: new Date(now).toISOString() };
  }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 validated projects failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
});
