import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { saveFilterSession } from '@/lib/filter-stats';

export const dynamic = 'force-dynamic';

/** Receives one mobile filter-dialog session (sent with sendBeacon); the student id comes from the session cookie. */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return new Response(null, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  return new Response(null, { status: await saveFilterSession(userId, body) ? 204 : 400 });
}
