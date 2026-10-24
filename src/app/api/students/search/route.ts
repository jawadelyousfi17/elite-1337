import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { loadRankingDataset } from '@/lib/dataset';
import { matchesSearch } from '@/lib/search';
import { photoReferences } from '@/lib/avatars/intra-photo';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

/** Up to 8 students (active first, then blackholed) matching a login or name, for the race picker. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ results: [] }, { status: 401, headers: noStore });
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40);
  if (q.length < 2) return Response.json({ results: [] }, { headers: noStore });
  const state = await loadRankingDataset();
  if (state.status !== 'ready') return Response.json({ results: [] }, { status: 503, headers: noStore });
  const lower = q.toLowerCase();
  // Exact and prefix login matches first, then typo-tolerant matches on login or name.
  const score = (login: string) => login.toLowerCase() === lower ? 0 : login.toLowerCase().startsWith(lower) ? 1 : 2;
  const active = state.data.students.filter((student) => student.id !== Number(session.user.id) && matchesSearch(q, [student.login, student.displayName]))
    .map((student) => ({ id: student.id, login: student.login, name: student.displayName, level: student.level, blackholed: false, photo: student.photo }));
  const lost = state.data.blackholed.filter((student) => matchesSearch(q, [student.login, student.displayName]))
    .map((student) => ({ id: student.id, login: student.login, name: student.displayName, level: student.level, blackholed: true, photo: student.photo }));
  const top = [...active, ...lost].sort((a, b) => score(a.login) - score(b.login) || Number(a.blackholed) - Number(b.blackholed) || b.level - a.level).slice(0, 8);
  const photos = photoReferences(top);
  return Response.json({ results: top.map(({ photo: _photo, ...student }) => ({ ...student, photo: photos[student.id] ?? null })) }, { headers: noStore });
}
