import { notFound } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { ArrowUpRight, Campus, Cohort, Globe, Ranking } from '@/components/icons';
import { loadOnlineStudents } from '@/lib/admin-online';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { isAccessAdmin } from '@/lib/user-controls';
import { requireStudent } from '@/lib/guard';
import { timeAgo } from '@/lib/time';
import { getStudentProfile } from '@/lib/student-overview';
import { AdminTabs } from '../admin-tabs';
import { OnlineRefresh } from './online-refresh';

export const metadata = { title: 'Online now', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pageName = (path: string) => path === '/' ? 'Home' : path.slice(1).split('/').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' / ');
const studentStatus = (status: 'ranked' | 'blackholed' | 'unlisted') => status === 'ranked' ? 'Common Core' : status === 'blackholed' ? 'Blackholed' : 'Not in leaderboard';

/** Admin-only students actively using Elite 1337, based on the private site heartbeat. */
export default async function OnlineAdminPage() {
  const user = await requireStudent();
  if (!await isAccessAdmin(user.login)) notFound();
  const [state, ownProfile] = await Promise.all([loadOnlineStudents(), getStudentProfile(user.id).catch(() => null)]);
  const preview = process.env.NODE_ENV === 'development';
  const students = [...(state?.students ?? [])];
  const viewerId = /^\d+$/.test(user.id) ? Number(user.id) : null;
  const own = viewerId ? students.find((student) => student.id === viewerId) : null;
  if (own && ownProfile?.image) own.photo = ownProfile.image;
  if (preview && viewerId && user.login && !own) students.unshift({ id: viewerId, login: user.login, path: '/admin', lastSeen: new Date().toISOString(), photo: ownProfile?.image ?? null, displayName: null, campus: null, cohort: null, level: null, rank: null, status: 'unlisted' });
  const avatars = photoReferences(students);

  return <main className="shell of fa ao">
    <header className="of-head ao-head">
      <div><h1>Online now</h1><p>Signed-in students actively using Elite 1337 in the last five minutes.</p></div>
      <div className="ao-live"><i aria-hidden="true"/><strong>{students.length}</strong><span>online</span><OnlineRefresh/></div>
    </header>
    <AdminTabs current="/admin/online"/>
    {!state && !preview ? <p className="fa-empty">Site presence is unavailable. Check DATABASE_URL.</p> : !students.length ? <p className="fa-empty">Nobody is actively using the site right now.</p> : <ol className="ao-grid">
      {students.map((student) => <li key={student.id} className="ao-card">
        <div className="ao-avatar"><Avatar login={student.login} name={student.displayName} src={avatars[student.id]} size={58}/><i aria-label="Online"/></div>
        <div className="ao-person"><strong>{student.login}</strong><span>{student.displayName ?? '1337 student'}</span></div>
        <div className="ao-page"><Globe size={15}/><span>Viewing</span><strong>{pageName(student.path)}</strong></div>
        <div className="ao-meta">
          {student.campus && <span><Campus size={14}/>{student.campus}</span>}
          {student.cohort && <span><Cohort size={14}/>Cohort {student.cohort}</span>}
          {student.level !== null && <span><Ranking size={14}/>Level {student.level.toFixed(2)}{student.rank ? ` · #${student.rank} global` : ''}</span>}
          <span className={`is-${student.status}`}>{studentStatus(student.status)}</span>
        </div>
        <a className="ao-intra" href={`https://profile.intra.42.fr/users/${encodeURIComponent(student.login)}`} target="_blank" rel="noopener noreferrer"><img src="/assets/42-mark.webp" alt="" width={24} height={24}/><span>Open Intra</span><ArrowUpRight size={13} weight="bold"/></a>
        <small>Active {timeAgo(student.lastSeen)}</small>
      </li>)}
    </ol>}
    <p className="ao-foot">Presence refreshes once a minute while the site is visible. Only configured administrators can see these identities.{preview && <> Your own card is previewed locally even when Neon presence is unavailable.</>}</p>
  </main>;
}
