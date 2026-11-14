import { createHash } from 'node:crypto';
import { sql } from './db';

let ready: Promise<unknown> | undefined;
/** Atomic row updates coordinate every server using the same 42 application. */
async function reserve(key: string): Promise<boolean> {
  ready ??= sql()`create table if not exists api_budget (key text primary key, next_at timestamptz not null, requests timestamptz[] not null)`
    .catch((error) => { ready = undefined; throw error; });
  await ready;
  const rows = await sql()`
    insert into api_budget (key, next_at, requests)
    values (${key}, clock_timestamp() + interval '600 milliseconds', array[clock_timestamp()])
    on conflict (key) do update set
      next_at = clock_timestamp() + interval '600 milliseconds',
      requests = array_append(array(select t from unnest(api_budget.requests) t where t > clock_timestamp() - interval '1 hour'), clock_timestamp())
    where api_budget.next_at <= clock_timestamp()
      and cardinality(array(select t from unnest(api_budget.requests) t where t > clock_timestamp() - interval '1 hour')) < 1100
    returning key`;
  return rows.length === 1;
}

/** Stop rather than bypass a failed coordinator; reserve 100 hourly calls for OAuth/other traffic. */
export class SharedBudget {
  constructor(private claim = reserve, private sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {}
  async acquire() {
    if (!process.env.DATABASE_URL) {
      if (process.env.NODE_ENV === 'production' && process.env.IS_DEMO !== '1') throw new Error('Shared API budget requires DATABASE_URL');
      return;
    }
    const key = createHash('sha256').update(process.env.FORTYTWO_CLIENT_ID ?? '').digest('hex');
    for (let attempt = 0; attempt < 8; attempt++) {
      if (await this.claim(key)) return;
      if (attempt < 7) await this.sleep(600);
    }
    throw new Error('Shared API budget is busy or exhausted');
  }
}
