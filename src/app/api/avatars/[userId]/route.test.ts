import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { readAvatar, validAvatarSignature } from '@/lib/avatars/storage';
import { GET } from './route';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/avatars/storage', () => ({
  checkedUserId: (value: string) => /^\d+$/.test(value) ? Number(value) : null,
  validAvatarSignature: vi.fn(), readAvatar: vi.fn(),
}));

const request = () => new NextRequest('http://localhost:3000/api/avatars/42?v=abc&e=9999999999&s=signed');
const context = { params: Promise.resolve({ userId: '42' }) };
const webp = Buffer.from('RIFFxxxxWEBP');
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: '99' } } as never);
  vi.mocked(validAvatarSignature).mockReturnValue(true);
  vi.mocked(readAvatar).mockResolvedValue(webp);
});

describe('private avatar reads', () => {
  it('blocks anonymous and invalid-signature requests before storage reads', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    expect((await GET(request(), context)).status).toBe(401);
    vi.mocked(validAvatarSignature).mockReturnValueOnce(false);
    expect((await GET(request(), context)).status).toBe(404);
    expect(readAvatar).not.toHaveBeenCalled();
  });
  it('serves a signed avatar to another signed-in student without stale browser caching', async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(webp);
    expect(readAvatar).toHaveBeenCalledWith(42, 'abc');
  });
  it('handles a missing object and a Supabase outage', async () => {
    vi.mocked(readAvatar).mockResolvedValueOnce(null);
    expect((await GET(request(), context)).status).toBe(404);
    vi.mocked(readAvatar).mockRejectedValueOnce(new Error('storage outage'));
    expect((await GET(request(), context)).status).toBe(503);
  });
});
