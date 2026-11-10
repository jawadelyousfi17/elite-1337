import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { withTimeout } from './timeout';
import { FULL, pair, rule, type Segment } from './terminal-card';

export * from './github-input';
import { type CardText } from './github-input';

const userSchema = z.object({
  login: z.string(), name: z.string().nullish(), bio: z.string().nullish(), location: z.string().nullish(),
  public_repos: z.number().int().nonnegative(), followers: z.number().int().nonnegative(), following: z.number().int().nonnegative(), created_at: z.string(),
});
const repoSchema = z.array(z.object({ fork: z.boolean(), stargazers_count: z.number().int().nonnegative(), language: z.string().nullish() }));
export type GithubProfile = { login: string; name: string | null; bio: string | null; location: string | null; repos: number; followers: number; following: number; createdAt: string; stars: number; languages: { name: string; share: number }[] };
export type GithubLookup = { status: 'ok'; profile: GithubProfile } | { status: 'missing' };

const headers = () => ({ accept: 'application/vnd.github+json', 'user-agent': 'elite-1337-card', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) });
const get = (path: string) => fetch(`https://api.github.com/${path}`, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(6000) });

/** Top languages by share of the owner's own (non-fork) repositories that have one. */
export function summarizeRepos(repos: z.infer<typeof repoSchema>): { stars: number; languages: GithubProfile['languages'] } {
  const own = repos.filter((repo) => !repo.fork);
  const counts = new Map<string, number>();
  for (const repo of own) if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const languages = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([name, count]) => ({ name, share: count / total }));
  return { stars: own.reduce((sum, repo) => sum + repo.stargazers_count, 0), languages };
}

/**
 * Two GitHub requests per username (profile and 100 repositories), cached for an hour per username whatever text the
 * visitor types. A missing user is cached too; any other failure throws and is not cached. Set GITHUB_TOKEN for 5,000 requests an hour instead of 60.
 */
const lookup = singleFlight(unstable_cache(async (login: string): Promise<GithubLookup> => {
  const response = await get(`users/${login}`);
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const user = userSchema.parse(await response.json());
  const reposResponse = await get(`users/${login}/repos?per_page=100&type=owner&sort=pushed`);
  const { stars, languages } = reposResponse.ok ? summarizeRepos(repoSchema.parse(await reposResponse.json())) : { stars: 0, languages: [] };
  return { status: 'ok', profile: { login: user.login, name: user.name ?? null, bio: user.bio ?? null, location: user.location ?? null, repos: user.public_repos, followers: user.followers, following: user.following, createdAt: user.created_at, stars, languages } };
}, ['1337-github-profile-v2'], { revalidate: 3600 }));

export type GithubActivity = { commits: number | null; added: number | null; removed: number | null };
const statsSchema = z.array(z.object({ author: z.object({ login: z.string() }).nullable(), weeks: z.array(z.object({ a: z.number(), d: z.number() })) }));
const repoNames = z.array(z.object({ name: z.string(), fork: z.boolean(), archived: z.boolean().optional() }));

/** Lines added and removed by `login` in one repository's contributor statistics (GitHub lists a few hundred contributors at most). */
export function linesOf(stats: z.infer<typeof statsSchema>, login: string): { added: number; removed: number } {
  const mine = stats.find((entry) => entry.author?.login.toLowerCase() === login.toLowerCase());
  return { added: mine?.weeks.reduce((sum, week) => sum + week.a, 0) ?? 0, removed: mine?.weeks.reduce((sum, week) => sum + week.d, 0) ?? 0 };
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** GitHub computes contributor statistics on first request and answers 202: ask once more shortly after, then give up on that repository. */
async function repoLines(login: string, repo: string): Promise<{ added: number; removed: number } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await get(`repos/${login}/${repo}/stats/contributors`);
    if (response.status === 202) { await wait(1500); continue; }
    if (!response.ok) return null;
    const parsed = statsSchema.safeParse(await response.json().catch(() => null));
    return parsed.success ? linesOf(parsed.data, login) : null;
  }
  return null;
}

/**
 * Commits (one search request, any visitor) and, only with GITHUB_TOKEN, lines added and removed across the 10 most recently
 * pushed repositories the user owns (one statistics request each). Cached six hours per username; each part is null when GitHub cannot answer.
 */
const activity = singleFlight(unstable_cache(async (login: string): Promise<GithubActivity> => {
  const search = await get(`search/commits?q=${encodeURIComponent(`author:${login}`)}&per_page=1`);
  const total = search.ok ? z.object({ total_count: z.number().int().nonnegative() }).safeParse(await search.json().catch(() => null)) : null;
  const commits = total?.success ? total.data.total_count : null;
  if (!process.env.GITHUB_TOKEN) return { commits, added: null, removed: null };
  const list = await get(`users/${login}/repos?per_page=100&type=owner&sort=pushed`);
  const repos = list.ok ? repoNames.safeParse(await list.json().catch(() => null)) : null;
  if (!repos?.success) return { commits, added: null, removed: null };
  const parts = await Promise.all(repos.data.filter((repo) => !repo.fork && !repo.archived).slice(0, 10).map((repo) => repoLines(login, repo.name).catch(() => null)));
  const done = parts.filter((part): part is { added: number; removed: number } => !!part);
  return { commits, added: done.length ? done.reduce((sum, part) => sum + part.added, 0) : null, removed: done.length ? done.reduce((sum, part) => sum + part.removed, 0) : null };
}, ['1337-github-activity-v1'], { revalidate: 21_600 }));

/** Commit and line counts, null when GitHub is slow (the card is drawn without those rows). */
export async function loadActivity(login: string): Promise<GithubActivity | null> {
  return withTimeout(activity(login.toLowerCase()).catch((error) => { console.error('github card activity failed:', error instanceof Error ? error.message.slice(0, 80) : 'unknown error'); return null; }), 12_000, null);
}

/** The GitHub numbers for a username, null when GitHub is slow or unavailable (the card still draws from the typed text). */
export async function loadGithub(login: string): Promise<GithubLookup | null> {
  return withTimeout(lookup(login.toLowerCase()).catch((error) => { console.error('github card lookup failed:', error instanceof Error ? error.message.slice(0, 80) : 'unknown error'); return null; }), 9_000, null);
}

const bar = (share: number) => { const filled = Math.max(1, Math.round(share * 10)); return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`; };
const plural = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;
const COLS = FULL.cols;

/** "7 years, 11 months, 3 days" since the account was created, like the reference card's Uptime. */
export function uptime(createdAt: string, now = Date.now()): string {
  const from = new Date(createdAt), to = new Date(now);
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();
  if (days < 0) { months -= 1; days += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate(); }
  if (!Number.isFinite(months) || months < 0) return 'new here';
  const parts = [[Math.floor(months / 12), 'year'], [months % 12, 'month'], [days, 'day']] as const;
  return parts.filter(([value], index) => value > 0 || index === 2).map(([value, word]) => plural(value, word)).join(', ');
}

/** One half of a two-stat row: `. Repos: ........ 9`. */
function half(prefix: string, key: string, value: string, width: number): Segment[] {
  return [['d', prefix], ['k', key], ['t', ': '], ['d', `${'.'.repeat(Math.max(2, width - prefix.length - key.length - 3 - value.length))} `], ['v', value]];
}
/** Two stats on one row, like the reference card's `Repos | Stars`. */
function duo(key1: string, value1: string, key2: string, value2: string): Segment[] {
  const left = Math.floor((COLS - 3) / 2);
  return [...half('. ', key1, value1, left), ['t', ' | '], ...half('', key2, value2, COLS - 3 - left)];
}
const list = (value: string) => value.split(/\s*[,/|]\s*/).filter(Boolean).slice(0, 6).join(', ');

const num = (value: number) => value.toLocaleString('en-US');
/** `Lines of code: ..... +1,545 -485`, additions and removals in their own colors. */
function linesRow(added: number, removed: number): Segment[] {
  const plus = `+${num(added)}`, minus = `-${num(removed)}`, key = 'Lines of code';
  return [['d', '. '], ['k', key], ['t', ': '], ['d', `${'.'.repeat(Math.max(2, COLS - key.length - 5 - plus.length - minus.length - 1))} `], ['g', plus], ['t', ' '], ['r', minus]];
}

/** The profile card's rows: typed lines first (only what was filled in), contact details, then live GitHub numbers. At most 24 fit. */
export function githubLines(login: string, text: CardText, github: GithubProfile | null, now = Date.now(), activity: GithubActivity | null = null): Segment[][] {
  const row = (key: string, value: string | null | undefined, valueClass = 'v'): Segment[] | null => value ? pair(key, value, valueClass, COLS) : null;
  const contact = [row('Email', text.email), row('Website', text.web), row('LinkedIn', text.linkedin), row('Discord', text.discord), row('X', text.x)].filter((entry): entry is Segment[] => !!entry);
  const head = `${login}@github `;
  const rows: (Segment[] | null)[] = [
    [['t', head], ['d', '─'.repeat(Math.max(3, COLS - head.length - 3))], ['d', '.-—']],
    row('Name', text.name ?? github?.name ?? login),
    row('OS', text.os),
    row('Uptime', github ? uptime(github.createdAt, now) : null),
    row('Host', text.host),
    row('Role', text.role),
    row('IDE', text.ide),
    row('Location', text.loc ?? github?.location),
    row('Languages.Programming', text.stack ? list(text.stack) : github?.languages.map((language) => language.name).join(', ')),
    row('Languages.Real', text.spoken ? list(text.spoken) : null),
    row('Hobbies', text.hobbies ? list(text.hobbies) : null),
    row('Building', text.now, 'g'),
    ...(contact.length ? [rule('Contact', COLS), ...contact] : []),
    rule('GitHub Stats', COLS),
    ...(github ? [
      duo('Repos', String(github.repos), 'Stars', String(github.stars)),
      duo('Followers', String(github.followers), 'Following', String(github.following)),
      ...(activity?.commits != null ? [pair('Commits', num(activity.commits), 'v', COLS)] : []),
      ...(activity?.added != null && activity.removed != null ? [linesRow(activity.added, activity.removed)] : []),
      ...github.languages.slice(0, 1).map((language) => pair(language.name, `${bar(language.share)} ${Math.round(language.share * 100)}%`, 'v', COLS)),
    ] : [pair('Profile', `github.com/${login}`, 'v', COLS)]),
    [['c', text.fun ? `// ${text.fun}` : '// Made with GitHub Card']],
  ];
  const filled = rows.filter((entry): entry is Segment[] => !!entry);
  // A card with every field has one row too many: the top-language bar goes first, since Languages.Programming already names the languages.
  const barAt = filled.findIndex((entry) => entry.some(([, part]) => part.includes('█')));
  return filled.length > FULL.rows && barAt > 0 ? filled.filter((_, index) => index !== barAt) : filled;
}
