import { beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
const query = vi.hoisted(() => vi.fn());
const tasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock('./db', () => ({ sql: () => query }));
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => tasks.push(fn) }));
const schema = z.object({ fetchedAt: z.string().datetime(), values: z.array(z.number()) });
beforeEach(() => { vi.resetModules(); query.mockReset(); tasks.length = 0; vi.stubEnv('DATABASE_URL', 'test'); });
it('returns old complete data immediately and retains it on failed background refresh', async () => {
  const previous = { fetchedAt: '2020-01-01T00:00:00.000Z', values: [1, 2] };
  query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ payload: previous }]).mockResolvedValueOnce([{ key: 'x' }]).mockResolvedValue([]);
  const { durableSnapshot } = await import('./durable-snapshot');
  const refresh = vi.fn(async () => { throw new Error('partial'); });
  expect(await durableSnapshot('x', schema, refresh, 1000)).toEqual(previous);
  expect(refresh).not.toHaveBeenCalled();
  await tasks[0]();
  expect(query.mock.calls.some(([parts]) => parts.join('').includes('set payload'))).toBe(false);
});
it('does not start duplicate work when another server holds the cold lease', async () => {
  query.mockResolvedValue([]);
  const refresh = vi.fn();
  const { durableSnapshot } = await import('./durable-snapshot');
  await expect(durableSnapshot('x', schema, refresh, 1000)).rejects.toThrow('being prepared');
  expect(refresh).not.toHaveBeenCalled();
});
it('validates a cold refresh before publishing it', async () => {
  query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ key: 'x' }]).mockResolvedValue([]);
  const { durableSnapshot } = await import('./durable-snapshot');
  await expect(durableSnapshot('x', schema, async () => ({ fetchedAt: 'invalid', values: [] }), 1000)).rejects.toThrow();
  expect(query.mock.calls.some(([parts]) => parts.join('').includes('set payload'))).toBe(false);
});
