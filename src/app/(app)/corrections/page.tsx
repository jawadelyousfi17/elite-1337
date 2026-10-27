import Link from 'next/link';
import { KiwiNote } from '@/components/kiwi-guide';
import { Suspense } from 'react';
import { CorrectionsLoading } from './corrections-loading';
import { z } from 'zod';
import { Campus, Check, Clock3, Cohort, Corrections } from '@/components/icons';
import { ScrollRow } from '@/components/scroll-row';
import { CorrectionRows } from '@/components/correction-rows';
import { FilterShell } from '@/components/filter-shell';
import { matchesSearch } from '@/lib/search';
import { DatasetState } from '@/components/dataset-state';
import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { CORRECTION_WINDOW_DAYS, loadPendingCorrections } from '@/lib/corrections';
import { RECENT_VALIDATED_DAYS, loadRecentValidated } from '@/lib/recent-validated';
import { getStudentProfile } from '@/lib/student-overview';
import { avatarReferencesOrEmpty } from '@/lib/avatars/storage';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/time';

export const metadata = { title: 'Waiting for Correction' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const params = z.object({ campus: z.coerce.number().int().positive().optional(), project: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(), q: z.string().trim().max(40).optional(), tab: z.enum(['validated']).optional().catch(undefined), cohort: z.string().regex(/^\d{4}$/).optional().catch(undefined) });
/** One row in either tab: waiting projects carry their try number, validated ones their mark. */
type Item = { id: number; userId: number; login: string; project: string; projectSlug: string; at: string; attempt?: number | null; mark?: number | null };


export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const raw = params.safeParse(await searchParams);
  const key = raw.success ? `${raw.data.tab ?? ''}|${raw.data.campus ?? ''}|${raw.data.cohort ?? ''}|${raw.data.project ?? ''}|${raw.data.q ?? ''}` : 'default';
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
  const validatedTab = raw.success && raw.data.tab === 'validated';
  const cohort = raw.success ? raw.data.cohort : undefined;
  const pending = !campus ? { status: 'unavailable' as const } : validatedTab
    ? await loadRecentValidated(campus).then((state) => state.status === 'ready' ? { ...state, rows: state.rows.map((row): Item => ({ ...row })) } : state)
    : await loadPendingCorrections(campus).then((state) => state.status === 'ready' ? { ...state, rows: state.rows.map((row): Item => ({ ...row, at: row.updatedAt })) } : state);
  const students = new Map(dataset.students.map((student) => [student.id, student]));
  const active = pending.status === 'ready' ? pending.rows.filter((row) => students.has(row.userId)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];
  // Promo = Common Core entry year; the chips list only years that have rows in this tab.
  const cohorts = [...new Set(active.map((row) => students.get(row.userId)?.commonCoreEntryYear).filter((year): year is string => !!year))].sort().reverse();
  const inCohort = cohort ? active.filter((row) => students.get(row.userId)?.commonCoreEntryYear === cohort) : active;
  const projects = [...inCohort.reduce((counts, row) => counts.set(row.projectSlug, { name: row.project, count: (counts.get(row.projectSlug)?.count ?? 0) + 1 }), new Map<string, { name: string; count: number }>())].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name));
  const shown = inCohort.filter((row) => (!project || row.projectSlug === project) && (!q || matchesSearch(q, [row.login, students.get(row.userId)?.displayName, row.project])));
  const avatars = photoReferences(shown.map((row) => ({ id: row.userId, photo: students.get(row.userId)?.photo })), await avatarReferencesOrEmpty([...new Set(shown.map((row) => row.userId))]));
  const link = (change: { campus?: number; cohort?: string; project?: string; q?: string; tab?: 'validated' | null }) => { const query = new URLSearchParams(); const next = { campus, cohort, project, q, tab: validatedTab ? 'validated' : null, ...change }; if (next.tab) query.set('tab', next.tab); if (next.campus) query.set('campus', String(next.campus)); if (next.cohort) query.set('cohort', next.cohort); if (next.project) query.set('project', next.project); if (next.q) query.set('q', next.q); return `/corrections?${query}`; };
  const projectName = project ? projects.find(([slug]) => slug === project)?.[1].name ?? project : null;

  return <main className="shell pl pc">
    <aside className="pl-side">
      <section className="pc-head">
        <nav className="fa-tabs pc-tabs" aria-label="Corrections view">
          <Link href={link({ tab: null, project: undefined })} className={cn('fa-tab', !validatedTab && 'is-picked')} aria-current={!validatedTab ? 'page' : undefined}>Waiting</Link>
          <Link href={link({ tab: 'validated', project: undefined })} className={cn('fa-tab', validatedTab && 'is-picked')} aria-current={validatedTab ? 'page' : undefined}>Recently validated</Link>
        </nav>
        <h1>{validatedTab ? <><Check size={28}/> Recently validated</> : <><Corrections size={28}/> Waiting for correction</>}</h1>
        <p><strong>{shown.length}</strong> {shown.length === 1 ? 'project' : 'projects'}{validatedTab && ' validated'} at {campus ? campusName(dataset, campus) : 'this campus'}{cohort && <> · promo {cohort}</>}{projectName && <> · {projectName}</>}{q && <> matching “{q}”</>} · last {validatedTab ? RECENT_VALIDATED_DAYS : CORRECTION_WINDOW_DAYS} days{pending.status === 'ready' && <> · updated {timeAgo(pending.fetchedAt)}</>}</p>
      </section>
      <FilterShell action="/corrections" hidden={{ ...(validatedTab ? { tab: 'validated' } : {}), ...(campus ? { campus: String(campus) } : {}), ...(cohort ? { cohort } : {}), ...(project ? { project } : {}) }} q={q} placeholder="Login, name or project" clearHref={link({ q: undefined })} activeCount={(project ? 1 : 0) + (cohort ? 1 : 0)} defaultOpen={false}>
        <div className="pl-groups">
          <div className="pl-chip-group" role="group" aria-label="Campus">
            <span className="pl-chip-label"><Campus size={17}/>Campus</span>
            <div className="pl-chips">{dataset.campuses.map((item) => <Link key={item.id} href={link({ campus: item.id, project: undefined })} className="pl-chip is-lilac" data-active={item.id === campus || undefined} aria-current={item.id === campus ? 'true' : undefined}>{item.name}</Link>)}</div>
          </div>
          {cohorts.length > 0 && <div className="pl-chip-group" role="group" aria-label="Promo">
            <span className="pl-chip-label"><Cohort size={17}/>Promo</span>
            <ScrollRow className="pl-chips is-scroll">
              <Link href={link({ cohort: undefined, project: undefined })} className="pl-chip is-yellow" data-active={!cohort || undefined} aria-current={!cohort ? 'true' : undefined}>All</Link>
              {cohorts.map((year) => <Link key={year} href={link({ cohort: year, project: undefined })} className="pl-chip is-yellow" data-active={cohort === year || undefined} aria-current={cohort === year ? 'true' : undefined}>{year}</Link>)}
            </ScrollRow>
          </div>}
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

    <section className="pl-list" aria-label={validatedTab ? 'Recently validated projects' : 'Pending corrections'}>
      {pending.status !== 'ready' ? <div className="pl-empty"><Clock3 size={26}/><h2>{pending.status === 'rate-limited' ? '42 API limit reached' : pending.status === 'incomplete' ? 'The 42 API returned an incomplete list' : 'Pending corrections are unavailable'}</h2><p>Try again in a few minutes.</p></div>
        : shown.length ? <CorrectionRows validated={validatedTab} rows={shown.map((row) => { const student = students.get(row.userId)!; return { id: row.id, userId: row.userId, login: row.login, mine: String(row.userId) === user.id, level: student.level, year: student.commonCoreEntryYear, project: row.project, at: row.at, src: avatars[row.userId] ?? null, mark: row.mark, attempt: row.attempt }; })}/> : <div className="pl-empty"><KiwiNote>{validatedTab ? <><h2>Nothing validated lately</h2><p>No project was validated here in the last {RECENT_VALIDATED_DAYS} days.</p></> : <><h2>Nothing waiting for correction</h2><p>Everyone is corrected. Kiwi approves.</p></>}</KiwiNote></div>}
    </section>
  </main>;
}
