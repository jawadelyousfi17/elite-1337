import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { InvalidAvatarError, prepareAvatar } from './image';

describe('avatar upload processing', () => {
  it('accepts a real PNG, strips the original format, and creates a bounded WebP', async () => {
    const input = await sharp({ create: { width: 500, height: 300, channels: 3, background: '#33aa66' } }).png().toBuffer();
    const output = await prepareAvatar(new File([input], 'portrait.png', { type: 'image/png' }));
    expect((await sharp(output).metadata())).toMatchObject({ format: 'webp', width: 256, height: 256 });
    expect(output.length).toBeLessThan(1024 * 1024);
  });
  it('rejects disguised content, unsupported MIME types, excessive bytes, and tiny dimensions', async () => {
    await expect(prepareAvatar(new File(['<svg/>'], 'fake.png', { type: 'image/png' }))).rejects.toBeInstanceOf(InvalidAvatarError);
    await expect(prepareAvatar(new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }))).rejects.toBeInstanceOf(InvalidAvatarError);
    await expect(prepareAvatar(new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toBeInstanceOf(InvalidAvatarError);
    const tiny = await sharp({ create: { width: 12, height: 12, channels: 3, background: 'red' } }).jpeg().toBuffer();
    await expect(prepareAvatar(new File([tiny], 'tiny.jpg', { type: 'image/jpeg' }))).rejects.toBeInstanceOf(InvalidAvatarError);
  });
});
