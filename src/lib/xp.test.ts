import { describe, expect, it } from 'vitest';
import { LEVEL_XP, chainLevels, levelToXp, projectGain, xpToLevel } from './xp-math';

describe('XP and levels', () => {
  it('turns XP into a level and back', () => {
    expect(xpToLevel(462)).toBe(1);
    expect(xpToLevel(0)).toBe(0);
    expect(xpToLevel(57_897)).toBeCloseTo(6.673, 3);
    expect(levelToXp(6.5)).toBeCloseTo((46_255 + 63_559) / 2, 6);
    expect(xpToLevel(levelToXp(12.34))).toBeCloseTo(12.34, 9);
    expect(xpToLevel(LEVEL_XP.at(-1)! * 2)).toBe(LEVEL_XP.length - 1);
  });
  it('scales a project XP by the mark, up to 125', () => {
    expect(projectGain(462, 100)).toBe(462);
    expect(projectGain(462, 125)).toBe(577.5);
    expect(projectGain(462, 150)).toBe(577.5);
    expect(projectGain(9660, 80)).toBe(7728);
  });
});

describe('chainLevels', () => {
  it('adds projects one after another, counting only the extra mark on validated ones', () => {
    const [first, second, third] = chainLevels(0, [{ xp: 462, mark: 100 }, { xp: 882, mark: 125 }, { xp: 462, mark: 125, doneMark: 100 }]);
    expect(first.level).toBe(1);
    expect(second.gain).toBe(1102.5);
    expect(third.gain).toBe(115.5);
    expect(third.level).toBeCloseTo(xpToLevel(462 + 1102.5 + 115.5), 9);
    expect(chainLevels(3, [{ xp: 462, mark: 80, doneMark: 100 }])[0]).toEqual({ gain: 0, level: 3 });
  });
  it('adds the coalition bonus on top of each gain', () => {
    const [step] = chainLevels(0, [{ xp: 1000, mark: 100 }], 4);
    expect(step.gain).toBeCloseTo(1040, 9);
    expect(chainLevels(0, [{ xp: 1000, mark: 125, doneMark: 100 }], 4)[0].gain).toBeCloseTo(260, 9);
    expect(chainLevels(0, [{ xp: 1000, mark: 100 }], -10)[0].gain).toBe(1000);
  });
});
