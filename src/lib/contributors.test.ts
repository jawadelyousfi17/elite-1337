import { describe, expect, it } from 'vitest';
import { pickContributors } from './contributors';

const person = (login: string, extra = {}) => ({ login, type: 'User', html_url: `https://github.com/${login}`, avatar_url: `https://avatars.githubusercontent.com/u/${login.length}?v=4`, contributions: 3, ...extra });

describe('pickContributors', () => {
  it('keeps people other than the makers and bots, with a small avatar', () => {
    const list = pickContributors([person('jawadelyousfi17'), person('HoussamMrabet'), person('ikosoftT'), person('dependabot[bot]', { type: 'Bot' }), person('moboulan')]);
    expect(list.map((c) => c.login)).toEqual(['HoussamMrabet', 'moboulan']);
    expect(list[0].commits).toBe(3);
    expect(list[0].avatar).toMatch(/^https:\/\/avatars\.githubusercontent\.com\/u\/\d+\?v=4&s=56$/);
  });
  it('drops entries whose links do not point at github.com', () => {
    expect(pickContributors([person('a', { html_url: 'https://evil.example/a' }), person('b', { avatar_url: 'https://evil.example/b.png' })])).toEqual([]);
  });
  it('returns nothing for an error payload', () => {
    expect(pickContributors({ message: 'API rate limit exceeded' })).toEqual([]);
    expect(pickContributors(null)).toEqual([]);
  });
});
