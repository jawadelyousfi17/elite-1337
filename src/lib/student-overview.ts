import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { fortyTwoApi, IncompletePopulationError } from './fortytwo-api';

const profileSchema = z.object({
  wallet: z.number().nullish(),
  correction_point: z.number().nullish(),
  pool_year: z.string().nullish(),
  pool_month: z.string().nullish(),
  campus_users: z.array(z.object({ campus_id: z.number().int(), is_primary: z.boolean().nullish() })).default([]),
});
const projectSchema = z.object({
  id: z.number().int(),
  status: z.string(),
  final_mark: z.number().nullish(),
  updated_at: z.string(),
  project: z.object({ name: z.string() }),
});
const locationSchema = z.object({ begin_at: z.string(), end_at: z.string().nullish() });
export type StudentProfileSummary = z.infer<typeof profileSchema>;
export type LatestProject = z.infer<typeof projectSchema>;
export type LocationSession = z.infer<typeof locationSchema>;
export type LogtimeSummary = { todaySeconds: number; weekSeconds: number; monthSeconds: number; weekStartIso: string; monthStartIso: string; monthEndIso: string };

function checkedId(id: string) {
  if (!/^\d+$/.test(id)) throw new Error('Invalid 42 user ID');
  return id;
}

export const getStudentProfile = unstable_cache(async (id: string) => {
  return (await fortyTwoApi.request(`users/${checkedId(id)}`, profileSchema)).data;
}, ['42-student-profile-v1'], { revalidate: 600 });

const getLatestProject = unstable_cache(async (id: string) => {
  const { data } = await fortyTwoApi.request(`users/${checkedId(id)}/projects_users`, z.array(projectSchema), { sort: '-updated_at', 'page[size]': '1' });
  return data[0] ?? null;
}, ['42-latest-project-v1'], { revalidate: 600 });

export function calculateLogtimeSeconds(sessions: LocationSession[], dayStart: number, now: number): number {
  const intervals = sessions.map((session) => {
    const begin = Date.parse(session.begin_at);
    const end = session.end_at ? Date.parse(session.end_at) : now;
    return [Math.max(begin, dayStart), Math.min(end, now)] as const;
  }).filter(([begin, end]) => Number.isFinite(begin) && Number.isFinite(end) && end > begin).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let lastEnd = dayStart;
  for (const [begin, end] of intervals) {
    total += Math.max(0, end - Math.max(begin, lastEnd));
    lastEnd = Math.max(lastEnd, end);
  }
  return Math.floor(total / 1000);
}

export function logtimePeriods(now: Date) {
  const year = now.getUTCFullYear(), month = now.getUTCMonth(), day = now.getUTCDate();
  const todayStart = Date.UTC(year, month, day);
  const weekStart = Date.UTC(year, month, day - ((now.getUTCDay() + 6) % 7));
  const monthStart = Date.UTC(year, month + (day >= 28 ? 0 : -1), 28);
  const monthEnd = Date.UTC(year, month + (day >= 28 ? 1 : 0), 28);
  return { todayStartIso: new Date(todayStart).toISOString(), weekStartIso: new Date(weekStart).toISOString(), monthStartIso: new Date(monthStart).toISOString(), monthEndIso: new Date(monthEnd).toISOString(), earliestStartIso: new Date(Math.min(weekStart, monthStart)).toISOString() };
}

const getLogtimeSummary = unstable_cache(async (id: string, periods: ReturnType<typeof logtimePeriods>): Promise<LogtimeSummary> => {
  const earliestStart = Date.parse(periods.earliestStartIso);
  const sessions: LocationSession[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await fortyTwoApi.request(`users/${checkedId(id)}/locations`, z.array(locationSchema), { sort: '-begin_at', 'page[size]': '100', 'page[number]': String(page) });
    sessions.push(...data);
    if (data.length < 100 || data.some((session) => Date.parse(session.begin_at) < earliestStart)) {
      const now = Date.now();
      return {
        todaySeconds: calculateLogtimeSeconds(sessions, Date.parse(periods.todayStartIso), now),
        weekSeconds: calculateLogtimeSeconds(sessions, Date.parse(periods.weekStartIso), now),
        monthSeconds: calculateLogtimeSeconds(sessions, Date.parse(periods.monthStartIso), now),
        weekStartIso: periods.weekStartIso,
        monthStartIso: periods.monthStartIso,
        monthEndIso: periods.monthEndIso,
      };
    }
  }
  throw new IncompletePopulationError('Recent location sessions exceed the bounded request budget');
}, ['42-logtime-summary-v1'], { revalidate: 300 });

export async function loadStudentOverview(id: string, now = new Date()) {
  const periods = logtimePeriods(now);
  const [profile, latestProject, logtime] = await Promise.allSettled([
    getStudentProfile(id),
    getLatestProject(id),
    getLogtimeSummary(id, periods),
  ]);
  return {
    profile: profile.status === 'fulfilled' ? profile.value : null,
    latestProject: latestProject.status === 'fulfilled' ? latestProject.value : null,
    logtime: logtime.status === 'fulfilled' ? logtime.value : null,
  };
}
