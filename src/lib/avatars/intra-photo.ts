import { createHmac, timingSafeEqual } from 'node:crypto';

export const INTRA_CDN = 'https://cdn.intra.42.fr';
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_PATH = /^\/users\/[a-f0-9]{32}\/[A-Za-z0-9_.-]{1,100}\.(?:jpe?g|png|gif|webp)$/i;

export function validPhotoPath(path: unknown): path is string {
  return typeof path === 'string' && PHOTO_PATH.test(path);
}

export function intraPhotoPath(image: unknown): string | null {
  if (!image || typeof image !== 'object') return null;
  const { link, versions } = image as { link?: unknown; versions?: unknown };
  const small = versions && typeof versions === 'object' ? (versions as { small?: unknown }).small : undefined;
  for (const value of [small, link]) {
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'cdn.intra.42.fr' && !url.search && validPhotoPath(url.pathname)) return url.pathname;
    } catch { /* malformed URL: no photo */ }
  }
  return null;
}

function signature(userId: number, path: string) {
  return createHmac('sha256', process.env.AUTH_SECRET!).update(`photo:v1:${userId}:${path}`).digest('base64url');
}

export function intraPhotoUrl(userId: number, path: string | null | undefined): string | null {
  if (!validPhotoPath(path) || !process.env.AUTH_SECRET) return null;
  return `/api/photos/${userId}?p=${encodeURIComponent(path)}&s=${signature(userId, path)}`;
}

export function validPhotoSignature(userId: number, path: string, supplied: string): boolean {
  if (!validPhotoPath(path) || !/^[A-Za-z0-9_-]{43}$/.test(supplied) || !process.env.AUTH_SECRET) return false;
  const expected = Buffer.from(signature(userId, path));
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Uploaded avatars take priority over 42 Intra photos.
export function photoReferences(people: { id: number; photo?: string | null }[], uploaded: Record<number, string> = {}): Record<number, string> {
  const references: Record<number, string> = {};
  for (const person of people) {
    const src = uploaded[person.id] ?? intraPhotoUrl(person.id, person.photo);
    if (src) references[person.id] = src;
  }
  return references;
}

export function photoContentType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}
