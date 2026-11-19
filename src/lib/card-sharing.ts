import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql } from './db';

const schema = z.object({ enabled: z.boolean(), version: z.string().min(1) });
export type CardSharing = z.infer<typeof schema>;
let ready: Promise<unknown> | undefined;
async function table() {
  ready ??= sql()`create table if not exists card_sharing (user_id bigint primary key, enabled boolean not null, version text not null, updated_at timestamptz not null default now())`
    .catch((error) => { ready = undefined; throw error; });
  await ready;
}
/** Preserve existing links until their owner explicitly rotates or disables them. */
export async function getCardSharing(userId: number): Promise<CardSharing> {
  if (!process.env.DATABASE_URL) return { enabled: true, version: 'legacy' };
  await table();
  const rows = await sql()`select enabled, version from card_sharing where user_id = ${userId}`;
  return rows.length ? schema.parse(rows[0]) : { enabled: true, version: 'legacy' };
}
/** A fresh nonce prevents old links from coming back when sharing is enabled again. */
export async function changeCardSharing(userId: number, enabled: boolean) {
  if (!process.env.DATABASE_URL || !Number.isSafeInteger(userId) || userId <= 0) throw new Error('Card sharing unavailable');
  await table();
  await sql()`insert into card_sharing (user_id, enabled, version) values (${userId}, ${enabled}, ${randomUUID()})
    on conflict (user_id) do update set enabled = excluded.enabled, version = excluded.version, updated_at = now()`;
}
