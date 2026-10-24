'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { isCat, saveCatVote } from '@/lib/cat-votes';

/** Records the signed-in student's pick; the student id always comes from the session, never from the form. */
export async function voteForCat(cat: string): Promise<boolean> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !isCat(cat)) return false;
  const saved = await saveCatVote(userId, cat);
  if (saved) { revalidatePath('/stats'); revalidatePath('/'); }
  return saved;
}
