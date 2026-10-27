/** Level math shared by the server and the calculator in the browser; no server imports here. */
/**
 * Total XP needed for each Common Core level (index = level). 42 does not expose this table to apps; it was checked
 * against a real student: the XP of their validated projects gave level 6.67 for a real 6.68.
 */
export const LEVEL_XP = [0, 462, 2688, 5885, 11777, 29217, 46255, 63559, 74340, 85483, 95000, 105630, 124446, 145782, 169932, 197316, 228354, 263508, 303366, 348516, 399672, 457632, 523320, 597786, 682164, 777756, 886074, 1008798, 1147902, 1305486, 1484070];
const TOP = LEVEL_XP.length - 1;

/** 6.68 → the XP a student at that level has. */
export function levelToXp(level: number) {
  const clamped = Math.min(Math.max(level, 0), TOP);
  const whole = Math.min(Math.floor(clamped), TOP - 1);
  return LEVEL_XP[whole] + (clamped - whole) * (LEVEL_XP[whole + 1] - LEVEL_XP[whole]);
}

/** XP → level with the fraction 42 shows (two decimals are what Intra displays). */
export function xpToLevel(xp: number) {
  if (xp >= LEVEL_XP[TOP]) return TOP;
  let whole = 0;
  while (whole < TOP - 1 && LEVEL_XP[whole + 1] <= xp) whole++;
  return whole + (Math.max(xp, 0) - LEVEL_XP[whole]) / (LEVEL_XP[whole + 1] - LEVEL_XP[whole]);
}

/** A validated project gives its XP scaled by the mark: 125 with the full bonus gives 1.25×. */
export const projectGain = (projectXp: number, mark: number) => projectXp * Math.min(Math.max(mark, 0), 125) / 100;

export type XpProject = { slug: string; name: string; xp: number; circle: number };

export type XpStep = { xp: number; mark: number; doneMark?: number | null };

/**
 * Levels after each project in order. A project already validated only adds the XP of the extra mark
 * (100 → 125 adds a quarter of its XP), and a lower mark adds nothing.
 */
export function chainLevels(startLevel: number, steps: XpStep[]) {
  let xp = levelToXp(startLevel);
  return steps.map((step) => {
    const gain = Math.max(0, projectGain(step.xp, step.mark) - (step.doneMark != null ? projectGain(step.xp, step.doneMark) : 0));
    xp += gain;
    return { gain, level: xpToLevel(xp) };
  });
}
