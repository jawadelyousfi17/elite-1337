import { unstable_cache } from 'next/cache';
import { demoAvatar, isDemo } from './demo';
import sharp from 'sharp';
import { decode } from 'jpeg-js';
import { singleFlight } from './single-flight';
import { fortyTwoApi } from './fortytwo-api';
import { ART_COLS, ART_ROWS, lumaFromRgba } from './card-art';

/** Gray cells through sharp (any common format); the pixels are shrunk first so a big upload stays cheap. */
async function viaSharp(bytes: Uint8Array): Promise<Uint8Array> {
  const raw = await sharp(Buffer.from(bytes), { limitInputPixels: 24_000_000 }).rotate().flatten({ background: '#161b22' })
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return lumaFromRgba(raw.data, raw.info.width, raw.info.height);
}
/** A pure-JavaScript JPEG decoder, used if the native one is not available on the server. */
function viaJpegJs(bytes: Uint8Array): Uint8Array {
  const image = decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
  return lumaFromRgba(image.data, image.width, image.height);
}

/**
 * Turns image bytes into ART_COLS x ART_ROWS gray cells (sharp first, a pure-JavaScript JPEG decoder if that fails), or
 * null. `loadCardLuma` does it for a student's 42 photo as base64 for the card's ASCII portrait, or null when it cannot be used. The CDN is not the 42 API, so this costs no request budget; a photo path changes with the photo, so a result is
 * cached for a month. A failed download throws and is NOT cached (a hiccup must not hide the photo for a month).
 */
export async function imageToCells(bytes: Uint8Array): Promise<Uint8Array | null> {
  for (const attempt of [viaSharp, async (data: Uint8Array) => viaJpegJs(data)]) {
    try { return await attempt(bytes); }
    catch (error) { console.error('rank card photo decode failed:', error instanceof Error ? error.message.slice(0, 120) : 'unknown error'); }
  }
  return null;
}

export const loadCardLuma = singleFlight(unstable_cache(async (userId: number, path: string): Promise<string | null> => {
  const bytes = isDemo() ? new TextEncoder().encode(demoAvatar(userId)) : await fortyTwoApi.cdnPhoto(path);
  if (!bytes) throw new Error('photo not available from the CDN');
  const cells = await imageToCells(bytes);
  return cells ? Buffer.from(cells).toString('base64') : null;
}, ['1337-card-luma-v4', String(ART_COLS * ART_ROWS)], { revalidate: 2_592_000 }));
