import { describe, expect, it } from 'vitest';
import { cursusUserSchema } from './fortytwo-api';
import { admissionOutcome, classifyCommonCore, commonCoreEntryYear, piscineSession } from './classification';
import { cohortRank, isEligible, rankStudents, selectLeaderboard } from './ranking';

const record = (id: number, userId: number, login: string, level: number | null, options: {
  active?: boolean; endAt?: string | null; beginAt?: string | null; blackholedAt?: string | null; poolYear?: string; poolMonth?: string; staff?: boolean; kind?: string;
} = {}) => cursusUserSchema.parse({
  id, cursus_id: 21, level, begin_at: options.beginAt ?? '2025-10-01T00:00:00Z', end_at: options.endAt ?? null, blackholed_at: options.blackholedAt ?? null,
  user: { id: userId, login, 'active?': options.active ?? true, 'staff?': options.staff ?? false, kind: options.kind ?? 'student', pool_year: options.poolYear ?? '2024', pool_month: options.poolMonth ?? 'july' },
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
    expect(isEligible(record(3, 3, 'inactive', 10, { active: false }), 21)).toBe(false);
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
