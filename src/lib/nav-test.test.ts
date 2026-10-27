import { describe, expect, it } from 'vitest';
import { assignedNavVariant, navEventSchema } from './nav-test';

describe('navigation A/B test', () => {
  it('gives a student the same half every time and splits students about evenly', () => {
    expect(assignedNavVariant(195219)).toBe(assignedNavVariant(195219));
    const ids = Array.from({ length: 2000 }, (_, index) => 100_000 + index * 37);
    const xp = ids.filter((id) => assignedNavVariant(id) === 'xp').length / ids.length;
    expect(xp).toBeGreaterThan(.45);
    expect(xp).toBeLessThan(.55);
  });
  it('accepts only known events', () => {
    expect(navEventSchema.safeParse({ event: 'xp' }).success).toBe(true);
    expect(navEventSchema.safeParse({ event: 'drop table' }).success).toBe(false);
  });
});
