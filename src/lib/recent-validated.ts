import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, projectUserSchema, RateBudgetError } from './fortytwo-api';

export const RECENT_VALIDATED_DAYS = 14;
const LIMIT = 1000, PAGE = 100, MAX_PAGES = 8;
export type RecentValidation = { id: number; userId: number; login: string; project: string; projectSlug: string; mark: number | null; at: string; campusId: number };

// parent_id marks sub-steps ("Work Experience I - Peer Video"); only whole projects are listed.
const rowSchema = projectUserSchema.extend({ final_mark: z.number().nullish(), project: z.object({ id: z.number().int(), name: z.string(), slug: z.string(), parent_id: z.number().int().nullish() }) });
type Row = z.infer<typeof rowSchema>;

/** Validated Common Core projects, newest first. 42 does not sort by marked_at reliably, so the list is sorted here. */
export function pickRecentValidated(rows: Row[], campusId: number, curriculum: number, limit = LIMIT): RecentValidation[] {
  return rows.filter((row) => row['validated?'] && row.marked_at && row.cursus_ids.includes(curriculum) && !row.project.parent_id)
    .map((row) => ({ id: row.id, userId: row.user.id, login: row.user.login, project: row.project.name, projectSlug: row.project.slug, mark: row.final_mark ?? null, at: row.marked_at!, campusId }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/**
 * Projects graded in the last 14 days at one campus: about 5 requests at Khouribga's pace (about 450 graded), at most
 * 8, cached 10 minutes. Kept apart from the daily-cached validated stats so "latest" stays fresh.
 */
const cached = singleFlight(unstable_cache(async (campus: number) => {
  const to = new Date(), from = new Date(to.getTime() - RECENT_VALIDATED_DAYS * 86_400_000);
  const base = { 'filter[campus]': String(campus), 'filter[marked]': 'true', 'range[marked_at]': `${from.toISOString()},${to.toISOString()}`, sort: 'id', 'page[size]': String(PAGE) };
  const first = await fortyTwoApi.request('projects_users', z.array(rowSchema), { ...base, 'page[number]': '1' });
  const pages = Math.min(MAX_PAGES, Math.ceil((first.total ?? first.data.length) / PAGE));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fortyTwoApi.request('projects_users', z.array(rowSchema), { ...base, 'page[number]': String(i + 2) })));
  return { fetchedAt: to.toISOString(), rows: pickRecentValidated([first.data, ...rest.map((page) => page.data)].flat(), campus, cursusId()) };
}, ['1337-recent-validated-v3'], { revalidate: 600 }));

export async function loadRecentValidated(campus: number): Promise<{ status: 'ready'; rows: RecentValidation[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  if (!campusIds().includes(campus)) return { status: 'unavailable' };
  try { return { status: 'ready', ...(await cached(campus)) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 recent validations failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
