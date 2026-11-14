import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { z } from 'zod';
import { sql } from './db';

let ready: Promise<unknown> | undefined;
async function table() {
  ready ??= sql()`create table if not exists data_snapshots (key text primary key, payload jsonb, lease text, lease_until timestamptz)`
    .catch((error) => { ready = undefined; throw error; });
  await ready;
}

/** Persist only complete validated values; a lease keeps concurrent cold readers from duplicating refreshes. */
export async function durableSnapshot<T extends { fetchedAt: string }>(key: string, schema: z.ZodType<T>, refresh: () => Promise<T>, ttlMs: number): Promise<T> {
  if (!process.env.DATABASE_URL) return refresh();
  await table();
  const rows = await sql()`select payload from data_snapshots where key = ${key}`;
  const parsed = schema.safeParse(rows[0]?.payload);
  const previous = parsed.success ? parsed.data : null;
  if (previous && Date.now() - Date.parse(previous.fetchedAt) < ttlMs) return previous;
  const owner = randomUUID();
  const acquired = await sql()`insert into data_snapshots (key, lease, lease_until)
    values (${key}, ${owner}, clock_timestamp() + interval '120 seconds')
    on conflict (key) do update set lease = excluded.lease, lease_until = excluded.lease_until
    where data_snapshots.lease_until is null or data_snapshots.lease_until < clock_timestamp()
    returning key`;
  if (!acquired.length) {
    if (previous) return previous;
    throw new Error('Complete snapshot is being prepared');
  }
  const work = async () => {
    try {
      const value = schema.parse(await refresh());
      const saved = await sql()`update data_snapshots set payload = ${JSON.stringify(value)}::jsonb, lease = null, lease_until = null
        where key = ${key} and lease = ${owner} returning key`;
      if (!saved.length) throw new Error('Snapshot refresh lease expired');
      return value;
    } finally {
      await sql()`update data_snapshots set lease = null, lease_until = null where key = ${key} and lease = ${owner}`;
    }
  };
  if (previous) {
    after(async () => { try { await work(); } catch { console.error('Snapshot refresh failed; previous complete data retained'); } });
    return previous;
  }
  return work();
}
