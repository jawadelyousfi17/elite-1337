'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStudent } from '@/lib/guard';
import { addUserControl, clearUserControl, isAccessAdmin, setUserControl } from '@/lib/user-controls';

const loginSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{2,40}$/);
const fieldSchema = z.enum(['admin', 'hacker', 'anonymized', 'allowed']);

async function actor() {
  const user = await requireStudent();
  if (!await isAccessAdmin(user.login)) throw new Error('Not authorized');
  return user.login!.toLowerCase();
}

/** Applies one role or access toggle after rechecking admin authority on the server. */
export async function updateUserControl(form: FormData) {
  const by = await actor(), login = loginSchema.safeParse(form.get('login')), field = fieldSchema.safeParse(form.get('field'));
  const value = z.enum(['true', 'false']).safeParse(form.get('value'));
  if (!login.success || !field.success || !value.success) redirect('/admin/access?result=invalid');
  if (login.data === by && (field.data === 'admin' || field.data === 'allowed' || field.data === 'anonymized')) redirect('/admin/access?result=self');
  const saved = await setUserControl(login.data, field.data, value.data === 'true', by);
  redirect(`/admin/access?result=${saved ? 'saved' : 'unavailable'}`);
}

/** Starts managing a login without granting anything until the admin selects a setting. */
export async function addManagedUser(form: FormData) {
  const by = await actor(), login = loginSchema.safeParse(form.get('login'));
  if (!login.success) redirect('/admin/access?result=invalid');
  const saved = await addUserControl(login.data, by);
  redirect(`/admin/access?result=${saved ? 'added' : 'unavailable'}`);
}

/** Clears overrides for a login; environment-defined values become effective again. */
export async function removeManagedUser(form: FormData) {
  const by = await actor(), login = loginSchema.safeParse(form.get('login'));
  if (!login.success) redirect('/admin/access?result=invalid');
  if (login.data === by) redirect('/admin/access?result=self');
  const removed = await clearUserControl(login.data);
  redirect(`/admin/access?result=${removed ? 'removed' : 'unavailable'}`);
}
