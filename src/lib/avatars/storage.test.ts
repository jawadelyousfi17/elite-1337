import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function fakeStore() {
  const state = { previous: null as { object_path: string } | null, currentVersion: null as string | null, rows: [] as { user_id: number; object_path: string; version: string }[], upsertError: null as Error | null, downloadError: null as { statusCode: string } | null };
  let selected = '';
  const table = {
    select: vi.fn((field: string) => { selected = field; return table; }), eq: vi.fn(() => table),
    maybeSingle: vi.fn(async () => ({ data: selected === 'version' ? state.currentVersion ? { version: state.currentVersion } : null : state.previous, error: null })),
    in: vi.fn(async () => ({ data: state.rows, error: null })),
    upsert: vi.fn(async () => ({ error: state.upsertError })),
    delete: vi.fn(() => table),
  };
  const object = {
    upload: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    download: vi.fn(async () => ({ data: null, error: state.downloadError })),
  };
  return { state, table, object, client: { from: vi.fn(() => table), storage: { from: vi.fn(() => object) } } };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-server-key';
  process.env.AUTH_SECRET = 'fixture-auth-secret';
});

describe('Supabase avatar mapping and object lifecycle', () => {
  it('looks up a page of avatars in one query and signs versioned local URLs', async () => {
    const fake = fakeStore();
    fake.state.rows = [{ user_id: 42, version: 'a'.repeat(32), object_path: `42/${'a'.repeat(32)}.webp` }];
    vi.mocked(createClient).mockReturnValue(fake.client as never);
    const store = await import('./storage');
    const references = await store.avatarReferences([42, 43, 42]);
    expect(fake.table.in).toHaveBeenCalledOnce();
    expect(fake.table.in).toHaveBeenCalledWith('user_id', [42, 43]);
    expect(references[42]).toMatch(/^\/api\/avatars\/42\?v=a{32}&e=\d{10}&s=/);
    expect(references[43]).toBeUndefined();
    const signed = new URL(references[42], 'http://localhost');
    expect(store.validAvatarSignature(42, signed.searchParams.get('v')!, signed.searchParams.get('e')!, signed.searchParams.get('s')!)).toBe(true);
    expect(store.validAvatarSignature(43, signed.searchParams.get('v')!, signed.searchParams.get('e')!, signed.searchParams.get('s')!)).toBe(false);
    expect(store.validAvatarSignature(42, signed.searchParams.get('v')!, '1000000000', signed.searchParams.get('s')!)).toBe(false);
  });
  it('replaces an avatar with a new immutable object and removes the old one', async () => {
    const fake = fakeStore();
    fake.state.previous = { object_path: `42/${'a'.repeat(32)}.webp` };
    vi.mocked(createClient).mockReturnValue(fake.client as never);
    const store = await import('./storage');
    const url = await store.saveAvatar(42, Buffer.from('RIFFxxxxWEBP'));
    expect(url).toMatch(/^\/api\/avatars\/42\?v=[a-f0-9]{32}&e=\d{10}&s=/);
    expect(fake.object.upload).toHaveBeenCalledWith(expect.stringMatching(/^42\/[a-f0-9]{32}\.webp$/), expect.any(Buffer), expect.objectContaining({ contentType: 'image/webp', upsert: false }));
    expect(fake.table.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 42, object_path: expect.stringMatching(/^42\/[a-f0-9]{32}\.webp$/) }), { onConflict: 'user_id' });
    expect(fake.object.remove).toHaveBeenCalledWith([fake.state.previous.object_path]);
  });
  it('removes only the owner mapping and object, and cleans up a failed upload mapping', async () => {
    const fake = fakeStore();
    fake.state.previous = { object_path: `42/${'a'.repeat(32)}.webp` };
    vi.mocked(createClient).mockReturnValue(fake.client as never);
    const store = await import('./storage');
    await store.deleteAvatar(42);
    expect(fake.table.eq).toHaveBeenCalledWith('user_id', 42);
    expect(fake.object.remove).toHaveBeenCalledWith([fake.state.previous.object_path]);
    fake.state.upsertError = new Error('database down');
    await expect(store.saveAvatar(42, Buffer.from('RIFFxxxxWEBP'))).rejects.toThrow('database down');
    expect(fake.object.remove).toHaveBeenCalledTimes(2);
  });
  it('distinguishes missing objects from storage service failures', async () => {
    const fake = fakeStore();
    vi.mocked(createClient).mockReturnValue(fake.client as never);
    const store = await import('./storage');
    expect(await store.readAvatar(42, 'a'.repeat(32))).toBeNull();
    expect(fake.object.download).not.toHaveBeenCalled();
    fake.state.currentVersion = 'a'.repeat(32);
    fake.state.downloadError = { statusCode: '404' };
    expect(await store.readAvatar(42, 'a'.repeat(32))).toBeNull();
    fake.state.downloadError = { statusCode: '503' };
    await expect(store.readAvatar(42, 'a'.repeat(32))).rejects.toEqual({ statusCode: '503' });
  });
});
