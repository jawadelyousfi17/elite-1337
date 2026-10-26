import Link from 'next/link';
import { KiwiNote } from '@/components/kiwi-guide';
import { Suspense } from 'react';
import { CorrectionsLoading } from './corrections-loading';
import { z } from 'zod';
import { Avatar } from '@/components/avatar';
import { ArrowUpRight, Campus, Clock3, Corrections } from '@/components/icons';
import { FilterShell } from '@/components/filter-shell';
import { matchesSearch } from '@/lib/search';
import { DatasetState } from '@/components/dataset-state';
import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { CORRECTION_WINDOW_DAYS, loadPendingCorrections } from '@/lib/corrections';
import { getStudentProfile } from '@/lib/student-overview';
import { avatarReferencesOrEmpty } from '@/lib/avatars/storage';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/time';

export const metadata = { title: 'Waiting for Correction' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pastels = ['var(--pastel-1)', 'var(--pastel-2)', 'var(--pastel-3)', 'var(--pastel-4)', 'var(--pastel-5)', 'var(--pastel-6)'];
const params = z.object({ campus: z.coerce.number().int().positive().optional(), project: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(), q: z.string().trim().max(40).optional() });

function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const raw = params.safeParse(await searchParams);
  const key = raw.success ? `${raw.data.campus ?? ''}|${raw.data.project ?? ''}|${raw.data.q ?? ''}` : 'default';
  return <Suspense key={key} fallback={<CorrectionsLoading/>}><CorrectionsBody userId={user.id} raw={raw}/></Suspense>;
}

async function CorrectionsBody({ userId, raw }: { userId: string; raw: ReturnType<typeof params.safeParse> }) {
  const user = { id: userId };
  const [state, profile] = await Promise.all([loadRankingDataset(), getStudentProfile(user.id).catch(() => null)]);
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const dataset = state.data;
  const own = dataset.students.find((student) => String(student.id) === user.id);
  const valid = new Set(dataset.campuses.map((campus) => campus.id));
  const defaultCampus = profile?.campus_users.find((entry) => entry.is_primary && valid.has(entry.campus_id))?.campus_id ?? own?.campusIds[0] ?? dataset.campuses[0]?.id;
  const campus = raw.success && raw.data.campus && valid.has(raw.data.campus) ? raw.data.campus : defaultCampus;
  const project = raw.success ? raw.data.project : undefined;
  const q = raw.success && raw.data.q ? raw.data.q : undefined;
  const pending = campus ? await loadPendingCorrections(campus) : { status: 'unavailable' as const };
  const students = new Map(dataset.students.map((student) => [student.id, student]));
  const active = pending.status === 'ready' ? pending.rows.filter((row) => students.has(row.userId)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) : [];
  const projects = [...active.reduce((counts, row) => counts.set(row.projectSlug, { name: row.project, count: (counts.get(row.projectSlug)?.count ?? 0) + 1 }), new Map<string, { name: string; count: number }>())].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name));
  const shown = active.filter((row) => (!project || row.projectSlug === project) && (!q || matchesSearch(q, [row.login, students.get(row.userId)?.displayName, row.project])));
  const avatars = photoReferences(shown.map((row) => ({ id: row.userId, photo: students.get(row.userId)?.photo })), await avatarReferencesOrEmpty([...new Set(shown.slice(0, 100).map((row) => row.userId))]));
  const link = (change: { campus?: number; project?: string; q?: string }) => { const query = new URLSearchParams(); const next = { campus, project, q, ...change }; if (next.campus) query.set('campus', String(next.campus)); if (next.project) query.set('project', next.project); if (next.q) query.set('q', next.q); return `/corrections?${query}`; };
  const projectName = project ? projects.find(([slug]) => slug === project)?.[1].name ?? project : null;

  return <main className="shell pl pc">
    <aside className="pl-side">
      <section className="pc-head">
        <h1><Corrections size={28}/> Waiting for correction</h1>
        <p><strong>{shown.length}</strong> {shown.length === 1 ? 'project' : 'projects'} at {campus ? campusName(dataset, campus) : 'this campus'}{projectName && <> · {projectName}</>}{q && <> matching “{q}”</>} · last {CORRECTION_WINDOW_DAYS} days{pending.status === 'ready' && <> · updated {timeAgo(pending.fetchedAt)}</>}</p>
      </section>
      <FilterShell action="/corrections" hidden={{ ...(campus ? { campus: String(campus) } : {}), ...(project ? { project } : {}) }} q={q} placeholder="Login, name or project" clearHref={link({ q: undefined })} activeCount={project ? 1 : 0} defaultOpen={false}>
        <div className="pl-groups">
          <div className="pl-chip-group" role="group" aria-label="Campus">
            <span className="pl-chip-label"><Campus size={17}/>Campus</span>
            <div className="pl-chips">{dataset.campuses.map((item) => <Link key={item.id} href={link({ campus: item.id, project: undefined })} className="pl-chip is-lilac" data-active={item.id === campus || undefined} aria-current={item.id === campus ? 'true' : undefined}>{item.name}</Link>)}</div>
          </div>
          {projects.length > 0 && <div className="pl-chip-group" role="group" aria-label="Project">
            <span className="pl-chip-label"><Corrections size={17}/>Project{projectName && <Link className="pc-clear" href={link({ project: undefined })}>Clear</Link>}</span>
            <div className="pc-projects">
              <Link href={link({ project: undefined })} className="pc-project-row" data-active={!project || undefined}><span>All projects</span><b>{active.length}</b></Link>
              {projects.map(([slug, info]) => <Link key={slug} href={link({ project: slug })} className="pc-project-row" data-active={project === slug || undefined} title={info.name}><span>{info.name}</span><b>{info.count}</b></Link>)}
            </div>
          </div>}
        </div>
      </FilterShell>
    </aside>

    <section className="pl-list" aria-label="Pending corrections">
      {pending.status !== 'ready' ? <div className="pl-empty"><Clock3 size={26}/><h2>{pending.status === 'rate-limited' ? '42 API limit reached' : pending.status === 'incomplete' ? 'The 42 API returned an incomplete list' : 'Pending corrections are unavailable'}</h2><p>Try again in a few minutes.</p></div>
        : shown.length ? <ol className="pl-rows">{shown.map((row, index) => {
          const student = students.get(row.userId)!;
          const mine = String(row.userId) === user.id;
          return <li key={row.id}><Link href={`https://profile.intra.42.fr/users/${encodeURIComponent(row.login)}`} target="_blank" rel="noopener noreferrer" className={cn('pl-row', mine && 'is-mine')} style={{ '--pastel': pastels[index % pastels.length] } as React.CSSProperties}>
            <span className="pl-avatar"><Avatar login={row.login} src={avatars[row.userId]} size={45}/></span>
            <span className="pl-copy"><strong>{row.login}{mine && <em>You</em>}<span className="pl-ext" aria-hidden="true"><ArrowUpRight size={14} weight="bold"/></span><span className="sr-only"> (opens 42 Intra in a new tab)</span></strong><span><b>Level {student.level.toFixed(2)}</b> · {student.commonCoreEntryYear ?? "?"}</span></span>
            <span className="pc-project"><b>{row.project}</b><small><Clock3 size={12}/> {ago(row.updatedAt)}{row.attempt && row.attempt > 1 ? ` · try ${row.attempt}` : ''}</small></span>
          </Link></li>;
        })}</ol> : <div className="pl-empty"><KiwiNote><h2>Nothing waiting for correction</h2><p>Everyone is corrected. Kiwi approves.</p></KiwiNote></div>}
    </section>
  </main>;
}
