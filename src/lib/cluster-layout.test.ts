import { expect, it } from 'vitest';
import { parseClusterLayouts } from './cluster-layout';
const fixture = { campusId: 16, clusterId: 'e1', width: 10, height: 10, source: 'Synthetic test fixture, not a real inventory', verifiedAt: '2026-11-12T00:00:00Z', seats: [{ campusId: 16, clusterId: 'e1', workstationId: 'e1r1p1', x: 1, y: 1, enabled: false }] };
it('keeps unverified inventory empty and preserves disabled seats', () => {
  expect(parseClusterLayouts([])).toEqual([]);
  expect(parseClusterLayouts([fixture])[0].seats[0].enabled).toBe(false);
});
it('rejects duplicate, cross-campus, unproven and out-of-bounds entries', () => {
  expect(() => parseClusterLayouts([fixture, fixture])).toThrow();
  for (const seat of [{ ...fixture.seats[0], x: 10 }, { ...fixture.seats[0], campusId: 21 }]) expect(() => parseClusterLayouts([{ ...fixture, seats: [seat] }])).toThrow();
  expect(() => parseClusterLayouts([{ ...fixture, source: '' }])).toThrow();
});
