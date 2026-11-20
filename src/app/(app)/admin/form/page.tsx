import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { isAccessAdmin } from '@/lib/user-controls';
import { ApplicantsBoard } from '@/components/applicants-board';
import { AdminTabs } from '../admin-tabs';

export const metadata = { title: 'Wedesign form', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Wedesign applications review: the admin imports the Tally CSV; statuses and roles stay in their own browser. */
export default async function FormAdminPage() {
  const user = await requireStudent();
  if (!await isAccessAdmin(user.login)) notFound();
  return <main className="shell of fa ap">
    <header className="of-head"><div><h1>Wedesign form</h1><p>Import the Tally export, then mark each applicant and give them roles. Everything stays in this browser.</p></div></header>
    <AdminTabs current="/admin/form"/>
    <ApplicantsBoard/>
  </main>;
}
