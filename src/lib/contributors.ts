import { z } from 'zod';
import { withTimeout } from './timeout';

export type Contributor = { login: string; url: string; avatar: string; commits: number };
const REPO = 'jawadelyousfi17/elite-1337';
/** The two makers already have their own cards in the footer. */
const MAKERS = new Set(['ikosoftt', 'jawadelyousfi17']);
const schema = z.array(z.object({ login: z.string(), type: z.string(), html_url: z.string(), avatar_url: z.string(), contributions: z.number().int().nonnegative().optional() }));

/** Contributors who are not makers or bots, in the order GitHub ranks them; only github.com links and avatars are kept. */
export function pickContributors(raw: unknown): Contributor[] {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data
    .filter((person) => person.type === 'User' && !MAKERS.has(person.login.toLowerCase()) && !person.login.endsWith('[bot]'))
    .filter((person) => person.html_url === `https://github.com/${person.login}` && /^https:\/\/avatars\.githubusercontent\.com\//.test(person.avatar_url))
    .map((person) => ({ login: person.login, url: person.html_url, avatar: `${person.avatar_url}${person.avatar_url.includes('?') ? '&' : '?'}s=56`, commits: person.contributions ?? 0 }));
}

/** Repository contributors for the footer. Refreshed daily; if GitHub is slow, rate-limited or down the footer simply shows none. */
export async function loadContributors(): Promise<Contributor[]> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'elite-1337' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const fetched = fetch(`https://api.github.com/repos/${REPO}/contributors?per_page=30`, { headers, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(4_000) })
    .then((response) => response.ok ? response.json() : [])
    .then(pickContributors)
    .catch(() => [] as Contributor[]);
  return withTimeout(fetched, 4_500, []);
}
