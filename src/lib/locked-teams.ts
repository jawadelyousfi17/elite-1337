import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, projectUserSchema, RateBudgetError } from './fortytwo-api';

export const LOCKED_TEAM_DAYS = 60;
const PAGE = 100, MAX_PAGES = 15;
/** One member of a team that locked recently; members of one team share `teamId`. */
export type LockedTeamMember = { id: number; userId: number; login: string; project: string; projectSlug: string; at: string; campusId: number; teamId: number };

const teamSchema = z.object({ id: z.number().int(), locked_at: z.string().nullish(), users: z.array(z.object({ id: z.number().int() })).default([]) });
const rowSchema = projectUserSchema.extend({ teams: z.array(teamSchema).default([]) });
type Row = z.infer<typeof rowSchema>;

/**
 * Group projects whose team locked since `from`, newest lock first. Solo projects lock on registration, so only teams
 * of two or more are kept; that is what "who is teaming up" means.
 */
export function pickLockedTeams(rows: Row[], campusId: number, curriculum: number, from: number): LockedTeamMember[] {
  const picked: LockedTeamMember[] = [];
  for (const row of rows) {
    const team = row.teams.find((item) => item.id === row.current_team_id);
    if (!team?.locked_at || Date.parse(team.locked_at) < from || team.users.length < 2 || !row.cursus_ids.includes(curriculum)) continue;
    picked.push({ id: row.id, userId: row.user.id, login: row.user.login, project: row.project.name, projectSlug: row.project.slug, at: team.locked_at, campusId, teamId: team.id });
  }
  return picked.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * In-progress projects updated in the last 60 days at one campus (a lock updates the row): about 9 requests at
 * Khouribga's pace (806 rows), at most 15, newest first so a cap drops the oldest, cached 30 minutes. The cache input
 * is the campus only; the window is computed inside.
 */
const cached = singleFlight(unstable_cache(async (campus: number) => {
  const to = new Date(), from = new Date(to.getTime() - LOCKED_TEAM_DAYS * 86_400_000);
  const base = { 'filter[campus]': String(campus), 'filter[status]': 'in_progress', 'range[updated_at]': `${from.toISOString()},${to.toISOString()}`, sort: '-updated_at', 'page[size]': String(PAGE) };
  const first = await fortyTwoApi.request('projects_users', z.array(rowSchema), { ...base, 'page[number]': '1' });
  const pages = Math.min(MAX_PAGES, Math.ceil((first.total ?? first.data.length) / PAGE));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fortyTwoApi.request('projects_users', z.array(rowSchema), { ...base, 'page[number]': String(i + 2) })));
  return { fetchedAt: to.toISOString(), rows: pickLockedTeams([first.data, ...rest.map((page) => page.data)].flat(), campus, cursusId(), from.getTime()) };
}, ['1337-locked-teams-v2'], { revalidate: 1800 }));

/** Teams that locked a group project lately at one campus, or why they are unavailable. */
export async function loadLockedTeams(campus: number): Promise<{ status: 'ready'; rows: LockedTeamMember[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  if (!campusIds().includes(campus)) return { status: 'unavailable' };
  try { return { status: 'ready', ...(await cached(campus)) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 locked teams failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
