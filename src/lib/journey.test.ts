import { describe, expect, it } from 'vitest';
import { buildJourney, summarizeJourney, type JourneyRecord } from './journey';

const day = (n: number) => new Date(Date.parse('2024-10-21T00:00:00Z') + n * 86_400_000).toISOString();
let id = 1;
const team = (closed: number, ok: boolean, mark = ok ? 100 : 0) => ({ id: id++, status: 'finished', 'validated?': ok, final_mark: mark, closed_at: day(closed) });
const record = (name: string, teams: ReturnType<typeof team>[], extra: Partial<JourneyRecord> = {}): JourneyRecord => {
  const last = teams.at(-1);
  return { id: id++, status: 'finished', 'validated?': last?.['validated?'] ?? null, final_mark: last?.final_mark ?? null, marked_at: last?.closed_at ?? null, created_at: day(0), updated_at: day(0), cursus_ids: [21],
    project: { name, slug: name.toLowerCase().replace(/ /g, '-'), parent_id: null }, teams, ...extra };
};

describe('buildJourney', () => {
  const records = [
    record('Libft', [team(16, false), team(18, false), team(25, true, 125)]),
    record('get_next_line', [team(35, true, 125)]),
    record('Exam Rank 02', [team(60, true)]),
    record('C Piscine C 00', [team(-80, true)], { cursus_ids: [9] }),
    record('Work Experience I - Duration', [team(70, true)], { project: { name: 'Work Experience I - Duration', slug: 'we', parent_id: 1 } }),
    record('CPP Module 08', [], { status: 'in_progress', 'validated?': null, marked_at: null }),
  ];
  const journey = buildJourney(records, day(0), null, day(100));

  it('keeps Common Core projects in finishing order, with work in progress last', () => {
    expect(journey.stops.map((stop) => stop.project)).toEqual(['Libft', 'get_next_line', 'Exam Rank 02', 'CPP Module 08']);
    expect(journey.stops.at(-1)).toMatchObject({ pending: true, passed: false });
  });
  it('turns failed teams into crashes before the pass', () => {
    expect(journey.stops[0].attempts.map((attempt) => attempt.passed)).toEqual([false, false, true]);
    expect(journey.stops[0].attempts.at(-1)?.mark).toBe(125);
  });
  it('measures the gap since the previous pass', () => {
    expect(journey.stops.map((stop) => stop.gapDays).slice(0, 3)).toEqual([16, 10, 25]);
  });
  it('spots exams', () => {
    expect(journey.stops[2].exam).toBe(true);
  });
  it('ignores re-tries after a pass', () => {
    const again = buildJourney([record('push_swap', [team(5, false), team(9, true), team(12, true, 125)])], day(0), null, day(20));
    expect(again.stops[0].attempts).toHaveLength(2);
  });
  it('summarizes the run', () => {
    expect(summarizeJourney(journey)).toEqual({ days: 100, passed: 3, retries: 2, longestBreak: 25, toughest: { project: 'Libft', tries: 3 } });
    expect(summarizeJourney({ ...journey, fell: day(40) }).days).toBe(40);
  });
});
