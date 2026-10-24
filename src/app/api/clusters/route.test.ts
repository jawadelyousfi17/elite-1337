import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { clusterMembership, getClusterSnapshot } from '@/lib/cluster-service';
import { GET } from './route';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/cluster-service', () => ({ clusterMembership: vi.fn(), getClusterSnapshot: vi.fn() }));

const request = (campus = '16') => new NextRequest(`http://localhost:3000/api/clusters?campus=${campus}`);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: '123' } } as never);
  vi.mocked(clusterMembership).mockResolvedValue({ memberships: [16], primary: 16 });
  vi.mocked(getClusterSnapshot).mockResolvedValue({
    campusId: 16, fetchedAt: '2026-10-19T18:00:00Z', ageSeconds: 0, complete: true,
    fresh: true, observedSample: true, notice: null,
    seats: [{ id: 'e1r1p1', clusterId: 'e1', state: 'occupied', enabled: true, inventoryVerified: false }],
    counts: { occupied: 1, available: 0, unknown: 0, disabled: 0 },
  });
});
describe('cluster endpoint authorization and privacy', () => {
  it('rejects anonymous requests before reading campus data', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await GET(request())).status).toBe(401);
    expect(clusterMembership).not.toHaveBeenCalled();
  });
  it('rejects accounts without verified 1337 campus membership', async () => {
    vi.mocked(clusterMembership).mockResolvedValue({ memberships: [], primary: null });
    expect((await GET(request())).status).toBe(403);
    expect(getClusterSnapshot).not.toHaveBeenCalled();
  });
  it('rejects unrelated campus IDs and returns only anonymous data', async () => {
    expect((await GET(request('1'))).status).toBe(400);
    const response = await GET(request('16'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ campusId: 16, counts: { occupied: 1 } });
    expect(getClusterSnapshot).toHaveBeenCalledWith(16);
  });
});
