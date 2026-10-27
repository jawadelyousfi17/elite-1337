import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { recordNavEvent } from '@/lib/nav-test';
import { isFeedbackAdmin } from '@/lib/feedback';

export const dynamic = 'force-dynamic';

/** One navigation event (sent with sendBeacon); the student and their half come from the session cookie. */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !session?.user?.login) return new Response(null, { status: 401 });
  // Admins always see the XP version (see nav.tsx), so their clicks would skew the experiment.
  if (isFeedbackAdmin(session.user.login)) return new Response(null, { status: 204 });
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return new Response(null, { status: 403 });
  return new Response(null, { status: await recordNavEvent(userId, session.user.login, await request.json().catch(() => null)) ? 204 : 400 });
}
