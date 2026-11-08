import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { loadRankingDataset } from '@/lib/dataset';
import { loadLastSeen } from '@/lib/last-seen';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

/** Last sessions of frozen students for the badges, loaded after the page; only ids the rankings list as frozen are looked up, so it cannot be used to spend the 42 budget on anyone else. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ seen: {} }, { status: 401, headers: noStore });
  const state = await loadRankingDataset();
  if (state.status !== 'ready') return Response.json({ seen: {} }, { status: 503, headers: noStore });
  const frozen = new Set(state.data.students.filter((student) => student.frozen && !student.anonymous && student.id > 0).map((student) => student.id));
  const asked = (request.nextUrl.searchParams.get('ids') ?? '').split(',').map(Number).filter((id) => Number.isInteger(id) && frozen.has(id));
  const seen = await loadLastSeen([...new Set(asked)].slice(0, 30), 8_000);
  return Response.json({ seen: Object.fromEntries(seen) }, { headers: noStore });
}
