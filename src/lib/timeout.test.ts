import { describe, expect, it } from 'vitest';
import { withTimeout } from './timeout';

describe('withTimeout', () => {
  it('returns the result when it is quick, and the fallback when it is not', async () => {
    expect(await withTimeout(Promise.resolve(1), 50, 0)).toBe(1);
    expect(await withTimeout(new Promise<number>((resolve) => setTimeout(() => resolve(1), 100)), 10, 0)).toBe(0);
  });
});
