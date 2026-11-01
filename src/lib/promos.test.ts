import { describe, expect, it } from 'vitest';
import { CAMPUS, PROMO_TARGETS, promoOutcome, safeBack } from './promos';

describe('promoOutcome', () => {
  it('allows students of the promo campus, primary or not', () => {
    expect(promoOutcome([{ campus_id: CAMPUS.khouribga }], CAMPUS.khouribga)).toBe('allowed');
    expect(promoOutcome([{ campus_id: 55 }, { campus_id: CAMPUS.benguerir }], CAMPUS.benguerir)).toBe('allowed');
  });
  it('denies other campuses and students with no campus', () => {
    expect(promoOutcome([{ campus_id: CAMPUS.benguerir }], CAMPUS.khouribga)).toBe('denied');
    expect(promoOutcome([], CAMPUS.khouribga)).toBe('denied');
  });
  it('reports an error when the profile could not be loaded', () => {
    expect(promoOutcome(null, CAMPUS.khouribga)).toBe('error');
  });
  it('keeps every promo link on https, or null for test promos', () => {
    for (const target of Object.values(PROMO_TARGETS)) expect(target.href === null || target.href.startsWith('https://')).toBe(true);
  });
});

describe('safeBack', () => {
  it('keeps paths on this site', () => {
    expect(safeBack('/stats')).toBe('/stats');
    expect(safeBack('/students/jdoe')).toBe('/students/jdoe');
  });
  it('falls back to the landing page for anything else', () => {
    expect(safeBack(null)).toBe('/');
    expect(safeBack('//evil.example')).toBe('/');
    expect(safeBack('https://evil.example')).toBe('/');
    expect(safeBack('/stats?x=1')).toBe('/');
    expect(safeBack('/\\evil.example')).toBe('/');
  });
});
