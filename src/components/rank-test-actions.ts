'use server';

import { auth } from '@/auth';
import { answerRankTest, type RankTestChoice, type ScrollMode } from '@/lib/rank-test';

/** Saves the signed-in student's answer; the id always comes from the session, never from the client. */
export async function sendRankTestAnswer(choice: RankTestChoice): Promise<ScrollMode | null> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || (choice !== 'keep' && choice !== 'switch')) return null;
  return answerRankTest(userId, choice);
}
