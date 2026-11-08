import { describe, expect, it } from 'vitest';
import { customLevelSchema } from './xp-custom';
import { chainLevels, levelToXp, MAX_XP_LEVEL, xpToLevel } from './xp-math';

describe('custom XP starting level', () => {
  it.each([['10.89', 10.89], ['0', 0], ['0.00', 0], ['.89', 0.89], [' 10.89 ', 10.89], [String(MAX_XP_LEVEL), MAX_XP_LEVEL]])('accepts %s as level %s', (input, level) => {
    expect(customLevelSchema.parse(input)).toBe(level);
  });

  it.each(['', ' ', '-1', '30.01', '10.891', 'Infinity', 'NaN', '1e1', '0x10', '10,89', 'text', undefined, null, ['10.89', '12'], 10.89])('rejects invalid entries without coercing them into level zero: %s', (input) => {
    expect(customLevelSchema.safeParse(input).success).toBe(false);
  });

  it('starts at the supplied fraction and adds each project’s full XP', () => {
    const level = customLevelSchema.parse('10.89');
    const steps = chainLevels(level, [{ xp: 462, mark: 100 }, { xp: 882, mark: 125 }]);
    expect(steps.map((step) => step.gain)).toEqual([462, 1102.5]);
    expect(steps[1].level).toBeCloseTo(xpToLevel(levelToXp(10.89) + 462 + 1102.5), 9);
    expect(steps[0].level).toBeGreaterThan(10.89);
  });
});
