import { unstable_cache } from 'next/cache';
import sharp from 'sharp';
import { singleFlight } from './single-flight';
import { fortyTwoApi } from './fortytwo-api';

export const PHOTO_PX = 360;

/**
 * A student's photo shrunk to a small square JPEG (base64) to embed in their rank card, or null when 42 has no usable
 * photo. The CDN is not the 42 API, so this costs no request budget; a photo path changes with the photo, so the result is
 * cached for a month. A CDN failure throws and is not cached, so the next visit retries.
 */
export const loadCardPhoto = singleFlight(unstable_cache(async (userId: number, path: string): Promise<string | null> => {
  const bytes = await fortyTwoApi.cdnPhoto(path);
  if (!bytes) return null;
  try {
    const jpeg = await sharp(Buffer.from(bytes), { limitInputPixels: 16_000_000 }).rotate().flatten({ background: '#161b22' })
      .resize(PHOTO_PX, PHOTO_PX, { fit: 'cover' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return jpeg.toString('base64');
  } catch { return null; }
}, ['1337-card-photo-v1', String(PHOTO_PX)], { revalidate: 2_592_000 }));
