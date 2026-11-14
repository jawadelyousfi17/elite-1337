import { beforeAll, describe, expect, it } from 'vitest';
import { readPuzzle, signPuzzle } from './puzzle-token';

const board = [3, 1, 2, 0, 4, 5, 6, 8, 7];
const now = 1_800_000_000_000;

describe('puzzle token', () => {
  beforeAll(() => { process.env.AUTH_SECRET = 'test-secret'; });

  it('reads back the board it signed for the same student', () => {
    const token = signPuzzle(9000000_01, board, now)!;
    expect(readPuzzle(9000000_01, token, now + 1000)).toEqual({ board, issuedAt: now });
  });

  it('refuses another student, a changed board and an old token', () => {
    const token = signPuzzle(9000000_01, board, now)!;
    expect(readPuzzle(9000000_02, token, now)).toBeNull();
    expect(readPuzzle(9000000_01, token.replace('312', '132'), now)).toBeNull();
    expect(readPuzzle(9000000_01, token, now + 3 * 60 * 60 * 1000)).toBeNull();
    expect(readPuzzle(9000000_01, 'nonsense', now)).toBeNull();
  });
});
