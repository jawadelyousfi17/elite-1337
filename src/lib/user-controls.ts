import { sql } from './db';

export type UserControl = {
  login: string; admin: boolean; hacker: boolean; anonymized: boolean; allowed: boolean;
  source: 'environment' | 'database'; updatedAt: string | null;
};
export type UserControlField = 'admin' | 'hacker' | 'anonymized' | 'allowed';

type Row = { login: string; admin: boolean | null; hacker: boolean | null; anonymized: boolean | null; allowed: boolean | null; updated_at: Date | string };
const envSet = (name: 'ADMIN_LOGINS' | 'HACKER_LOGINS' | 'ANONYMIZED_LOGINS') => new Set((process.env[name] ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
const defaults = (login: string) => ({ admin: envSet('ADMIN_LOGINS').has(login), hacker: envSet('HACKER_LOGINS').has(login), anonymized: envSet('ANONYMIZED_LOGINS').has(login), allowed: true });

let ready: Promise<unknown> | undefined, cached: { rows: Row[]; until: number } | undefined, loading: Promise<Row[]> | undefined;
/** Creates the small override table independently so a missing migration never breaks sign-in. */
async function ensureTable() {
  ready ??= sql()`
    create table if not exists user_controls (
      login text primary key,
      admin boolean,
      hacker boolean,
      anonymized boolean,
      allowed boolean,
      updated_at timestamptz not null default now(),
      updated_by text not null
    )`.catch((error) => { ready = undefined; throw error; });
  return ready;
}

/** Database overrides cached briefly; environment values remain the safe fallback during a Neon outage. */
async function rows(): Promise<Row[]> {
  if (!process.env.DATABASE_URL) return [];
  if (cached && cached.until > Date.now()) return cached.rows;
  loading ??= (async () => {
    try {
      await ensureTable();
      const found = await sql()`select login, admin, hacker, anonymized, allowed, updated_at from user_controls order by login`;
      const result = found as Row[];
      cached = { rows: result, until: Date.now() + 30_000 };
      return result;
    } catch (error) {
      console.error('User controls unavailable:', error instanceof Error ? error.name : 'unknown');
      return [];
    } finally { loading = undefined; }
  })();
  return loading;
}

function effective(login: string, row?: Row): UserControl {
  const base = defaults(login);
  return {
    login, admin: row?.admin ?? base.admin, hacker: row?.hacker ?? base.hacker,
    anonymized: row?.anonymized ?? base.anonymized, allowed: row?.allowed ?? base.allowed,
    source: row ? 'database' : 'environment', updatedAt: row ? new Date(row.updated_at).toISOString() : null,
  };
}

/** One login's effective policy, with database values taking precedence over environment defaults. */
export async function userControl(login: string | null | undefined): Promise<UserControl | null> {
  const normalized = login?.trim().toLowerCase();
  if (!normalized) return null;
  const found = (await rows()).find((row) => row.login === normalized);
  return effective(normalized, found);
}

/** Admin authorization shared by navigation, pages and mutations. */
export async function isAccessAdmin(login: string | null | undefined) { return (await userControl(login))?.admin === true; }

/** Effective sets used to mask identities and mark hacker credits in shared datasets. */
export async function userControlSets() {
  const found = await rows(), logins = new Set([...envSet('ADMIN_LOGINS'), ...envSet('HACKER_LOGINS'), ...envSet('ANONYMIZED_LOGINS'), ...found.map((row) => row.login)]);
  const controls = [...logins].map((login) => effective(login, found.find((row) => row.login === login)));
  return {
    admins: new Set(controls.filter((item) => item.admin).map((item) => item.login)),
    hackers: new Set(controls.filter((item) => item.hacker).map((item) => item.login)),
    anonymized: new Set(controls.filter((item) => item.anonymized).map((item) => item.login)),
    blocked: new Set(controls.filter((item) => !item.allowed).map((item) => item.login)),
  };
}

/** Rows shown in the admin console, including environment-only users. */
export async function listUserControls(): Promise<UserControl[]> {
  const found = await rows(), logins = new Set([...envSet('ADMIN_LOGINS'), ...envSet('HACKER_LOGINS'), ...envSet('ANONYMIZED_LOGINS'), ...found.map((row) => row.login)]);
  return [...logins].sort().map((login) => effective(login, found.find((row) => row.login === login)));
}

/** Writes one explicit override and returns false when persistence is unavailable. */
export async function setUserControl(login: string, field: UserControlField, value: boolean, actor: string) {
  if (!process.env.DATABASE_URL) return false;
  try {
    await ensureTable();
    const admin = field === 'admin' ? value : null, hacker = field === 'hacker' ? value : null;
    const anonymized = field === 'anonymized' ? value : null, allowed = field === 'allowed' ? value : null;
    await sql()`
      insert into user_controls (login, admin, hacker, anonymized, allowed, updated_by)
      values (${login}, ${admin}, ${hacker}, ${anonymized}, ${allowed}, ${actor})
      on conflict (login) do update set
        admin = coalesce(${admin}, user_controls.admin), hacker = coalesce(${hacker}, user_controls.hacker),
        anonymized = coalesce(${anonymized}, user_controls.anonymized), allowed = coalesce(${allowed}, user_controls.allowed),
        updated_at = now(), updated_by = ${actor}`;
    cached = undefined;
    return true;
  } catch (error) {
    console.error('User control update failed:', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

/** Removes database overrides so environment defaults apply again. */
export async function clearUserControl(login: string) {
  if (!process.env.DATABASE_URL) return false;
  try { await ensureTable(); await sql()`delete from user_controls where login = ${login}`; cached = undefined; return true; }
  catch (error) { console.error('User control delete failed:', error instanceof Error ? error.name : 'unknown'); return false; }
}
