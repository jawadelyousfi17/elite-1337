import sharp from 'sharp';

export class InvalidAvatarError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidAvatarError'; }
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const types: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function prepareAvatar(file: File): Promise<Buffer> {
  if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD_BYTES) throw new InvalidAvatarError('Choose an image smaller than 4 MB.');
  if (!Object.values(types).includes(file.type)) throw new InvalidAvatarError('Use a JPEG, PNG, or WebP image.');
  const input = Buffer.from(await file.arrayBuffer());
  const format = input.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpeg'
    : input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  if (!format || types[format] !== file.type) throw new InvalidAvatarError('The image content does not match its file type.');
  try {
    const processor = sharp(input, { limitInputPixels: 20_000_000, pages: 1, failOn: 'error' });
    const metadata = await processor.metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32 || metadata.width > 6000 || metadata.height > 6000 || metadata.width * metadata.height > 20_000_000) {
      throw new InvalidAvatarError('Image dimensions must be between 32 and 6000 pixels, with at most 20 million pixels total.');
    }
    const output = await processor.rotate().resize(256, 256, { fit: 'cover', position: 'attention' }).webp({ quality: 82, effort: 4 }).toBuffer();
    if (output.length > 1024 * 1024) throw new InvalidAvatarError('The optimized image is too large.');
    return output;
  } catch (error) {
    if (error instanceof InvalidAvatarError) throw error;
    throw new InvalidAvatarError('The image could not be processed.');
  }
}
