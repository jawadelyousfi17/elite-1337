import { after, NextRequest, NextResponse } from 'next/server';
import { auth, signIn } from '@/auth';
import { PROMO_TARGETS, promoOutcome, safeBack } from '@/lib/promos';
import { recordPromo, visitIds } from '@/lib/site-stats';
import { recordsOnHost } from '@/lib/site-stats-core';
import { getStudentProfile } from '@/lib/student-overview';
import { withTimeout } from '@/lib/timeout';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

/** Sends a signed-in student of the promo's campus to its link; signs others in first, and returns other campuses to the page they came from. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = Object.hasOwn(PROMO_TARGETS, id) ? PROMO_TARGETS[id] : null;
  if (!target) return NextResponse.redirect(new URL('/', request.url), { headers: noStore });
  const returning = request.nextUrl.searchParams.get('from') === 'signin';
  const back = safeBack(request.nextUrl.searchParams.get('back'));
  const session = await auth();
  const { who, apply } = visitIds(request.cookies, session?.user?.id);
  const track = recordsOnHost(request.headers.get('host'));
  if (!session?.user?.id) {
    if (track) after(() => recordPromo(id, 'signin', returning, who));
    return signIn('42', { redirectTo: `/api/promos/${id}?from=signin${back === '/' ? '' : `&back=${encodeURIComponent(back)}`}` });
  }
  const profile = await withTimeout(getStudentProfile(session.user.id).catch(() => null), 8000, null);
  const outcome = promoOutcome(profile?.campus_users ?? null, target.campus);
  if (track) after(() => recordPromo(id, outcome, returning, who));
  const destination = outcome === 'allowed' && target.href ? new URL(target.href) : new URL(`${back}?promo=${encodeURIComponent(id)}&result=${outcome}`, request.url);
  const response = NextResponse.redirect(destination, { headers: noStore });
  apply(response.cookies);
  return response;
}

/** Click beacon from the instant path (the page already knows the outcome): records the click for the admin stats only. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = Object.hasOwn(PROMO_TARGETS, id) ? PROMO_TARGETS[id] : null;
  const response = new NextResponse(null, { status: 204, headers: noStore });
  const session = await auth();
  if (!target || !session?.user?.id || !recordsOnHost(request.headers.get('host'))) return response;
  const userId = session.user.id;
  const { who, apply } = visitIds(request.cookies, userId);
  apply(response.cookies);
  after(async () => {
    const profile = await withTimeout(getStudentProfile(userId).catch(() => null), 8000, null);
    await recordPromo(id, promoOutcome(profile?.campus_users ?? null, target.campus), false, who);
  });
  return response;
}
