import { describe, expect, it } from 'vitest';
import { singleFlight } from './single-flight';

describe('singleFlight', () => {
  it('shares one call between concurrent callers with the same arguments, then runs again', async () => {
    let calls = 0;
    const load = singleFlight(async (id: number) => { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return id * 2; }, 20);
    expect(await Promise.all([load(1), load(1), load(2)])).toEqual([2, 2, 4]);
    expect(calls).toBe(2);
    await load(1);
    expect(calls).toBe(2);                     // still held right after success
    await new Promise((resolve) => setTimeout(resolve, 30));
    await load(1);
    expect(calls).toBe(3);
  });
  it('forgets a failed call so the next one retries', async () => {
    let calls = 0;
    const load = singleFlight(async () => { calls++; throw new Error('boom'); }, 20);
    await expect(load()).rejects.toThrow('boom');
    await expect(load()).rejects.toThrow('boom');
    expect(calls).toBe(2);
  });
});
