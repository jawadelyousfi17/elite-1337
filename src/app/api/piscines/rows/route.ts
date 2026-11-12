import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { loadPiscineRanking } from '@/lib/piscines';
import { piscineAvatars, piscinePage, piscineRowData, resolvePiscineFilters } from '@/lib/piscine-view';
import { getStudentProfile } from '@/lib/student-overview';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

/** One more page from the same cached Piscine session used by the server-rendered leaderboard. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ rows: [] }, { status: 401, headers: noStore });
  const profile = await getStudentProfile(session.user.id).catch(() => null);
  const { filters } = resolvePiscineFilters(Object.fromEntries(request.nextUrl.searchParams), profile);
  const requestedPage = filters.page;
  const state = await loadPiscineRanking(filters.campus ?? null, filters.year, filters.month ?? null);
  if (state.status !== 'ready') return Response.json({ rows: [] }, { status: 503, headers: noStore });
  const view = piscinePage(state.data, filters);
  if (requestedPage > view.pages) return Response.json({ rows: [], page: requestedPage, pages: view.pages }, { headers: noStore });
  const avatars = await piscineAvatars(view.rows);
  return Response.json({ rows: piscineRowData(view.rows, avatars, session.user.id), page: view.page, pages: view.pages }, { headers: noStore });
}
