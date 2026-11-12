import { eligibleEvaluation } from './evaluation-rules';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { singleFlight } from './single-flight';
import { fortyTwoApi, RateBudgetError, scaleTeamSchema } from './fortytwo-api';

/** How many of a student's latest evaluations as corrector are summarized: one 42 request. */
export const CORRECTOR_SAMPLE = 100;
export type CorrectorProfile = { evaluations: number; returned: number; rate: number | null; rated: number; rating: number | null };

const rowSchema = scaleTeamSchema.extend({ feedbacks: z.array(z.object({ rating: z.number().nullish() })).default([]) });
type Row = z.infer<typeof rowSchema>;

/**
 * A student as corrector: the share of their filled evaluations that returned the project (a negative flag), and the
 * average rating (0 to 5) the evaluated students gave them. Unfilled evaluations and missing ratings are skipped.
 */
export function summarizeCorrections(rows: Pick<Row, 'filled_at' | 'flag' | 'feedbacks'>[]): CorrectorProfile {
  const filled = rows.filter((row) => row.filled_at && row.flag);
  const returned = filled.filter((row) => !row.flag!.positive).length;
  const ratings = filled.flatMap((row) => row.feedbacks.map((feedback) => feedback.rating).filter((rating): rating is number => typeof rating === 'number' && rating >= 0 && rating <= 5));
  return {
    evaluations: filled.length, returned, rate: filled.length ? returned / filled.length : null,
    rated: ratings.length, rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
  };
}

/** One request per student, shared by everyone who opens their page, refreshed every 6 hours. */
const cached = singleFlight(unstable_cache(async (userId: number) => {
  const { data } = await fortyTwoApi.request(`users/${userId}/scale_teams/as_corrector`, z.array(rowSchema), { sort: '-filled_at', 'page[size]': String(CORRECTOR_SAMPLE) });
  return summarizeCorrections(data.filter(eligibleEvaluation));
}, ['1337-corrector-profile-v2'], { revalidate: 21_600 }));

/** The student's corrector summary, or why it is missing; never throws, so the page renders without it. */
export async function loadCorrectorProfile(userId: number): Promise<{ status: 'ready'; profile: CorrectorProfile } | { status: 'rate-limited' | 'unavailable' }> {
  try { return { status: 'ready', profile: await cached(userId) }; }
  catch (error) {
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('42 corrector profile failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
