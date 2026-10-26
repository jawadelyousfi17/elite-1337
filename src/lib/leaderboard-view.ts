import { z } from 'zod';
import { campusName, type BlackholedStudent, type RankingDataset } from './dataset';
import { selectLeaderboard, type StudentRank } from './ranking';
import { matchesSearch } from './search';
import { hackerLogins } from './hackers';
import { avatarReferencesOrEmpty } from './avatars/storage';
import { photoReferences } from './avatars/intra-photo';
import type { RankRowData } from '@/components/rank-row';

/** Shared by the leaderboard page and its rows endpoint, so both read the same filters and pages. */
export const ALL = 'all';
export const filtersSchema = z.object({
  campus: z.coerce.number().int().positive().optional(),
  cohort: z.string().regex(/^\d{4}$/).optional(),
  q: z.string().trim().max(40).optional(),
  bh: z.enum(['blackholed', 'alumni', 'frozen']).optional(),
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
  const blackholedMode = filters.bh === 'blackholed', alumniMode = filters.bh === 'alumni', frozenMode = filters.bh === 'frozen';
  const { rows, total: rankedTotal, page: rankedPage, pages: rankedPages, podium } = selectLeaderboard(dataset.students, { ...filters, alumni: alumniMode, frozen: frozenMode }, ownId);
  const inScope = (student: BlackholedStudent) => (!filters.campus || student.campusIds.includes(filters.campus)) && (!filters.cohort || student.commonCoreEntryYear === filters.cohort) && (!filters.q || matchesSearch(filters.q, [student.login, student.displayName]));
  const lost = blackholedMode ? dataset.blackholed.filter(inScope) : [];
  if (filters.order === 'desc') lost.reverse();
  const lostPages = Math.max(1, Math.ceil(lost.length / 25)), lostPage = Math.min(filters.page, lostPages);
  const lostRows = lost.slice((lostPage - 1) * 25, lostPage * 25);
  const page = blackholedMode ? lostPage : rankedPage, pages = blackholedMode ? lostPages : rankedPages;
  const showWinner = !!podium[0] && !filters.q && !filters.bh;
  const onPodium = new Set(showWinner ? podium.map((student) => student.id) : []);
  const listed = page === 1 || filters.order === 'desc' ? rows.filter((student) => !onPodium.has(student.id)) : rows;
  return { blackholedMode, alumniMode, frozenMode, total: blackholedMode ? lost.length : rankedTotal, page, pages, podium, showWinner, listed, lostRows };
}

/** Photo links for the people shown: uploaded avatars first, then signed 42 Intra photos. */
export async function avatarsFor(people: { id: number; photo?: string | null }[]) {
  return photoReferences(people, await avatarReferencesOrEmpty([...new Set(people.map((person) => person.id))]));
}

export function rowData(dataset: RankingDataset, view: ReturnType<typeof listPage>, avatars: Record<number, string>, userId: string): RankRowData[] {
  const hackers = hackerLogins();
  const campus = (ids: number[]) => ids.map((id) => campusName(dataset, id)).join(' · ');
  if (view.blackholedMode) return view.lostRows.map((student) => ({ kind: 'lost', id: student.id, login: student.login, level: student.level, year: student.commonCoreEntryYear, campus: campus(student.campusIds), src: avatars[student.id] ?? null, hacker: hackers.has(student.login.toLowerCase()), blackholedAt: student.blackholedAt }));
  return view.listed.map((student) => ({
    kind: 'ranked', id: student.id, login: student.login, level: student.level, year: student.commonCoreEntryYear, campus: campus(student.campusIds), src: avatars[student.id] ?? null,
    hacker: hackers.has(student.login.toLowerCase()), rank: student.rank, mine: String(student.id) === userId, alumni: !!student.alumni, frozen: !!student.frozen,
  }));
}
