import { unstable_cache } from 'next/cache';
import { isAnonymized } from './anonymous';
import { campusIds, cursusId, piscineCursusId } from './config';
import { demoDataset, isDemo } from './demo';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError, type ApiCursusUser } from './fortytwo-api';
import { singleFlight } from './single-flight';
import { userControlSets } from './user-controls';

export type PiscineRank = {
  id: number; login: string; displayName: string | null; level: number; rank: number;
  poolYear: string; poolMonth: string | null; campusIds: number[]; photo: string | null; accepted: boolean;
};
export type PiscineDataset = { students: PiscineRank[]; fetchedAt: string; unranked: number; accepted: number; notAccepted: number; candidates: number };

/** Builds level-based ranks while merging candidates returned by more than one 1337 campus. */
export function rankPiscineProgress(sources: { campusId: number; candidates: number[]; records: ApiCursusUser[]; accepted?: number[] }[], year: string, month: string | null, curriculum = piscineCursusId()): PiscineDataset {
  const candidateIds = new Set(sources.flatMap((source) => source.candidates));
  const acceptedIds = new Set(sources.flatMap((source) => source.accepted ?? []));
  const grouped = new Map<number, { record: ApiCursusUser; campusIds: Set<number> }>();
  for (const source of sources) for (const record of source.records) {
    if (!source.candidates.includes(record.user.id) || record.cursus_id !== curriculum || record.level == null) continue;
    if (record.user['staff?'] === true || (record.user.kind && record.user.kind !== 'student') || isAnonymized(record.user.login)) continue;
    const found = grouped.get(record.user.id) ?? { record, campusIds: new Set<number>() };
    if (record.level > (found.record.level ?? -1)) found.record = record;
    found.campusIds.add(source.campusId);
    grouped.set(record.user.id, found);
  }
  const students = [...grouped.values()].map(({ record, campusIds }) => ({
    id: record.user.id, login: record.user.login, displayName: record.user.displayname ?? null, level: record.level!, rank: 0,
    poolYear: record.user.pool_year ?? year, poolMonth: record.user.pool_month?.toLowerCase() ?? month,
    campusIds: [...campusIds].sort((a, b) => a - b), photo: record.user.image ?? null, accepted: acceptedIds.has(record.user.id),
  })).sort((a, b) => b.level - a.level || a.login.localeCompare(b.login) || a.id - b.id);
  let previous: number | undefined, rank = 0;
  students.forEach((student, index) => { if (student.level !== previous) rank = index + 1; student.rank = rank; previous = student.level; });
  return { students, fetchedAt: new Date().toISOString(), unranked: candidateIds.size - students.length, accepted: [...candidateIds].filter((id) => acceptedIds.has(id)).length, notAccepted: [...candidateIds].filter((id) => !acceptedIds.has(id)).length, candidates: candidateIds.size };
}

const cached = singleFlight(unstable_cache(async (campus: number | null, year: string, month: string | null, curriculum: number) => {
  const ids = campus === null ? campusIds() : [campus];
  const sources = await Promise.all(ids.map(async (campusId) => {
    const candidates = (await fortyTwoApi.usersByPiscine(campusId, year, month ?? undefined))
      .filter((user) => user['staff?'] !== true && (!user.kind || user.kind === 'student') && !isAnonymized(user.login));
    const candidateIds = candidates.map((candidate) => candidate.id);
    const [records, commonCore] = await Promise.all([fortyTwoApi.cursusUsersFor(candidateIds, curriculum), fortyTwoApi.cursusUsersFor(candidateIds, cursusId())]);
    return { campusId, candidates: candidateIds, records, accepted: commonCore.filter((record) => !!record.begin_at).map((record) => record.user.id) };
  }));
  return rankPiscineProgress(sources, year, month, curriculum);
}, ['1337-piscine-ranking-v2'], { revalidate: 3600 }));

function demoPiscine(year: string, month: string | null): PiscineDataset {
  const students = demoDataset().students.filter((student) => student.poolYear === year && (!month || student.poolMonth === month)).map((student) => ({
    id: student.id, login: student.login, displayName: student.displayName, level: Math.min(12, student.level), rank: 0, poolYear: student.poolYear!, poolMonth: student.poolMonth, campusIds: student.campusIds, photo: student.photo ?? null, accepted: student.id % 4 !== 0,
  })).sort((a, b) => b.level - a.level || a.login.localeCompare(b.login));
  students.forEach((student, index) => { student.rank = index && student.level === students[index - 1].level ? students[index - 1].rank : index + 1; });
  const accepted = students.filter((student) => student.accepted).length;
  return { students, fetchedAt: new Date().toISOString(), unranked: 0, accepted, notAccepted: students.length - accepted, candidates: students.length };
}

/** Complete, cached Piscine progress for one stable session scope. */
export async function loadPiscineRanking(campus: number | null, year: string, month: string | null):
  Promise<{ status: 'ready'; data: PiscineDataset } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  if (!/^\d{4}$/.test(year) || (campus !== null && !campusIds().includes(campus))) return { status: 'unavailable' };
  if (isDemo()) return { status: 'ready', data: demoPiscine(year, month) };
  try {
    const [data, controls] = await Promise.all([cached(campus, year, month, piscineCursusId()), userControlSets()]);
    const removed = data.students.filter((student) => controls.anonymized.has(student.login.toLowerCase()));
    if (!removed.length) return { status: 'ready', data };
    const students = data.students.filter((student) => !controls.anonymized.has(student.login.toLowerCase())).map((student) => ({ ...student }));
    let previous: number | undefined, rank = 0;
    students.forEach((student, index) => { if (student.level !== previous) rank = index + 1; student.rank = rank; previous = student.level; });
    const acceptedRemoved = removed.filter((student) => student.accepted).length;
    return { status: 'ready', data: { ...data, students, candidates: data.candidates - removed.length, accepted: data.accepted - acceptedRemoved, notAccepted: data.notAccepted - (removed.length - acceptedRemoved) } };
  }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 Piscine ranking failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
