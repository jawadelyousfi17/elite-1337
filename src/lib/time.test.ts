import { describe, expect, it } from 'vitest';
import { timeAgo } from './time';

const now = Date.parse('2026-10-23T12:00:00Z');
const before = (ms: number) => new Date(now - ms).toISOString();

describe('timeAgo', () => {
  it('reads like a human', () => {
    expect(timeAgo(before(20_000), now)).toBe('just now');
    expect(timeAgo(before(12 * 60_000), now)).toBe('12 min ago');
    expect(timeAgo(before(3 * 3_600_000 + 5 * 60_000), now)).toBe('3 h ago');
    expect(timeAgo(before(26 * 3_600_000), now)).toBe('1 day ago');
    expect(timeAgo(before(50 * 3_600_000), now)).toBe('2 days ago');
  });
});
