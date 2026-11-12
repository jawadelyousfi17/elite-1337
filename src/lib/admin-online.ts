import { campusName, loadRankingDataset } from './dataset';
import { listOnlinePresence } from './site-stats';
import { withTimeout } from './timeout';

export type OnlineStudent = {
  id: number; login: string; path: string; lastSeen: string; photo: string | null; displayName: string | null;
  campus: string | null; cohort: string | null; level: number | null; rank: number | null; status: 'ranked' | 'blackholed' | 'unlisted';
};

/** Admin-only site presence, enriched from the shared ranking only when that cache answers quickly. */
export async function loadOnlineStudents(): Promise<{ students: OnlineStudent[]; fetchedAt: string } | null> {
  const presence = await listOnlinePresence();
  if (presence === null) return null;
  const ranking = await withTimeout(loadRankingDataset(), 2_000, null);
  const dataset = ranking?.status === 'ready' ? ranking.data : null;
  const people = dataset ? new Map([...dataset.students, ...dataset.blackholed].filter((student) => !student.anonymous).map((student) => [student.id, student])) : new Map();
  return {
    students: presence.map((entry) => {
      const person = people.get(entry.id), ranked = person && 'globalRank' in person;
      return {
        ...entry, photo: person?.photo ?? null, displayName: person?.displayName ?? null,
        campus: person && dataset ? person.campusIds.map((id: number) => campusName(dataset, id)).join(' · ') : null,
        cohort: person?.commonCoreCohort ?? null, level: person?.level ?? null,
        rank: ranked ? person.globalRank : null, status: ranked ? 'ranked' : person ? 'blackholed' : 'unlisted',
      };
    }),
    fetchedAt: new Date().toISOString(),
  };
}
