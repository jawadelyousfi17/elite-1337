import { describe, expect, it } from 'vitest';
import { rankCoalitions } from './coalitions';

describe('rankCoalitions', () => {
  it('ranks by score, shares ties and drops colours that are not hex', () => {
    const ranked = rankCoalitions([
      { id: 75, name: 'Freax', color: '#f5bc39', score: 3_776_428 },
      { id: 76, name: 'Commodore', color: '#235a16', score: 4_340_516 },
      { id: 73, name: 'Bios', color: 'url(x)', score: 3_776_428 },
    ]);
    expect(ranked.map((coalition) => [coalition.name, coalition.rank])).toEqual([['Commodore', 1], ['Freax', 2], ['Bios', 2]]);
    expect(ranked[2].color).toBeNull();
    expect(ranked[0].total).toBe(3);
  });
});
