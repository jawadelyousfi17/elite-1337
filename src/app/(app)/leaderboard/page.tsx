import { StickySide } from '@/components/sticky-side';
import { KiwiNote } from '@/components/kiwi-guide';
import Link from 'next/link';
import { HackerBadge } from '@/components/hacker-badge';
import { AlumniBadge } from '@/components/alumni-badge';
import { FrozenBadge } from '@/components/frozen-badge';
import { hackerLogins } from '@/lib/hackers';
import { ArrowUpRight, Campus, ChevronLeft, ChevronRight, Cohort, Hourglass, Reverse, RotateCcw, Search, X } from '@/components/icons';
import { z } from 'zod';
import { Avatar } from '@/components/avatar';
import { FilterShell } from '@/components/filter-shell';
import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset, type BlackholedStudent } from '@/lib/dataset';
import { DatasetState } from '@/components/dataset-state';
import { selectLeaderboard, type StudentRank } from '@/lib/ranking';
import { getStudentProfile } from '@/lib/student-overview';
import { avatarReferencesOrEmpty } from '@/lib/avatars/storage';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { matchesSearch } from '@/lib/search';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/time';
import { pageItems } from '@/lib/pagination';

export const metadata = { title: 'Student Rankings' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALL = 'all';
const pastels = ['var(--pastel-1)', 'var(--pastel-2)', 'var(--pastel-3)', 'var(--pastel-4)', 'var(--pastel-5)', 'var(--pastel-6)'];
const filtersSchema = z.object({
  campus: z.coerce.number().int().positive().optional(),
  cohort: z.string().regex(/^\d{4}$/).optional(),
  q: z.string().trim().max(40).optional(),
  bh: z.enum(['blackholed', 'alumni', 'frozen']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  order: z.enum(['desc']).optional(),
});
type Filters = z.infer<typeof filtersSchema>;
type Ranked = StudentRank & { rank: number };
const profileHref = (login: string) => `https://profile.intra.42.fr/users/${encodeURIComponent(login)}`;
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const appHref = (login: string) => `/students/${encodeURIComponent(login)}`;
/** Ghost button before the rank, shown on hover: the rest of the row opens the student in the app. */
const IntraButton = ({ login, podium }: { login: string; podium?: boolean }) => <a className={podium ? 'pl-intra is-podium' : 'pl-intra'} href={profileHref(login)} {...external} aria-label={`${login} on 42 Intra (opens in a new tab)`}>Intra<ArrowUpRight size={13} weight="bold"/></a>;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const pastel = (rank: number) => pastels[(rank - 2 + pastels.length * 100) % pastels.length];
const href = (filters: Partial<Filters>) => {
  const params = new URLSearchParams();
  for (const key of ['campus','cohort','q','bh'] as const) params.set(key, filters[key] ? String(filters[key]) : '');
  if (filters.order) params.set('order', filters.order);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return `/leaderboard?${params}`;
};

export default async function Leaderboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const hackers = hackerLogins();
  const user = await requireStudent();
  const raw = await searchParams;
  const param = (key: string) => { const value = raw[key]; return value === ALL ? '' : value; };
  const [state, profile] = await Promise.all([loadRankingDataset(), getStudentProfile(user.id).catch(() => null)]);
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const dataset = state.data;
  const own = dataset.students.find((student) => String(student.id) === user.id);
  const validCampusIds = new Set(dataset.campuses.map((campus) => campus.id));
  const defaultCampus = profile?.campus_users.find((entry) => entry.is_primary && validCampusIds.has(entry.campus_id))?.campus_id ?? own?.campusIds[0];
  const defaultCohort = own?.commonCoreEntryYear ?? undefined;
  const parsed = filtersSchema.safeParse({
    campus: param('campus') === undefined ? defaultCampus : param('campus') || undefined,
    cohort: param('cohort') === undefined ? defaultCohort : param('cohort') || undefined,
    q: raw.q || undefined, bh: raw.bh || undefined, page: raw.page || 1, order: raw.order || undefined,
  });
  const filters: Filters = parsed.success ? parsed.data : { campus: defaultCampus, cohort: defaultCohort, page: 1 };
  if (filters.campus && !validCampusIds.has(filters.campus)) filters.campus = undefined;
  const cohorts = [...new Set(dataset.students.map((student) => student.commonCoreEntryYear).filter((year): year is string => !!year))].sort().reverse();
  const blackholedMode = filters.bh === 'blackholed', alumniMode = filters.bh === 'alumni', frozenMode = filters.bh === 'frozen';
  const { rows, total: rankedTotal, page: rankedPage, pages: rankedPages, podium } = selectLeaderboard(dataset.students, { ...filters, alumni: alumniMode, frozen: frozenMode }, own?.id);
  const inScope = (student: { campusIds: number[]; commonCoreEntryYear: string | null; login: string; displayName: string | null }) => (!filters.campus || student.campusIds.includes(filters.campus)) && (!filters.cohort || student.commonCoreEntryYear === filters.cohort) && (!filters.q || matchesSearch(filters.q, [student.login, student.displayName]));
  const lost = blackholedMode ? dataset.blackholed.filter(inScope) : [];
  if (filters.order === 'desc') lost.reverse();
  const lostPages = Math.max(1, Math.ceil(lost.length / 25)), lostPage = Math.min(filters.page, lostPages);
  const lostRows = lost.slice((lostPage - 1) * 25, lostPage * 25);
  const total = blackholedMode ? lost.length : rankedTotal, page = blackholedMode ? lostPage : rankedPage, pages = blackholedMode ? lostPages : rankedPages;
  const winner = podium[0];
  const showWinner = !!winner && !filters.q && !filters.bh;
  const onPodium = new Set(showWinner ? podium.map((student) => student.id) : []);
  const listed = page === 1 || filters.order === 'desc' ? rows.filter((student) => !onPodium.has(student.id)) : rows;
  const pictured: { id: number; photo?: string | null }[] = [...rows, ...podium, ...lostRows];
  const avatars = photoReferences(pictured, await avatarReferencesOrEmpty([...new Set(pictured.map((student) => student.id))]));

  const scopes = [
    { label: 'Cohort', filters: { campus: defaultCampus, cohort: defaultCohort } },
    { label: 'Campus', filters: { campus: defaultCampus } },
    { label: 'All 1337', filters: {} },
  ];
  const same = (target: Partial<Filters>) => (['campus','cohort'] as const).every((key) => (filters[key] ?? undefined) === (target[key] ?? undefined));
  const activeScope = scopes.find((scope) => same(scope.filters))?.label;

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

      <FilterBox filters={filters} campuses={dataset.campuses} cohorts={cohorts} open={false} reset={href(scopes[0].filters)} isDefault={activeScope === 'Cohort' && !filters.q && !filters.bh}/>
    </aside>

    <section className="pl-list" aria-label="Leaderboard">
      <div className="pl-list-head"><p className="pl-count"><strong>{total.toLocaleString()}</strong> {blackholedMode ? 'blackholed' : alumniMode ? 'alumni' : total === 1 ? 'student' : 'students'}{filters.q && <> matching “{filters.q}”</>}<span className="pl-updated"> · updated {timeAgo(dataset.fetchedAt)}</span></p>
        <Link href={href({ ...filters, order: filters.order === 'desc' ? undefined : 'desc', page: 1 })} className={cn('pl-reverse', filters.order === 'desc' && 'is-on')} aria-pressed={filters.order === 'desc'} title={filters.order === 'desc' ? 'Show from the first rank' : 'Show from the last rank'}><Reverse size={15}/>Reverse</Link></div>
      {blackholedMode ? lostRows.length ? <ol className="pl-rows">{lostRows.map((student) => <li key={student.id} className="pl-item"><BlackholedRow student={student} src={avatars[student.id]} campus={student.campusIds.map((id) => campusName(dataset, id)).join(' · ')}/></li>)}</ol> : <div className="pl-empty"><KiwiNote><h2>Nobody blackholed here</h2><p>Good news for this group.</p></KiwiNote></div> : listed.length ? <ol className="pl-rows">{listed.map((student) => {
        const mine = String(student.id) === user.id;
        return <li key={student.id} className="pl-item"><div className={cn('pl-row', mine && 'is-mine')} style={{ '--pastel': pastel(student.rank) } as React.CSSProperties}>
          <span className="pl-avatar"><Avatar login={student.login} src={avatars[student.id]} size={45}/></span>
          <span className="pl-copy"><strong><Link href={appHref(student.login)} className="pl-row-link">{student.login}</Link>{student.alumni && <AlumniBadge/>}{student.frozen && <FrozenBadge/>}{hackers.has(student.login.toLowerCase()) && <HackerBadge/>}{mine && <em>You</em>}</strong><span><b>Level {student.level.toFixed(2)}</b> · {student.commonCoreEntryYear ?? '?'} · {student.campusIds.map((id) => campusName(dataset, id)).join(' · ')}</span></span>
          <IntraButton login={student.login}/>
          <span className="pl-rank" aria-label={`Rank ${student.rank}`}>{student.rank}</span>
        </div></li>;
      })}</ol> : !showWinner || total > podium.length ? <div className="pl-empty"><KiwiNote>{alumniMode ? <><h2>No alumni here yet</h2><p>Nobody from this group has graduated so far.</p></> : frozenMode ? <><h2>Nobody frozen here</h2><p>Everyone in this group is on the move.</p></> : <><h2>No students here</h2><p>Kiwi looked everywhere. Try another filter.</p></>}</KiwiNote><Link className="pl-scope is-active" href={href(scopes[0].filters)}>Back to my cohort</Link></div> : null}

      {pages > 1 && <nav className="pl-pager" aria-label="Pagination">
        <Link className={cn('pl-round', page === 1 && 'is-disabled')} href={href({ ...filters, page: Math.max(1, page - 1) })} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} aria-label="Previous page"><ChevronLeft size={22}/></Link>
        <span className="pl-pages">{pageItems(page, pages).map((item, index) => item === 'gap'
          ? <span key={`gap${index}`} className="pl-page-gap" aria-hidden="true">…</span>
          : <Link key={item} href={href({ ...filters, page: item })} className={cn('pl-page', item === page && 'is-current')} aria-current={item === page ? 'page' : undefined} aria-label={`Page ${item}`}>{item}</Link>)}</span>
        <Link className={cn('pl-round', page === pages && 'is-disabled')} href={href({ ...filters, page: Math.min(pages, page + 1) })} aria-disabled={page === pages} tabIndex={page === pages ? -1 : undefined} aria-label="Next page"><ChevronRight size={22}/></Link>
      </nav>}
    </section>
  </main>;
}

function BlackholedRow({ student, src, campus }: { student: BlackholedStudent; src?: string; campus: string }) {
  return <div className="pl-row is-lost" style={{ '--pastel': '#3a3a3a' } as React.CSSProperties}>
    <span className="pl-avatar"><Avatar login={student.login} src={src} size={45}/></span>
    <span className="pl-copy"><strong><Link href={appHref(student.login)} className="pl-row-link">{student.login}</Link>{hackerLogins().has(student.login.toLowerCase()) && <HackerBadge/>}</strong><span><b>Level {student.level.toFixed(2)}</b> · {student.commonCoreEntryYear ?? '?'} · {campus}</span></span>
    <IntraButton login={student.login}/>
    <span className="pl-bh is-lost"><Hourglass size={12}/>{shortDate(student.blackholedAt)}</span>
  </div>;
}

function RunnerUp({ student, src }: { student: Ranked; src?: string }) {
  return <span className="pl-podium-item"><Link href={appHref(student.login)} className="pl-runner" style={{ '--pastel': pastel(student.rank) } as React.CSSProperties} aria-label={`Rank ${student.rank}, ${student.login}, level ${student.level.toFixed(2)}`}>
    <div className="pl-runner-portrait"><Avatar login={student.login} src={src} size={72}/><span className="pl-runner-rank">{student.rank}</span></div>
    <strong>{student.login}</strong>{student.alumni && <AlumniBadge/>}{student.frozen && <FrozenBadge/>}
    <span className="pl-runner-level">Lvl {student.level.toFixed(2)}</span>
  </Link><IntraButton login={student.login} podium/></span>;
}

function Winner({ student, src }: { student: Ranked; src?: string }) {
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
  return <FilterShell action="/leaderboard" hidden={hidden} q={filters.q} placeholder="Search a login or name" clearHref={go({ q: undefined })} activeCount={isDefault ? 0 : tokens.length} defaultOpen={open}>
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
  return <div className="pl-chip-group" role="group" aria-label={label}>
    <span className="pl-chip-label">{icon}{label}</span>
    <div className={cn('pl-chips', scroll && 'is-scroll')}>{chips.map((chip) => <Link key={chip.label} href={chip.href} className={`pl-chip is-${chip.tone ?? tone}`} data-active={chip.active || undefined} aria-current={chip.active ? 'true' : undefined}>{chip.label}</Link>)}</div>
  </div>;
}
