import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { cursusId } from './config';
import { fortyTwoApi, IncompletePopulationError, RateBudgetError } from './fortytwo-api';

const DAY = 86_400_000;

export type Attempt = { at: string; passed: boolean; mark: number | null };
export type Stop = { project: string; slug: string; exam: boolean; attempts: Attempt[]; passed: boolean; pending: boolean; at: string; gapDays: number };
export type Journey = { start: string; stops: Stop[]; fell: string | null; now: string };

const teamSchema = z.object({ id: z.number().int(), status: z.string().nullish(), 'validated?': z.boolean().nullish(), final_mark: z.number().nullish(), closed_at: z.string().nullish() });
const recordSchema = z.object({
  id: z.number().int(), status: z.string(), 'validated?': z.boolean().nullish(), final_mark: z.number().nullish(),
  marked_at: z.string().nullish(), created_at: z.string().nullish(), updated_at: z.string().nullish(), cursus_ids: z.array(z.number().int()).default([]),
  project: z.object({ name: z.string(), slug: z.string(), parent_id: z.number().int().nullish() }),
  teams: z.array(teamSchema).default([]),
});
export type JourneyRecord = z.infer<typeof recordSchema>;
const PENDING = new Set(['in_progress', 'waiting_for_correction', 'creating_group', 'searching_a_group']);

/**
 * Turns a student's project records into race stops, in the order they were finished.
 * Each finished team is one attempt; the latest one uses the record's own verdict and date.
 * Sub-steps (internship evaluations) and other cursus (the Piscine) are left out.
 */
export function buildJourney(records: JourneyRecord[], start: string, fell: string | null, now = new Date().toISOString(), curriculum = 21): Journey {
  const stops: Omit<Stop, 'gapDays'>[] = [];
  for (const record of records) {
    if (!record.cursus_ids.includes(curriculum) || record.project.parent_id) continue;
    const finished = record.teams.filter((team) => team.status === 'finished' && team.closed_at && typeof team['validated?'] === 'boolean').sort((a, b) => a.id - b.id);
    const attempts: Attempt[] = finished.slice(0, -1).map((team) => ({ at: team.closed_at!, passed: !!team['validated?'], mark: team.final_mark ?? null }));
    if (record.marked_at && typeof record['validated?'] === 'boolean') attempts.push({ at: record.marked_at, passed: record['validated?'], mark: record.final_mark ?? null });
    else if (finished.length) { const last = finished.at(-1)!; attempts.push({ at: last.closed_at!, passed: !!last['validated?'], mark: last.final_mark ?? null }); }
    const pending = PENDING.has(record.status);
    if (!attempts.length && !pending) continue;
    // A pass ends the story for this hurdle; later re-tries (to raise a grade) are not crashes.
    const firstPass = attempts.findIndex((attempt) => attempt.passed);
    const kept = firstPass >= 0 ? attempts.slice(0, firstPass + 1) : attempts;
    const at = kept.at(-1)?.at ?? record.updated_at ?? record.created_at ?? now;
    stops.push({ project: record.project.name, slug: record.project.slug, exam: record.project.slug.startsWith('exam-rank'), attempts: kept, passed: firstPass >= 0, pending: pending && firstPass < 0, at });
  }
  // Finished hurdles in time order; work still in progress waits at the end of the track.
  stops.sort((a, b) => Number(a.pending) - Number(b.pending) || Date.parse(a.at) - Date.parse(b.at));
  let previous = Date.parse(start);
  const timed = stops.map((stop) => {
    const reached = stop.attempts[0] ? Date.parse(stop.attempts[0].at) : Date.parse(now);
    const gapDays = Math.max(0, Math.round((reached - previous) / DAY));
    if (!stop.pending) previous = Math.max(previous, Date.parse(stop.at));
    return { ...stop, gapDays };
  });
  return { start, stops: timed, fell, now };
}

export type JourneySummary = { days: number; passed: number; retries: number; longestBreak: number; toughest: { project: string; tries: number } | null };

export function summarizeJourney(journey: Journey): JourneySummary {
  const end = journey.fell ?? journey.now;
  const done = journey.stops.filter((stop) => !stop.pending);
  const toughest = done.reduce<{ project: string; tries: number } | null>((best, stop) => !best || stop.attempts.length > best.tries ? { project: stop.project, tries: stop.attempts.length } : best, null);
  return {
    days: Math.max(0, Math.round((Date.parse(end) - Date.parse(journey.start)) / DAY)),
    passed: done.filter((stop) => stop.passed).length,
    retries: done.reduce((sum, stop) => sum + stop.attempts.filter((attempt) => !attempt.passed).length, 0),
    longestBreak: Math.max(0, ...done.map((stop) => stop.gapDays)),
    toughest: toughest && toughest.tries > 1 ? toughest : null,
  };
}

const cursusSchema = z.object({ cursus_id: z.number().int(), begin_at: z.string().nullish() });

const fetchRecords = unstable_cache(async (userId: number) => {
  const curriculum = cursusId();
  const path = `users/${userId}/projects_users`, base = { 'filter[cursus]': String(curriculum), sort: 'id', 'page[size]': '100' };
  const [first, cursus] = await Promise.all([
    fortyTwoApi.request(path, z.array(recordSchema), { ...base, 'page[number]': '1' }),
    fortyTwoApi.request(`users/${userId}/cursus_users`, z.array(cursusSchema)),
  ]);
  const pages = Math.ceil((first.total ?? first.data.length) / 100);
  if (pages > 5) throw new IncompletePopulationError('Too many project records');
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fortyTwoApi.request(path, z.array(recordSchema), { ...base, 'page[number]': String(i + 2) })));
  return { records: [first.data, ...rest.map((page) => page.data)].flat(), start: cursus.data.find((entry) => entry.cursus_id === curriculum)?.begin_at ?? null };
}, ['1337-journey-v1'], { revalidate: 3600 });

/** The student's Common Core race; `fell` is the blackhole date when their enrollment has ended. */
export async function loadJourney(userId: number, fell: string | null): Promise<{ status: 'ready'; journey: Journey } | { status: 'empty' | 'rate-limited' | 'unavailable' }> {
  try {
    const { records, start } = await fetchRecords(userId);
    if (!start) return { status: 'empty' };
    return { status: 'ready', journey: buildJourney(records, start, fell, new Date().toISOString(), cursusId()) };
  } catch (error) {
    if (error instanceof RateBudgetError) return { status: 'rate-limited' };
    console.error('Journey failed:', error instanceof Error ? error.name : 'unknown');
    return { status: 'unavailable' };
  }
}
