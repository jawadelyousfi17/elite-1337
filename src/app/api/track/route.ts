import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { recordPresence, recordView, visitIds } from '@/lib/site-stats';
import { normalizePath, recordsOnHost } from '@/lib/site-stats-core';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const body = z.object({ path: z.string().max(200), presence: z.boolean().optional() });

/** Page-view beacon for the admin site stats. Open to signed-out visitors so the landing page counts too. */
export async function POST(request: NextRequest) {
  const response = new NextResponse(null, { status: 204, headers: noStore });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response;
  const path = normalizePath(parsed.data.path);
  const presencePath = path ?? (parsed.data.presence && /^\/admin(?:\/|$)/.test(parsed.data.path) ? '/admin' : null);
  if (!presencePath) return response;
  const session = await auth();
  const id = session?.user?.id && /^\d+$/.test(session.user.id) ? Number(session.user.id) : null;
  const login = session?.user?.login;
  if (parsed.data.presence) {
    if (id && login) after(() => recordPresence(id, login, presencePath));
    return response;
  }
  if (id && login) after(() => recordPresence(id, login, presencePath));
  if (!recordsOnHost(request.headers.get('host'))) return response;
  if (!path) return response;
  const { who, apply } = visitIds(request.cookies, session?.user?.id);
  apply(response.cookies);
  after(() => recordView(path, who));
  return response;
}
