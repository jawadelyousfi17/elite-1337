import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
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
/**
 * Each campus is cached on its own. A cold download takes 30+ seconds of paced requests; if a visit is cut off
 * at the 60 s function limit, the campuses it finished stay cached and the next visit only fetches the rest,
 * instead of starting over and spending every request again. Rankings refresh every 30 minutes: a full download is
 * about 50 requests, so about 100 an hour.
 */
const campusRecords = singleFlight(unstable_cache(async (campusId: number, curriculum: number) => ({ records: await fortyTwoApi.cursusUsers(campusId, curriculum), fetchedAt: new Date().toISOString() }),
  ['1337-campus-cursus-users-v2'], { revalidate: 1800 }));
const campusInfo = singleFlight(unstable_cache(async (campusId: number) => fortyTwoApi.campus(campusId), ['1337-campus-info-v1'], { revalidate: 86_400 }));

/**
 * The ranked view is rebuilt from the campus caches, not cached a second time: a second cache would be rebuilt
 * from campus entries that are themselves about to expire, showing data up to twice the refresh interval old.
 * Classifying is cheap, so each server instance keeps the last result until a campus entry changes.
 */
let built: { stamp: string; data: RankingDataset } | undefined;
async function fetchCompleteDataset(): Promise<RankingDataset> {
  const ids = campusIds(), curriculum = cursusId();
  const [campuses, loaded] = await Promise.all([
    Promise.all(ids.map((id) => campusInfo(id))),
    Promise.all(ids.map(async (campusId) => ({ campusId, ...(await campusRecords(campusId, curriculum)) })))
  ]);
  const stamp = loaded.map((source) => `${source.campusId}:${source.fetchedAt}`).join('|');
  if (built?.stamp === stamp) return built.data;
  const sources = loaded.map(({ campusId, records }) => ({ campusId, records }));
  const { students, exclusions } = classifyPopulation(sources, curriculum, excludedUserIds());
  console.info('42 ranking population:', { eligible: students.length, exclusions });
  const acceptedUserIds = [...new Set(sources.flatMap((source) => source.records.filter((record) => record.cursus_id === curriculum && !!record.begin_at).map((record) => record.user.id)))];
  const blackholed = collectBlackholed(sources, curriculum, new Set(students.map((student) => student.id)));
  // "Updated" is the oldest campus download, so the label never claims fresher data than it shows.
  const fetchedAt = loaded.map((source) => source.fetchedAt).sort()[0];
  const data: RankingDataset = { students, blackholed, acceptedUserIds, campuses, fetchedAt, complete: true };
  built = { stamp, data };
  return data;
}
export const getRankingDataset = singleFlight(fetchCompleteDataset, 5_000);
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
