import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { withTimeout } from '@/lib/timeout';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'student-avatars';
export type AvatarRecord = { user_id: number; object_path: string; version: string };
let client: SupabaseClient | undefined;

export function avatarStorageConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.AUTH_SECRET);
}

function storageClient() {
  if (!avatarStorageConfigured()) throw new Error('Avatar storage is not configured');
  return client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function avatarPath(userId: number, version: string) { return `${userId}/${version}.webp`; }
export function checkedUserId(value: string): number | null {
  if (!/^[1-9]\d{0,11}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
function signature(userId: number, version: string, expiresAt: number) {
  return createHmac('sha256', process.env.AUTH_SECRET!).update(`avatar:v1:${userId}:${version}:${expiresAt}`).digest('base64url');
}
export function avatarUrl(userId: number, version: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return `/api/avatars/${userId}?v=${version}&e=${expiresAt}&s=${signature(userId, version, expiresAt)}`;
}
export function validAvatarSignature(userId: number, version: string, expiry: string, supplied: string): boolean {
  if (!/^[a-f0-9]{32}$/.test(version) || !/^\d{10}$/.test(expiry) || !/^[A-Za-z0-9_-]{43}$/.test(supplied) || !process.env.AUTH_SECRET) return false;
  const expiresAt = Number(expiry), now = Math.floor(Date.now() / 1000);
  if (expiresAt < now || expiresAt > now + 3600) return false;
  const expected = Buffer.from(signature(userId, version, expiresAt));
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function avatarReferences(ids: number[]): Promise<Record<number, string>> {
  if (!ids.length || !avatarStorageConfigured()) return {};
  const unique = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (unique.length > 100) throw new Error('Avatar lookup exceeds the page limit');
  const { data, error } = await storageClient().from('student_avatars').select('user_id,object_path,version').in('user_id', unique);
  if (error) throw error;
  return Object.fromEntries((data as AvatarRecord[]).filter((row) => /^[a-f0-9]{32}$/.test(row.version) && row.object_path === avatarPath(row.user_id, row.version)).map((row) => [row.user_id, avatarUrl(row.user_id, row.version)]));
}

/** Uploaded avatars for these students; none (42 photos are used) if storage fails or takes over 3 s. */
export async function avatarReferencesOrEmpty(ids: number[]): Promise<Record<number, string>> {
  try { return await withTimeout(avatarReferences(ids), 3000, {}); }
  catch (error) { console.error('Avatar lookup failed:', error instanceof Error ? error.name : 'unknown'); return {}; }
}

export async function readAvatar(userId: number, version: string): Promise<Buffer | null> {
  const store = storageClient();
  const current = await store.from('student_avatars').select('version').eq('user_id', userId).maybeSingle();
  if (current.error) throw current.error;
  if (current.data?.version !== version) return null;
  const { data, error } = await store.storage.from(BUCKET).download(avatarPath(userId, version));
  if (error) {
    if (String((error as { statusCode?: string | number }).statusCode) === '404') return null;
    throw error;
  }
  if (!data) return null;
  if (data.size > 1024 * 1024) return null;
  const image = Buffer.from(await data.arrayBuffer());
  return image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP' ? image : null;
}

export async function saveAvatar(userId: number, image: Buffer): Promise<string> {
  const store = storageClient();
  const version = randomUUID().replaceAll('-', '');
  const path = avatarPath(userId, version);
  const { data: previous, error: lookupError } = await store.from('student_avatars').select('object_path').eq('user_id', userId).maybeSingle();
  if (lookupError) throw lookupError;
  const uploaded = await store.storage.from(BUCKET).upload(path, image, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (uploaded.error) throw uploaded.error;
  const saved = await store.from('student_avatars').upsert({ user_id: userId, object_path: path, version, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (saved.error) {
    await store.storage.from(BUCKET).remove([path]);
    throw saved.error;
  }
  if (previous?.object_path && previous.object_path !== path) {
    const removed = await store.storage.from(BUCKET).remove([previous.object_path]);
    if (removed.error) console.error('Old avatar cleanup failed');
  }
  return avatarUrl(userId, version);
}

export async function deleteAvatar(userId: number): Promise<void> {
  const store = storageClient();
  const { data: previous, error: lookupError } = await store.from('student_avatars').select('object_path').eq('user_id', userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!previous) return;
  const deleted = await store.from('student_avatars').delete().eq('user_id', userId);
  if (deleted.error) throw deleted.error;
  const removed = await store.storage.from(BUCKET).remove([previous.object_path]);
  if (removed.error) console.error('Avatar object cleanup failed');
}
