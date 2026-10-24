import { describe, expect, it } from 'vitest';
import { matchesSearch, normalize } from './search';

const ylagmah = ['ylagmah', 'Youness Lagmah'];

describe('smart student search', () => {
  it('matches logins and real names, ignoring case and accents', () => {
    expect(matchesSearch('YLAG', ylagmah)).toBe(true);
    expect(matchesSearch('youness lagmah', ylagmah)).toBe(true);
    expect(matchesSearch('lagmah youness', ylagmah)).toBe(true);
    expect(matchesSearch('Tétouan', ['x', 'Tetouan Student'])).toBe(true);
    expect(normalize('  Saad  El-Jazouly ')).toBe('saad el jazouly');
  });
  it('tolerates spelling mistakes and partial words', () => {
    expect(matchesSearch('younes', ylagmah)).toBe(true);
    expect(matchesSearch('lagmha', ylagmah)).toBe(true);
    expect(matchesSearch('youenss', ylagmah)).toBe(true);
    expect(matchesSearch('lagm', ylagmah)).toBe(true);
    expect(matchesSearch('ylgmah', ylagmah)).toBe(true);
  });
  it('rejects unrelated queries and keeps very short queries exact', () => {
    expect(matchesSearch('bkolani', ylagmah)).toBe(false);
    expect(matchesSearch('xyz', ylagmah)).toBe(false);
    expect(matchesSearch('yoz', ylagmah)).toBe(false);
    expect(matchesSearch('', ylagmah)).toBe(true);
  });
});
