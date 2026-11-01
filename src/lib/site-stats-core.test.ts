import { describe, expect, it } from 'vitest';
import { change, normalizePath, parsePeriod, ratio, recordsOnHost } from './site-stats-core';

describe('normalizePath', () => {
  it('keeps known sections and drops the query', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/leaderboard?campus=16&q=jdoe')).toBe('/leaderboard');
    expect(normalizePath('/stats/')).toBe('/stats');
  });
  it('folds profiles and ids so no login is stored', () => {
    expect(normalizePath('/students/jdoe')).toBe('/students/:id');
    expect(normalizePath('/students/jdoe/projects')).toBe('/students/:id');
    expect(normalizePath('/piscines/2024-07')).toBe('/piscines/:id');
    expect(normalizePath('/xp/calculator')).toBe('/xp/calculator');
  });
  it('ignores admin, api, unknown and malformed paths', () => {
    expect(normalizePath('/admin/stats')).toBeNull();
    expect(normalizePath('/api/track')).toBeNull();
    expect(normalizePath('/wp-login.php')).toBeNull();
    expect(normalizePath('leaderboard')).toBeNull();
    expect(normalizePath(`/${'a'.repeat(300)}`)).toBeNull();
  });
});

describe('recordsOnHost', () => {
  it('records on production hosts only, plus explicit extras', () => {
    expect(recordsOnHost('www.elite-1337.app', '', '')).toBe(true);
    expect(recordsOnHost('localhost:3000', '', '')).toBe(false);
    expect(recordsOnHost('localhost:3399', 'localhost', '')).toBe(true);
    expect(recordsOnHost(null, '', '')).toBe(false);
  });
  it('follows the Vercel environment whatever the host header says', () => {
    expect(recordsOnHost('elite-1337-abc.vercel.app', '', 'production')).toBe(true);
    expect(recordsOnHost(null, '', 'production')).toBe(true);
    expect(recordsOnHost('www.elite-1337.app', '', 'preview')).toBe(false);
  });
});

describe('helpers', () => {
  it('parses periods with a today default', () => {
    expect(parsePeriod('7d')).toBe('7d');
    expect(parsePeriod('1y')).toBe('today');
  });
  it('computes ratios and changes safely', () => {
    expect(ratio(6, 4)).toBe(1.5);
    expect(ratio(3, 0)).toBe(0);
    expect(change(150, 100)).toBe(50);
    expect(change(5, 0)).toBeNull();
  });
});
