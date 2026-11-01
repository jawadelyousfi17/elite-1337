import { UMAMI_DOMAINS } from './analytics';

/** Pure helpers for the first-party site stats (src/lib/site-stats.ts), safe to import anywhere. */

export const STATS_PERIODS = ['today', '7d', '30d'] as const;
export type StatsPeriod = typeof STATS_PERIODS[number];
export const PERIOD_DAYS: Record<StatsPeriod, number> = { today: 1, '7d': 7, '30d': 30 };
export const PERIOD_LABEL: Record<StatsPeriod, string> = { today: 'Today', '7d': '7 days', '30d': '30 days' };

export const PROMO_OUTCOMES = ['signin', 'allowed', 'denied', 'error'] as const;
export type PromoEventOutcome = typeof PROMO_OUTCOMES[number];

export const parsePeriod = (value: unknown): StatsPeriod => STATS_PERIODS.includes(value as StatsPeriod) ? value as StatsPeriod : 'today';

/**
 * Only production records, so local runs and previews never pollute the numbers. On Vercel that is the production
 * deployment (VERCEL_ENV); elsewhere (Docker) the Umami production hosts, plus any in SITE_STATS_HOSTS.
 */
export function recordsOnHost(host: string | null | undefined, extra = process.env.SITE_STATS_HOSTS ?? '', vercelEnv = process.env.VERCEL_ENV) {
  if (vercelEnv) return vercelEnv === 'production';
  if (!host) return false;
  const name = host.toLowerCase().replace(/:\d+$/, '');
  return [...UMAMI_DOMAINS.split(','), ...extra.split(',')].map((entry) => entry.trim().toLowerCase()).filter(Boolean).includes(name);
}

const SECTIONS = new Set(['', 'leaderboard', 'stats', 'corrections', 'clusters', 'piscines', 'students', 'xp', 'offers', 'me', 'privacy', 'terms', 'denied', 'removed']);

/**
 * Turns a browser path into a page name for the stats: known sections only, query dropped, and anything after a
 * profile route folded into `:id`, so no login or search text is stored. Admin and unknown paths return null.
 */
export function normalizePath(path: string): string | null {
  if (typeof path !== 'string' || path.length > 200 || !path.startsWith('/')) return null;
  const parts = path.split(/[?#]/)[0].split('/').filter(Boolean).map((part) => part.toLowerCase());
  const section = parts[0] ?? '';
  if (!SECTIONS.has(section)) return null;
  if (!section) return '/';
  if (parts.length === 1) return `/${section}`;
  if (section === 'students') return '/students/:id';
  return /^[a-z-]{1,24}$/.test(parts[1]) ? `/${section}/${parts[1]}` : `/${section}/:id`;
}

/** Average with a safe zero, for "pages per visit" and "visits per student". */
export const ratio = (part: number, whole: number) => whole > 0 ? part / whole : 0;

/** Change against the previous window as a whole percent, or null when there is nothing to compare with. */
export const change = (now: number, before: number) => before > 0 ? Math.round((now - before) / before * 100) : null;
