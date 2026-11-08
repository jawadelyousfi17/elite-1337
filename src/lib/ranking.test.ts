import { describe, expect, it } from 'vitest';
import { cursusUserSchema } from './fortytwo-api';
import { admissionOutcome, classifyCommonCore, commonCoreEntryYear, likelyFrozen, piscineSession } from './classification';
import { byLastSeen, cohortRank, isEligible, mergeByLevel, rankStudents, selectLeaderboard, topPercent } from './ranking';

const record = (id: number, userId: number, login: string, level: number | null, options: {
  active?: boolean; endAt?: string | null; beginAt?: string | null; blackholedAt?: string | null; poolYear?: string; poolMonth?: string; staff?: boolean; kind?: string; alumni?: boolean;
} = {}) => cursusUserSchema.parse({
  id, cursus_id: 21, level, begin_at: options.beginAt ?? '2025-10-01T00:00:00Z', end_at: options.endAt ?? null, blackholed_at: options.blackholedAt ?? null,
  user: { id: userId, login, 'active?': options.active ?? true, 'staff?': options.staff ?? false, kind: options.kind ?? 'student', pool_year: options.poolYear ?? '2024', pool_month: options.poolMonth ?? 'july', ...(options.alumni ? { 'alumni?': true } : {}) },
});

describe('classification and rankings', () => {
  it('uses Common Core begin_at for cohort and keeps the earlier Piscine session', () => {
    const student = rankStudents([{ campusId: 16, records: [record(1, 1, 'alpha', 10, { beginAt: '2025-01-02T00:00:00Z', poolYear: '2024' })] }], 21)[0];
    expect(student).toMatchObject({ commonCoreEntryYear: '2025', poolYear: '2024', poolMonth: 'july' });
    expect(commonCoreEntryYear(null)).toBeNull();
    expect(piscineSession('2024', 'July')).toEqual({ poolYear: '2024', poolMonth: 'july' });
  });
  it('excludes staff, inactive, alumni, missing levels, and audited IDs', () => {
    expect(isEligible(record(1, 1, 'alpha', 10), 21)).toBe(true);
    expect(isEligible(record(2, 2, 'staff', 10, { staff: true }), 21)).toBe(false);
    expect(isEligible(record(3, 3, 'inactive', 0, { active: false }), 21)).toBe(false);
    expect(isEligible(record(4, 4, 'alumni', 10, { endAt: '2026-01-01' }), 21)).toBe(false);
    expect(isEligible(record(5, 5, 'nulllevel', null), 21)).toBe(false);
    expect(isEligible(record(6, 6, 'test', 10), 21, new Set([6]))).toBe(false);
    expect(isEligible(record(7, 7, 'deadline', 10, { blackholedAt: '2027-01-01T00:00:00Z' }), 21)).toBe(true);
    expect(classifyCommonCore(record(6, 6, 'test', 10), 21, new Set([6]))).toEqual({ eligible: false, reason: 'manual-exclusion' });
  });
  it('deduplicates shared memberships including Tétouan and ranks ties', () => {
    const shared = record(2, 2, 'bravo', 10.25);
    const students = rankStudents([
      { campusId: 16, records: [record(1, 1, 'alpha', 10.5), shared] },
      { campusId: 55, records: [shared, record(3, 3, 'charlie', 10.25)] },
    ], 21);
    expect(students).toHaveLength(3);
    expect(students.map((item) => item.globalRank)).toEqual([1, 2, 2]);
    expect(students.find((item) => item.id === 2)).toMatchObject({ campusIds: [16, 55], campusRanks: { 16: 2, 55: 1 } });
    expect(selectLeaderboard(students, { campus: 55, q: 'charlie', page: 1 }).rows[0].rank).toBe(1);
  });
  it('recalculates cohort and Piscine filters before search and pagination', () => {
    const students = rankStudents([{ campusId: 16, records: [
      record(1, 1, 'older', 12, { beginAt: '2024-10-01T00:00:00Z' }),
      record(2, 2, 'alpha', 11),
      record(3, 3, 'bravo', 11),
      record(4, 4, 'charlie', 10, { poolMonth: 'august' }),
    ] }], 21);
    const cohort = selectLeaderboard(students, { campus: 16, cohort: '2025', poolYear: '2024', page: 1 });
    expect(cohort.rows.map(({ login, rank }) => [login, rank])).toEqual([['alpha', 1], ['bravo', 1], ['charlie', 3]]);
    expect(cohortRank(students, students.find((student) => student.login === 'charlie')!, 16)).toBe(3);
    expect(selectLeaderboard(students, { campus: 16, cohort: '2025', poolMonth: 'august', page: 1 }).rows.map((item) => item.login)).toEqual(['charlie']);
    expect(selectLeaderboard(students, { campus: 16, cohort: '2025', q: 'charlie', page: 1 }).rows[0].rank).toBe(3);
  });
  it('keeps unverified admissions unknown', () => {
    expect(admissionOutcome(true)).toBe('Accepted');
    expect(admissionOutcome(false)).toBe('Unknown');
  });
  it('ranks alumni even with an inactive account and an ended enrollment, and filters them in place', () => {
    const students = rankStudents([{ campusId: 16, records: [
      record(1, 1, 'grad', 15, { alumni: true, active: false, endAt: '2026-01-01' }),
      record(2, 2, 'alpha', 12),
      record(3, 3, 'grad2', 9, { alumni: true }),
    ] }], 21);
    expect(students.map((student) => [student.login, student.alumni ?? false])).toEqual([['grad', true], ['alpha', false], ['grad2', true]]);
    expect(selectLeaderboard(students, { page: 1, alumni: true }).rows.map((student) => [student.login, student.rank])).toEqual([['grad', 1], ['grad2', 3]]);
  });
  it('ranks likely-frozen students: paused, enrollment open, past level 0, whatever the blackhole date', () => {
    const now = Date.parse('2026-10-25T00:00:00Z'), ahead = '2026-12-01T00:00:00Z';
    const frozen = record(1, 1, 'frozen', 4.2, { active: false, blackholedAt: ahead });
    expect(likelyFrozen(frozen, now)).toBe(true);
    expect(likelyFrozen(record(2, 2, 'fresh', 0, { active: false, blackholedAt: ahead }), now)).toBe(false);
    expect(likelyFrozen(record(3, 3, 'gone', 4, { active: false, blackholedAt: '2026-09-01T00:00:00Z' }), now)).toBe(true);
    expect(likelyFrozen(record(4, 4, 'ended', 4, { active: false, blackholedAt: ahead, endAt: '2026-10-01T00:00:00Z' }), now)).toBe(false);
    expect(likelyFrozen(record(6, 6, 'nodate', 11, { active: false }), now)).toBe(true);
    expect(likelyFrozen(record(5, 5, 'live', 4, { blackholedAt: ahead }), now)).toBe(false);
    expect(classifyCommonCore(frozen, 21, new Set(), now)).toEqual({ eligible: true });
    expect(classifyCommonCore(record(2, 2, 'fresh', 0, { active: false, blackholedAt: ahead }), 21, new Set(), now)).toEqual({ eligible: false, reason: 'inactive' });
  });
});

describe('selectLeaderboard order', () => {
  const students = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, login: `s${String(i + 1).padStart(2, '0')}`, displayName: null, poolYear: null, poolMonth: null, commonCoreEntryYear: '2024', level: 30 - i, campusIds: [16], globalRank: 0, campusRanks: {} }));
  it('lists from the last rank when reversed, keeping ranks and the podium', () => {
    const normal = selectLeaderboard(students, { page: 1 });
    const reversed = selectLeaderboard(students, { page: 1, order: 'desc' });
    expect(reversed.rows[0]).toMatchObject({ login: 's30', rank: 30 });
    expect(reversed.podium.map((student) => student.rank)).toEqual(normal.podium.map((student) => student.rank));
    expect(selectLeaderboard(students, { page: 2, order: 'desc' }).rows.at(-1)).toMatchObject({ rank: 1 });
    expect(reversed.total).toBe(normal.total);
  });
});

describe('topPercent', () => {
  it('rounds up and stays between 1 and 100', () => {
    expect(topPercent(1, 200)).toBe(1);
    expect(topPercent(655, 1386)).toBe(48);
    expect(topPercent(1386, 1386)).toBe(100);
    expect(topPercent(3, 0)).toBe(100);
  });
});

describe('mergeByLevel', () => {
  const ranked = [{ id: 1, level: 9, rank: 1 }, { id: 2, level: 5, rank: 2 }], lost = [{ id: 3, level: 7 }, { id: 4, level: 5 }];
  it('places blackholed students by level, ranked students first on a tie, without touching ranks', () => {
    expect(mergeByLevel(ranked, lost).map((student) => student.id)).toEqual([1, 3, 2, 4]);
    expect(mergeByLevel(ranked, lost)[2]).toEqual({ id: 2, level: 5, rank: 2 });
  });
  it('runs from the lowest level when reversed', () => {
    expect(mergeByLevel([...ranked].reverse(), lost, 'desc').map((student) => student.id)).toEqual([2, 4, 3, 1]);
  });
});

describe('byLastSeen', () => {
  const people = [1, 2, 3, 4].map((id) => ({ id, rank: id }));
  it('puts the most recent session first and unknown students last in rank order', () => {
    const seen = new Map<number, string | null>([[1, '2025-01-01T00:00:00Z'], [3, '2026-05-01T00:00:00Z'], [4, null]]);
    expect(byLastSeen(people, seen).map((p) => p.id)).toEqual([3, 1, 2, 4]);
  });
});
