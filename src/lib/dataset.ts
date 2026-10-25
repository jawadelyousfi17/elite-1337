import { unstable_cache } from 'next/cache';
import { campusIds, cursusId, excludedUserIds } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError, type ApiCampus, type ApiCursusUser } from './fortytwo-api';
import { commonCoreEntryYear } from './classification';
import { classifyPopulation, type StudentRank } from './ranking';

export type BlackholedStudent = { id: number; login: string; displayName: string | null; level: number; campusIds: number[]; commonCoreEntryYear: string | null; blackholedAt: string; photo: string | null };
export type RankingDataset = { students: StudentRank[]; blackholed: BlackholedStudent[]; acceptedUserIds: number[]; campuses: ApiCampus[]; fetchedAt: string; complete: true };

export function collectBlackholed(sources: { campusId: number; records: ApiCursusUser[] }[], curriculum: number, ranked: ReadonlySet<number>, now = Date.now()): BlackholedStudent[] {
  const found = new Map<number, BlackholedStudent>();
  for (const { campusId, records } of sources) for (const record of records) {
    const user = record.user, at = record.blackholed_at ? Date.parse(record.blackholed_at) : NaN;
    if (record.cursus_id !== curriculum || ranked.has(user.id) || !Number.isFinite(at) || at > now) continue;
    if (user['staff?'] === true || (user.kind && user.kind !== 'student') || user['alumni?'] === true || user.alumni === true) continue;
    if (!record.end_at || Date.parse(record.end_at) > now) continue;
    const previous = found.get(user.id);
    if (previous) { if (!previous.campusIds.includes(campusId)) previous.campusIds.push(campusId); if (Date.parse(previous.blackholedAt) >= at) continue; }
    found.set(user.id, { id: user.id, login: user.login, displayName: user.displayname ?? null, level: record.level ?? 0, campusIds: previous?.campusIds ?? [campusId], commonCoreEntryYear: commonCoreEntryYear(record.begin_at), blackholedAt: record.blackholed_at!, photo: user.image ?? null });
  }
  return [...found.values()].sort((a, b) => Date.parse(b.blackholedAt) - Date.parse(a.blackholedAt) || a.login.localeCompare(b.login));
}
async function fetchCompleteDataset(): Promise<RankingDataset> {
  const ids = campusIds(), curriculum = cursusId();
  const [campuses, sources] = await Promise.all([
    Promise.all(ids.map((id) => fortyTwoApi.campus(id))),
    Promise.all(ids.map(async (campusId) => ({ campusId, records: await fortyTwoApi.cursusUsers(campusId, curriculum) })))
  ]);
  const { students, exclusions } = classifyPopulation(sources, curriculum, excludedUserIds());
  console.info('42 ranking population:', { eligible: students.length, exclusions });
  const acceptedUserIds = [...new Set(sources.flatMap((source) => source.records.filter((record) => record.cursus_id === curriculum && !!record.begin_at).map((record) => record.user.id)))];
  const blackholed = collectBlackholed(sources, curriculum, new Set(students.map((student) => student.id)));
  return { students, blackholed, acceptedUserIds, campuses, fetchedAt: new Date().toISOString(), complete: true };
}
export const getRankingDataset = unstable_cache(fetchCompleteDataset, ['1337-complete-rankings-v9'], { revalidate: 3600 });
export async function loadRankingDataset(): Promise<{ status: 'ready'; data: RankingDataset } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  try { return { status: 'ready', data: await getRankingDataset() }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 ranking refresh failed:', error instanceof Error ? error.name : 'unknown error');
    return { status: 'unavailable' };
  }
}
export function campusName(dataset: RankingDataset, id: number) { return dataset.campuses.find((campus) => campus.id === id)?.name ?? `Campus ${id}`; }
