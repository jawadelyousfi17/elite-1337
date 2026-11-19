import { isDemo } from './demo';
import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError } from './fortytwo-api';

export const CORRECTION_WINDOW_DAYS = 30;
export type PendingCorrection = { id: number; userId: number; login: string; project: string; projectSlug: string; updatedAt: string; attempt: number | null; campusId: number; teamId: number | null };

const cached = singleFlight(unstable_cache(async (campus: number) => {
  const to = new Date();
  const curriculum = cursusId();
  const rows = await fortyTwoApi.waitingForCorrection(campus);
  return {
    fetchedAt: to.toISOString(),
    rows: rows.filter((row) => row.status === 'waiting_for_correction' && row.cursus_ids.includes(curriculum)).map((row): PendingCorrection => ({
      id: row.id, userId: row.user.id, login: row.user.login, project: row.project.name, projectSlug: row.project.slug,
      updatedAt: row.updated_at, attempt: row.occurrence ?? null, campusId: campus, teamId: row.current_team_id ?? null,
    })),
  };
}, ['1337-pending-corrections-v4'], { revalidate: 300 }));

export async function loadPendingCorrections(campus: number): Promise<{ status: 'ready'; rows: PendingCorrection[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  if (!campusIds().includes(campus)) return { status: 'unavailable' };
  if (isDemo()) return { status: 'ready', fetchedAt: new Date().toISOString(), rows: [{ id: 9000001, userId: 9000001, login: 'demo-student', project: 'NetPractice', projectSlug: 'netpractice', updatedAt: new Date().toISOString(), attempt: 1, campusId: campus, teamId: 9000001 }] };
  try { return { status: 'ready', ...(await cached(campus)) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 pending corrections failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
