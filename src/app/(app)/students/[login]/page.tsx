import { notFound, redirect } from 'next/navigation';
import { requireStudent } from '@/lib/guard';

export const dynamic = 'force-dynamic';

/** The in-app student page is switched off for now: old links and bookmarks go to the student's 42 Intra profile. */
export default async function StudentPage({ params }: { params: Promise<{ login: string }> }) {
  await requireStudent();
  const { login } = await params;
  if (!/^[\w.-]{1,40}$/.test(login)) notFound();
  redirect(`https://profile.intra.42.fr/users/${encodeURIComponent(login)}`);
}
