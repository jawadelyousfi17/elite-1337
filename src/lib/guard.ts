import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { userControl } from './user-controls';
/** Requires a signed-in student whose access has not been revoked by an administrator. */
export async function requireStudent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const control = await userControl(session.user.login);
  if (control?.anonymized) redirect('/removed');
  if (control && !control.allowed) redirect('/denied?reason=blocked');
  return session.user;
}
