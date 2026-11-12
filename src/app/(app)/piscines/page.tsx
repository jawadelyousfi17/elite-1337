import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { DatasetState } from '@/components/dataset-state';
import { FilterShell } from '@/components/filter-shell';
import { Calendar, Campus, Check, Hourglass, Reverse, RotateCcw, Waves, X } from '@/components/icons';
import { InfiniteRanks } from '@/components/infinite-ranks';
import { KiwiNote } from '@/components/kiwi-guide';
import { NewTabMark, appHref, newTab, pastel } from '@/components/rank-row';
import { ScrollRow } from '@/components/scroll-row';
import { StickySide } from '@/components/sticky-side';
import { requireStudent } from '@/lib/guard';
import { loadPiscineRanking, type PiscineRank } from '@/lib/piscines';
import { PISCINE_CAMPUSES, PISCINE_MONTHS, piscineAvatars, piscineHref as href, piscinePage, piscineRowData, resolvePiscineFilters, type PiscineFilters } from '@/lib/piscine-view';
import { getStudentProfile } from '@/lib/student-overview';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Piscine Rankings' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Piscine progress ranked by the level reported by the 42 C Piscine cursus. */
export default async function Piscines({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const [raw, profile] = await Promise.all([searchParams, getStudentProfile(user.id).catch(() => null)]);
  const { filters, defaultCampus, defaultYear, defaultMonth } = resolvePiscineFilters(raw, profile);
  filters.page = 1;
  const state = await loadPiscineRanking(filters.campus ?? null, filters.year, filters.month ?? null);
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const dataset = state.data, view = piscinePage(dataset, filters);
  const visible = [...view.rows, ...(view.showPodium ? view.podium : [])];
  const avatars = await piscineAvatars(visible);
  const rows = piscineRowData(view.rows, avatars, user.id);
  const query = new URL(href(filters), 'http://local').searchParams.toString();
  const isDefault = filters.campus === defaultCampus && filters.year === defaultYear && filters.month === defaultMonth && !filters.admission;

  return <main className="shell pl pp">
    <aside className="pl-side">
      <StickySide/>
      <section className="pl-hero" aria-labelledby="pl-title">
        <nav className="pp-switch" aria-label="Ranking type"><Link href="/leaderboard">Common Core</Link><Link href="/piscines" className="is-active" aria-current="page"><Waves size={15}/>Piscine</Link></nav>
        <h1 id="pl-title">Piscine leaderboard</h1>
        {view.showPodium && <div className="pl-podium">
          {view.podium[1] ? <Podium student={view.podium[1]} src={avatars[view.podium[1].id]}/> : <span/>}
          <Podium student={view.podium[0]} src={avatars[view.podium[0].id]} winner/>
          {view.podium[2] ? <Podium student={view.podium[2]} src={avatars[view.podium[2].id]}/> : <span/>}
        </div>}
      </section>
      <PiscineFilters filters={filters} defaults={{ campus: defaultCampus, year: defaultYear, month: defaultMonth }} isDefault={isDefault}/>
    </aside>

    <section className="pl-list" aria-label="Piscine leaderboard">
      <dl className="pp-summary" aria-label="Piscine admission totals">
        <div><dt>Poolers</dt><dd>{dataset.candidates.toLocaleString()}</dd></div>
        <div className="is-accepted"><dt><Check size={14}/>Accepted</dt><dd>{dataset.accepted.toLocaleString()}</dd></div>
        <div className="is-not-accepted"><dt><X size={14}/>Not accepted</dt><dd>{dataset.notAccepted.toLocaleString()}</dd></div>
      </dl>
      <div className="pl-list-head"><p className="pl-count"><strong>{view.total.toLocaleString()}</strong> {view.total === 1 ? 'pooler' : 'poolers'} ranked by progress{filters.q && <> matching “{filters.q}”</>}<span className="pl-updated"> · updated {timeAgo(dataset.fetchedAt)}</span></p>
        <Link href={href({ ...filters, order: filters.order === 'desc' ? undefined : 'desc', page: 1 })} className={cn('pl-reverse', filters.order === 'desc' && 'is-on')} aria-pressed={filters.order === 'desc'}><Reverse size={15}/>Reverse</Link></div>
      {!rows.length ? <div className="pl-empty"><KiwiNote><h2>No ranked poolers here</h2><p>Try another campus, year or month.</p></KiwiNote></div> : <InfiniteRanks key={query} initial={rows} query={query} pages={view.pages} endpoint="/api/piscines/rows"/>}
      {dataset.unranked > 0 && <p className="pp-note">{dataset.unranked.toLocaleString()} session {dataset.unranked === 1 ? 'account has' : 'accounts have'} no readable Piscine level yet and {dataset.unranked === 1 ? 'is' : 'are'} not ranked.</p>}
      <p className="pp-note"><X size={12}/> Not accepted means no Common Core enrollment was found. The 42 API does not expose an official rejection result.</p>
    </section>
  </main>;
}

function Podium({ student, src, winner = false }: { student: PiscineRank; src?: string; winner?: boolean }) {
  if (winner) return <span className="pl-podium-item"><Link href={appHref(student.login)} {...newTab} className="pl-winner" aria-label={`Rank ${student.rank}, ${student.login}, level ${student.level.toFixed(2)}`}>
    <div className="pl-winner-portrait"><Avatar login={student.login} src={src} size={96}/><span className="pl-runner-rank pl-winner-rank">{student.rank}</span></div>
    <h2>{student.login}<NewTabMark/></h2><span className="pl-pill">Level {student.level.toFixed(2)}</span>
  </Link></span>;
  return <span className="pl-podium-item"><Link href={appHref(student.login)} {...newTab} className="pl-runner" style={{ '--pastel': pastel(student.rank) } as React.CSSProperties} aria-label={`Rank ${student.rank}, ${student.login}, level ${student.level.toFixed(2)}`}>
    <div className="pl-runner-portrait"><Avatar login={student.login} src={src} size={72}/><span className="pl-runner-rank">{student.rank}</span></div>
    <strong>{student.login}<NewTabMark/></strong><span className="pl-runner-level">Lvl {student.level.toFixed(2)}</span>
  </Link></span>;
}

function PiscineFilters({ filters, defaults, isDefault }: { filters: PiscineFilters; defaults: { campus?: number; year: string; month?: typeof PISCINE_MONTHS[number] }; isDefault: boolean }) {
  const go = (change: Partial<PiscineFilters>) => href({ ...filters, ...change, page: 1 });
  const campus = PISCINE_CAMPUSES.find((item) => item.id === filters.campus);
  const tokens = [
    filters.campus ? { key: 'campus', label: campus?.name ?? `Campus ${filters.campus}`, tone: 'lilac', remove: go({ campus: undefined }) } : null,
    { key: 'year', label: filters.year, tone: 'yellow', remove: go({ year: defaults.year }) },
    filters.month ? { key: 'month', label: filters.month[0].toUpperCase() + filters.month.slice(1), tone: 'cyan', remove: go({ month: undefined }) } : null,
    filters.admission ? { key: 'admission', label: filters.admission === 'accepted' ? 'Accepted' : 'Not accepted', tone: filters.admission === 'accepted' ? 'mint' : 'red', remove: go({ admission: undefined }) } : null,
  ].filter((token): token is NonNullable<typeof token> => !!token);
  const reset = href({ campus: defaults.campus, year: defaults.year, month: defaults.month, page: 1 });
  return <FilterShell action="/piscines" hidden={{ campus: filters.campus ? String(filters.campus) : 'all', year: filters.year, month: filters.month ?? 'all', ...(filters.admission ? { admission: filters.admission } : {}), ...(filters.order ? { order: filters.order } : {}) }} q={filters.q} placeholder="Search a pooler" clearHref={go({ q: undefined })} activeCount={isDefault ? 0 : tokens.length} defaultOpen={false}>
    {(tokens.length > 0 || !isDefault) && <div className="pl-tokens" aria-label="Active filters" data-keep-scroll>
      {tokens.map((token) => <Link key={token.key} href={token.remove} scroll={false} className={`pl-token is-${token.tone}`}>{token.label}<X size={13}/></Link>)}
      {!isDefault && <Link href={reset} scroll={false} className="pl-token-reset"><RotateCcw size={14}/> My Piscine</Link>}
    </div>}
    <div className="pl-groups" data-keep-scroll>
      <ChipGroup icon={<Campus size={17}/>} label="Campus" tone="lilac" chips={[{ label: 'All 1337', href: go({ campus: undefined }), active: !filters.campus }, ...PISCINE_CAMPUSES.map((item) => ({ label: item.name, href: go({ campus: item.id }), active: filters.campus === item.id }))]}/>
      <ChipGroup icon={<Calendar size={17}/>} label="Year" tone="yellow" scroll chips={Array.from({ length: new Date().getUTCFullYear() - 2013 + 1 }, (_, index) => String(new Date().getUTCFullYear() - index)).map((year) => ({ label: year, href: go({ year }), active: filters.year === year }))}/>
      <ChipGroup icon={<Waves size={17}/>} label="Month" tone="cyan" scroll chips={[{ label: 'All months', href: go({ month: undefined }), active: !filters.month }, ...PISCINE_MONTHS.map((month) => ({ label: month[0].toUpperCase() + month.slice(1, 3), href: go({ month }), active: filters.month === month }))]}/>
      <ChipGroup icon={<Hourglass size={17}/>} label="Admission" tone="mint" chips={[{ label: 'All', href: go({ admission: undefined }), active: !filters.admission }, { label: 'Accepted', href: go({ admission: 'accepted' }), active: filters.admission === 'accepted' }, { label: 'Not accepted', href: go({ admission: 'not-accepted' }), active: filters.admission === 'not-accepted' }]}/>
    </div>
  </FilterShell>;
}

function ChipGroup({ icon, label, tone, chips, scroll = false }: { icon: React.ReactNode; label: string; tone: string; chips: { label: string; href: string; active: boolean }[]; scroll?: boolean }) {
  const items = chips.map((chip) => <Link key={chip.label} href={chip.href} scroll={false} className={`pl-chip is-${tone}`} data-active={chip.active || undefined} aria-current={chip.active ? 'true' : undefined}>{chip.label}</Link>);
  return <div className="pl-chip-group" role="group" aria-label={label}><span className="pl-chip-label">{icon}{label}</span>{scroll ? <ScrollRow className="pl-chips is-scroll">{items}</ScrollRow> : <div className="pl-chips">{items}</div>}</div>;
}
