import { unstable_cache } from 'next/cache';
import sharp from 'sharp';
import { singleFlight } from './single-flight';
import { fortyTwoApi } from './fortytwo-api';
import { ART_COLS, ART_ROWS } from './card-art';

/**
 * A student's photo as COLS x ROWS grayscale bytes (base64) for the card's text portrait, or null when 42 has no
 * usable photo. The CDN is not the 42 API, so this costs no request budget; a photo path changes with the photo, so
 * the result is cached for a month. A CDN failure throws and is not cached, so the next visit retries.
 */
const lumaFor = singleFlight(unstable_cache(async (userId: number, path: string): Promise<string | null> => {
  const bytes = await fortyTwoApi.cdnPhoto(path);
  if (!bytes) return null;
  try {
    // Cells are about twice as tall as wide, so a square photo is squeezed into a 2:1 grid on purpose.
    const raw = await sharp(Buffer.from(bytes), { limitInputPixels: 16_000_000 }).flatten({ background: '#ffffff' })
      .resize(ART_COLS, ART_ROWS, { fit: 'fill' }).greyscale().normalise({ lower: 2, upper: 98 }).raw().toBuffer();
    return raw.length === ART_COLS * ART_ROWS ? raw.toString('base64') : null;
  } catch { return null; }
}, ['1337-card-luma-v1', String(ART_COLS * ART_ROWS)], { revalidate: 2_592_000 }));

export async function loadCardLuma(userId: number, path: string): Promise<Uint8Array | null> {
  const encoded = await lumaFor(userId, path);
  return encoded ? new Uint8Array(Buffer.from(encoded, 'base64')) : null;
}
