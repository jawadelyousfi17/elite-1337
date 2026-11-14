import { createHmac, timingSafeEqual } from 'node:crypto';
import { isBoard, type Board } from './puzzle';

// A dealt board stays playable for two hours; older tokens are refused so they cannot be farmed later.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const TOKEN = /^([0-8]{9})\.(\d{10,14})\.([A-Za-z0-9_-]{43})$/;

const signature = (userId: number, board: string, issuedAt: number) =>
  createHmac('sha256', process.env.AUTH_SECRET!).update(`puzzle:v1:${userId}:${board}:${issuedAt}`).digest('base64url');

/** Signs the board the server dealt to one student, so a solve can only count from a board the student did not pick. */
export function signPuzzle(userId: number, board: Board, issuedAt = Date.now()): string | null {
  if (!Number.isInteger(userId) || userId <= 0 || !process.env.AUTH_SECRET) return null;
  const cells = board.join('');
  return `${cells}.${issuedAt}.${signature(userId, cells, issuedAt)}`;
}

/** The dealt board and when it was dealt, or null when the token is forged, someone else's or too old. */
export function readPuzzle(userId: number, token: string, now = Date.now()): { board: Board; issuedAt: number } | null {
  const match = TOKEN.exec(token);
  if (!match || !Number.isInteger(userId) || userId <= 0 || !process.env.AUTH_SECRET) return null;
  const [, cells, stamp, supplied] = match, issuedAt = Number(stamp), board = [...cells].map(Number);
  if (!isBoard(board) || issuedAt > now || now - issuedAt > MAX_AGE_MS) return null;
  const expected = Buffer.from(signature(userId, cells, issuedAt)), received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received) ? { board, issuedAt } : null;
}
