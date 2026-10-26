import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError } from './fortytwo-api';

export const CORRECTION_WINDOW_DAYS = 30;
export type PendingCorrection = { id: number; userId: number; login: string; project: string; projectSlug: string; updatedAt: string; attempt: number | null; campusId: number };

const cached = singleFlight(unstable_cache(async (campus: number) => {
  const to = new Date(), from = new Date(to.getTime() - CORRECTION_WINDOW_DAYS * 86_400_000);
  const curriculum = cursusId();
  const rows = await fortyTwoApi.waitingForCorrection(campus, from.toISOString(), to.toISOString());
  return {
    fetchedAt: to.toISOString(),
    rows: rows.filter((row) => row.cursus_ids.includes(curriculum)).map((row): PendingCorrection => ({
      id: row.id, userId: row.user.id, login: row.user.login, project: row.project.name, projectSlug: row.project.slug,
      updatedAt: row.updated_at, attempt: row.occurrence ?? null, campusId: campus,
    })),
  };
}, ['1337-pending-corrections-v2'], { revalidate: 300 }));

export async function loadPendingCorrections(campus: number): Promise<{ status: 'ready'; rows: PendingCorrection[]; fetchedAt: string } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  if (!campusIds().includes(campus)) return { status: 'unavailable' };
  try { return { status: 'ready', ...(await cached(campus)) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 pending corrections failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
