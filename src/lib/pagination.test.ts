import { describe, expect, it } from 'vitest';
import { pageItems } from './pagination';

describe('pageItems', () => {
  it('shows every page up to seven', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('keeps seven slots with gaps once there are more pages', () => {
    expect(pageItems(1, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9]);
    expect(pageItems(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9]);
    expect(pageItems(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
    expect(pageItems(6, 9)).toEqual([1, 'gap', 5, 6, 7, 8, 9]);
    expect(pageItems(9, 9)).toEqual([1, 'gap', 5, 6, 7, 8, 9]);
    expect(pageItems(50, 134)).toEqual([1, 'gap', 49, 50, 51, 'gap', 134]);
  });
  it('always includes the current, first and last page', () => {
    for (let pages = 1; pages <= 30; pages++) for (let page = 1; page <= pages; page++) {
      const items = pageItems(page, pages);
      expect(items).toContain(page); expect(items[0]).toBe(1); expect(items.at(-1)).toBe(pages);
      expect(items.length).toBeLessThanOrEqual(7);
    }
  });
});
