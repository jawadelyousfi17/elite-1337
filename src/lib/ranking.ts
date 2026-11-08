import { commonCoreCohort } from './cohorts';
import type { ApiCursusUser } from './fortytwo-api';
import { matchesSearch } from './search';
import { classifyCommonCore, likelyFrozen, piscineSession, type ExclusionReason } from './classification';

export type StudentRank = {
  id: number; login: string; displayName: string | null;
  poolYear: string | null; poolMonth: string | null; commonCoreCohort: string | null;
  level: number; campusIds: number[]; globalRank: number; campusRanks: Record<number, number>;
  photo?: string | null; alumni?: boolean; frozen?: boolean; anonymous?: boolean;
};
export type CampusCursusRecords = { campusId: number; records: ApiCursusUser[] };
export type RankingFilters = { campus?: number; cohort?: string; poolYear?: string; poolMonth?: string; q?: string; alumni?: boolean; frozen?: boolean; seen?: ReadonlyMap<number, string | null>; page: number; order?: 'desc' };
const ordered = (items: StudentRank[]) => items.sort((a, b) => b.level - a.level || a.login.localeCompare(b.login) || a.id - b.id);

export function isEligible(record: ApiCursusUser, cursusId: number, excludedUserIds: ReadonlySet<number> = new Set()): boolean {
  return classifyCommonCore(record, cursusId, excludedUserIds).eligible;
}

export function classifyPopulation(sources: CampusCursusRecords[], cursusId: number, excludedUserIds: ReadonlySet<number> = new Set()) {
  const grouped = new Map<number, { records: Map<number, ApiCursusUser>; campuses: Set<number> }>();
  const exclusions: Partial<Record<ExclusionReason | 'ambiguous-enrollment', number>> = {};
  for (const source of sources) for (const record of source.records) {
    const verdict = classifyCommonCore(record, cursusId, excludedUserIds);
    if (!verdict.eligible) { exclusions[verdict.reason] = (exclusions[verdict.reason] ?? 0) + 1; continue; }
    const group = grouped.get(record.user.id) ?? { records: new Map(), campuses: new Set<number>() };
    group.records.set(record.id, record);
    group.campuses.add(source.campusId);
    grouped.set(record.user.id, group);
  }
  const students: StudentRank[] = [];
  for (const [id, group] of grouped) {
    if (group.records.size !== 1) { exclusions['ambiguous-enrollment'] = (exclusions['ambiguous-enrollment'] ?? 0) + 1; continue; }
    const record = [...group.records.values()][0];
    const session = piscineSession(record.user.pool_year, record.user.pool_month);
    students.push({
      id, login: record.user.login, displayName: record.user.displayname ?? null,
      ...session, commonCoreCohort: commonCoreCohort(record.begin_at),
      level: record.level!, campusIds: [...group.campuses].sort((a, b) => a - b), globalRank: 0, campusRanks: {},
      photo: record.user.image ?? null, ...(record.user['alumni?'] === true || record.user.alumni === true ? { alumni: true } : {}), ...(likelyFrozen(record) ? { frozen: true } : {}),
    });
  }
  ordered(students);
  assignRanks(students, (student, rank) => { student.globalRank = rank; });
  for (const campusId of new Set(students.flatMap((student) => student.campusIds))) {
    assignRanks(ordered(students.filter((student) => student.campusIds.includes(campusId))), (student, rank) => { student.campusRanks[campusId] = rank; });
  }
  return { students, exclusions };
}

function assignRanks(items: StudentRank[], set: (student: StudentRank, rank: number) => void) {
  let previousLevel: number | undefined, rank = 0;
  items.forEach((student, index) => {
    if (student.level !== previousLevel) rank = index + 1;
    set(student, rank);
    previousLevel = student.level;
  });
}

export function rankStudents(sources: CampusCursusRecords[], cursusId: number, excludedUserIds: ReadonlySet<number> = new Set()): StudentRank[] {
  return classifyPopulation(sources, cursusId, excludedUserIds).students;
}

/** Frozen students, the most recently seen first; students with no known session go last, in rank order. */
export function byLastSeen<T extends { id: number; rank: number }>(students: T[], seen: ReadonlyMap<number, string | null>): T[] {
  const time = (id: number) => { const at = seen.get(id); return at ? Date.parse(at) : NaN; };
  return [...students].sort((a, b) => {
    const x = time(a.id), y = time(b.id);
    if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1;
    return (Number.isNaN(x) ? 0 : y - x) || a.rank - b.rank;
  });
}

export function selectLeaderboard(students: StudentRank[], filters: RankingFilters, viewerId?: number) {
  const scope = ordered(students.filter((student) =>
    (!filters.campus || student.campusIds.includes(filters.campus)) &&
    (!filters.cohort || student.commonCoreCohort === filters.cohort) &&
    (!filters.poolYear || student.poolYear === filters.poolYear) &&
    (!filters.poolMonth || student.poolMonth === filters.poolMonth)
  ));
  const ranked: (StudentRank & { rank: number })[] = [];
  assignRanks(scope, (student, rank) => { ranked.push({ ...student, rank }); });
  // Like search, the alumni and frozen filters keep each student's rank within the full scope.
  const found = ranked.filter((student) => (!filters.alumni || student.alumni) && (!filters.frozen || student.frozen) && (!filters.q || matchesSearch(filters.q, [student.login, student.displayName])));
  // Reversed lists run from the last rank to the first; ranks themselves never change.
  const sorted = filters.frozen && filters.seen ? byLastSeen(found, filters.seen) : found;
  const matches = filters.order === 'desc' ? [...sorted].reverse() : sorted;
  const pages = Math.max(1, Math.ceil(matches.length / 25));
  const page = Math.max(1, Math.min(filters.page, pages));
  const viewer = viewerId === undefined ? undefined : ranked.find((student) => student.id === viewerId);
  return { rows: matches.slice((page - 1) * 25, page * 25), matches, total: matches.length, scopeTotal: scope.length, page, pages, podium: ranked.slice(0, 3), viewerRank: viewer?.rank ?? null };
}

/** Ranked and blackholed students in one list by level; ties keep ranked students first, and nobody's rank changes. */
export function mergeByLevel<A extends { level: number }, B extends { level: number }>(ranked: A[], blackholed: B[], order?: 'desc'): (A | B)[] {
  return [...ranked, ...blackholed].sort((a, b) => order === 'desc' ? a.level - b.level : b.level - a.level);
}

/** "Top N%" for a rank among `total` people, rounded up so #1 of 200 reads "top 1%", never "top 0%". */
export function topPercent(rank: number, total: number): number {
  if (total <= 0 || rank <= 0) return 100;
  return Math.min(100, Math.max(1, Math.ceil(rank / total * 100)));
}

/** Keep personal ranks scoped to the same promo and campus as the leaderboard. */
export function cohortRank(students: StudentRank[], student: StudentRank, campusId?: number): number | null {
  if (!student.commonCoreCohort) return null;
  return rankWithinScope(students, student, campusId);
}
function rankWithinScope(students: StudentRank[], student: StudentRank, campusId?: number) {
  return 1 + students.filter((member) => member.commonCoreCohort === student.commonCoreCohort && (!campusId || member.campusIds.includes(campusId)) && member.level > student.level).length;
}
