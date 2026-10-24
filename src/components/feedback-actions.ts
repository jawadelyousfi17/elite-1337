'use server';

import { auth } from '@/auth';
import { saveFeedback, type FeedbackInput, type FeedbackResult } from '@/lib/feedback';

/** Saves a report from the signed-in student; the id and login always come from the session, never from the form. */
export async function sendFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !session?.user?.login) return 'invalid';
  return saveFeedback(userId, session.user.login, input);
}
