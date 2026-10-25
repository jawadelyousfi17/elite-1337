import { beforeEach, expect, it, vi } from 'vitest';
import { fortyTwoApi } from './fortytwo-api';
import { getStudentProfile } from './student-overview';
import { clusterMembership, getClusterSnapshot } from './cluster-service';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./single-flight', () => ({ singleFlight: (fn: unknown) => fn }));
vi.mock('./fortytwo-api', () => ({ fortyTwoApi: { campusActiveLocations: vi.fn(), campusObservedHosts: vi.fn() } }));
vi.mock('./student-overview', () => ({ getStudentProfile: vi.fn() }));

beforeEach(() => { vi.resetAllMocks(); });
it('filters campus memberships to the four verified 1337 campuses', async () => {
  vi.mocked(getStudentProfile).mockResolvedValue({
    campus_users: [{ campus_id: 1, is_primary: false }, { campus_id: 55, is_primary: true }, { campus_id: 16, is_primary: false }],
    wallet: null, correction_point: null, pool_year: null, pool_month: null,
  });
  expect(await clusterMembership('123')).toEqual({ memberships: [55, 16], primary: 55 });
});
it('returns only unknown states if the active API request fails', async () => {
  vi.mocked(fortyTwoApi.campusActiveLocations).mockRejectedValue(new Error('429'));
  vi.mocked(fortyTwoApi.campusObservedHosts).mockResolvedValue(['e1r1p1']);
  const snapshot = await getClusterSnapshot(16);
  expect(snapshot.complete).toBe(false);
  expect(snapshot.counts).toEqual({ occupied: 0, available: 0, unknown: 1, disabled: 0 });
  expect(JSON.stringify(snapshot)).not.toContain('429');
});
it('still shows anonymous occupied hosts if recent-host discovery fails', async () => {
  vi.mocked(fortyTwoApi.campusActiveLocations).mockResolvedValue([{
    id: 1, campus_id: 16, host: 'e1r1p1', begin_at: new Date(Date.now() - 60_000).toISOString(), end_at: null, user: { id: 123 },
  }]);
  vi.mocked(fortyTwoApi.campusObservedHosts).mockRejectedValue(new Error('failed'));
  const snapshot = await getClusterSnapshot(16);
  expect(snapshot.complete).toBe(true);
  expect(snapshot.observedSample).toBe(false);
  expect(snapshot.counts.occupied).toBe(1);
  expect(JSON.stringify(snapshot)).not.toContain('"user"');
});
