import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { CORE_CIRCLES, NEXT_CIRCLES, type Track } from './circles';
import { cursusId } from './config';
import { fortyTwoApi } from './fortytwo-api';

export { LEVEL_XP, levelToXp, xpToLevel, projectGain, type XpProject } from './xp-math';
import type { XpProject } from './xp-math';

const sessionSchema = z.object({ difficulty: z.number().nullish(), cursus_id: z.number().int().nullish(), project: z.object({ slug: z.string(), name: z.string() }) });
const projectSchema = z.object({ name: z.string(), slug: z.string(), project_sessions: z.array(z.object({ difficulty: z.number().nullish(), cursus_id: z.number().int().nullish() })).default([]) });

/**
 * XP of each Common Core project for both tracks (the old one and the 2025 one), from one campus's project sessions
 * (3 requests), with the project's own sessions as a fallback when the campus has no value (C++ Module 04, for
 * example). Exams give no XP, so they are not fetched. Cached for 30 days.
 */
export const loadXpProjects = singleFlight(unstable_cache(async (): Promise<Record<Track, XpProject[]>> => {
  const curriculum = cursusId(), found = new Map<string, { name: string; xp: number }>();
  for (let page = 1; page <= 5; page++) {
    const { data, total } = await fortyTwoApi.request('project_sessions', z.array(sessionSchema), { 'filter[campus_id]': '16', 'filter[cursus_id]': String(curriculum), 'page[size]': '100', 'page[number]': String(page) });
    for (const session of data) if (session.difficulty != null && !found.has(session.project.slug)) found.set(session.project.slug, { name: session.project.name, xp: session.difficulty });
    if (!data.length || (total !== null && page * 100 >= total)) break;
  }
  const lookup = async (slug: string) => {
    let entry = found.get(slug);
    if (entry) return entry;
    if (slug.includes('exam-rank')) entry = { name: slug, xp: 0 };
    else {
      const { data } = await fortyTwoApi.request(`projects/${slug}`, projectSchema);
      const values = data.project_sessions.filter((session) => session.cursus_id === curriculum || session.cursus_id == null).map((session) => session.difficulty ?? 0);
      entry = { name: data.name, xp: Math.max(0, ...values) };
    }
    found.set(slug, entry);
    return entry;
  };
  const list = async (circles: string[][][]) => {
    const projects: XpProject[] = [];
    for (const [circle, groups] of circles.entries()) for (const slug of groups.flat()) {
      const entry = await lookup(slug);
      projects.push({ slug, name: entry.name, xp: entry.xp, circle });
    }
    return projects;
  };
  return { core: await list(CORE_CIRCLES), next: await list(NEXT_CIRCLES) };
}, ['42-project-xp-v5'], { revalidate: 30 * 86_400 }));
