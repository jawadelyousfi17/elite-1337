import { ANY_TRACK, CORE_CIRCLES, NEXT_CIRCLES } from './circles';
import type { XpOption } from './xp-math';

/** `campuses`: the 1337 campuses that offer the project. */
export type CatalogProject = { slug: string; name: string; xp: number; campuses: number[] };
export type RawCursusProject = { slug: string; name: string; difficulty?: number | null; exam?: boolean | null; campus?: { id: number }[] };

// 42 lists some projects under a second slug (42cursus-push_swap and 42next-push_swap); compare them without it.
const bare = (slug: string) => slug.replace(/^(42cursus|42next)-/, '');
const core = CORE_CIRCLES.flat(2);
// Late projects older students may also take after the Common Core stay in the Advanced list.
const COMMON = new Set([...core, ...NEXT_CIRCLES.flat(2).filter((slug) => !ANY_TRACK.has(slug) || core.includes(slug))].map(bare));
const MODULE = /^(piscine-|python-\d+-|data-science-|(optional-)?cybersecurity-|mobile-|django-|unity-|ocaml-)/;
const EXPERIENCE = /^(42cursus-)?(work-experience|startup-experience|apprentissage|apprenticeship|internship)/;

/**
 * Projects after the Common Core that give XP, from the cursus project list: piscine modules count one by one
 * (the piscine itself gives nothing). Exams, retired and test entries, every Common Core project of either track, and
 * projects no 1337 campus offers (French apprenticeships, other campuses' own projects) are left out.
 */
export function advancedCatalog(projects: RawCursusProject[], campuses: number[]): CatalogProject[] {
  return projects
    .filter((project) => (project.difficulty ?? 0) > 0 && !project.exam && !/exam|deprecated|test/i.test(project.slug) && !COMMON.has(bare(project.slug)))
    .map((project) => ({ slug: project.slug, name: project.name.trim(), xp: project.difficulty!, campuses: campuses.filter((id) => project.campus?.some((campus) => campus.id === id)) }))
    .filter((project) => project.campuses.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** Picker label: piscine modules and work experience stand apart from regular projects. */
export const advancedTag = (slug: string) => EXPERIENCE.test(slug) ? 'Exp' : MODULE.test(slug) ? 'Mod' : '';

/**
 * One entry per project for this student: only what their campus offers (`campuses` null when unknown), plus any
 * project they already have a record on. When 42 lists the same project twice (agent-smith and 42cursus-agent-smith),
 * keep the slug the student has a record on, so their mark is found.
 */
export function advancedOptions(catalog: CatalogProject[], has: (slug: string) => boolean, campuses: number[] | null): XpOption[] {
  const kept = new Map<string, CatalogProject>();
  for (const project of catalog) {
    if (campuses && !has(project.slug) && !project.campuses.some((id) => campuses.includes(id))) continue;
    const key = `${project.name.toLowerCase()}|${project.xp}`, previous = kept.get(key);
    if (!previous || (!has(previous.slug) && has(project.slug))) kept.set(key, project);
  }
  return [...kept.values()].map(({ slug, name, xp }) => ({ slug, name, xp, tag: advancedTag(slug) }));
}
