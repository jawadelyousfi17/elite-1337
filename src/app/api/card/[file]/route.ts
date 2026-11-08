import { NextRequest } from 'next/server';
import { loadRankingDataset } from '@/lib/dataset';
import { validCardToken } from '@/lib/card-token';
import { loadCardLuma } from '@/lib/card-photo';
import { getCardArt } from '@/lib/card-art-store';
import { withTimeout } from '@/lib/timeout';
import { parseCardStyle } from '@/lib/card-style';
import { cardData, renderPendingCard, renderRankCard } from '@/lib/rank-card';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = (maxAge: number, stale = 86400) => ({
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': `public, max-age=${Math.min(maxAge, 300)}, s-maxage=${maxAge}, stale-while-revalidate=${stale}`,
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
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
  const style = parseCardStyle(request.nextUrl.searchParams);
  const state = await loadRankingDataset();
  if (state.status !== 'ready') return new Response(renderPendingCard(style.theme, style.font), { headers: headers(60, 0) });
  const data = cardData(state.data, id);
  if (!data) return notFound.clone();
  // A picture the student chose (kept as gray cells) wins; otherwise their 42 photo from the CDN (cached a month per photo).
  // If that is slow the card goes out with a silhouette and a short cache.
  const chosen = await withTimeout(getCardArt(id), 3_000, null);
  const luma = chosen ? chosen.cells : data.photo ? await withTimeout(loadCardLuma(id, data.photo).catch((error) => { console.error('rank card photo failed:', error instanceof Error ? error.message.slice(0, 120) : 'unknown error'); return null; }), 12_000, undefined) : null;
  // GitHub caches images for a while anyway; an hour keeps the rank fresh without touching 42 (rankings refresh every 30 minutes).
  return new Response(renderRankCard(data, style.theme, luma ? new Uint8Array(Buffer.from(luma, 'base64')) : null, style), { headers: headers(luma === undefined ? 300 : 3600) });
}
