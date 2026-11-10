import { NextRequest } from 'next/server';
import { loadGithubLuma } from '@/lib/photo';
import { parseCardStyle } from '@/lib/card-style';
import { GITHUB_LOGIN, githubLines, loadActivity, loadGithub, parseCardText } from '@/lib/github';
import { FULL, renderTerminalCard } from '@/lib/terminal-card';
import { withTimeout } from '@/lib/timeout';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const headers = (maxAge: number) => ({
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': `public, max-age=${Math.min(maxAge, 300)}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
});
const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });

/**
 * A GitHub profile card for anyone, no sign-in: the username picks the GitHub data and avatar, the query string carries
 * the text and look. Nothing is stored. GitHub is asked once an hour per username and the avatar once a day.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ file: string }> }) {
  const match = /^([A-Za-z\d-]{1,39})\.svg$/.exec((await context.params).file);
  if (!match || !GITHUB_LOGIN.test(match[1])) return notFound();
  const params = request.nextUrl.searchParams;
  const found = await loadGithub(match[1]);
  if (found?.status === 'missing') return notFound();
  const profile = found?.status === 'ok' ? found.profile : null;
  const login = profile?.login ?? match[1];
  const [luma, activity] = await Promise.all([withTimeout(loadGithubLuma(login.toLowerCase()).catch(() => null), 10_000, null), profile ? loadActivity(login) : null]);
  const style = parseCardStyle(params);
  const svg = renderTerminalCard(`${login} on GitHub`, githubLines(login, parseCardText(params), profile, Date.now(), activity), style.theme, luma ? new Uint8Array(Buffer.from(luma, 'base64')) : null, style, FULL);
  // A card drawn without GitHub's answer or the avatar is short-lived so the real one replaces it soon.
  return new Response(svg, { headers: headers(profile && luma ? 3600 : 120) });
}
