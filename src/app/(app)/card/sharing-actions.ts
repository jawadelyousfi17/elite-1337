'use server';
import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { changeCardSharing } from '@/lib/card-sharing';

/** Only the signed-in owner may disable or regenerate their card. */
export async function updateCardSharing(form: FormData) {
  const user = await requireStudent();
  const action = form.get('action');
  if (action !== 'disable' && action !== 'regenerate') redirect('/card?sharing=invalid');
  try { await changeCardSharing(Number(user.id), action === 'regenerate'); }
  catch { redirect('/card?sharing=unavailable'); }
  redirect('/card?sharing=saved');
}
