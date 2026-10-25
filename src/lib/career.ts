import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError, type ApiProjectUser } from './fortytwo-api';
import { getRankingDataset } from './dataset';
import type { StudentRank } from './ranking';

/** 42 project ids: the last Common Core project and the two Work Experience (internship) parents. */
export const TRANSCENDENCE = 1337, WORK_EXPERIENCE_I = 1638, WORK_EXPERIENCE_II = 1644;
/** Validating ft_transcendence lands students above level 10 (lowest seen in any stage: 10.31), so lower levels are skipped to save API calls. */
export const MIN_CAREER_LEVEL = 9;

export type CareerStage = 'waiting' | 'internship' | 'done';
export type CareerRecord = { userId: number; stage: CareerStage; since: string | null };

/** Waiting = validated ft_transcendence without a started internship; internship = a Work Experience in progress; done = Work Experience I validated. */
export function classifyCareer(rows: Pick<ApiProjectUser, 'status' | 'validated?' | 'marked_at' | 'created_at' | 'project' | 'user'>[]): CareerRecord[] {
  const byUser = new Map<number, typeof rows>();
  for (const row of rows) byUser.set(row.user.id, [...(byUser.get(row.user.id) ?? []), row]);
  const records: CareerRecord[] = [];
  for (const [userId, items] of byUser) {
    const find = (project: number) => items.find((item) => item.project.id === project);
    const transcendence = find(TRANSCENDENCE), first = find(WORK_EXPERIENCE_I), second = find(WORK_EXPERIENCE_II);
    const running = [first, second].find((item) => item?.status === 'in_progress');
    if (running) records.push({ userId, stage: 'internship', since: running.created_at ?? null });
    else if (first?.status === 'finished' && first['validated?']) records.push({ userId, stage: 'done', since: first.marked_at ?? null });
    else if (transcendence?.status === 'finished' && transcendence['validated?']) records.push({ userId, stage: 'waiting', since: transcendence.marked_at ?? null });
  }
  return records;
}

const cached = singleFlight(unstable_cache(async () => {
  const dataset = await getRankingDataset();
  const rows = await fortyTwoApi.projectsUsersFor(dataset.students.filter((student) => student.level >= MIN_CAREER_LEVEL).map((student) => student.id), [TRANSCENDENCE, WORK_EXPERIENCE_I, WORK_EXPERIENCE_II]);
  return { records: classifyCareer(rows), fetchedAt: new Date().toISOString() };
}, ['1337-career-stages-v2'], { revalidate: 21_600 }));

export async function loadCareer(): Promise<{ status: 'ready'; records: CareerRecord[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  try { return { status: 'ready', ...(await cached()) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 career stages failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}

export type CareerSummary = { counts: Record<CareerStage, number> };

/** Counts career stages among active students, optionally for one campus. */
export function summarizeCareer(students: StudentRank[], records: CareerRecord[], campusId?: number): CareerSummary {
  const byId = new Map(students.map((student) => [student.id, student]));
  const counts: Record<CareerStage, number> = { waiting: 0, internship: 0, done: 0 };
  for (const record of records) {
    const student = byId.get(record.userId);
    if (student && (!campusId || student.campusIds.includes(campusId))) counts[record.stage]++;
  }
  return { counts };
}
