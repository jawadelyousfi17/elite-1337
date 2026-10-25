export const REPO_URL = 'https://github.com/jawadelyousfi17/elite-1337';
const REPO_API = 'https://api.github.com/repos/jawadelyousfi17/elite-1337';

/** Star count, cached for an hour. A private repo needs GITHUB_TOKEN (read-only metadata access); null when unavailable. */
export async function repoStars(): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(REPO_API, { headers: { accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const data = await response.json() as { stargazers_count?: unknown };
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}
