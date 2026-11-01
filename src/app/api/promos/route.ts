import { auth } from '@/auth';
import { PROMO_TARGETS, promoOutcome, type PromoOutcome } from '@/lib/promos';
import { getStudentProfile } from '@/lib/student-overview';
import { withTimeout } from '@/lib/timeout';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

export type PromoAccess = { signedIn: false } | { signedIn: true; promos: Record<string, { outcome: PromoOutcome; href: string | null }> };

/** Which promos the signed-in student may open, fetched on hover so a click answers instantly. Links are sent only for allowed promos. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ signedIn: false } satisfies PromoAccess, { headers: noStore });
  const profile = await withTimeout(getStudentProfile(session.user.id).catch(() => null), 4000, null);
  const promos = Object.fromEntries(Object.entries(PROMO_TARGETS).map(([id, target]) => {
    const outcome = promoOutcome(profile?.campus_users ?? null, target.campus);
    return [id, { outcome, href: outcome === 'allowed' ? target.href : null }];
  }));
  return Response.json({ signedIn: true, promos } satisfies PromoAccess, { headers: noStore });
}
