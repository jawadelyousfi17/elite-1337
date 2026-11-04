import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { CORE_CIRCLES, NEXT_CIRCLES, type Track } from './circles';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError } from './fortytwo-api';
import { advancedCatalog, type CatalogProject } from './xp-advanced';

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

const cursusProjectSchema = z.object({ slug: z.strinprogressg(), name: z.string(), difficulty: z.number().nullish(), exam: z.boolean().nullish(), campus: z.array(z.object({ id: z.number().int() })).default([]) });
const PAGE = 100, MAX_PAGES = 8;

/**
 * XP of every project after the Common Core, from the cursus project list. 42 sends each project with its sessions
 * and attachments (about 6 MB and 15 s per page), so only projects with XP are asked for (4 pages), the pages after
 * the first are fetched together, and only the catalog (with the 1337 campuses offering each project) is kept, no
 * student data. Refreshed weekly: the 42 API terms ask apps to keep data reasonably up to date, and the stale list
 * is served while it refreshes.
 */
export const loadAdvancedProjects = singleFlight(unstable_cache(async (): Promise<CatalogProject[]> => {
  const path = `cursus/${cursusId()}/projects`, schema = z.array(cursusProjectSchema);
  const page = (number: number) => fortyTwoApi.request(path, schema, { sort: 'id', 'filter[exam]': 'false', 'range[difficulty]': '1,10000000', 'page[size]': String(PAGE), 'page[number]': String(number) }, 45_000);
  const first = await page(1);
  const pages = Math.ceil((first.total ?? first.data.length) / PAGE);
  if (pages > MAX_PAGES) throw new IncompletePopulationError('Too many cursus projects');
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => page(i + 2)));
  const all = [first.data, ...rest.map((result) => result.data)].flat();
  if (first.total !== null && all.length < first.total) throw new IncompletePopulationError('Cursus project list changed while loading');
  return advancedCatalog(all, campusIds());
}, ['42-advanced-xp-v2'], { revalidate: 7 * 86_400 }));
