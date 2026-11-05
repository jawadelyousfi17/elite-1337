import { z } from 'zod';
import { campusName, type BlackholedStudent, type RankingDataset } from './dataset';
import { mergeByLevel, selectLeaderboard, type StudentRank } from './ranking';
import { matchesSearch } from './search';
import { hackerLogins } from './hackers';
import { photoReferences } from './avatars/intra-photo';
import type { RankRowData } from '@/components/rank-row';

/** Shared by the leaderboard page and its rows endpoint, so both read the same filters and pages. */
export const ALL = 'all';
export const filtersSchema = z.object({
  campus: z.coerce.number().int().positive().optional(),
  cohort: z.string().regex(/^\d{4}$/).optional(),
  q: z.string().trim().max(40).optional(),
  bh: z.enum(['all', 'blackholed', 'alumni', 'frozen']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  order: z.enum(['desc']).optional(),
});
export type Filters = z.infer<typeof filtersSchema>;
export type Ranked = StudentRank & { rank: number };
type Raw = Record<string, string | string[] | undefined>;
type Profile = { campus_users: { campus_id: number; is_primary?: boolean | null }[] } | null;

export const leaderboardHref = (filters: Partial<Filters>) => {
  const params = new URLSearchParams();
  for (const key of ['campus', 'cohort', 'q', 'bh'] as const) params.set(key, filters[key] ? String(filters[key]) : '');
  if (filters.order) params.set('order', filters.order);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return `/leaderboard?${params}`;
};

/** Missing campus/cohort mean "my own"; "all" (or empty) means no filter. */
export function resolveFilters(raw: Raw, dataset: RankingDataset, profile: Profile, userId: string) {
  const param = (key: string) => { const value = raw[key]; return value === ALL ? '' : value; };
  const own = dataset.students.find((student) => String(student.id) === userId);
  const validCampusIds = new Set(dataset.campuses.map((campus) => campus.id));
  const defaultCampus = profile?.campus_users.find((entry) => entry.is_primary && validCampusIds.has(entry.campus_id))?.campus_id ?? own?.campusIds[0];
  const defaultCohort = own?.commonCoreEntryYear ?? undefined;
  const parsed = filtersSchema.safeParse({
    campus: param('campus') === undefined ? defaultCampus : param('campus') || undefined,
    cohort: param('cohort') === undefined ? defaultCohort : param('cohort') || undefined,
    q: raw.q || undefined, bh: raw.bh || undefined, page: raw.page || 1, order: raw.order || undefined,
  });
  const filters: Filters = parsed.success ? parsed.data : { campus: defaultCampus, cohort: defaultCohort, page: 1 };
  if (filters.campus && !validCampusIds.has(filters.campus)) filters.campus = undefined;
  return { filters, own, defaultCampus, defaultCohort };
}

/** One page of the list for the filters, with the podium kept out of the rows where it is shown. */
export function listPage(dataset: RankingDataset, filters: Filters, ownId?: number) {
  const blackholedMode = filters.bh === 'blackholed', alumniMode = filters.bh === 'alumni', frozenMode = filters.bh === 'frozen', everyoneMode = filters.bh === 'all';
  const { rows, matches, total: rankedTotal, page: rankedPage, pages: rankedPages, podium } = selectLeaderboard(dataset.students, { ...filters, alumni: alumniMode, frozen: frozenMode }, ownId);
  const inScope = (student: BlackholedStudent) => (!filters.campus || student.campusIds.includes(filters.campus)) && (!filters.cohort || student.commonCoreEntryYear === filters.cohort) && (!filters.q || matchesSearch(filters.q, [student.login, student.displayName]));
  const lost = blackholedMode || everyoneMode ? dataset.blackholed.filter((student) => !student.anonymous && inScope(student)) : [];
  if (filters.order === 'desc') lost.reverse();
  const merged = blackholedMode ? lost : everyoneMode ? mergeByLevel(matches, lost, filters.order) : [];
  const mergedPages = Math.max(1, Math.ceil(merged.length / 25)), mergedPage = Math.min(filters.page, mergedPages);
  const mergedRows = merged.slice((mergedPage - 1) * 25, mergedPage * 25);
  const page = blackholedMode || everyoneMode ? mergedPage : rankedPage, pages = blackholedMode || everyoneMode ? mergedPages : rankedPages;
  const showWinner = !!podium[0] && !filters.q && (!filters.bh || everyoneMode);
  const onPodium = new Set(showWinner ? podium.map((student) => student.id) : []);
  const base: (Ranked | BlackholedStudent)[] = everyoneMode ? mergedRows : rows;
  const listed = page === 1 || filters.order === 'desc' ? base.filter((student) => !onPodium.has(student.id)) : base;
  return { blackholedMode, alumniMode, frozenMode, total: blackholedMode || everyoneMode ? merged.length : rankedTotal, page, pages, podium, showWinner, listed, lostRows: blackholedMode ? lost.slice((mergedPage - 1) * 25, mergedPage * 25) : [] };
}

/** Signed 42 Intra photo links for the people shown. */
export function avatarsFor(people: { id: number; photo?: string | null }[]) {
  // Anonymous students have negative ids and no photo: nothing to look up.
  const real = people.filter((person) => person.id > 0);
  return photoReferences(real);
}

export function rowData(dataset: RankingDataset, view: ReturnType<typeof listPage>, avatars: Record<number, string>, userId: string): RankRowData[] {
  const hackers = hackerLogins();
  const campus = (ids: number[]) => ids.map((id) => campusName(dataset, id)).join(' · ');
  const lostRow = (student: BlackholedStudent): RankRowData => ({ kind: 'lost', id: student.id, login: student.login, level: student.level, year: student.commonCoreEntryYear, campus: campus(student.campusIds), src: avatars[student.id] ?? null, hacker: hackers.has(student.login.toLowerCase()), blackholedAt: student.blackholedAt });
  if (view.blackholedMode) return view.lostRows.map(lostRow);
  return view.listed.map((student) => !('rank' in student) ? lostRow(student) : student.anonymous ? {
    // Nothing but the place in the list leaves the server for an anonymous student.
    kind: 'ranked', id: student.id, login: 'Anonymous student', level: 0, year: null, campus: '', src: null, hacker: false, rank: student.rank, mine: false, alumni: false, frozen: false, anonymous: true,
  } as RankRowData : ({
    kind: 'ranked', id: student.id, login: student.login, level: student.level, year: student.commonCoreEntryYear, campus: campus(student.campusIds), src: avatars[student.id] ?? null,
    hacker: hackers.has(student.login.toLowerCase()), rank: student.rank, mine: String(student.id) === userId, alumni: !!student.alumni, frozen: !!student.frozen,
  } as RankRowData));
}
