import { z } from 'zod';
import type { RankRowData } from '@/components/rank-row';
import { campusIds } from './config';
import { matchesSearch } from './search';
import type { PiscineDataset, PiscineRank } from './piscines';
import { photoReferences } from './avatars/intra-photo';

export const PISCINE_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'] as const;
export const PISCINE_CAMPUSES = [
  { id: 16, name: 'Khouribga' }, { id: 21, name: 'Benguerir' }, { id: 55, name: 'Tétouan' }, { id: 75, name: 'Rabat' },
] as const;
const schema = z.object({
  campus: z.coerce.number().int().positive().optional(), year: z.string().regex(/^\d{4}$/), month: z.enum(PISCINE_MONTHS).optional(),
  admission: z.enum(['accepted', 'not-accepted']).optional(), q: z.string().trim().max(40).optional(), page: z.coerce.number().int().min(1).max(10000).default(1), order: z.enum(['desc']).optional(),
});
export type PiscineFilters = z.infer<typeof schema>;
type Raw = Record<string, string | string[] | undefined>;
type Profile = { pool_year?: string | null; pool_month?: string | null; campus_users: { campus_id: number; is_primary?: boolean | null }[] } | null;

/** Stable links preserve the selected Piscine session across search, reverse and infinite paging. */
export function piscineHref(filters: Partial<PiscineFilters>) {
  const params = new URLSearchParams();
  params.set('campus', filters.campus ? String(filters.campus) : 'all');
  if (filters.year) params.set('year', filters.year);
  params.set('month', filters.month ?? 'all');
  if (filters.admission) params.set('admission', filters.admission);
  if (filters.q) params.set('q', filters.q);
  if (filters.order) params.set('order', filters.order);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return `/piscines?${params}`;
}

/** Missing session filters open the signed-in student's Piscine; `all` deliberately widens a scope. */
export function resolvePiscineFilters(raw: Raw, profile: Profile, now = new Date()) {
  const valid = new Set(campusIds());
  const ownCampus = profile?.campus_users.find((entry) => entry.is_primary && valid.has(entry.campus_id))?.campus_id;
  const poolMonth = profile?.pool_month?.toLowerCase();
  const ownMonth = PISCINE_MONTHS.find((month) => month === poolMonth);
  const value = (key: string) => raw[key] === 'all' ? '' : raw[key];
  const parsed = schema.safeParse({
    campus: value('campus') === undefined ? ownCampus : value('campus') || undefined,
    year: value('year') || profile?.pool_year || String(now.getUTCFullYear()),
    month: value('month') === undefined ? ownMonth : value('month') || undefined,
    admission: raw.admission || undefined, q: raw.q || undefined, page: raw.page || 1, order: raw.order || undefined,
  });
  const filters: PiscineFilters = parsed.success ? parsed.data : { campus: ownCampus, year: profile?.pool_year ?? String(now.getUTCFullYear()), month: ownMonth, page: 1 };
  if (filters.campus && !valid.has(filters.campus)) filters.campus = undefined;
  return { filters, defaultCampus: ownCampus, defaultYear: profile?.pool_year ?? String(now.getUTCFullYear()), defaultMonth: ownMonth };
}

/** Keeps session ranks stable while search only narrows the visible people. */
export function piscinePage(dataset: PiscineDataset, filters: PiscineFilters) {
  let matches = dataset.students.filter((student) => (!filters.q || matchesSearch(filters.q, [student.login, student.displayName])) && (!filters.admission || student.accepted === (filters.admission === 'accepted')));
  if (filters.order === 'desc') matches = [...matches].reverse();
  const pages = Math.max(1, Math.ceil(matches.length / 25)), page = Math.min(filters.page, pages);
  return { matches, total: matches.length, pages, page, rows: matches.slice((page - 1) * 25, page * 25) };
}

export const piscineAvatars = (students: PiscineRank[]) => photoReferences(students);
const campusLabel = (ids: number[]) => ids.map((id) => PISCINE_CAMPUSES.find((campus) => campus.id === id)?.name ?? `Campus ${id}`).join(' · ');
const sessionLabel = (student: PiscineRank) => `${student.poolMonth ? student.poolMonth[0].toUpperCase() + student.poolMonth.slice(1) : 'Piscine'} ${student.poolYear}`;

/** Piscine progress in the shared leaderboard row contract. */
export function piscineRowData(students: PiscineRank[], avatars: Record<number, string>, userId: string): RankRowData[] {
  return students.map((student) => ({ kind: 'ranked', id: student.id, login: student.login, level: student.level, year: sessionLabel(student), campus: campusLabel(student.campusIds), src: avatars[student.id] ?? null, hacker: false, rank: student.rank, mine: String(student.id) === userId, alumni: false, frozen: false, admission: student.accepted ? 'accepted' : 'not-accepted' }));
}
