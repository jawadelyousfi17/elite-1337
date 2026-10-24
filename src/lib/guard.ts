import { redirect } from 'next/navigation';
import { auth } from '@/auth';
export async function requireStudent() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  return session.user;
}
