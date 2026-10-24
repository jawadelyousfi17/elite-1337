import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { avatarStorageConfigured, deleteAvatar, saveAvatar } from '@/lib/avatars/storage';
import { DELETE, POST } from './route';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/avatars/storage', () => ({ avatarStorageConfigured: vi.fn(), checkedUserId: (value: string) => /^\d+$/.test(value) ? Number(value) : null, saveAvatar: vi.fn(), deleteAvatar: vi.fn() }));

const endpoint = 'http://localhost:3000/api/avatars';
const owner = { user: { id: '42', login: 'student' } } as never;
const request = (method: 'POST' | 'DELETE', body?: FormData, origin = 'http://localhost:3000') => new NextRequest(endpoint, { method, headers: { origin, host: 'localhost:3000' }, body });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue(owner);
  vi.mocked(avatarStorageConfigured).mockReturnValue(true);
  vi.mocked(saveAvatar).mockResolvedValue('/api/avatars/42?v=abc&s=signature');
});

describe('avatar owner mutations', () => {
  it('rejects anonymous uploads and cross-origin requests before storage writes', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    expect((await POST(request('POST'))).status).toBe(401);
    expect((await DELETE(request('DELETE', undefined, 'https://evil.test'))).status).toBe(403);
    expect(saveAvatar).not.toHaveBeenCalled();
    expect(deleteAvatar).not.toHaveBeenCalled();
  });
  it('rejects invalid image bytes before storage writes', async () => {
    const form = new FormData(); form.set('image', new File(['fake'], 'fake.png', { type: 'image/png' }));
    expect((await POST(request('POST', form))).status).toBe(400);
    expect(saveAvatar).not.toHaveBeenCalled();
  });
  it('saves a valid upload under the authenticated 42 user ID', async () => {
    const input = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'green' } }).png().toBuffer();
    const form = new FormData(); form.set('image', new File([input], 'face.png', { type: 'image/png' }));
    const response = await POST(request('POST', form));
    expect(response.status).toBe(200);
    expect(saveAvatar).toHaveBeenCalledWith(42, expect.any(Buffer));
    expect((await response.json()).src).toContain('/api/avatars/42');
  });
  it('deletes only the authenticated owner avatar and reports storage failures', async () => {
    expect((await DELETE(request('DELETE'))).status).toBe(204);
    expect(deleteAvatar).toHaveBeenCalledWith(42);
    vi.mocked(deleteAvatar).mockRejectedValueOnce(new Error('service unavailable'));
    expect((await DELETE(request('DELETE'))).status).toBe(503);
  });
});
