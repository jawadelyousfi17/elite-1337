import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, projectUserSchema, RateBudgetError } from './fortytwo-api';

export const RECENT_VALIDATED_DAYS = 14;
/** Windows the Recently validated and Recently failed tabs offer; the first is the default. */
export const RECENT_MARK_WINDOWS = [14, 30, 60] as const;
const LIMIT = 4000, PAGE = 100, PAGES_PER_14_DAYS = 8;
export type RecentValidation = { id: number; userId: number; login: string; project: string; projectSlug: string; mark: number | null; at: string; campusId: number; teamId: number | null };

// parent_id marks sub-steps ("Work Experience I - Peer Video"); only whole projects are listed.
const rowSchema = projectUserSchema.extend({ final_mark: z.number().nullish(), project: z.object({ id: z.number().int(), name: z.string(), slug: z.string(), parent_id: z.number().int().nullish() }) });
type Row = z.infer<typeof rowSchema>;

/** Validated Common Core projects, newest first. 42 does not sort by marked_at reliably, so the list is sorted here. */
export function pickRecentValidated(rows: Row[], campusId: number, curriculum: number, limit = LIMIT): RecentValidation[] {
  return rows.filter((row) => row['validated?'] && row.marked_at && row.cursus_ids.includes(curriculum) && !row.project.parent_id)
    .map((row) => ({ id: row.id, userId: row.user.id, login: row.user.login, project: row.project.name, projectSlug: row.project.slug, mark: row.final_mark ?? null, at: row.marked_at!, campusId, teamId: row.current_team_id ?? null }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/** Common Core projects that were graded and failed and have not been retried yet (a retry moves the project out of "finished"), newest first. */
export function pickRecentFailed(rows: Row[], campusId: number, curriculum: number, limit = LIMIT): RecentValidation[] {
  return rows.filter((row) => row['validated?'] === false && row.status === 'finished' && row.marked_at && row.cursus_ids.includes(curriculum) && !row.project.parent_id)
    .map((row) => ({ id: row.id, userId: row.user.id, login: row.user.login, project: row.project.name, projectSlug: row.project.slug, mark: row.final_mark ?? null, at: row.marked_at!, campusId, teamId: row.current_team_id ?? null }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/**
 * Projects graded in the last 14, 30 or 60 days at one campus. One fetch holds both the validated and the failed ones
 * (the API marks both): about 5 requests for 14 days at Khouribga (about 450 graded), about 4 times that for 60. Each window
 * is fetched only when someone opens it. The newest 14 days refresh every 10 minutes, longer windows every 30.
 * Pages are capped by window; sorting by id means a cap would drop the newest, so the caps leave headroom.
 */
async function fetchMarks(campus: number, days: number) {
  const to = new Date(), from = new Date(to.getTime() - days * 86_400_000), maxPages = Math.ceil(days / 14) * PAGES_PER_14_DAYS;
  const base = { 'filter[campus]': String(campus), 'filter[marked]': 'true', 'range[marked_at]': `${from.toISOString()},${to.toISOString()}`, sort: 'id', 'page[size]': String(PAGE) };
  const first = await fortyTwoApi.request('projects_users', z.array(rowSchema), { ...base, 'page[number]': '1' });
  const pages = Math.min(maxPages, Math.ceil((first.total ?? first.data.length) / PAGE));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fortyTwoApi.request('projects_users', z.array(rowSchema), { ...base, 'page[number]': String(i + 2) })));
  const rows = [first.data, ...rest.map((page) => page.data)].flat();
  return { fetchedAt: to.toISOString(), validated: pickRecentValidated(rows, campus, cursusId()), failed: pickRecentFailed(rows, campus, cursusId()) };
}
const cached = singleFlight(unstable_cache(fetchMarks, ['1337-recent-marks-v1'], { revalidate: 600 }));
const cachedLong = singleFlight(unstable_cache(fetchMarks, ['1337-recent-marks-long-v1'], { revalidate: 1800 }));

export type RecentMarks = { status: 'ready'; validated: RecentValidation[]; failed: RecentValidation[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' };

/** Validated and failed projects of the last `days` days (14, 30 or 60) at one campus, or why they are unavailable. */
export async function loadRecentMarks(campus: number, days: number = RECENT_VALIDATED_DAYS): Promise<RecentMarks> {
  if (!campusIds().includes(campus) || !(RECENT_MARK_WINDOWS as readonly number[]).includes(days)) return { status: 'unavailable' };
  try { return { status: 'ready', ...(await (days === RECENT_VALIDATED_DAYS ? cached : cachedLong)(campus, days)) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 recent marks failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
