import { StickySide } from '@/components/sticky-side';
import { KiwiNote } from '@/components/kiwi-guide';
import Link from 'next/link';
import { AlumniBadge } from '@/components/alumni-badge';
import { FrozenBadge } from '@/components/frozen-badge';
import { Campus, ChevronLeft, ChevronRight, Cohort, Hourglass, Reverse, RotateCcw, X } from '@/components/icons';
import { Avatar } from '@/components/avatar';
import { FilterShell } from '@/components/filter-shell';
import { ScrollRow } from '@/components/scroll-row';
import { IntraButton, RankRow, appHref, pastel } from '@/components/rank-row';
import { InfiniteRanks } from '@/components/infinite-ranks';
import { RankTestPrompt } from '@/components/rank-test-prompt';
import { requireStudent } from '@/lib/guard';
import { loadRankingDataset } from '@/lib/dataset';
import { DatasetState } from '@/components/dataset-state';
import { getStudentProfile } from '@/lib/student-overview';
import { ALL, avatarsFor, leaderboardHref as href, listPage, resolveFilters, rowData, type Filters, type Ranked } from '@/lib/leaderboard-view';
import { visitRankTest } from '@/lib/rank-test';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/time';
import { pageItems } from '@/lib/pagination';

export const metadata = { title: 'Student Rankings' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function Leaderboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const raw = await searchParams;
  const [state, profile, test] = await Promise.all([loadRankingDataset(), getStudentProfile(user.id).catch(() => null), visitRankTest(Number(user.id), user.login)]);
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const dataset = state.data;
  const { filters, own, defaultCampus, defaultCohort } = resolveFilters(raw, dataset, profile, user.id);
  // A/B test: without the database everyone keeps page numbers and nobody is asked.
  const infinite = test?.mode === 'infinite';
  if (infinite) filters.page = 1;
  const view = listPage(dataset, filters, own?.id);
  const { blackholedMode, alumniMode, frozenMode, total, page, pages, podium, showWinner } = view;
  const winner = podium[0];
  const avatars = await avatarsFor([...(blackholedMode ? view.lostRows : view.listed), ...podium]);
  const rows = rowData(dataset, view, avatars, user.id);
  const query = new URL(href({ ...filters, page: 1 }), 'http://local').searchParams.toString();

  const scopes = [
    { label: 'Cohort', filters: { campus: defaultCampus, cohort: defaultCohort } },
    { label: 'Campus', filters: { campus: defaultCampus } },
    { label: 'All 1337', filters: {} },
  ];
  const same = (target: Partial<Filters>) => (['campus','cohort'] as const).every((key) => (filters[key] ?? undefined) === (target[key] ?? undefined));
  const activeScope = scopes.find((scope) => same(scope.filters))?.label;
  const empty = blackholedMode
    ? <div className="pl-empty"><KiwiNote><h2>Nobody blackholed here</h2><p>Good news for this group.</p></KiwiNote></div>
    : !showWinner || total > podium.length ? <div className="pl-empty"><KiwiNote>{alumniMode ? <><h2>No alumni here yet</h2><p>Nobody from this group has graduated so far.</p></> : frozenMode ? <><h2>Nobody frozen here</h2><p>Everyone in this group is on the move.</p></> : <><h2>No students here</h2><p>Kiwi looked everywhere. Try another filter.</p></>}</KiwiNote><Link className="pl-scope is-active" href={href(scopes[0].filters)}>Back to my cohort</Link></div> : null;

  return <main className="shell pl">
    <aside className="pl-side">
      <StickySide/>
      <section className="pl-hero" aria-labelledby="pl-title">
        <h1 id="pl-title">Leaderboard</h1>
        {showWinner && <div className="pl-podium">
          {podium[1] ? <RunnerUp student={podium[1]} src={avatars[podium[1].id]}/> : <span/>}
          <Winner student={winner} src={avatars[winner.id]}/>
          {podium[2] ? <RunnerUp student={podium[2]} src={avatars[podium[2].id]}/> : <span/>}
        </div>}
      </section>

      <FilterBox filters={filters} campuses={dataset.campuses} cohorts={cohorts(dataset.students)} open={false} reset={href(scopes[0].filters)} isDefault={activeScope === 'Cohort' && !filters.q && !filters.bh}/>
    </aside>

    <section className="pl-list" aria-label="Leaderboard">
      <div className="pl-list-head"><p className="pl-count"><strong>{total.toLocaleString()}</strong> {blackholedMode ? 'blackholed' : alumniMode ? 'alumni' : total === 1 ? 'student' : 'students'}{filters.q && <> matching “{filters.q}”</>}<span className="pl-updated"> · updated {timeAgo(dataset.fetchedAt)}</span></p>
        <Link href={href({ ...filters, order: filters.order === 'desc' ? undefined : 'desc', page: 1 })} className={cn('pl-reverse', filters.order === 'desc' && 'is-on')} aria-pressed={filters.order === 'desc'} title={filters.order === 'desc' ? 'Show from the first rank' : 'Show from the last rank'}><Reverse size={15}/>Reverse</Link></div>
      {!rows.length ? empty : infinite
        ? <InfiniteRanks key={query} initial={rows} query={query} pages={pages}/>
        : <><ol className="pl-rows">{rows.map((row) => <li key={row.id} className="pl-item"><RankRow row={row}/></li>)}</ol><span data-rank-end="" aria-hidden="true"/></>}

      {!infinite && pages > 1 && <nav className="pl-pager" aria-label="Pagination">
        <Link className={cn('pl-round', page === 1 && 'is-disabled')} href={href({ ...filters, page: Math.max(1, page - 1) })} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} aria-label="Previous page"><ChevronLeft size={22}/></Link>
        <span className="pl-pages">{pageItems(page, pages).map((item, index) => item === 'gap'
          ? <span key={`gap${index}`} className="pl-page-gap" aria-hidden="true">…</span>
          : <Link key={item} href={href({ ...filters, page: item })} className={cn('pl-page', item === page && 'is-current')} aria-current={item === page ? 'page' : undefined} aria-label={`Page ${item}`}>{item}</Link>)}</span>
        <Link className={cn('pl-round', page === pages && 'is-disabled')} href={href({ ...filters, page: Math.min(pages, page + 1) })} aria-disabled={page === pages} tabIndex={page === pages ? -1 : undefined} aria-label="Next page"><ChevronRight size={22}/></Link>
      </nav>}
    </section>
    {test && !test.answered && <RankTestPrompt mode={test.mode}/>}
  </main>;
}

const cohorts = (students: { commonCoreEntryYear: string | null }[]) => [...new Set(students.map((student) => student.commonCoreEntryYear).filter((year): year is string => !!year))].sort().reverse();

function RunnerUp({ student, src }: { student: Ranked; src?: string }) {
  // A student who asked to be removed keeps their place on the podium, with no name, level or link.
  if (student.anonymous) return <span className="pl-podium-item"><div className="pl-runner" style={{ '--pastel': '#3a3a3a' } as React.CSSProperties} aria-label={`Rank ${student.rank}, anonymous student`}>
    <div className="pl-runner-portrait"><Avatar login="?" name="?" src={null} size={72}/><span className="pl-runner-rank">{student.rank}</span></div>
    <strong>Anonymous</strong>
  </div></span>;
  return <span className="pl-podium-item"><Link href={appHref(student.login)} className="pl-runner" style={{ '--pastel': pastel(student.rank) } as React.CSSProperties} aria-label={`Rank ${student.rank}, ${student.login}, level ${student.level.toFixed(2)}`}>
    <div className="pl-runner-portrait"><Avatar login={student.login} src={src} size={72}/><span className="pl-runner-rank">{student.rank}</span></div>
    <strong>{student.login}</strong>{student.alumni && <AlumniBadge/>}{student.frozen && <FrozenBadge/>}
    <span className="pl-runner-level">Lvl {student.level.toFixed(2)}</span>
  </Link><IntraButton login={student.login} podium/></span>;
}

function Winner({ student, src }: { student: Ranked; src?: string }) {
  if (student.anonymous) return <span className="pl-podium-item"><div className="pl-winner" aria-label={`Rank ${student.rank}, anonymous student`}>
    <div className="pl-winner-portrait">
      <Avatar login="?" name="?" src={null} size={96}/>
      <span className="pl-runner-rank pl-winner-rank" aria-hidden="true">{student.rank}</span>
    </div>
    <h2>Anonymous</h2>
  </div></span>;
  return <span className="pl-podium-item"><Link href={appHref(student.login)} className="pl-winner" aria-label={`Rank ${student.rank}, ${student.login}, level ${student.level.toFixed(2)}`}>
    <div className="pl-winner-portrait">
      <Avatar login={student.login} src={src} size={96}/>
      <span className="pl-runner-rank pl-winner-rank" aria-hidden="true">{student.rank}</span>
    </div>
    <h2>{student.login}</h2>{student.alumni && <AlumniBadge/>}{student.frozen && <FrozenBadge/>}
    <span className="pl-pill">Level {student.level.toFixed(2)}</span>
  </Link><IntraButton login={student.login} podium/></span>;
}

function FilterBox({ filters, campuses, cohorts, open, reset, isDefault }: { filters: Filters; campuses: { id: number; name: string }[]; cohorts: string[]; open: boolean; reset: string; isDefault: boolean }) {
  const go = (change: Partial<Filters>) => href({ ...filters, ...change, page: 1 });
  const campusLabel = (id: number) => campuses.find((campus) => campus.id === id)?.name ?? `Campus ${id}`;
  const tokens = [
    filters.campus ? { key: 'campus', label: campusLabel(filters.campus), tone: 'lilac', remove: go({ campus: undefined }) } : null,
    filters.cohort ? { key: 'cohort', label: `Cohort ${filters.cohort}`, tone: 'yellow', remove: go({ cohort: undefined }) } : null,
    filters.bh ? { key: 'bh', label: filters.bh === 'alumni' ? 'Alumni' : filters.bh === 'frozen' ? 'Frozen' : 'Blackholed', tone: filters.bh === 'alumni' ? 'alumni' : filters.bh === 'frozen' ? 'frozen' : 'red', remove: go({ bh: undefined }) } : null,
  ].filter((token): token is NonNullable<typeof token> => !!token);
  const hidden: Record<string, string> = { campus: filters.campus ? String(filters.campus) : ALL, cohort: filters.cohort ?? ALL, ...(filters.bh ? { bh: filters.bh } : {}) };
  return <FilterShell action="/leaderboard" track="leaderboard" hidden={hidden} q={filters.q} placeholder="Search a login or name" clearHref={go({ q: undefined })} activeCount={isDefault ? 0 : tokens.length} defaultOpen={open}>
    {(tokens.length > 0 || !isDefault) && <div className="pl-tokens" aria-label="Active filters">
      {tokens.map((token) => <Link key={token.key} href={token.remove} className={`pl-token is-${token.tone}`} aria-label={`Remove ${token.label}`}>{token.label}<X size={13}/></Link>)}
      {!isDefault && <Link href={reset} className="pl-token-reset"><RotateCcw size={14}/> Reset to my year</Link>}
    </div>}
    <div className="pl-groups">
      <ChipGroup icon={<Campus size={17}/>} label="Campus" tone="lilac" chips={[{ label: 'All', href: go({ campus: undefined }), active: !filters.campus }, ...campuses.map((campus) => ({ label: campus.name, href: go({ campus: campus.id }), active: filters.campus === campus.id }))]}/>
      <ChipGroup icon={<Cohort size={17}/>} label="Cohort" tone="yellow" scroll chips={[{ label: 'All', href: go({ cohort: undefined }), active: !filters.cohort }, ...cohorts.map((year) => ({ label: year, href: go({ cohort: year }), active: filters.cohort === year }))]}/>
      <ChipGroup icon={<Hourglass size={17}/>} label="Status" tone="mint" chips={[{ label: 'Active students', href: go({ bh: undefined }), active: !filters.bh }, { label: 'Alumni', href: go({ bh: 'alumni' }), active: filters.bh === 'alumni', tone: 'alumni' }, { label: 'Frozen', href: go({ bh: 'frozen' }), active: filters.bh === 'frozen', tone: 'frozen' }, { label: 'Blackholed', href: go({ bh: 'blackholed' }), active: filters.bh === 'blackholed', tone: 'red' }]}/>
    </div>
  </FilterShell>;
}

function ChipGroup({ icon, label, tone, chips, scroll = false }: { icon: React.ReactNode; label: string; tone: string; chips: { label: string; href: string; active: boolean; tone?: string }[]; scroll?: boolean }) {
  const items = chips.map((chip) => <Link key={chip.label} href={chip.href} className={`pl-chip is-${chip.tone ?? tone}`} data-active={chip.active || undefined} aria-current={chip.active ? 'true' : undefined}>{chip.label}</Link>);
  return <div className="pl-chip-group" role="group" aria-label={label}>
    <span className="pl-chip-label">{icon}{label}</span>
    {scroll ? <ScrollRow className="pl-chips is-scroll">{items}</ScrollRow> : <div className="pl-chips">{items}</div>}
  </div>;
}
