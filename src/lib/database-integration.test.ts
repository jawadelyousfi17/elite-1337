import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock('./db', () => ({ sql: () => async (parts: TemplateStringsArray, ...values: unknown[]) => {
  const text = parts.reduce((out, part, i) => out + (i ? `$${i}` : '') + part, '');
  return (await state.db.query(text, values)).rows;
} }));
beforeAll(async () => { state.db = new PGlite(); await state.db.waitReady; vi.stubEnv('DATABASE_URL', 'local-only'); }, 30_000);
afterAll(async () => { await state.db.close(); vi.unstubAllEnvs(); });

it('Postgres atomically reserves slots and rejects a full rolling-hour budget', async () => {
  const { SharedBudget } = await import('./shared-budget');
  const a = new SharedBudget(undefined, async () => {}), b = new SharedBudget(undefined, async () => {});
  const results = await Promise.allSettled([a.acquire(), b.acquire()]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  await state.db.exec("update api_budget set next_at = now() - interval '1 second', requests = array(select now() from generate_series(1,1100))");
  await expect(a.acquire()).rejects.toThrow('exhausted');
  await state.db.exec("update api_budget set requests = array[now() - interval '2 hours']");
  await a.acquire();
  const result = await state.db.query<{ count: number }>('select cardinality(requests) as count from api_budget');
  expect(result.rows[0].count).toBe(1);
}, 30_000);

it('audit trigger captures before/after and deleting administrator in the same transaction', async () => {
  await state.db.exec('create table user_controls (login text primary key, admin boolean, allowed boolean, updated_by text not null)');
  const { ensurePolicyAudit } = await import('./policy-audit');
  await ensurePolicyAudit();
  await state.db.exec("insert into user_controls values ('fixture', false, false, 'admin-a'); update user_controls set allowed=true, updated_by='admin-b' where login='fixture'");
  await state.db.transaction(async (tx) => {
    await tx.query("select set_config('app.audit_actor', 'admin-c', true)");
    await tx.query("delete from user_controls where login='fixture'");
  });
  const { rows } = await state.db.query<{ actor: string; operation: string; before_policy: { allowed: boolean } | null; after_policy: { allowed: boolean } | null }>('select * from policy_audit order by id');
  expect(rows.map((r) => [r.actor, r.operation])).toEqual([['admin-a', 'INSERT'], ['admin-b', 'UPDATE'], ['admin-c', 'DELETE']]);
  expect(rows[1].before_policy?.allowed).toBe(false);
  expect(rows[1].after_policy?.allowed).toBe(true);
  expect(rows[2].after_policy).toBeNull();
}, 30_000);

it('card revocation survives re-enabling and does not affect another owner', async () => {
  const { getCardSharing, changeCardSharing } = await import('./card-sharing');
  expect(await getCardSharing(90000001)).toEqual({ enabled: true, version: 'legacy' });
  await changeCardSharing(90000001, false);
  const disabled = await getCardSharing(90000001);
  expect(disabled.enabled).toBe(false);
  await changeCardSharing(90000001, true);
  expect((await getCardSharing(90000001)).version).not.toBe(disabled.version);
  expect(await getCardSharing(90000002)).toEqual({ enabled: true, version: 'legacy' });
});
