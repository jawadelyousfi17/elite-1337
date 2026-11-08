import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { ART_COLS, ART_ROWS } from './card-art';

const store = new Map<string, unknown>();
vi.mock('next/cache', () => ({
  unstable_cache: <A extends unknown[], T>(fn: (...args: A) => Promise<T>, keys: string[]) => async (...args: A) => {
    const key = `${keys.join('/')}:${JSON.stringify(args)}`;
    if (!store.has(key)) store.set(key, await fn(...args));
    return store.get(key) as T;
  },
}));
const cdnPhoto = vi.fn();
vi.mock('./fortytwo-api', () => ({ fortyTwoApi: { cdnPhoto: (...args: unknown[]) => cdnPhoto(...args) } }));

const path = '/users/c10658bc667e3e1f6e21cac83d956028/small_tester.jpg';
/** Dark left half, bright right half. */
const jpeg = async () => {
  const half = await sharp({ create: { width: 50, height: 100, channels: 3, background: '#ffffff' } }).png().toBuffer();
  return new Uint8Array(await sharp({ create: { width: 100, height: 100, channels: 3, background: '#202020' } }).composite([{ input: half, left: 50, top: 0 }]).jpeg().toBuffer());
};
const cells = (encoded: string | null) => new Uint8Array(Buffer.from(encoded!, 'base64'));
beforeEach(() => { store.clear(); cdnPhoto.mockReset(); vi.resetModules(); vi.doUnmock('sharp'); });

describe('loadCardLuma', () => {
  it('turns a photo into gray cells, dark on the left and bright on the right', async () => {
    cdnPhoto.mockResolvedValue(await jpeg());
    const { loadCardLuma } = await import('./card-photo');
    const luma = cells(await loadCardLuma(1, path));
    expect(luma).toHaveLength(ART_COLS * ART_ROWS);
    expect(luma[0]).toBeLessThan(40);
    expect(luma[ART_COLS - 1]).toBeGreaterThan(215);
  });
  it('falls back to the pure-JavaScript decoder when sharp is unavailable', async () => {
    cdnPhoto.mockResolvedValue(await jpeg());
    vi.doMock('sharp', () => ({ default: () => { throw new Error('sharp unavailable'); } }));
    const { loadCardLuma } = await import('./card-photo');
    const luma = cells(await loadCardLuma(2, path));
    expect(luma[0]).toBeLessThan(40);
    expect(luma[ART_COLS - 1]).toBeGreaterThan(215);
  });
  it('does not cache a failed download, so the next card retries it', async () => {
    cdnPhoto.mockResolvedValueOnce(null);
    const { loadCardLuma } = await import('./card-photo');
    await expect(loadCardLuma(3, path)).rejects.toThrow();
    cdnPhoto.mockResolvedValue(await jpeg());
    vi.resetModules();
    expect(await (await import('./card-photo')).loadCardLuma(3, path)).toBeTruthy();
  });
  it('gives null for bytes no decoder can read', async () => {
    cdnPhoto.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const { loadCardLuma } = await import('./card-photo');
    expect(await loadCardLuma(4, path)).toBeNull();
  });
});
