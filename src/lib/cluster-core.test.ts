import { describe, expect, it } from 'vitest';
import { campusLocationSchema } from './fortytwo-api';
import { buildClusterSnapshot, clusterFromHost, isSnapshotFresh, normalizeWorkstationId, searchWorkstations, summarizeActiveLocations } from './cluster-core';
import type { LayoutSeat } from './cluster-layout';

const now = Date.parse('2026-10-19T18:00:00Z');
const location = (id: number, host: string, userId: number, options: { campus?: number; begin?: string | null; end?: string | null } = {}) =>
  campusLocationSchema.parse({ id, campus_id: options.campus ?? 16, host, begin_at: options.begin === undefined ? '2026-10-19T17:00:00Z' : options.begin, end_at: options.end ?? null, user: { id: userId, login: 'private-login' } });
const inventory: LayoutSeat[] = [
  { campusId: 16, clusterId: 'e1', workstationId: 'e1r1p1', x: 10, y: 10, enabled: true },
  { campusId: 16, clusterId: 'e1', workstationId: 'e1r1p2', x: 30, y: 10, enabled: true },
  { campusId: 16, clusterId: 'e1', workstationId: 'e1r1p3', x: 50, y: 10, enabled: false },
];
const snapshot = (complete = true, fetchedAt = '2026-10-19T17:59:00Z') => buildClusterSnapshot({
  campusId: 16, observedHosts: ['E1R1P1', 'e1r1p4'], activeHosts: [{ id: 'e1r1p1', state: 'occupied' }],
  inventory, complete, fetchedAt, observedSample: true, nowMs: now,
});

describe('cluster normalization and occupancy', () => {
  it('normalizes safe host IDs and discovers campus-specific groups', () => {
    expect(normalizeWorkstationId(' E1R3P11 ')).toBe('e1r3p11');
    expect(normalizeWorkstationId('bad host / token')).toBeNull();
    expect(clusterFromHost(16, 'e2r3p4')).toBe('e2');
    expect(clusterFromHost(21, 'c3r3p4')).toBe('c3');
    expect(clusterFromHost(55, 'c1r1p1')).toBe('c1');
    expect(clusterFromHost(75, 'c2r9p6')).toBe('c2');
    expect(clusterFromHost(16, 'c3r3p4')).toBe('other');
  });
  it('keeps one active user occupied, including duplicate sessions, but marks conflicts unknown', () => {
    const result = summarizeActiveLocations(16, [
      location(1, 'e1r1p1', 7), location(2, 'E1R1P1', 7),
      location(3, 'e1r1p2', 8), location(4, 'e1r1p2', 9),
      location(5, 'c1r1p1', 10, { campus: 55 }),
    ], now);
    expect(result).toEqual([{ id: 'e1r1p1', state: 'occupied' }, { id: 'e1r1p2', state: 'unknown' }]);
  });
  it('treats ended, stale, and malformed sessions as unknown', () => {
    expect(summarizeActiveLocations(16, [
      location(1, 'e1r1p1', 1, { end: '2026-10-19T17:30:00Z' }),
      location(2, 'e1r1p2', 2, { begin: '2026-10-17T10:00:00Z' }),
      location(3, 'e1r1p3', 3, { begin: null }),
    ], now).map((item) => item.state)).toEqual(['unknown', 'unknown', 'unknown']);
  });
  it('only calls verified enabled inventory seats available in a complete fresh snapshot', () => {
    const result = snapshot();
    expect(result.counts).toEqual({ occupied: 1, available: 1, unknown: 1, disabled: 1 });
    expect(result.seats.find((seat) => seat.id === 'e1r1p2')?.state).toBe('available');
    expect(result.seats.find((seat) => seat.id === 'e1r1p4')?.state).toBe('unknown');
    expect(result.seats.find((seat) => seat.id === 'e1r1p3')?.state).toBe('unknown');
    expect(searchWorkstations(result.seats, ' R1P2 ').map((seat) => seat.id)).toEqual(['e1r1p2']);
    expect(JSON.stringify(result)).not.toContain('private-login');
    expect(JSON.stringify(result)).not.toContain('"user"');
  });
  it('marks occupancy unknown when data is partial or stale', () => {
    expect(snapshot(false).counts).toEqual({ occupied: 0, available: 0, unknown: 3, disabled: 1 });
    expect(snapshot(true, '2026-10-19T17:50:00Z').counts).toEqual({ occupied: 0, available: 0, unknown: 3, disabled: 1 });
    expect(isSnapshotFresh('2026-10-19T17:59:00Z', now)).toBe(true);
    expect(isSnapshotFresh('2026-10-19T17:50:00Z', now)).toBe(false);
  });
});
