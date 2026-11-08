import { describe, expect, it } from 'vitest';
import { ART_COLS, ART_ROWS, artRows, lumaFromRgba, silhouetteLuma } from './card-art';

const flat = (value: number) => new Uint8Array(ART_COLS * ART_ROWS).fill(value);

describe('artRows', () => {
  it('makes one row per line, at most one glyph per column', () => {
    const rows = artRows(flat(255), 'dark');
    expect(rows).toHaveLength(ART_ROWS);
    expect(rows.every((row) => row.length === ART_COLS)).toBe(true);
  });
  it('is dense for bright pixels on dark and for dark pixels on light, blank otherwise', () => {
    expect(artRows(flat(255), 'dark')[0]).toBe('@'.repeat(ART_COLS));
    expect(artRows(flat(0), 'light')[0]).toBe('@'.repeat(ART_COLS));
    expect(artRows(flat(0), 'dark')[0]).toBe('');
    expect(artRows(flat(255), 'light')[0]).toBe('');
  });
  it('uses a middle character for mid grays', () => {
    expect(artRows(flat(128), 'dark')[0]).toMatch(/^\++$/);
  });
});

describe('silhouetteLuma', () => {
  it('has a bright head and shoulders on a dark background', () => {
    const luma = silhouetteLuma();
    expect(luma).toHaveLength(ART_COLS * ART_ROWS);
    expect(luma[0]).toBeLessThan(60);
    expect(luma[8 * ART_COLS + ART_COLS / 2]).toBeGreaterThan(150);
    expect(luma[(ART_ROWS - 1) * ART_COLS + ART_COLS / 2]).toBeGreaterThan(150);
  });
});

describe('lumaFromRgba', () => {
  const rgba = (width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
    return data;
  };
  it('maps a dark-left, bright-right image onto the grid and stretches the contrast', () => {
    const luma = lumaFromRgba(rgba(160, 80, (x) => x < 80 ? [90, 90, 90, 255] : [140, 140, 140, 255]), 160, 80);
    expect(luma).toHaveLength(ART_COLS * ART_ROWS);
    expect(luma[0]).toBe(0);
    expect(luma[ART_COLS - 1]).toBe(255);
  });
  it('treats transparent pixels as the dark background', () => {
    const luma = lumaFromRgba(rgba(80, 40, (x) => x < 40 ? [255, 255, 255, 0] : [255, 255, 255, 255]), 80, 40);
    expect(luma[0]).toBeLessThan(luma[ART_COLS - 1]);
  });
  it('fills every cell even when the image is smaller than the grid', () => {
    const luma = lumaFromRgba(rgba(20, 20, (x) => x < 10 ? [0, 0, 0, 255] : [255, 255, 255, 255]), 20, 20);
    expect(luma).toHaveLength(ART_COLS * ART_ROWS);
    expect(luma.slice(0, ART_COLS / 2 - 1).every((value) => value === 0)).toBe(true);
    expect(luma.slice(ART_COLS / 2 + 1, ART_COLS).every((value) => value === 255)).toBe(true);
  });
});
