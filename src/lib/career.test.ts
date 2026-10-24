import { describe, expect, it } from 'vitest';
import { classifyCareer, summarizeCareer, TRANSCENDENCE, WORK_EXPERIENCE_I, WORK_EXPERIENCE_II } from './career';
import type { StudentRank } from './ranking';

const row = (user: number, project: number, status: string, validated: boolean | null, at = '2026-01-01T00:00:00Z') =>
  ({ status, 'validated?': validated, marked_at: at, created_at: at, project: { id: project, name: 'p', slug: 'p' }, user: { id: user, login: `u${user}` } });
const student = (id: number, campusIds: number[]): StudentRank => ({ id, login: `u${id}`, displayName: null, poolYear: null, poolMonth: null, commonCoreEntryYear: '2023', level: 10, campusIds, globalRank: 0, campusRanks: {} });

describe('classifyCareer', () => {
  it('sorts students into waiting, internship and done', () => {
    const records = classifyCareer([
      row(1, TRANSCENDENCE, 'finished', true),
      row(2, TRANSCENDENCE, 'finished', true), row(2, WORK_EXPERIENCE_I, 'in_progress', null),
      row(3, TRANSCENDENCE, 'finished', true), row(3, WORK_EXPERIENCE_I, 'finished', true),
      row(4, WORK_EXPERIENCE_I, 'finished', true), row(4, WORK_EXPERIENCE_II, 'in_progress', null),
      row(5, TRANSCENDENCE, 'finished', false),
      row(6, TRANSCENDENCE, 'in_progress', null),
    ]);
    expect(Object.fromEntries(records.map((record) => [record.userId, record.stage]))).toEqual({ 1: 'waiting', 2: 'internship', 3: 'done', 4: 'internship' });
  });
  it('treats a registered but unstarted internship as still waiting', () => {
    expect(classifyCareer([row(7, TRANSCENDENCE, 'finished', true), row(7, WORK_EXPERIENCE_I, 'searching_a_group', null)])[0].stage).toBe('waiting');
  });
});

describe('summarizeCareer', () => {
  const students = [student(1, [16]), student(2, [21]), student(3, [16])];
  const records = [
    { userId: 1, stage: 'waiting' as const, since: null },
    { userId: 3, stage: 'waiting' as const, since: null },
    { userId: 2, stage: 'internship' as const, since: null },
    { userId: 99, stage: 'done' as const, since: null },
  ];
  it('counts only active students', () => {
    expect(summarizeCareer(students, records).counts).toEqual({ waiting: 2, internship: 1, done: 0 });
  });
  it('narrows to one campus', () => {
    expect(summarizeCareer(students, records, 21).counts).toEqual({ waiting: 0, internship: 1, done: 0 });
  });
});
