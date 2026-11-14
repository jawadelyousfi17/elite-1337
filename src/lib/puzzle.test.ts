import { describe, expect, it } from 'vitest';
import { BLANK, cellForArrow, dragDirection, isBoard, replay, isSolved, neighbours, shuffle, slide, solvedBoard } from './puzzle';

// Counts inversions; a 3x3 board is solvable only when the count is even.
const inversions = (board: number[]) => {
  const tiles = board.filter((tile) => tile !== BLANK);
  let count = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) count++;
  return count;
};

describe('puzzle', () => {
  it('finds the neighbours of corners, edges and the centre', () => {
    expect(neighbours(0).sort()).toEqual([1, 3]);
    expect(neighbours(4).sort()).toEqual([1, 3, 5, 7]);
    expect(neighbours(7).sort()).toEqual([4, 6, 8]);
  });

  it('slides only tiles that touch the blank', () => {
    const board = solvedBoard();
    expect(slide(board, 7)).toEqual([0, 1, 2, 3, 4, 5, 6, BLANK, 7]);
    expect(slide(board, 0)).toBe(board);
  });

  it('maps arrow keys to the tile that moves into the blank', () => {
    const board = solvedBoard();
    expect(cellForArrow(board, 'ArrowRight')).toBe(7);
    expect(cellForArrow(board, 'ArrowDown')).toBe(5);
    expect(cellForArrow(board, 'ArrowLeft')).toBeNull();
    expect(cellForArrow(board, 'ArrowUp')).toBeNull();
  });

  it('drags only tiles next to the blank, toward it', () => {
    const board = solvedBoard();
    expect(dragDirection(board, 7)).toEqual([1, 0]);
    expect(dragDirection(board, 5)).toEqual([0, 1]);
    expect(dragDirection(board, 4)).toBeNull();
  });

  it('replays legal move lists and rejects forged ones', () => {
    const start = slide(slide(solvedBoard(), 7), 6);
    expect(replay(start, [7, 8])).toEqual(solvedBoard());
    expect(replay(start, [7, 0])).toBeNull();
    expect(replay(start, [])).toEqual(start);
  });

  it('accepts only boards that hold each tile once', () => {
    expect(isBoard(solvedBoard())).toBe(true);
    expect(isBoard([0, 0, 1, 2, 3, 4, 5, 6, 7])).toBe(false);
    expect(isBoard([0, 1, 2])).toBe(false);
  });

  it('shuffles into a solvable board that is not solved', () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 50; i++) {
      const board = shuffle(random);
      expect([...board].sort()).toEqual(solvedBoard());
      expect(isSolved(board)).toBe(false);
      expect(inversions(board) % 2).toBe(0);
    }
  });

  it('keeps shuffling when a short shuffle lands back on the solved board', () => {
    expect(isSolved(shuffle(() => 0, 2))).toBe(false);
  });
});
