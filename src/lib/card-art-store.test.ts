import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ART_COLS, ART_ROWS } from './card-art';

const query = vi.fn();
vi.mock('./db', () => ({ sql: () => (strings: TemplateStringsArray, ...values: unknown[]) => query(strings.join('?'), values) }));
const cells = (fill = 7) => Buffer.from(new Uint8Array(ART_COLS * ART_ROWS).fill(fill)).toString('base64');
beforeEach(() => { vi.resetModules(); query.mockReset(); query.mockResolvedValue([]); process.env.DATABASE_URL = 'postgres://test'; });

describe('validCells', () => {
  it('accepts exactly the grid size in base64 and nothing else', async () => {
    const { validCells } = await import('./card-art-store');
    expect(validCells(cells())).toBe(true);
    expect(validCells(cells().slice(4))).toBe(false);
    expect(validCells(`${cells()}AAAA`)).toBe(false);
    expect(validCells('<script>')).toBe(false);
    expect(validCells(42)).toBe(false);
    expect(validCells(Buffer.from(new Uint8Array(10)).toString('base64'))).toBe(false);
  });
});

describe('card picture storage', () => {
  it('refuses bad input before touching the database', async () => {
    const { saveCardArt } = await import('./card-art-store');
    expect(await saveCardArt(5, { source: 'upload', label: 'x', cells: 'nope' })).toBe('invalid');
    expect(await saveCardArt(-1, { source: 'upload', label: 'x', cells: cells() })).toBe('invalid');
    expect(await saveCardArt(5, { source: 'evil' as never, label: 'x', cells: cells() })).toBe('invalid');
    expect(query).not.toHaveBeenCalled();
  });
  it('saves one row per student and reports a repeat inside 5 seconds as limited', async () => {
    const { saveCardArt } = await import('./card-art-store');
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ user_id: 5 }]);
    expect(await saveCardArt(5, { source: 'github', label: '@x', cells: cells() })).toBe('saved');
    expect(query.mock.calls.at(-1)![0]).toContain('interval \'5 seconds\'');
    query.mockResolvedValueOnce([]);
    expect(await saveCardArt(5, { source: 'github', label: '@x', cells: cells() })).toBe('limited');
  });
  it('fails soft when the database is missing or errors', async () => {
    const { getCardArt, saveCardArt } = await import('./card-art-store');
    query.mockRejectedValue(new Error('down'));
    expect(await getCardArt(5)).toBeNull();
    expect(await saveCardArt(5, { source: 'link', label: 'h', cells: cells() })).toBe('unavailable');
    delete process.env.DATABASE_URL;
    expect(await getCardArt(5)).toBeNull();
  });
  it('only returns stored art whose cells are valid', async () => {
    const { getCardArt } = await import('./card-art-store');
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ source: 'upload', label: 'Uploaded image', cells: cells() }]);
    expect(await getCardArt(5)).toMatchObject({ source: 'upload' });
    query.mockResolvedValueOnce([{ source: 'upload', label: 'x', cells: 'broken' }]);
    expect(await getCardArt(5)).toBeNull();
  });
});
