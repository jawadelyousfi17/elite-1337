import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: number[] = [];
const store = new Map<string, unknown>();
vi.mock('next/cache', () => ({
  // Stands in for the Data Cache: survives a "new server instance" because it lives outside the module.
  unstable_cache: <A extends unknown[], T>(fn: (...args: A) => Promise<T>, keys: string[]) => async (...args: A) => {
    const key = `${keys.join('/')}:${JSON.stringify(args)}`;
    if (!store.has(key)) store.set(key, await fn(...args));
    return store.get(key) as T;
  },
}));
vi.mock('./fortytwo-api', () => ({ fortyTwoApi: { userLastSession: async (id: number) => { calls.push(id); return id === 3 ? null : `2026-0${id}-01T00:00:00Z`; } } }));

describe('loadLastSeen caching', () => {
  beforeEach(() => { calls.length = 0; vi.resetModules(); });

  it('asks 42 once per student, however often or at the same time it is requested', async () => {
    store.clear();
    const { loadLastSeen } = await import('./last-seen');
    await Promise.all([loadLastSeen([1, 2, 3]), loadLastSeen([1, 2, 3])]);
    await loadLastSeen([1, 2, 3, 4]);
    expect(calls.sort()).toEqual([1, 2, 3, 4]);
  });

  it('a fresh server instance reads the cache instead of 42, and keeps "never seen" as null', async () => {
    const { loadLastSeen } = await import('./last-seen');
    const seen = await loadLastSeen([1, 2, 3, 4]);
    expect(calls).toEqual([]);
    expect(seen.get(3)).toBeNull();
    expect(seen.get(1)).toBe('2026-01-01T00:00:00Z');
  });

  it('does not cache a failed lookup, so the next visit retries it', async () => {
    store.clear();
    const api = await import('./fortytwo-api');
    const original = api.fortyTwoApi.userLastSession;
    api.fortyTwoApi.userLastSession = async (id: number) => { calls.push(id); throw new Error('42 busy'); };
    const { loadLastSeen } = await import('./last-seen');
    expect((await loadLastSeen([7])).size).toBe(0);
    api.fortyTwoApi.userLastSession = original;
    vi.resetModules();
    const again = await (await import('./last-seen')).loadLastSeen([7]);
    expect(again.get(7)).toBe('2026-07-01T00:00:00Z');
  });
});
