import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { campusIds, cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError, type ApiScaleTeam } from './fortytwo-api';

const DAY = 86_400_000;
export const CORRECTOR_WINDOWS = [30, 60, 90] as const;
export type CorrectorWindow = typeof CORRECTOR_WINDOWS[number];
/** Fewer evaluations than this, for the chosen window, say too little about how strict someone is. */
export const minEvaluations = (days: number) => Math.round(days / 6);

export type Evaluation = { id: number; campusId: number; correctorId: number; corrector: string; at: string; returned: boolean };
export type CorrectorStat = { correctorId: number; login: string; campusId: number; evaluations: number; returned: number; rate: number };

/** Filled evaluations by people (not automated correctors) that carry a verdict. */
export function pickEvaluations(rows: ApiScaleTeam[], campusId: number): Evaluation[] {
  return rows.flatMap((row) => row.filled_at && row.flag && row.corrector && typeof row.corrector === 'object'
    ? [{ id: row.id, campusId, correctorId: row.corrector.id, corrector: row.corrector.login, at: row.filled_at, returned: !row.flag.positive }]
    : []);
}

/** Correctors ranked by the share of their evaluations that returned the project; ties by more returns, then login. */
export function strictCorrectors(evaluations: Evaluation[], { days = 30, min = minEvaluations(days), campusId, limit = 10, now = Date.now() }: { days?: number; min?: number; campusId?: number; limit?: number; now?: number } = {}): CorrectorStat[] {
  const byCorrector = new Map<number, CorrectorStat & { campuses: Map<number, number> }>();
  for (const evaluation of evaluations) {
    const age = now - Date.parse(evaluation.at);
    if (age < 0 || age > days * DAY || (campusId && evaluation.campusId !== campusId)) continue;
    const stat = byCorrector.get(evaluation.correctorId) ?? { correctorId: evaluation.correctorId, login: evaluation.corrector, campusId: evaluation.campusId, evaluations: 0, returned: 0, rate: 0, campuses: new Map() };
    stat.evaluations++; if (evaluation.returned) stat.returned++;
    stat.campuses.set(evaluation.campusId, (stat.campuses.get(evaluation.campusId) ?? 0) + 1);
    byCorrector.set(evaluation.correctorId, stat);
  }
  // A "strictest" list only names people who actually returned something.
  return [...byCorrector.values()].filter((stat) => stat.evaluations >= min && stat.returned > 0)
    .map(({ campuses, ...stat }) => ({ ...stat, campusId: [...campuses].sort((a, b) => b[1] - a[1])[0][0], rate: stat.returned / stat.evaluations }))
    .sort((a, b) => b.rate - a.rate || b.returned - a.returned || a.login.localeCompare(b.login)).slice(0, limit);
}

/**
 * Evaluations are fetched in fixed 10-day slices per campus. A finished slice never changes (a filled evaluation
 * keeps its date), so it is cached for weeks; only the slice containing today refreshes. A cold start that gets
 * cut short keeps every slice it finished, and the next visit continues from there.
 */
const SLICE_DAYS = 10;
const sliceOf = (time: number) => Math.floor(time / (SLICE_DAYS * DAY));

function loadSlice(campusId: number, slice: number, current: boolean) {
  return unstable_cache(async () => {
    const from = new Date(slice * SLICE_DAYS * DAY), to = new Date(Math.min((slice + 1) * SLICE_DAYS * DAY, Date.now()));
    return pickEvaluations(await fortyTwoApi.scaleTeams(campusId, from.toISOString(), to.toISOString(), cursusId()), campusId);
  }, ['1337-evaluations-v2', String(campusId), String(slice)], { revalidate: current ? 1800 : 30 * 86_400 })();
}

export const loadEvaluations = cache(async (): Promise<{ status: 'ready'; evaluations: Evaluation[] } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> => {
  const now = Date.now(), last = sliceOf(now), first = sliceOf(now - Math.max(...CORRECTOR_WINDOWS) * DAY);
  const slices = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  try {
    const parts = await Promise.all(campusIds().flatMap((campusId) => slices.map((slice) => loadSlice(campusId, slice, slice === last))));
    const seen = new Set<number>();
    return { status: 'ready', evaluations: parts.flat().filter((evaluation) => !seen.has(evaluation.id) && seen.add(evaluation.id)) };
  } catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 evaluations failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
});
