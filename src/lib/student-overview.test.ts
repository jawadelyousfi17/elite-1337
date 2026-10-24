import { expect, it } from 'vitest';
import { calculateLogtimeSeconds, logtimePeriods } from './student-overview';

it('counts only today’s session time, including an active session, without double counting overlap', () => {
  const start = Date.parse('2026-10-18T00:00:00.000Z');
  const now = Date.parse('2026-10-18T03:00:00.000Z');
  const sessions = [
    { begin_at: '2026-10-17T23:30:00.000Z', end_at: '2026-10-18T01:00:00.000Z' },
    { begin_at: '2026-10-18T00:30:00.000Z', end_at: '2026-10-18T01:30:00.000Z' },
    { begin_at: '2026-10-18T02:00:00.000Z', end_at: null },
  ];
  expect(calculateLogtimeSeconds(sessions, start, now)).toBe(2.5 * 3600);
});

it('starts weeks on Monday and switches the monthly cycle on the 28th', () => {
  expect(logtimePeriods(new Date('2026-10-27T15:00:00Z'))).toMatchObject({
    weekStartIso: '2026-10-26T00:00:00.000Z',
    monthStartIso: '2026-09-28T00:00:00.000Z',
    monthEndIso: '2026-10-28T00:00:00.000Z',
  });
  expect(logtimePeriods(new Date('2026-10-28T00:00:00Z'))).toMatchObject({
    weekStartIso: '2026-10-26T00:00:00.000Z',
    monthStartIso: '2026-10-28T00:00:00.000Z',
    monthEndIso: '2026-11-28T00:00:00.000Z',
    earliestStartIso: '2026-10-26T00:00:00.000Z',
  });
});
