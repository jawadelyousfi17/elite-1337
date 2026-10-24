import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { checkedUserId, readAvatar, validAvatarSignature } from '@/lib/avatars/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401, headers: noStore });
  const userId = checkedUserId((await context.params).userId);
  const version = request.nextUrl.searchParams.get('v') ?? '';
  const expiry = request.nextUrl.searchParams.get('e') ?? '';
  const signature = request.nextUrl.searchParams.get('s') ?? '';
  if (!userId || !validAvatarSignature(userId, version, expiry, signature)) return new Response(null, { status: 404, headers: noStore });
  try {
    const image = await readAvatar(userId, version);
    if (!image) return new Response(null, { status: 404, headers: noStore });
    const body = new Uint8Array(image.length);
    body.set(image);
    return new Response(body, { headers: { 'Content-Type': 'image/webp', 'Content-Length': String(image.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('Avatar read failed:', error instanceof Error ? error.name : 'unknown');
    return new Response(null, { status: 503, headers: noStore });
  }
}
