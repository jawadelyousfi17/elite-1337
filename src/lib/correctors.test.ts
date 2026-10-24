import { describe, expect, it } from 'vitest';
import { minEvaluations, pickEvaluations, strictCorrectors } from './correctors';

const now = Date.parse('2026-10-23T12:00:00Z');
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();
const ids: Record<string, number> = {};
const row = (id: number, login: string | null, positive: boolean | null, days = 1) => ({
  id, filled_at: daysAgo(days), corrector: login === null ? 'invisible' : { id: ids[login] ??= Object.keys(ids).length + 1, login }, flag: positive === null ? null : { name: positive ? 'Ok' : 'Incomplete work', positive },
});

describe('pickEvaluations', () => {
  it('keeps filled, judged evaluations by people', () => {
    const picked = pickEvaluations([row(1, 'amine', false), row(2, null, false), row(3, 'sara', null), { ...row(4, 'sara', true), filled_at: null }], 16);
    expect(picked.map((evaluation) => [evaluation.id, evaluation.corrector, evaluation.returned, evaluation.campusId])).toEqual([[1, 'amine', true, 16]]);
  });
});

describe('strictCorrectors', () => {
  const evaluations = [
    ...pickEvaluations([
      ...Array.from({ length: 10 }, (_, i) => row(i, 'amine', i < 6)),          // 4 of 10 returned
      ...Array.from({ length: 8 }, (_, i) => row(100 + i, 'sara', i < 2)),       // 6 of 8 returned
      ...Array.from({ length: 3 }, (_, i) => row(200 + i, 'youssef', false)),    // 3 of 3, too few
      ...Array.from({ length: 12 }, (_, i) => row(400 + i, 'omar', true)),       // never returned
    ], 16),
    ...pickEvaluations(Array.from({ length: 9 }, (_, i) => row(300 + i, 'nora', false, 40)), 21), // 40 days ago, Benguerir
  ];
  it('ranks by the share returned, ignoring small samples, old evaluations and people who returned nothing', () => {
    expect(strictCorrectors(evaluations, { now, days: 30, min: 8 }).map((stat) => [stat.login, stat.returned, stat.evaluations])).toEqual([['sara', 6, 8], ['amine', 4, 10]]);
  });
  it('widens to 60 or 90 days', () => {
    expect(strictCorrectors(evaluations, { now, days: 60, min: 8 })[0]).toMatchObject({ login: 'nora', rate: 1, campusId: 21 });
  });
  it('narrows to one campus', () => {
    expect(strictCorrectors(evaluations, { now, days: 60, min: 8, campusId: 16 }).map((stat) => stat.login)).toEqual(['sara', 'amine']);
  });
  it('asks for more evaluations over longer windows', () => {
    expect([30, 60, 90].map(minEvaluations)).toEqual([5, 10, 15]);
  });
});
