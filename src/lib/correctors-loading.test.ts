import { beforeEach, expect, it, vi } from 'vitest';
const fetchScales = vi.hoisted(() => vi.fn());
vi.mock('react', () => ({ cache: (fn: unknown) => fn }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./config', () => ({ campusIds: () => [16, 21, 55, 75], cursusId: () => 21 }));
vi.mock('./fortytwo-api', async (original) => ({ ...await original<object>(), fortyTwoApi: { scaleTeams: fetchScales } }));
beforeEach(() => { vi.resetModules(); fetchScales.mockReset().mockResolvedValue([]); });
it('loads only the requested campus and slices, sharing overlapping slices', async () => {
  const { loadEvaluations } = await import('./correctors');
  expect((await loadEvaluations(30, 16)).status).toBe('ready');
  expect(fetchScales).toHaveBeenCalledTimes(4);
  expect(fetchScales.mock.calls.every(([campus]) => campus === 16)).toBe(true);
  await loadEvaluations(90, 16);
  expect(fetchScales).toHaveBeenCalledTimes(10);
  await loadEvaluations(30, 21);
  expect(fetchScales).toHaveBeenCalledTimes(14);
});
it('rejects unknown scopes without spending requests', async () => {
  const { loadEvaluations } = await import('./correctors');
  expect(await loadEvaluations(30, 999)).toEqual({ status: 'unavailable' });
  expect(fetchScales).not.toHaveBeenCalled();
});
