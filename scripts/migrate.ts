import { sql } from '../src/lib/db';
import { ensurePolicyAudit } from '../src/lib/policy-audit';

async function main() {
// Idempotent bootstrap for review/implementation; records completion only after every DDL succeeds.
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before migrating');
await sql()`create table if not exists schema_migrations (version integer primary key, applied_at timestamptz not null default now())`;
await sql()`create table if not exists user_controls (login text primary key, admin boolean, hacker boolean, anonymized boolean, allowed boolean, updated_at timestamptz not null default now(), updated_by text not null)`;
await ensurePolicyAudit();
await sql()`create table if not exists api_budget (key text primary key, next_at timestamptz not null, requests timestamptz[] not null)`;
await sql()`create table if not exists data_snapshots (key text primary key, payload jsonb, lease text, lease_until timestamptz)`;
await sql()`create table if not exists card_sharing (user_id bigint primary key, enabled boolean not null, version text not null, updated_at timestamptz not null default now())`;
await sql()`insert into schema_migrations (version) values (1) on conflict (version) do nothing`;
console.info('Migration 1 complete');

}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode = 1; });
