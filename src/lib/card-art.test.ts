import { describe, expect, it } from 'vitest';
import { ART_COLS, ART_ROWS, artRows, silhouetteLuma } from './card-art';

const flat = (value: number) => new Uint8Array(ART_COLS * ART_ROWS).fill(value);

describe('artRows', () => {
  it('makes one row per line, at most one glyph per column', () => {
    const rows = artRows(flat(255), 'dark');
    expect(rows).toHaveLength(ART_ROWS);
    expect(rows.every((row) => row.length === ART_COLS)).toBe(true);
  });
  it('is dense for bright pixels on dark and for dark pixels on light, blank otherwise', () => {
    expect(artRows(flat(255), 'dark')[0]).toBe('█'.repeat(ART_COLS));
    expect(artRows(flat(0), 'light')[0]).toBe('█'.repeat(ART_COLS));
    expect(artRows(flat(0), 'dark')[0]).toBe('');
    expect(artRows(flat(255), 'light')[0]).toBe('');
  });
  it('uses the middle glyphs for mid grays', () => {
    expect(artRows(flat(128), 'dark')[0]).toMatch(/^▒+$/);
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
