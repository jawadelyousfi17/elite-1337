import { describe, expect, it } from 'vitest';
import { isCat, tallyVotes } from './cat-votes';

describe('tallyVotes', () => {
  it('counts each vote once and ignores unknown cats', () => {
    const tally = tallyVotes([{ cat: 'tiger' }, { cat: 'tiger' }, { cat: 'mochi' }, { cat: 'garfield' }]);
    expect(tally.total).toBe(3);
    expect(tally.counts).toMatchObject({ tiger: 2, mochi: 1, oreo: 0 });
  });
});

describe('isCat', () => {
  it('only accepts the six cats', () => {
    expect([isCat('kiwi'), isCat('Kiwi'), isCat(''), isCat(null)]).toEqual([true, false, false, false]);
  });
});
