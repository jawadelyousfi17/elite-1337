'use server';

import { auth } from '@/auth';
import { saveHideRequest } from '@/lib/hide-requests';
import type { HideRequestInput, HideRequestResult } from '@/lib/hide-request-rules';

/** Saves the signed-in student's request; the id and login always come from the session, never from the form. */
export async function sendHideRequest(input: HideRequestInput): Promise<HideRequestResult> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !session?.user?.login) return 'invalid';
  return saveHideRequest(userId, session.user.login, input);
}
