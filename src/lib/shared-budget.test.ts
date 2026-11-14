import { afterEach, expect, it, vi } from 'vitest';
import { SharedBudget } from './shared-budget';
afterEach(() => vi.unstubAllEnvs());
it('independent clients share one reservation authority and never bypass rejection', async () => {
  vi.stubEnv('DATABASE_URL', 'test'); vi.stubEnv('FORTYTWO_CLIENT_ID', 'same-app');
  let calls = 0;
  const reserve = vi.fn(async (_key: string) => ++calls === 1);
  const a = new SharedBudget(reserve, async () => {}), b = new SharedBudget(reserve, async () => {});
  await a.acquire();
  await expect(b.acquire()).rejects.toThrow('exhausted');
  expect(new Set(reserve.mock.calls.map((args) => args[0])).size).toBe(1);
});
it('propagates coordinator outages rather than spending unaccounted requests', async () => {
  vi.stubEnv('DATABASE_URL', 'test');
  await expect(new SharedBudget(async () => { throw new Error('offline'); }).acquire()).rejects.toThrow('offline');
});
it('requires a coordinator for production', async () => {
  vi.stubEnv('DATABASE_URL', ''); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('IS_DEMO', '');
  await expect(new SharedBudget().acquire()).rejects.toThrow('DATABASE_URL');
});
