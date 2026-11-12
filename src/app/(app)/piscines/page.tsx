import Link from 'next/link';
import { DatasetState } from '@/components/dataset-state';
import { FilterShell } from '@/components/filter-shell';
import { RankingSwitch } from '@/components/ranking-switch';
import { Calendar, Campus, Check, Hourglass, Reverse, RotateCcw, Waves, X } from '@/components/icons';
import { InfiniteRanks } from '@/components/infinite-ranks';
import { KiwiNote } from '@/components/kiwi-guide';
import { ScrollRow } from '@/components/scroll-row';
import { StickySide } from '@/components/sticky-side';
import { requireStudent } from '@/lib/guard';
import { loadPiscineRanking } from '@/lib/piscines';
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
  const avatars = await piscineAvatars(view.rows);
  const rows = piscineRowData(view.rows, avatars, user.id);
  const query = new URL(href(filters), 'http://local').searchParams.toString();
  const isDefault = filters.campus === defaultCampus && filters.year === defaultYear && filters.month === defaultMonth && !filters.admission;

  return <main className="shell pl pp">
    <aside className="pl-side">
      <StickySide/>
      <section className="pl-hero" aria-labelledby="pl-title">
        <RankingSwitch active="piscine"/>
        <h1 id="pl-title" className="sr-only">Piscine leaderboard</h1>
      </section>
      <PiscineFilters filters={filters} defaults={{ campus: defaultCampus, year: defaultYear, month: defaultMonth }} isDefault={isDefault}/>
    </aside>

    <section className="pl-list" aria-label="Piscine leaderboard">
      <dl className="pp-summary" aria-label="Piscine admission totals">
        <div className="is-total"><dt><i><Waves size={13}/></i>Total</dt><dd>{dataset.candidates.toLocaleString()}</dd></div>
        <div className="is-accepted"><dt><i><Check size={13} weight="bold"/></i>Accepted</dt><dd>{dataset.accepted.toLocaleString()}</dd></div>
        <div className="is-not-accepted"><dt><i><X size={13} weight="bold"/></i>Not accepted</dt><dd>{dataset.notAccepted.toLocaleString()}</dd></div>
      </dl>
      <div className="pl-list-head"><p className="pl-count"><strong>{view.total.toLocaleString()}</strong> {view.total === 1 ? 'pooler' : 'poolers'} ranked by progress{filters.q && <> matching “{filters.q}”</>}<span className="pl-updated"> · updated {timeAgo(dataset.fetchedAt)}</span></p>
        <Link href={href({ ...filters, order: filters.order === 'desc' ? undefined : 'desc', page: 1 })} className={cn('pl-reverse', filters.order === 'desc' && 'is-on')} aria-pressed={filters.order === 'desc'}><Reverse size={15}/>Reverse</Link></div>
      {!rows.length ? <div className="pl-empty"><KiwiNote><h2>No ranked poolers here</h2><p>Try another campus, year or month.</p></KiwiNote></div> : <InfiniteRanks key={query} initial={rows} query={query} pages={view.pages} endpoint="/api/piscines/rows"/>}
      {dataset.unranked > 0 && <p className="pp-note">{dataset.unranked.toLocaleString()} session {dataset.unranked === 1 ? 'account has' : 'accounts have'} no readable Piscine level yet and {dataset.unranked === 1 ? 'is' : 'are'} not ranked.</p>}
      <p className="pp-note"><X size={12}/> Not accepted means no Common Core enrollment was found. The 42 API does not expose an official rejection result.</p>
    </section>
  </main>;
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
    <RankingSwitch active="piscine" inPanel/>
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
