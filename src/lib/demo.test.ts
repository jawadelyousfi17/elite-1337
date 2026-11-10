import { afterEach, describe, expect, it } from 'vitest';
import { demoAvatar, demoDataset, isDemo } from './demo';

afterEach(() => { delete process.env.IS_DEMO; });
describe('demo mode', () => {
  it('is off unless IS_DEMO is set', () => {
    expect(isDemo()).toBe(false);
    process.env.IS_DEMO = '1';
    expect(isDemo()).toBe(true);
  });
  it('lists only the four real campuses with ranked made-up students', () => {
    const data = demoDataset();
    expect(data.campuses.map((campus) => campus.name)).toEqual(['Khouribga', 'Benguerir', 'Rabat', 'Tetouan']);
    expect(data.students.length).toBeGreaterThan(100);
    expect(data.students[0].globalRank).toBe(1);
    expect(new Set(data.students.map((student) => student.login)).size).toBe(data.students.length);
    expect(data.students.some((student) => student.frozen)).toBe(true);
  });
  it('draws a different valid face per student', () => {
    expect(demoAvatar(1)).toMatch(/^<svg/);
    expect(demoAvatar(1)).not.toBe(demoAvatar(2));
  });
});
