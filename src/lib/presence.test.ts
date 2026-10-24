import { describe, expect, it } from 'vitest';
import { clusterOf, computeNeighbors, computePresence, neighborSeats } from './presence';

// Local hours come from the timezone database (Morocco's offset has changed over the years), never a fixed offset.
const localHour = (iso: string) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', hour: '2-digit', hourCycle: 'h23' }).format(Date.parse(iso)));
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, day, hour)).toISOString();
const now = Date.parse(at(20, 12));

describe('computePresence', () => {
  const sessions = [
    { host: 'e3r3p6', begin: at(10, 8), end: at(10, 12) },
    { host: 'e3r3p6', begin: at(11, 8), end: at(11, 10) },
    { host: 'e1r1p1', begin: at(12, 22), end: at(13, 2) },   // crosses local midnight
    { host: 'e3r3p6', begin: at(19, 8), end: at(19, 9) },
    { host: 'e3r3p6', begin: at(20, 8), end: null },          // still logged in
  ];
  const presence = computePresence(sessions, at(1, 0), now);

  it('adds up hours, including an open session until now', () => {
    expect(Math.round(presence.totalHours)).toBe(4 + 2 + 4 + 1 + 4);
  });
  it('finds the longest and current streaks on local days', () => {
    expect(presence.longestStreak).toBe(4); // Oct 10, 11, 12, 13 (the late session spills into the 13th)
    expect(presence.currentStreak).toBe(2); // Oct 19, 20
  });
  it('ranks seats and clusters by hours', () => {
    expect(presence.seats[0]).toMatchObject({ host: 'e3r3p6' });
    expect(presence.cluster?.name).toBe('e3');
  });
  it('splits time by local hour of day', () => {
    expect(Math.round(presence.hours[localHour(at(10, 8))])).toBe(4); // the 08:00Z hour, on four days
  });
  it('caps forgotten logouts and ignores time before the start', () => {
    const capped = computePresence([{ host: 'e1r1p1', begin: at(1, 0), end: at(5, 0) }, { host: 'e1r1p1', begin: at(1, 0), end: at(1, 5) }], at(1, 3), now);
    expect(Math.round(capped.totalHours)).toBe(13 + 2);
  });
});

describe('clusterOf', () => {
  it('reads the cluster from a seat name', () => { expect(clusterOf('e3r3p6')).toBe('e3'); expect(clusterOf('c2r10p12')).toBe('c2'); });
});

describe('seat neighbors', () => {
  it('finds the seats on either side in the same row', () => {
    expect(neighborSeats('e3r3p9')).toEqual(['e3r3p8', 'e3r3p10']);
    expect(neighborSeats('e1r2p1')).toEqual(['e1r2p2']);
    expect(neighborSeats('lab')).toEqual([]);
  });

  it('counts only the time both people sat side by side', () => {
    const mine = [{ host: 'e3r3p9', begin: '2026-05-01T09:00:00Z', end: '2026-05-01T13:00:00Z' }];
    const theirs = [
      { host: 'e3r3p8', begin: '2026-05-01T11:00:00Z', end: '2026-05-01T15:00:00Z', userId: 2, login: 'amina', photo: null },
      { host: 'e3r3p10', begin: '2026-05-01T09:00:00Z', end: '2026-05-01T13:00:00Z', userId: 3, login: 'yassine', photo: null },
      { host: 'e3r3p10', begin: '2026-05-02T09:00:00Z', end: '2026-05-02T13:00:00Z', userId: 4, login: 'absent', photo: null },
      { host: 'e3r3p8', begin: '2026-05-01T09:00:00Z', end: '2026-05-01T13:00:00Z', userId: 1, login: 'me', photo: null },
    ];
    expect(computeNeighbors(mine, theirs, 1, Date.parse('2026-06-01T00:00:00Z')).map((p) => [p.login, p.hours])).toEqual([['yassine', 4], ['amina', 2]]);
  });
});
