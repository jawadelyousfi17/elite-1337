import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({ sql: () => query }));
beforeEach(() => { vi.resetModules(); query.mockReset(); vi.stubEnv('DATABASE_URL', 'test'); vi.stubEnv('ADMIN_LOGINS', 'revoked'); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

it('fails closed on a cold policy outage, including environment admins and public masking', async () => {
  query.mockRejectedValue(new Error('offline'));
  const policy = await import('./user-controls');
  await expect(policy.userControl('student')).rejects.toThrow('policy');
  await expect(policy.isAccessAdmin('revoked')).rejects.toThrow('policy');
  await expect(policy.userControlSets()).rejects.toThrow('policy');
});

it('does not discard restrictions after cache expiry and recovers after the outage', async () => {
  vi.useFakeTimers();
  const rows = [{ login: 'revoked', admin: false, allowed: false, anonymized: true, hacker: null, updated_at: new Date() }];
  query.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);
  const policy = await import('./user-controls');
  expect(await policy.userControl('revoked')).toMatchObject({ admin: false, allowed: false, anonymized: true });
  vi.advanceTimersByTime(30_001);
  query.mockRejectedValue(new Error('offline'));
  await expect(policy.userControl('revoked')).rejects.toThrow('policy');
  await expect(policy.userControlSets()).rejects.toThrow('policy');
  query.mockResolvedValue(rows);
  expect(await policy.userControl('revoked')).toMatchObject({ admin: false, allowed: false, anonymized: true });
});

it('supports deliberately environment-only installations', async () => {
  vi.stubEnv('DATABASE_URL', '');
  const policy = await import('./user-controls');
  expect(await policy.isAccessAdmin('revoked')).toBe(true);
  expect(query).not.toHaveBeenCalled();
});

it('registers a login without overwriting existing restrictions', async () => {
  query.mockResolvedValue([]);
  const policy = await import('./user-controls');
  expect(await policy.addUserControl('blocked', 'admin')).toBe(true);
  expect(await policy.addUserControl('blocked', 'admin')).toBe(true);
  const writes = query.mock.calls.filter(([parts]) => parts.join('').includes('insert into'));
  expect(writes).toHaveLength(2);
  for (const [parts, ...values] of writes) {
    expect(parts.join('')).toContain('on conflict (login) do nothing');
    expect(parts.join('')).not.toContain('allowed');
    expect(values).toEqual(['blocked', 'admin']);
  }
});
