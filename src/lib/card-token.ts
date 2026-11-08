import { createHmac, timingSafeEqual } from 'node:crypto';

const signature = (userId: number) => createHmac('sha256', process.env.AUTH_SECRET!).update(`card:v1:${userId}`).digest('base64url');

/**
 * The public image link of a student's rank card. The signature is the permission: it only exists for students who
 * pressed "Share", so nothing is stored and nobody can look up another student by id. Changing AUTH_SECRET revokes every link.
 */
export function cardPath(userId: number): string | null {
  if (!Number.isInteger(userId) || userId <= 0 || !process.env.AUTH_SECRET) return null;
  return `/api/card/${userId}.svg?t=${signature(userId)}`;
}

export function validCardToken(userId: number, supplied: string): boolean {
  if (!Number.isInteger(userId) || userId <= 0 || !/^[A-Za-z0-9_-]{43}$/.test(supplied) || !process.env.AUTH_SECRET) return false;
  const expected = Buffer.from(signature(userId)), received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
