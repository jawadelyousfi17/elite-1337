/** A 3x3 sliding puzzle: `board[cell]` is the tile in that cell, tile `i` belongs in cell `i`, and `BLANK` is the empty cell. */
export const SIZE = 3;
export const BLANK = SIZE * SIZE - 1;
export type Board = number[];
/** One row of the top solvers list; login is null for students who asked to be removed. */
export type Solver = { login: string | null; moves: number; ms: number };

export const solvedBoard = (): Board => Array.from({ length: SIZE * SIZE }, (_, i) => i);
export const isSolved = (board: Board) => board.every((tile, cell) => tile === cell);

/** Cells next to `cell` (up, down, left, right). */
export function neighbours(cell: number): number[] {
  const row = Math.floor(cell / SIZE), col = cell % SIZE, out: number[] = [];
  if (row > 0) out.push(cell - SIZE);
  if (row < SIZE - 1) out.push(cell + SIZE);
  if (col > 0) out.push(cell - 1);
  if (col < SIZE - 1) out.push(cell + 1);
  return out;
}

/** Slides the tile in `cell` into the blank; returns the same board when that tile does not touch the blank. */
export function slide(board: Board, cell: number): Board {
  const blank = board.indexOf(BLANK);
  if (!neighbours(blank).includes(cell)) return board;
  const next = [...board];
  [next[blank], next[cell]] = [next[cell], next[blank]];
  return next;
}

/** The cell whose tile moves when the player presses an arrow: the tile on the opposite side of the blank slides into it. */
export function cellForArrow(board: Board, key: string): number | null {
  const blank = board.indexOf(BLANK), row = Math.floor(blank / SIZE), col = blank % SIZE;
  if (key === 'ArrowUp' && row < SIZE - 1) return blank + SIZE;
  if (key === 'ArrowDown' && row > 0) return blank - SIZE;
  if (key === 'ArrowLeft' && col < SIZE - 1) return blank + 1;
  if (key === 'ArrowRight' && col > 0) return blank - 1;
  return null;
}

/** Which way the tile in `cell` can be dragged ([x, y], one step toward the blank), or null when it does not touch the blank. */
export function dragDirection(board: Board, cell: number): [number, number] | null {
  const blank = board.indexOf(BLANK);
  if (!neighbours(blank).includes(cell)) return null;
  return [(blank % SIZE) - (cell % SIZE), Math.floor(blank / SIZE) - Math.floor(cell / SIZE)];
}

/** Plays `cells` from `board`; null as soon as one of them is not a legal slide, so a forged move list never counts. */
export function replay(board: Board, cells: number[]): Board | null {
  let current = board;
  for (const cell of cells) {
    const next = slide(current, cell);
    if (next === current) return null;
    current = next;
  }
  return current;
}

/** A board read from outside (token, request) is only usable when it holds each tile exactly once. */
export const isBoard = (value: number[]): value is Board => value.length === SIZE * SIZE && [...value].sort((a, b) => a - b).every((tile, i) => tile === i);

/** Shuffles by playing random legal moves from the solved board, so the result is always solvable and never already solved. */
export function shuffle(random: () => number = Math.random, moves = 80): Board {
  let board = solvedBoard(), previous = -1;
  for (let i = 0; i < moves || isSolved(board); i++) {
    const blank = board.indexOf(BLANK);
    const options = neighbours(blank).filter((cell) => cell !== previous);
    const cell = options[Math.floor(random() * options.length) % options.length];
    board = slide(board, cell);
    previous = blank;
  }
  return board;
}
