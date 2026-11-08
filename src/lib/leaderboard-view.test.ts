import { describe, expect, it } from 'vitest';
import { filtersSchema, leaderboardHref, listPage, resolveFilters, rowData } from './leaderboard-view';
import type { RankingDataset } from './dataset';
import type { StudentRank } from './ranking';

const student = (id: number, cohort: string): StudentRank => ({ id, login: `s${id}`, displayName: null, poolYear: '2018', poolMonth: 'july', commonCoreCohort: cohort, level: 20 - id, campusIds: [16], globalRank: id, campusRanks: { 16: id } });
const dataset: RankingDataset = {
  students: [student(1, '2019-03'), student(2, '2019-10')],
  blackholed: [
    { ...student(3, '2019-03'), blackholedAt: '2026-01-01T00:00:00Z', photo: null },
    { ...student(4, '2019-10'), blackholedAt: '2026-01-02T00:00:00Z', photo: null },
  ],
  acceptedUserIds: [1, 2, 3, 4], campuses: [{ id: 16, name: 'Khouribga' }], fetchedAt: '2026-11-08T00:00:00Z', complete: true,
};

describe('split promo filters', () => {
  it('defaults to the viewer’s precise promo and ranks within it', () => {
    const { filters, defaultCohort } = resolveFilters({}, dataset, null, '2');
    expect(defaultCohort).toBe('2019-10');
    expect(filters).toMatchObject({ campus: 16, cohort: '2019-10' });
    expect(listPage(dataset, filters, 2).podium).toMatchObject([{ id: 2, rank: 1 }]);
  });

  it.each(['2019-03', '2019-10', '2025'])('preserves %s through filter links and parsing', (cohort) => {
    const raw = Object.fromEntries(new URL(leaderboardHref({ campus: 16, cohort }), 'http://local').searchParams);
    expect(resolveFilters(raw, dataset, null, '2').filters.cohort).toBe(cohort);
    expect(filtersSchema.safeParse({ cohort }).success).toBe(true);
  });

  it('applies split promos to blackholed and combined lists too', () => {
    const filters = { campus: 16, cohort: '2019-03', page: 1 };
    expect(listPage(dataset, { ...filters, bh: 'blackholed' }).lostRows.map((student) => student.id)).toEqual([3]);
    const combined = listPage(dataset, { ...filters, bh: 'all' });
    expect(combined.total).toBe(2);
    expect(combined.podium.map((student) => student.id)).toEqual([1]);
    expect(combined.listed.map((student) => student.id)).toEqual([3]);
  });

  it('allows clearing the cohort to compare both promos', () => {
    const { filters } = resolveFilters({ cohort: 'all' }, dataset, null, '2');
    expect(filters.cohort).toBeUndefined();
    expect(listPage(dataset, filters).total).toBe(2);
  });

  it('preserves frozen-student ordering and last-seen dates within each split promo', () => {
    const data = { ...dataset, students: [...dataset.students, student(5, '2019-10')].map((student) => ({ ...student, frozen: true })) };
    const seen = new Map([[1, '2026-11-08T00:00:00Z'], [2, '2026-10-01T00:00:00Z'], [5, '2026-11-01T00:00:00Z']]);
    const view = listPage(data, { campus: 16, cohort: '2019-10', bh: 'frozen', page: 1 }, 2, seen);
    expect(view.listed.map((student) => student.id)).toEqual([5, 2]);
    expect(rowData(data, view, {}, '2')).toMatchObject([
      { id: 5, rank: 2, year: '2019-10', lastSeen: seen.get(5) },
      { id: 2, rank: 1, year: '2019-10', lastSeen: seen.get(2) },
    ]);
  });
});
