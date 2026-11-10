import { unstable_cache } from 'next/cache';
import { singleFlight } from './single-flight';
import { withTimeout } from './timeout';
import { fortyTwoApi } from './fortytwo-api';
import { demoLastSeen, isDemo } from './demo';

/** A frozen account cannot log in, so its last session never changes: cached for 60 days, one request per student. */
const lastSession = singleFlight(unstable_cache(async (userId: number) => ({ at: await fortyTwoApi.userLastSession(userId) }), ['1337-last-session-v1'], { revalidate: 5_184_000 }));
const known = new Map<number, string | null>();

/**
 * Last session per student for ordering the Frozen list. A cold list is hundreds of requests at 2 per second, so a visit
 * waits only `budgetMs`: fetches keep running and stay cached, and students not known yet are listed last until the next visit.
 */
export async function loadLastSeen(ids: number[], budgetMs = 15_000): Promise<Map<number, string | null>> {
  if (isDemo()) return demoLastSeen(ids);
  const missing = ids.filter((id) => !known.has(id));
  const work = Promise.all(missing.map((id) => lastSession(id).then(({ at }) => { known.set(id, at); }, () => {})));
  if (missing.length) await withTimeout(work, budgetMs, undefined);
  return new Map(ids.filter((id) => known.has(id)).map((id) => [id, known.get(id) ?? null]));
}
