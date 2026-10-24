import { describe, expect, it } from 'vitest';
import { countValidated, pickMarked, returnRates, topValidated } from './validated';

const now = Date.parse('2026-10-23T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
const row = (id: number, hours: number, validated: boolean | null = true, cursus = [21], teams: { id: number; status: string; 'validated?': boolean | null; closed_at: string }[] = []) => ({ id, 'validated?': validated, marked_at: hoursAgo(hours), cursus_ids: cursus, project: { id: 1, name: 'libft', slug: 'libft' }, teams });
const team = (id: number, hours: number, validated: boolean | null, status = 'finished') => ({ id, status, 'validated?': validated, closed_at: hoursAgo(hours) });

describe('pickMarked', () => {
  it('keeps Common Core enrollments once, even when listed at two campuses', () => {
    const records = pickMarked([
      { campusId: 16, rows: [row(1, 2), row(2, 3, false), row(3, 4, true, [9]), row(4, 5), row(6, 6, null)] },
      { campusId: 21, rows: [row(4, 5), row(5, 30)] },
    ], 21);
    expect(records.map((record) => [record.id, record.campusId, record.validated])).toEqual([['1', 16, true], ['2', 16, false], ['4', 16, true], ['5', 21, true]]);
  });
  it('counts every finished attempt, so a fail before a pass is not lost', () => {
    const records = pickMarked([{ campusId: 16, rows: [row(7, 2, true, [21], [team(70, 50, false), team(71, 2, true), team(72, 1, null, 'in_progress')])] }], 21);
    expect(records.map((record) => [record.id, record.validated, record.at])).toEqual([['7:70', false, hoursAgo(50)], ['7', true, hoursAgo(2)]]);
  });
  it('dates the latest attempt by the record, since some steps are graded long after their team closed', () => {
    const records = pickMarked([{ campusId: 21, rows: [row(8, 3, true, [21], [team(80, 24 * 400, false), team(81, 24 * 200, true)])] }], 21);
    expect(records.map((record) => [record.id, record.validated, record.at])).toEqual([['8:80', false, hoursAgo(24 * 400)], ['8', true, hoursAgo(3)]]);
  });
});

describe('countValidated', () => {
  const records = [
    { id: '1', campusId: 16, at: hoursAgo(2), project: 'libft', validated: true, internship: false },
    { id: '2', campusId: 16, at: hoursAgo(30), project: 'push_swap', validated: true, internship: false },
    { id: '3', campusId: 21, at: hoursAgo(24 * 10), project: 'libft', validated: true, internship: false },
    { id: '4', campusId: 21, at: hoursAgo(24 * 40), project: 'libft', validated: true, internship: false },
    { id: '5', campusId: 21, at: hoursAgo(5), project: 'push_swap', validated: true, internship: false },
  ];
  it('counts the last day, week and month', () => {
    expect(countValidated(records, undefined, now)).toEqual({ day: 2, week: 3, month: 4 });
  });
  it('narrows to one campus', () => {
    expect(countValidated(records, 21, now)).toEqual({ day: 1, week: 1, month: 2 });
  });
});

describe('topValidated', () => {
  const records = [
    { id: '1', campusId: 16, at: hoursAgo(2), project: 'libft', validated: true, internship: false },
    { id: '2', campusId: 16, at: hoursAgo(3), project: 'push_swap', validated: true, internship: false },
    { id: '3', campusId: 21, at: hoursAgo(4), project: 'push_swap', validated: true, internship: false },
    { id: '4', campusId: 21, at: hoursAgo(24 * 10), project: 'libft', validated: true, internship: false },
    { id: '5', campusId: 21, at: hoursAgo(24 * 11), project: 'libft', validated: true, internship: false },
  ];
  it('ranks projects by validations in the window', () => {
    expect(topValidated(records, 'day', undefined, 5, now)).toEqual([{ project: 'push_swap', count: 2 }, { project: 'libft', count: 1 }]);
    expect(topValidated(records, 'month', undefined, 1, now)).toEqual([{ project: 'libft', count: 3 }]);
  });
  it('narrows to one campus', () => {
    expect(topValidated(records, 'day', 16, 5, now)).toEqual([{ project: 'libft', count: 1 }, { project: 'push_swap', count: 1 }]);
  });
});

describe('returnRates', () => {
  const mark = (id: number, campusId: number, hours: number, validated: boolean, internship = false) => ({ id: String(id), campusId, at: hoursAgo(hours), project: 'libft', validated, internship });
  const records = [
    mark(1, 16, 2, true), mark(2, 16, 3, false), mark(3, 16, 30, false), mark(4, 16, 24 * 10, true),
    mark(5, 21, 4, true), mark(6, 21, 24 * 20, false), mark(7, 21, 24 * 45, false),
  ];
  it('returns the share of graded projects that were not validated, per window', () => {
    const all = returnRates(records, undefined, now);
    expect(all.day).toEqual({ marked: 3, returned: 1, rate: 1 / 3 });
    expect(all.week).toEqual({ marked: 4, returned: 2, rate: .5 });
    expect(all.month).toEqual({ marked: 6, returned: 3, rate: .5 });
  });
  it('narrows to one campus', () => {
    expect(returnRates(records, 21, now).month).toEqual({ marked: 2, returned: 1, rate: .5 });
  });
  it('leaves internships out of the return rate', () => {
    expect(returnRates([...records, mark(8, 16, 1, false, true), mark(9, 16, 1, false, true)], 16, now).day).toEqual({ marked: 2, returned: 1, rate: .5 });
  });
  it('has no rate when nothing was graded', () => {
    expect(returnRates(records, 55, now).day).toEqual({ marked: 0, returned: 0, rate: null });
  });
  it('leaves validated counts untouched by returned projects', () => {
    expect(countValidated(records, 16, now)).toEqual({ day: 1, week: 1, month: 2 });
  });
});
