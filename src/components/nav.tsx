import { Suspense } from 'react';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { Announcements } from '@/components/announcements';
import { GitHubStars } from '@/components/github-stars';
import { NavLinks } from '@/components/nav-links';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavRank, type ViewerRanks } from '@/components/nav-rank';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { cohortRank } from '@/lib/ranking';
import { getStudentProfile } from '@/lib/student-overview';
import { intraPhotoUrl } from '@/lib/avatars/intra-photo';
import { isAccessAdmin } from '@/lib/user-controls';

async function viewerRanks(): Promise<ViewerRanks | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [state, profile] = await Promise.all([loadRankingDataset(), getStudentProfile(session.user.id).catch(() => null)]);
  if (state.status !== 'ready') return null;
  const dataset = state.data;
  const own = dataset.students.find((student) => String(student.id) === session.user.id);
  if (!own) return null;
  const campus = profile?.campus_users.find((entry) => entry.is_primary && own.campusIds.includes(entry.campus_id))?.campus_id ?? own.campusIds[0];
  return {
    login: own.login, photo: intraPhotoUrl(own.id, own.photo), level: own.level,
    cohort: cohortRank(dataset.students, own, campus), cohortLabel: own.commonCoreCohort ? `Cohort ${own.commonCoreCohort}` : 'Cohort',
    campus: campus ? own.campusRanks[campus] ?? null : null, campusLabel: campus ? campusName(dataset, campus) : 'Campus', global: own.globalRank,
  };
}

async function logout() {
  'use server';
  await signOut({ redirectTo: '/' });
}

/** The rank pill streams in on its own: a cold rankings download must never hold up the page under it. */
async function RankedChip({ login, admin }: { login: string; admin: boolean }) {
  return <NavRank ranks={await viewerRanks()} login={login} logout={logout} admin={admin}/>;
}

export async function Nav({ loggedIn = false }: { loggedIn?: boolean }) {
  const session = loggedIn ? await auth() : null;
  const login = session?.user?.login ?? 'You';
  const admin = await isAccessAdmin(session?.user?.login);
  return <>
    <header className="shell nav">
      <Link className="brand" href="/" aria-label="Elite 1337 home"><img src="/assets/elite-1337-icy.webp" alt="Elite 1337" width={680} height={180}/></Link>
      {loggedIn ? <>
        <nav className="navlinks" aria-label="Main navigation"><NavLinks variant="top"/></nav>
        <div className="nav-actions">
        <div className="nav-tools"><Announcements/><ThemeToggle/><GitHubStars variant="nav"/></div>
        <Suspense fallback={<NavRank ranks={null} login={login} logout={logout} admin={admin}/>}><RankedChip login={login} admin={admin}/></Suspense>
        </div>
      </> : <nav className="navlinks" aria-label="Main navigation"><Link href="/">Home</Link></nav>}
    </header>
    {loggedIn && <nav className="bottom-nav" aria-label="Main navigation"><NavLinks variant="bottom"/></nav>}
  </>;
}
