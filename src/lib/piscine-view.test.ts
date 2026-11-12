import { describe, expect, it } from 'vitest';
import { piscinePage, resolvePiscineFilters } from './piscine-view';
import type { PiscineDataset, PiscineRank } from './piscines';

const student = (id: number, login: string, rank: number): PiscineRank => ({ id, login, displayName: login, level: 10 - rank, rank, poolYear: '2026', poolMonth: 'july', campusIds: [21], photo: null, accepted: id !== 2 });
const dataset: PiscineDataset = { students: [student(1, 'alpha', 1), student(2, 'beta', 2), student(3, 'gamma', 3)], fetchedAt: '2026-07-01T00:00:00Z', unranked: 0, accepted: 2, notAccepted: 1, candidates: 3 };

describe('Piscine leaderboard view', () => {
  it('keeps session ranks stable through search and reverse order', () => {
    expect(piscinePage(dataset, { campus: 21, year: '2026', month: 'july', q: 'gamma', page: 1 }).rows[0].rank).toBe(3);
    expect(piscinePage(dataset, { campus: 21, year: '2026', month: 'july', order: 'desc', page: 1 }).rows.map((row) => row.login)).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('filters admission results without recomputing progress ranks', () => {
    const accepted = piscinePage(dataset, { campus: 21, year: '2026', month: 'july', admission: 'accepted', page: 1 });
    const notAccepted = piscinePage(dataset, { campus: 21, year: '2026', month: 'july', admission: 'not-accepted', page: 1 });
    expect(accepted.rows.map((row) => [row.login, row.rank])).toEqual([['alpha', 1], ['gamma', 3]]);
    expect(notAccepted.rows.map((row) => [row.login, row.rank])).toEqual([['beta', 2]]);
  });

  it('uses the student session by default and respects explicit all scopes', () => {
    const profile = { pool_year: '2025', pool_month: 'august', campus_users: [{ campus_id: 21, is_primary: true }] };
    expect(resolvePiscineFilters({}, profile).filters).toMatchObject({ campus: 21, year: '2025', month: 'august' });
    expect(resolvePiscineFilters({ campus: 'all', month: 'all' }, profile).filters).toMatchObject({ campus: undefined, year: '2025', month: undefined });
  });
});
