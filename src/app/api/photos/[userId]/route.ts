import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { checkedUserId } from '@/lib/avatars/storage';
import { photoContentType, validPhotoSignature } from '@/lib/avatars/intra-photo';
import { fortyTwoApi } from '@/lib/fortytwo-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401, headers: noStore });
  const userId = checkedUserId((await context.params).userId);
  const path = request.nextUrl.searchParams.get('p') ?? '';
  const signature = request.nextUrl.searchParams.get('s') ?? '';
  if (!userId || !validPhotoSignature(userId, path, signature)) return new Response(null, { status: 404, headers: noStore });
  try {
    const bytes = await fortyTwoApi.cdnPhoto(path);
    const type = bytes && photoContentType(bytes);
    if (!bytes || !type) return new Response(null, { status: 404, headers: noStore });
    // The CDN path changes whenever a student changes their photo, so each URL is immutable.
    return new Response(bytes, { headers: { 'Content-Type': type, 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('42 photo read failed:', error instanceof Error ? error.name : 'unknown');
    return new Response(null, { status: 503, headers: noStore });
  }
}
