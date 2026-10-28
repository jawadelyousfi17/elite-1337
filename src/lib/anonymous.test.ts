import { describe, expect, it } from 'vitest';
import { isAnonymized, maskAnonymous } from './anonymous';

describe('anonymous students', () => {
  const hidden = new Set(['jel-yous']);
  it('matches logins case-insensitively', () => {
    expect(isAnonymized('Jel-Yous', hidden)).toBe(true);
    expect(isAnonymized('someone', hidden)).toBe(false);
    expect(isAnonymized(null, hidden)).toBe(false);
  });
  it('keeps the place and drops the identity', () => {
    const items = [{ id: 195219, login: 'jel-yous', displayName: 'Jawad', photo: '/users/x.jpg', level: 6.68, campusIds: [16] }, { id: 7, login: 'other', displayName: 'Other', photo: null, level: 3, campusIds: [16] }];
    const [masked, other] = maskAnonymous(items, hidden);
    expect(masked).toMatchObject({ id: -1, login: 'Anonymous', displayName: null, photo: null, anonymous: true, level: 6.68, campusIds: [16] });
    expect(other).toBe(items[1]);
    expect(maskAnonymous(items, new Set())).toBe(items);
  });
});
