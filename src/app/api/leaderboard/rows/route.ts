import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { loadRankingDataset } from '@/lib/dataset';
import { getStudentProfile } from '@/lib/student-overview';
import { avatarsFor, listPage, resolveFilters, rowData } from '@/lib/leaderboard-view';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

/** One more page of leaderboard rows for infinite scroll; same filters as the page, read from the cached rankings. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ rows: [] }, { status: 401, headers: noStore });
  const [state, profile] = await Promise.all([loadRankingDataset(), getStudentProfile(session.user.id).catch(() => null)]);
  if (state.status !== 'ready') return Response.json({ rows: [] }, { status: 503, headers: noStore });
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const { filters, own } = resolveFilters(raw, state.data, profile, session.user.id);
  const view = listPage(state.data, filters, own?.id);
  // Asking past the end returns nothing, instead of repeating the last page.
  if (filters.page > view.pages) return Response.json({ rows: [], page: filters.page, pages: view.pages }, { headers: noStore });
  const avatars = await avatarsFor(view.blackholedMode ? view.lostRows : view.listed);
  return Response.json({ rows: rowData(state.data, view, avatars, session.user.id), page: view.page, pages: view.pages }, { headers: noStore });
}
