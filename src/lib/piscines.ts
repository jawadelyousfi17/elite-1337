import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { campusIds } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError, type ApiUserSummary } from './fortytwo-api';

export type PiscineCandidate = ApiUserSummary & { campusId: number };
const cached = singleFlight(unstable_cache(async (campus: number | null, year: string, month: string | null) => {
  const ids = campus === null ? campusIds() : [campus];
  const lists = await Promise.all(ids.map(async (campusId) => (await fortyTwoApi.usersByPiscine(campusId, year, month ?? undefined)).map((user) => ({ ...user, campusId }))));
  const deduped = new Map<number, PiscineCandidate>();
  for (const candidate of lists.flat()) {
    if (candidate['staff?'] === true || (candidate.kind && candidate.kind !== 'student')) continue;
    deduped.set(candidate.id, candidate);
  }
  return [...deduped.values()].sort((a, b) => a.login.localeCompare(b.login));
}, ['1337-piscine-candidates-v2'], { revalidate: 3600 }));

export async function loadPiscineCandidates(campus: number | null, year: string, month: string | null):
  Promise<{ status: 'ready'; candidates: PiscineCandidate[] } | { status: 'incomplete' | 'rate-limited' | 'unavailable' }> {
  if (!/^\d{4}$/.test(year) || (campus !== null && !campusIds().includes(campus))) return { status: 'unavailable' };
  try { return { status: 'ready', candidates: await cached(campus, year, month) }; }
  catch (error) {
    if (error instanceof IncompletePopulationError) return { status: 'incomplete' };
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 Piscine list failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
