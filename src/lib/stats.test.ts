import { describe, expect, it } from 'vitest';
import { computeStats, shiftMonth } from './stats';
import type { BlackholedStudent } from './dataset';
import type { StudentRank } from './ranking';

const now = Date.parse('2026-10-23T12:00:00Z');
const student = (id: number, level: number, campusIds: number[], year: string): StudentRank => ({ id, login: `s${id}`, displayName: null, poolYear: null, poolMonth: null, commonCoreEntryYear: year, level, campusIds, globalRank: 0, campusRanks: {} });
const lost = (id: number, daysAgo: number, campusIds: number[], year: string): BlackholedStudent => ({ id, login: `b${id}`, displayName: null, level: 3, campusIds, commonCoreEntryYear: year, blackholedAt: new Date(now - daysAgo * 86_400_000).toISOString(), photo: null });

describe('computeStats', () => {
  const dataset = {
    students: [student(1, 4, [16], '2024'), student(2, 8, [16], '2025'), student(3, 2, [21], '2025')],
    blackholed: [lost(10, 2, [16], '2024'), lost(11, 20, [21], '2025'), lost(12, 45, [16], '2024'), lost(13, 200, [16], '2023')],
  };

  it('counts blackholes per window, including the previous 30 days', () => {
    const stats = computeStats(dataset, { now });
    expect([stats.blackholed7, stats.blackholed30, stats.previous30, stats.blackholed90, stats.blackholedTotal]).toEqual([1, 2, 1, 3, 4]);
  });
  it('builds weekly and monthly series ending now', () => {
    const stats = computeStats(dataset, { now });
    expect(stats.weekly).toHaveLength(26);
    expect(stats.weekly.reduce((sum, week) => sum + week.count, 0)).toBe(3);
    expect(stats.monthly.map((month) => month.key)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(stats.monthly.at(-1)).toMatchObject({ count: 2, change: 1 });
  });
  it('splits monthly totals by campus without double-counting multi-campus students', () => {
    const data = { ...dataset, blackholed: [...dataset.blackholed, lost(14, 1, [55, 16], '2025'), lost(15, 1, [75], '2025')] };
    const months = computeStats(data, { now }).monthly;
    expect(months.at(-1)).toMatchObject({ count: 4, byCampus: { 16: 1, 21: 1, 55: 1, 75: 1 } });
    for (const month of months) expect(Object.values(month.byCampus).reduce((sum, count) => sum + count, 0)).toBe(month.count);
    expect(computeStats(data, { now, campusId: 16 }).monthly.at(-1)).toMatchObject({ count: 2, byCampus: { 16: 2 } });
  });
  it('limits figures to one campus but keeps the campus comparison complete', () => {
    const stats = computeStats(dataset, { campusId: 16, now });
    expect([stats.active, stats.blackholedTotal, stats.avgLevel, stats.medianLevel]).toEqual([2, 3, 6, 6]);
    expect(stats.campuses.map((campus) => campus.campusId)).toEqual([16, 21]);
  });
  it('fills the campus × cohort survival matrix', () => {
    const { matrix } = computeStats(dataset, { now });
    expect(matrix.cells['2024'][16]).toEqual({ active: 1, blackholed: 2, rate: 1 / 3 });
    expect(matrix.cells['2024'][21].rate).toBeNull();
  });
  it('picks the best level of each cohort and builds the calendar month', () => {
    const stats = computeStats(dataset, { now, month: '2026-10' });
    expect(stats.leaders.find((leader) => leader.year === '2025')?.student.id).toBe(2);
    expect(stats.calendar.days).toHaveLength(31);
    expect(stats.calendar.days.find((day) => day.date === '2026-10-21')?.count).toBe(1);
    expect(computeStats(dataset, { now, month: '2027-01' }).calendar.month).toBe('2026-10');
  });
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});
