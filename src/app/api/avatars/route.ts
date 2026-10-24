import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { avatarStorageConfigured, checkedUserId, deleteAvatar, saveAvatar } from '@/lib/avatars/storage';
import { InvalidAvatarError, MAX_UPLOAD_BYTES, prepareAvatar } from '@/lib/avatars/image';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'private, no-store' };
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.host === host && url.protocol === request.nextUrl.protocol;
  } catch { return false; }
}
async function boundedFormData(request: NextRequest): Promise<FormData> {
  const type = request.headers.get('content-type');
  if (!type?.toLowerCase().startsWith('multipart/form-data;') || !request.body) throw new InvalidAvatarError('Choose an image to upload.');
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES + 100_000) { await reader.cancel(); throw new InvalidAvatarError('Choose an image smaller than 4 MB.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
  return new Request(request.url, { method: 'POST', headers: { 'content-type': type }, body }).formData();
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = checkedUserId(session?.user?.id ?? '');
  if (!userId) return NextResponse.json({ error: 'Sign in with 42 first.' }, { status: 401, headers });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  if (!avatarStorageConfigured()) return NextResponse.json({ error: 'Avatar storage is not configured yet.' }, { status: 503, headers });
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES + 100_000) return NextResponse.json({ error: 'Choose an image smaller than 4 MB.' }, { status: 413, headers });
  try {
    const form = await boundedFormData(request);
    const file = form.get('image');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400, headers });
    const image = await prepareAvatar(file);
    const src = await saveAvatar(userId, image);
    return NextResponse.json({ src }, { headers });
  } catch (error) {
    if (error instanceof InvalidAvatarError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error('Avatar upload failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Avatar storage is temporarily unavailable.' }, { status: 503, headers });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  const userId = checkedUserId(session?.user?.id ?? '');
  if (!userId) return NextResponse.json({ error: 'Sign in with 42 first.' }, { status: 401, headers });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  if (!avatarStorageConfigured()) return NextResponse.json({ error: 'Avatar storage is not configured yet.' }, { status: 503, headers });
  try {
    await deleteAvatar(userId);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    console.error('Avatar removal failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Avatar storage is temporarily unavailable.' }, { status: 503, headers });
  }
}
