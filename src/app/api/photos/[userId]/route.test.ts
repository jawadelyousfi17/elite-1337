import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { validPhotoSignature } from '@/lib/avatars/intra-photo';
import { fortyTwoApi } from '@/lib/fortytwo-api';
import { GET } from './route';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/avatars/intra-photo', async (original) => ({ ...(await original<typeof import('@/lib/avatars/intra-photo')>()), validPhotoSignature: vi.fn() }));
vi.mock('@/lib/fortytwo-api', () => ({ fortyTwoApi: { cdnPhoto: vi.fn() } }));

const path = '/users/c10658bc667e3e1f6e21cac83d956028/small_tester.jpg';
const request = () => new NextRequest(`http://localhost:3000/api/photos/42?p=${encodeURIComponent(path)}&s=signed`);
const context = { params: Promise.resolve({ userId: '42' }) };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: '99' } } as never);
  vi.mocked(validPhotoSignature).mockReturnValue(true);
  vi.mocked(fortyTwoApi.cdnPhoto).mockResolvedValue(jpeg);
});

describe('42 photo proxy', () => {
  it('blocks anonymous and unsigned requests before contacting the CDN', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    expect((await GET(request(), context)).status).toBe(401);
    vi.mocked(validPhotoSignature).mockReturnValueOnce(false);
    expect((await GET(request(), context)).status).toBe(404);
    expect(fortyTwoApi.cdnPhoto).not.toHaveBeenCalled();
  });
  it('serves a signed photo to a signed-in user with private caching', async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400, immutable');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpeg);
    expect(fortyTwoApi.cdnPhoto).toHaveBeenCalledWith(path);
  });
  it('falls back when the CDN refuses, returns non-image bytes, or fails', async () => {
    vi.mocked(fortyTwoApi.cdnPhoto).mockResolvedValueOnce(null);
    expect((await GET(request(), context)).status).toBe(404);
    vi.mocked(fortyTwoApi.cdnPhoto).mockResolvedValueOnce(new TextEncoder().encode('<html>'));
    expect((await GET(request(), context)).status).toBe(404);
    vi.mocked(fortyTwoApi.cdnPhoto).mockRejectedValueOnce(new Error('timeout'));
    expect((await GET(request(), context)).status).toBe(503);
  });
});
