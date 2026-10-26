import { describe, expect, it } from 'vitest';
import { assignedVariant, otherMode } from './rank-test';

describe('rank scroll A/B test', () => {
  it('gives a student the same half every time, and splits students about evenly', () => {
    expect(assignedVariant(195219)).toBe(assignedVariant(195219));
    const ids = Array.from({ length: 2000 }, (_, index) => 100_000 + index * 37);
    const infinite = ids.filter((id) => assignedVariant(id) === 'infinite').length;
    expect(infinite / ids.length).toBeGreaterThan(.45);
    expect(infinite / ids.length).toBeLessThan(.55);
  });
  it('switches to the other mode', () => {
    expect(otherMode('pages')).toBe('infinite');
    expect(otherMode('infinite')).toBe('pages');
  });
});
