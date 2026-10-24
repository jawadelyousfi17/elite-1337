import type { ApiCursusUser } from './fortytwo-api';
import { matchesSearch } from './search';
import { classifyCommonCore, commonCoreEntryYear, piscineSession, type ExclusionReason } from './classification';

export type StudentRank = {
  id: number; login: string; displayName: string | null;
  poolYear: string | null; poolMonth: string | null; commonCoreEntryYear: string | null;
  level: number; campusIds: number[]; globalRank: number; campusRanks: Record<number, number>;
  photo?: string | null;
};
export type CampusCursusRecords = { campusId: number; records: ApiCursusUser[] };
export type RankingFilters = { campus?: number; cohort?: string; poolYear?: string; poolMonth?: string; q?: string; page: number; order?: 'desc' };
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
      ...session, commonCoreEntryYear: commonCoreEntryYear(record.begin_at),
      level: record.level!, campusIds: [...group.campuses].sort((a, b) => a - b), globalRank: 0, campusRanks: {},
      photo: record.user.image ?? null,
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

export function selectLeaderboard(students: StudentRank[], filters: RankingFilters, viewerId?: number) {
  const scope = ordered(students.filter((student) =>
    (!filters.campus || student.campusIds.includes(filters.campus)) &&
    (!filters.cohort || student.commonCoreEntryYear === filters.cohort) &&
    (!filters.poolYear || student.poolYear === filters.poolYear) &&
    (!filters.poolMonth || student.poolMonth === filters.poolMonth)
  ));
  const ranked: (StudentRank & { rank: number })[] = [];
  assignRanks(scope, (student, rank) => { ranked.push({ ...student, rank }); });
  const found = ranked.filter((student) => (!filters.q || matchesSearch(filters.q, [student.login, student.displayName])));
  // Reversed lists run from the last rank to the first; ranks themselves never change.
  const matches = filters.order === 'desc' ? [...found].reverse() : found;
  const pages = Math.max(1, Math.ceil(matches.length / 25));
  const page = Math.max(1, Math.min(filters.page, pages));
  const viewer = viewerId === undefined ? undefined : ranked.find((student) => student.id === viewerId);
  return { rows: matches.slice((page - 1) * 25, page * 25), total: matches.length, scopeTotal: scope.length, page, pages, podium: ranked.slice(0, 3), viewerRank: viewer?.rank ?? null };
}

export function cohortRank(students: StudentRank[], student: StudentRank, campusId?: number): number | null {
  if (!student.commonCoreEntryYear) return null;
  return rankWithinScope(students, student, campusId);
}
function rankWithinScope(students: StudentRank[], student: StudentRank, campusId?: number) {
  return 1 + students.filter((member) => member.commonCoreEntryYear === student.commonCoreEntryYear && (!campusId || member.campusIds.includes(campusId)) && member.level > student.level).length;
}
