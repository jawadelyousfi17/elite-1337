'use server';

import { z } from 'zod';
import { auth, signIn } from '@/auth';
import { isSolved, replay, shuffle, type Board, type Solver } from '@/lib/puzzle';
import { saveSolve, solverStanding, topSolvers } from '@/lib/puzzle-solvers';
import { readPuzzle, signPuzzle } from '@/lib/puzzle-token';
import { withTimeout } from '@/lib/timeout';
import { userControl } from '@/lib/user-controls';

export type PuzzleDeal = { board: Board; token: string; me: string; top: Solver[] | null } | null;
export type PuzzleResult = { best: { moves: number; ms: number } | null; standing: { place: number; total: number } | null; top: Solver[] | null } | null;

const solveSchema = z.object({ token: z.string().max(80), cells: z.array(z.number().int().min(0).max(8)).min(1).max(1000) });

// The student comes from the session only; null for visitors, who play without being ranked.
async function student() {
  const session = await auth();
  const userId = Number(session?.user?.id), login = session?.user?.login;
  return Number.isSafeInteger(userId) && userId > 0 && login ? { userId, login } : null;
}

/** Deals a signed board to a signed-in student with the current top solvers; null for visitors. */
export async function dealPuzzle(): Promise<PuzzleDeal> {
  const me = await student();
  if (!me) return null;
  const board = shuffle(), token = signPuzzle(me.userId, board);
  if (!token) return null;
  return { board, token, me: me.login, top: await withTimeout(topSolvers(10), 2500, null) };
}

/** Replays the moves on the dealt board and saves the solve only when they really solve it. */
export async function submitPuzzle(input: { token: string; cells: number[] }): Promise<PuzzleResult> {
  const me = await student(), parsed = solveSchema.safeParse(input);
  if (!me || !parsed.success) return null;
  const dealt = readPuzzle(me.userId, parsed.data.token);
  const end = dealt && replay(dealt.board, parsed.data.cells);
  if (!dealt || !end || !isSolved(end)) return null;
  // Students who asked to be removed can play, but are never written to the list.
  const control = await withTimeout(userControl(me.login).catch(() => null), 1500, null);
  if (control?.anonymized) return { best: null, standing: null, top: await withTimeout(topSolvers(10), 2500, null) };
  const best = await withTimeout(saveSolve(me.userId, me.login, parsed.data.cells.length, Date.now() - dealt.issuedAt), 2500, null);
  // Read after the save so the place already counts this solve.
  const [standing, top] = await Promise.all([withTimeout(solverStanding(me.userId), 2500, null), withTimeout(topSolvers(10), 2500, null)]);
  return { best, standing, top };
}

/** Signs a visitor in with 42 and brings them straight back to the puzzle. */
export async function signInToSolve() {
  await signIn('42', { redirectTo: '/?puzzle=1' });
}
