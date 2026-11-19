import { StickySide } from '@/components/sticky-side';
import { KiwiNote } from '@/components/kiwi-guide';
import Link from 'next/link';
import { Campus, Cohort, Hourglass, Reverse, RotateCcw, X } from '@/components/icons';
import { FilterShell } from '@/components/filter-shell';
import { RankingSwitch } from '@/components/ranking-switch';
import { ScrollRow } from '@/components/scroll-row';
import { InfiniteRanks } from '@/components/infinite-ranks';
import { requireStudent } from '@/lib/guard';
import { loadRankingDataset } from '@/lib/dataset';
import { DatasetState } from '@/components/dataset-state';
import { getStudentProfile } from '@/lib/student-overview';
import { ALL, avatarsFor, frozenSeen, leaderboardHref as href, listPage, resolveFilters, rowData, type Filters } from '@/lib/leaderboard-view';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/time';

export const metadata = { title: 'Student Rankings' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function Leaderboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const raw = await searchParams;
  const [state, profile] = await Promise.all([loadRankingDataset(), getStudentProfile(user.id).catch(() => null)]);
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const dataset = state.data;
  const { filters, own, defaultCampus, defaultCohort } = resolveFilters(raw, dataset, profile, user.id);
  // The list always opens at the top and loads the rest while scrolling, even from an old ?page= link.
  filters.page = 1;
  const view = listPage(dataset, filters, own?.id, await frozenSeen(dataset, filters));
  const { blackholedMode, alumniMode, frozenMode, total, pages } = view;
  const avatars = await avatarsFor(blackholedMode ? view.lostRows : view.listed);
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
    : <div className="pl-empty"><KiwiNote>{alumniMode ? <><h2>No alumni here yet</h2><p>Nobody from this group has graduated so far.</p></> : frozenMode ? <><h2>Nobody frozen here</h2><p>Everyone in this group is on the move.</p></> : <><h2>No students here</h2><p>Kiwi looked everywhere. Try another filter.</p></>}</KiwiNote><Link className="pl-scope is-active" href={href(scopes[0].filters)}>Back to my cohort</Link></div>;

  return <main className="shell pl">
    <aside className="pl-side">
      <StickySide/>
      <section className="pl-hero" aria-labelledby="pl-title">
        <RankingSwitch active="students"/>
        <h1 id="pl-title" className="sr-only">Leaderboard</h1>
      </section>

      <FilterBox filters={filters} campuses={dataset.campuses} cohorts={cohorts([...dataset.students, ...dataset.blackholed])} open={false} reset={href(scopes[0].filters)} isDefault={activeScope === 'Cohort' && !filters.q && !filters.bh}/>
    </aside>

    <section className="pl-list" aria-label="Leaderboard">
      <div className="pl-list-head"><p className="pl-count"><strong>{total.toLocaleString()}</strong> {blackholedMode ? 'blackholed' : alumniMode ? 'alumni' : total === 1 ? 'student' : 'students'}{filters.q && <> matching “{filters.q}”</>}<span className="pl-updated"> · updated {timeAgo(dataset.fetchedAt)}{Date.now() - Date.parse(dataset.fetchedAt) > 1_800_000 && " · previous complete snapshot; refresh pending"}</span></p>
        <Link href={href({ ...filters, order: filters.order === 'desc' ? undefined : 'desc', page: 1 })} className={cn('pl-reverse', filters.order === 'desc' && 'is-on')} aria-pressed={filters.order === 'desc'} title={filters.order === 'desc' ? 'Show from the first rank' : 'Show from the last rank'}><Reverse size={15}/>Reverse</Link></div>
      {!rows.length ? empty : <InfiniteRanks key={query} initial={rows} query={query} pages={pages}/>}
    </section>
  </main>;
}

const cohorts = (students: { commonCoreCohort: string | null }[]) => [...new Set(students.map((student) => student.commonCoreCohort).filter((year): year is string => !!year))].sort().reverse();

function FilterBox({ filters, campuses, cohorts, open, reset, isDefault }: { filters: Filters; campuses: { id: number; name: string }[]; cohorts: string[]; open: boolean; reset: string; isDefault: boolean }) {
  const go = (change: Partial<Filters>) => href({ ...filters, ...change, page: 1 });
  const campusLabel = (id: number) => campuses.find((campus) => campus.id === id)?.name ?? `Campus ${id}`;
  const tokens = [
    filters.campus ? { key: 'campus', label: campusLabel(filters.campus), tone: 'lilac', remove: go({ campus: undefined }) } : null,
    filters.cohort ? { key: 'cohort', label: `Cohort ${filters.cohort}`, tone: 'yellow', remove: go({ cohort: undefined }) } : null,
    filters.bh ? { key: 'bh', label: filters.bh === 'all' ? 'All statuses' : filters.bh === 'alumni' ? 'Alumni' : filters.bh === 'frozen' ? 'Frozen' : 'Blackholed', tone: filters.bh === 'all' ? 'cyan' : filters.bh === 'alumni' ? 'alumni' : filters.bh === 'frozen' ? 'frozen' : 'red', remove: go({ bh: undefined }) } : null,
  ].filter((token): token is NonNullable<typeof token> => !!token);
  const hidden: Record<string, string> = { campus: filters.campus ? String(filters.campus) : ALL, cohort: filters.cohort ?? ALL, ...(filters.bh ? { bh: filters.bh } : {}) };
  return <FilterShell action="/leaderboard" hidden={hidden} q={filters.q} placeholder="Search a login or name" clearHref={go({ q: undefined })} activeCount={isDefault ? 0 : tokens.length} defaultOpen={open}>
    <RankingSwitch active="students" inPanel/>
    {(tokens.length > 0 || !isDefault) && <div className="pl-tokens" aria-label="Active filters" data-keep-scroll>
      {tokens.map((token) => <Link key={token.key} href={token.remove} scroll={false} className={`pl-token is-${token.tone}`} aria-label={`Remove ${token.label}`}>{token.label}<X size={13}/></Link>)}
      {!isDefault && <Link href={reset} scroll={false} className="pl-token-reset"><RotateCcw size={14}/> Reset to my cohort</Link>}
    </div>}
    <div className="pl-groups" data-keep-scroll>
      <ChipGroup icon={<Campus size={17}/>} label="Campus" tone="lilac" chips={[{ label: 'All', href: go({ campus: undefined }), active: !filters.campus }, ...campuses.map((campus) => ({ label: campus.name, href: go({ campus: campus.id }), active: filters.campus === campus.id }))]}/>
      <ChipGroup icon={<Cohort size={17}/>} label="Cohort" tone="yellow" scroll chips={[{ label: 'All', href: go({ cohort: undefined }), active: !filters.cohort }, ...cohorts.map((year) => ({ label: year, href: go({ cohort: year }), active: filters.cohort === year }))]}/>
      <ChipGroup icon={<Hourglass size={17}/>} label="Status" tone="mint" chips={[{ label: 'All', href: go({ bh: 'all' }), active: filters.bh === 'all' }, { label: 'Active students', href: go({ bh: undefined }), active: !filters.bh }, { label: 'Alumni', href: go({ bh: 'alumni' }), active: filters.bh === 'alumni', tone: 'alumni' }, { label: 'Frozen', href: go({ bh: 'frozen' }), active: filters.bh === 'frozen', tone: 'frozen' }, { label: 'Blackholed', href: go({ bh: 'blackholed' }), active: filters.bh === 'blackholed', tone: 'red' }]}/>
    </div>
  </FilterShell>;
}

function ChipGroup({ icon, label, tone, chips, scroll = false }: { icon: React.ReactNode; label: string; tone: string; chips: { label: string; href: string; active: boolean; tone?: string }[]; scroll?: boolean }) {
  const items = chips.map((chip) => <Link key={chip.label} href={chip.href} scroll={false} className={`pl-chip is-${chip.tone ?? tone}`} data-active={chip.active || undefined} aria-current={chip.active ? 'true' : undefined}>{chip.label}</Link>);
  return <div className="pl-chip-group" role="group" aria-label={label}>
    <span className="pl-chip-label">{icon}{label}</span>
    {scroll ? <ScrollRow className="pl-chips is-scroll">{items}</ScrollRow> : <div className="pl-chips">{items}</div>}
  </div>;
}
