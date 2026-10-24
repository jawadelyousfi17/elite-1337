import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { campusIds } from '@/lib/config';
import { clusterMembership, getClusterSnapshot } from '@/lib/cluster-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in with 42 to view clusters.' }, { status: 401, headers });
  let membership: Awaited<ReturnType<typeof clusterMembership>>;
  try { membership = await clusterMembership(session.user.id); }
  catch { return NextResponse.json({ error: 'Campus membership could not be verified.' }, { status: 503, headers }); }
  if (!membership.memberships.length) return NextResponse.json({ error: 'A verified 1337 campus membership is required.' }, { status: 403, headers });
  const value = request.nextUrl.searchParams.get('campus');
  const campusId = value === null ? membership.primary : /^\d+$/.test(value) ? Number(value) : null;
  if (!campusId || !campusIds().includes(campusId)) return NextResponse.json({ error: 'Select a supported 1337 campus.' }, { status: 400, headers });
  try { return NextResponse.json(await getClusterSnapshot(campusId), { headers }); }
  catch { return NextResponse.json({ error: 'Cluster data is temporarily unavailable.' }, { status: 503, headers }); }
}
