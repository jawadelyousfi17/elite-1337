import { NextRequest } from 'next/server';
import { loadRankingDataset } from '@/lib/dataset';
import { validCardToken } from '@/lib/card-token';
import { loadCardPhoto } from '@/lib/card-photo';
import { withTimeout } from '@/lib/timeout';
import { cardData, renderPendingCard, renderRankCard, type CardTheme } from '@/lib/rank-card';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = (maxAge: number, stale = 86400) => ({
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${stale}`,
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
});
const notFound = new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });

/**
 * A student's rank card for a GitHub README. Public on purpose (GitHub's image proxy sends no cookies), so the signed
 * token in the link is the permission: only students who shared their card have one. Nothing is stored.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ file: string }> }) {
  const match = /^(\d{1,12})\.svg$/.exec((await context.params).file);
  const id = match ? Number(match[1]) : 0;
  if (!id || !validCardToken(id, request.nextUrl.searchParams.get('t') ?? '')) return notFound.clone();
  const requested = request.nextUrl.searchParams.get('theme');
  const theme: CardTheme = requested === 'dark' || requested === 'light' ? requested : 'auto';
  const state = await loadRankingDataset();
  if (state.status !== 'ready') return new Response(renderPendingCard(theme), { headers: headers(60, 0) });
  const data = cardData(state.data, id);
  if (!data) return notFound.clone();
  // The photo comes from the photo CDN (cached a month per photo). If it is slow the card goes out with a silhouette and a short cache.
  const photo = data.photo ? await withTimeout(loadCardPhoto(id, data.photo).catch(() => null), 6_000, undefined) : null;
  // GitHub caches images for a while anyway; an hour keeps the rank fresh without touching 42 (rankings refresh every 30 minutes).
  return new Response(renderRankCard(data, theme, photo ?? null), { headers: headers(photo === undefined ? 300 : 3600) });
}
