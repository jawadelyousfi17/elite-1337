import Link from 'next/link';
import { KiwiNote } from '@/components/kiwi-guide';
import { Suspense } from 'react';
import { CorrectionsLoading } from './corrections-loading';
import { z } from 'zod';
import { cohortSchema } from '@/lib/cohorts';
import { Campus, Check, Clock3, Cohort, Corrections, LockKeyhole, X } from '@/components/icons';
import { ScrollRow } from '@/components/scroll-row';
import { CorrectionsResults } from '@/components/corrections-results';
import { CorrectionsSearch } from '@/components/corrections-search';
import { matchesSearch } from '@/lib/search';
import { FilterShell } from '@/components/filter-shell';
import { DatasetState } from '@/components/dataset-state';
import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { CORRECTION_WINDOW_DAYS, loadPendingCorrections } from '@/lib/corrections';
import { RECENT_MARK_WINDOWS, RECENT_VALIDATED_DAYS, loadRecentMarks } from '@/lib/recent-validated';
import { LOCKED_TEAM_DAYS, loadLockedTeams } from '@/lib/locked-teams';
import { getStudentProfile } from '@/lib/student-overview';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/time';
import { PROJECT_SLUG, groupTeams, mergeInternshipSteps } from '@/lib/correction-teams';

export const metadata = { title: 'Waiting for Correction' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const params = z.object({ campus: z.coerce.number().int().positive().optional(), project: z.string().regex(PROJECT_SLUG).optional().catch(undefined), q: z.string().trim().max(40).optional(), tab: z.enum(['validated', 'failed', 'locked']).optional().catch(undefined), d: z.enum(['14', '30', '60']).optional().catch(undefined), cohort: cohortSchema.optional().catch(undefined) });
/** One row in either tab: waiting projects carry their try number, validated ones their mark. */
type Item = { id: number; userId: number; login: string; project: string; projectSlug: string; at: string; teamId: number | null; attempt?: number | null; mark?: number | null; steps?: string[] };


export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const raw = params.safeParse(await searchParams);
  const key = raw.success ? `${raw.data.tab ?? ''}|${raw.data.d ?? ''}|${raw.data.campus ?? ''}|${raw.data.cohort ?? ''}|${raw.data.project ?? ''}|${raw.data.q ?? ''}` : 'default';
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
  const tab = raw.success ? raw.data.tab ?? null : null, validatedTab = tab === 'validated', failedTab = tab === 'failed', lockedTab = tab === 'locked', markTab = validatedTab || failedTab;
  // Validated and failed offer 14, 30 and 60 days; locked teams 30 and 60 (the list already covers 60); waiting is a live queue.
  const windows: number[] = lockedTab ? [30, 60] : markTab ? [...RECENT_MARK_WINDOWS] : [];
  const asked = raw.success && raw.data.d && windows.includes(Number(raw.data.d)) ? Number(raw.data.d) : undefined;
  const days = asked ?? (lockedTab ? LOCKED_TEAM_DAYS : markTab ? RECENT_VALIDATED_DAYS : CORRECTION_WINDOW_DAYS);
  const cohort = raw.success ? raw.data.cohort : undefined;
  const pending = !campus ? { status: 'unavailable' as const } : markTab
    ? await loadRecentMarks(campus, days).then((state) => state.status === 'ready' ? { ...state, rows: (failedTab ? state.failed : state.validated).map((row): Item => ({ ...row })) } : state)
    : lockedTab ? await loadLockedTeams(campus).then((state) => state.status === 'ready' ? { ...state, rows: state.rows.filter((row) => Date.parse(row.at) >= Date.now() - days * 86_400_000).map((row): Item => ({ ...row })) } : state)
    : await loadPendingCorrections(campus).then((state) => state.status === 'ready' ? { ...state, rows: state.rows.map((row): Item => ({ ...row, at: row.updatedAt })) } : state);
  const students = new Map(dataset.students.map((student) => [student.id, student]));
  const active = pending.status === 'ready' ? pending.rows.filter((row) => students.get(row.userId)?.campusIds.includes(campus!)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) : [];
  // Only promos with rows in this tab need a filter chip.
  const cohorts = [...new Set(active.map((row) => students.get(row.userId)?.commonCoreCohort).filter((year): year is string => !!year))].sort().reverse();
  // A group project pushed by a team is one entry: counts and filters work on teams, a team matches if any member does.
  const teams = groupTeams(mergeInternshipSteps(active));
  const inCohort = cohort ? teams.filter((team) => team.some((row) => students.get(row.userId)?.commonCoreCohort === cohort)) : teams;
  const projects = [...inCohort.reduce((counts, [row]) => counts.set(row.projectSlug, { name: row.project, count: (counts.get(row.projectSlug)?.count ?? 0) + 1 }), new Map<string, { name: string; count: number }>())].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name));
  const picked = inCohort.filter((team) => !project || team[0].projectSlug === project);
  const shown = picked.filter((team) => !q || team.some((row) => matchesSearch(q, [row.login, students.get(row.userId)?.displayName, row.project, ...row.steps ?? []])));
  // The search box suggests students and projects from what is loaded; choosing one opens the page filtered by it.
const avatars = photoReferences(picked.flat().map((row) => ({ id: row.userId, photo: students.get(row.userId)?.photo })));
  const suggestStudents = [...new Map(picked.flat().map((row) => [row.userId, [row.login, students.get(row.userId)?.displayName ?? null, avatars[row.userId] ?? null] as [string, string | null, string | null]])).values()];
  const suggestProjects = projects.map(([slug, info]): [string, string, number] => [slug, info.name, info.count]);
  const link = (change: { campus?: number; cohort?: string; project?: string; q?: string; tab?: 'validated' | 'failed' | 'locked' | null; days?: number }) => { const query = new URLSearchParams(); const next = { campus, cohort, project, q, tab, days: asked, ...change }; if (next.tab) query.set('tab', next.tab); if (next.days) query.set('d', String(next.days)); if (next.campus) query.set('campus', String(next.campus)); if (next.cohort) query.set('cohort', next.cohort); if (next.project) query.set('project', next.project); if (next.q) query.set('q', next.q); return `/corrections?${query}`; };
  const projectName = project ? projects.find(([slug]) => slug === project)?.[1].name ?? project : null;

  return <main className="shell pl pc">
    <aside className="pl-side">
      <section className="pc-head">
        <nav className="fa-tabs pc-tabs" aria-label="Corrections view">
          <Link href={link({ tab: null, project: undefined, days: undefined })} className={cn('fa-tab is-waiting', !tab && 'is-picked')} aria-current={!tab ? 'page' : undefined}><Corrections size={18}/>Waiting</Link>
          <Link href={link({ tab: 'validated', project: undefined, days: undefined })} className={cn('fa-tab is-validated', validatedTab && 'is-picked')} aria-current={validatedTab ? 'page' : undefined}><Check size={18}/>Validated</Link>
          <Link href={link({ tab: 'failed', project: undefined, days: undefined })} className={cn('fa-tab is-failed', failedTab && 'is-picked')} aria-current={failedTab ? 'page' : undefined}><X size={18}/>Failed</Link>
          <Link href={link({ tab: 'locked', project: undefined, days: undefined })} className={cn('fa-tab is-locked', lockedTab && 'is-picked')} aria-current={lockedTab ? 'page' : undefined}><LockKeyhole size={18}/>Locked</Link>
        </nav>
        {/* The active tab already names the view; the heading stays for screen readers. */}
        <h1 className="sr-only">{validatedTab ? 'Validated projects' : failedTab ? 'Failed projects' : lockedTab ? 'Locked teams' : 'Waiting for correction'}</h1>
      </section>
      <FilterShell action="/corrections" hidden={{ ...(tab ? { tab } : {}), ...(asked ? { d: String(asked) } : {}), ...(campus ? { campus: String(campus) } : {}), ...(cohort ? { cohort } : {}), ...(project ? { project } : {}) }} q={q} placeholder="Login, name or project" clearHref={link({ q: undefined })} activeCount={(project ? 1 : 0) + (cohort ? 1 : 0)} defaultOpen={false} field={<CorrectionsSearch action="/corrections" base={{ ...(tab ? { tab } : {}), ...(asked ? { d: String(asked) } : {}), ...(campus ? { campus: String(campus) } : {}), ...(cohort ? { cohort } : {}), ...(project ? { project } : {}) }} initial={q ?? ''} placeholder="Login, name or project" clearHref={link({ q: undefined })} students={suggestStudents} projects={suggestProjects}/>}>
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
              <Link href={link({ project: undefined })} className="pc-project-row" data-active={!project || undefined}><span>All projects</span><b>{teams.length}</b></Link>
              {projects.map(([slug, info]) => <Link key={slug} href={link({ project: slug })} className="pc-project-row" data-active={project === slug || undefined} title={info.name}><span>{info.name}</span><b>{info.count}</b></Link>)}
            </div>
          </div>}
        </div>
      </FilterShell>
    </aside>

    <section className="pl-list" aria-label={validatedTab ? 'Recently validated projects' : failedTab ? 'Recently failed projects' : lockedTab ? 'Recently locked teams' : 'Pending corrections'}>
      <CorrectionsResults mode={tab ?? 'waiting'}
        scope={{ campus: campus ? campusName(dataset, campus) : 'This campus', days, periods: windows.map((window) => ({ days: window, href: link({ days: window }) })), cohort, project: projectName, updated: pending.status === 'ready' ? timeAgo(pending.fetchedAt) : null }}
        problem={pending.status !== 'ready' ? <div className="pl-empty"><Clock3 size={26}/><h2>{pending.status === 'rate-limited' ? '42 API limit reached' : pending.status === 'incomplete' ? 'The 42 API returned an incomplete list' : lockedTab ? 'Locked teams are unavailable' : 'Pending corrections are unavailable'}</h2><p>Try again in a few minutes.</p></div> : null}
        rows={shown.map(([first, ...rest]) => ({ id: first.id, project: first.project, projectSlug: first.projectSlug, at: first.at, mark: first.mark, attempt: first.attempt, steps: first.steps, members: [first, ...rest].map((row) => { const student = students.get(row.userId)!; return { userId: row.userId, login: row.login, name: student.displayName, mine: String(row.userId) === user.id, level: student.level, year: student.commonCoreCohort, src: avatars[row.userId] ?? null }; }) }))}
        empty={<div className="pl-empty"><KiwiNote>{q ? <><h2>No match</h2><p>Nothing here matches “{q}”. Try a login, a name or a project.</p></> : validatedTab ? <><h2>Nothing validated lately</h2><p>No project was validated here in the last {days} days.</p></> : failedTab ? <><h2>Nothing failed lately</h2><p>No project was failed here in the last {days} days.</p></> : lockedTab ? <><h2>No new teams</h2><p>No team locked a group project here in the last {days} days.</p></> : <><h2>Nothing waiting for correction</h2><p>Everyone is corrected. Kiwi approves.</p></>}</KiwiNote></div>}/>
    </section>
  </main>;
}
