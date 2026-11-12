import { describe, expect, it } from 'vitest';
import type { ApiCursusUser } from './fortytwo-api';
import { rankPiscineProgress } from './piscines';

const progress = (id: number, login: string, level: number | null, cursus = 9): ApiCursusUser => ({
  id: id * 10, cursus_id: cursus, level, begin_at: '2026-07-01T00:00:00Z', end_at: null, blackholed_at: null, grade: null,
  user: { id, login, displayname: login.toUpperCase(), pool_year: '2026', pool_month: 'july', kind: 'student' },
});

describe('Piscine progress ranking', () => {
  it('ranks by level with competition ties and merges campus membership', () => {
    const data = rankPiscineProgress([
      { campusId: 16, candidates: [1, 2], records: [progress(1, 'alpha', 8), progress(2, 'beta', 7)], accepted: [1] },
      { campusId: 21, candidates: [1, 3], records: [progress(1, 'alpha', 8), progress(3, 'gamma', 7)], accepted: [1, 3] },
    ], '2026', 'july', 9);
    expect(data.students.map(({ login, rank, campusIds }) => ({ login, rank, campusIds }))).toEqual([
      { login: 'alpha', rank: 1, campusIds: [16, 21] },
      { login: 'beta', rank: 2, campusIds: [16] },
      { login: 'gamma', rank: 2, campusIds: [21] },
    ]);
    expect(data.unranked).toBe(0);
    expect({ accepted: data.accepted, notAccepted: data.notAccepted }).toEqual({ accepted: 2, notAccepted: 1 });
    expect(data.students.map((student) => student.accepted)).toEqual([true, false, true]);
  });

  it('does not rank missing levels or records from another cursus', () => {
    const data = rankPiscineProgress([{ campusId: 16, candidates: [1, 2, 3], records: [progress(1, 'alpha', 4), progress(2, 'beta', null), progress(3, 'gamma', 9, 21)] }], '2026', 'july', 9);
    expect(data.students.map((student) => student.login)).toEqual(['alpha']);
    expect(data.unranked).toBe(2);
  });
});
