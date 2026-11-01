import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { recordView, visitIds } from '@/lib/site-stats';
import { normalizePath, recordsOnHost } from '@/lib/site-stats-core';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const body = z.object({ path: z.string().max(200) });

/** Page-view beacon for the admin site stats. Open to signed-out visitors so the landing page counts too. */
export async function POST(request: NextRequest) {
  const response = new NextResponse(null, { status: 204, headers: noStore });
  if (!recordsOnHost(request.headers.get('host'))) return response;
  const parsed = body.safeParse(await request.json().catch(() => null));
  const path = parsed.success ? normalizePath(parsed.data.path) : null;
  if (!path) return response;
  const session = await auth();
  const { who, apply } = visitIds(request.cookies, session?.user?.id);
  apply(response.cookies);
  after(() => recordView(path, who));
  return response;
}
