import Link from 'next/link';
import { Suspense } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { z } from 'zod';
import { Avatar } from '@/components/avatar';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from '@/components/icons';
import { DatasetState } from '@/components/dataset-state';
import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { computeStats, monthKey, shiftMonth } from '@/lib/stats';
import { avatarReferencesOrEmpty } from '@/lib/avatars/storage';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { cn } from '@/lib/utils';
import { CareerSection, CareerSkeleton } from './career';
import { ReturnsSection, ReturnsSkeleton, StrictCorrectors, StrictCorrectorsSkeleton } from './returns';
import type { CorrectorWindow } from '@/lib/correctors';
import { ValidatedCampusesSkeleton, ValidatedCampusesWidget, ValidatedSkeleton, ValidatedWidget } from './validated';
import { BlackholeCalendar, CampusDonut, LevelBars, MonthBars, SurvivalHeatmap, WeeklyArea, campusColors } from './charts';

export const metadata = { title: 'Stats' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const params = z.object({ campus: z.coerce.number().int().positive().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(), vw: z.enum(['week', 'month']).optional().catch(undefined), rw: z.enum(['week', 'month']).optional().catch(undefined), cw: z.enum(['30', '60', '90']).optional() });
const fmt = (value: number) => value.toLocaleString('en-US');
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const longMonth = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const profileHref = (login: string) => `https://profile.intra.42.fr/users/${encodeURIComponent(login)}`;

function updated(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

function Card({ title, note, className, children }: { title: string; note?: ReactNode; className?: string; children: ReactNode }) {
  const id = `st-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return <section className={cn('st-card', className)} aria-labelledby={id}>
    <header><h2 id={id}>{title}</h2>{note && <span className="st-note-chip">{note}</span>}</header>
    {children}
  </section>;
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireStudent();
  const parsed = params.safeParse(await searchParams);
  const state = await loadRankingDataset();
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const dataset = state.data;
  const viewerLevel = dataset.students.find((student) => String(student.id) === viewer.id)?.level;
  const query = parsed.success ? parsed.data : {};
  const campusId = dataset.campuses.some((campus) => campus.id === query.campus) ? query.campus : undefined;
  const now = Date.now();
  const stats = computeStats(dataset, { campusId, month: query.month, now });
  const names = Object.fromEntries(dataset.campuses.map((campus) => [campus.id, campus.name]));
  const href = (change: { campus?: number | null; month?: string | null; vw?: string | null; rw?: string | null; cw?: string | null }) => {
    const next = new URLSearchParams();
    const campus = change.campus === undefined ? campusId : change.campus, month = change.month === undefined ? query.month : change.month;
    if (campus) next.set('campus', String(campus));
    if (month) next.set('month', month);
    const vw = change.vw === undefined ? query.vw : change.vw;
    if (vw) next.set('vw', vw);
    const rw = change.rw === undefined ? query.rw : change.rw;
    if (rw) next.set('rw', rw);
    const cw = change.cw === undefined ? query.cw : change.cw;
    if (cw) next.set('cw', cw);
    return next.size ? `/stats?${next}` : '/stats';
  };

  const pictured = [...stats.leaders.map((leader) => leader.student), ...stats.latest];
  const avatars = photoReferences(pictured, await avatarReferencesOrEmpty([...new Set(pictured.map((student) => student.id))]));
  const delta = stats.blackholed30 - stats.previous30;
  const currentMonth = monthKey(now), month = stats.calendar.month;
  const scope = campusId ? names[campusId] : 'All campuses';

  const kpis = [
    { tone: 'lime', label: 'Active students', value: fmt(stats.active), foot: `${fmt(stats.blackholed90)} blackholed in 90 days` },
    { tone: 'coral', label: 'Blackholed · 30 days', value: fmt(stats.blackholed30), foot: <>{delta > 0 ? <ArrowUpRight size={13} weight="bold"/> : delta < 0 ? <ArrowDownRight size={13} weight="bold"/> : null}{delta === 0 ? 'Same as' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs`} the 30 days before</> },
    { tone: 'gold', label: 'Average level', value: stats.avgLevel.toFixed(2), foot: `Median ${stats.medianLevel.toFixed(2)}` },
    { tone: 'blue', label: 'Still in Common Core', value: `${Math.round(stats.survival * 100)}%`, foot: `${fmt(stats.blackholedTotal)} blackholed all time` },
  ];

  return <main className="shell st">
    <header className="st-top">
      <div>
        <h1>Stats</h1>
        <p>Common Core · {scope} · updated {updated(dataset.fetchedAt)}</p>
      </div>
      <nav className="st-seg" aria-label="Campus">
        <Link href={href({ campus: null })} aria-current={!campusId ? 'true' : undefined}>All</Link>
        {dataset.campuses.map((campus) => <Link key={campus.id} href={href({ campus: campus.id })} aria-current={campusId === campus.id ? 'true' : undefined}>
          <i style={{ background: campusColors[campus.id] }} aria-hidden="true"/>{campus.name}
        </Link>)}
      </nav>
    </header>

      <section className="st-kpis" aria-label="Key numbers">
        {kpis.map((kpi) => <div key={kpi.label} className={`st-kpi is-${kpi.tone}`}>
          <div><span className="st-kpi-label">{kpi.label}</span><strong>{kpi.value}</strong><small>{kpi.foot}</small></div>
        </div>)}
      </section>

    <div className="st-layout">
      <div className="st-main">

        <div className="st-row is-wide-left">
          <Card title="Blackholes per week" note="Last 26 weeks"><WeeklyArea weeks={stats.weekly}/></Card>
          <Card title="Monthly trend" note="Last 7 months"><MonthBars months={stats.monthly} campuses={!campusId ? dataset.campuses : undefined}/></Card>
        </div>

        <div className="st-row">
          <Card title="Who's still in" note="By cohort and campus"><SurvivalHeatmap {...stats.matrix} names={names} focus={campusId}/></Card>
          <Card title="Level distribution" note={scope} className="is-fill"><LevelBars levels={stats.levels} median={stats.medianLevel} viewerLevel={viewerLevel}/></Card>
        </div>

        <div className="st-row">
          <Card title="Students by campus" note="Active now"><CampusDonut parts={stats.campuses.map((campus) => ({ id: campus.campusId, name: names[campus.campusId], value: campus.active }))} total={stats.campuses.reduce((sum, campus) => sum + campus.active, 0)} focus={campusId}/>
            <div className="st-compare" role="table" aria-label="Campus comparison">
              <div role="row" className="st-compare-head"><span role="columnheader">Campus</span><span role="columnheader">Avg level</span><span role="columnheader">Out · 30d</span></div>
              {stats.campuses.map((campus) => <Link role="row" key={campus.campusId} href={href({ campus: campus.campusId })} className={cn(campusId && campusId !== campus.campusId && 'is-dim')}>
                <span role="cell"><i style={{ background: campusColors[campus.campusId] }} aria-hidden="true"/>{names[campus.campusId]}</span>
                <span role="cell">{campus.avgLevel.toFixed(2)}</span>
                <span role="cell">{fmt(campus.blackholed30)}</span>
              </Link>)}
            </div>
          </Card>
          <Card title="Top of each cohort" note={scope}>
            <ol className="st-leaders">{stats.leaders.map(({ year, student, cohortSize }) => <li key={year}>
              <Link href={profileHref(student.login)} {...external}>
                <span className="st-year">{year}</span>
                <Avatar login={student.login} src={avatars[student.id]} size={40}/>
                <span className="st-who"><b>{student.login}<ArrowUpRight size={12} weight="bold" className="st-ext"/></b><small>best of {fmt(cohortSize)}</small></span>
                <strong>{student.level.toFixed(2)}</strong>
              </Link>
            </li>)}</ol>
          </Card>
        </div>

        <Suspense fallback={<ReturnsSkeleton/>}><ReturnsSection campuses={dataset.campuses} focus={campusId} window={query.rw ?? 'week'} hrefFor={{ week: href({ rw: null }), month: href({ rw: 'month' }) }}/></Suspense>
        <Suspense fallback={<StrictCorrectorsSkeleton/>}><StrictCorrectors students={dataset.students} campusId={campusId} names={names} days={Number(query.cw ?? 30) as CorrectorWindow} hrefFor={{ 30: href({ cw: null }), 60: href({ cw: '60' }), 90: href({ cw: '90' }) }}/></Suspense>
      </div>

      <aside className="st-rail">
        <Suspense fallback={<ValidatedSkeleton/>}><ValidatedWidget campusId={campusId} window={query.vw ?? 'week'} hrefFor={{ week: href({ vw: null }), month: href({ vw: 'month' }) }}/></Suspense>

        <Suspense fallback={<ValidatedCampusesSkeleton/>}><ValidatedCampusesWidget campuses={dataset.campuses} window={query.vw ?? 'week'} hrefFor={{ week: href({ vw: null }), month: href({ vw: 'month' }) }}/></Suspense>

        <section className="st-card" aria-labelledby="st-calendar">
          <header>
            <h2 id="st-calendar">{longMonth(month)}</h2>
            <span data-keep-scroll className="st-month-nav">
              <Link href={href({ month: shiftMonth(month, -1) })} scroll={false} aria-label="Previous month"><ChevronLeft size={16}/></Link>
              <Link href={href({ month: shiftMonth(month, 1) === currentMonth ? null : shiftMonth(month, 1) })} scroll={false} aria-label="Next month" aria-disabled={month >= currentMonth} className={cn(month >= currentMonth && 'is-disabled')} tabIndex={month >= currentMonth ? -1 : undefined}><ChevronRight size={16}/></Link>
            </span>
          </header>
          <BlackholeCalendar month={month} days={stats.calendar.days} today={new Date(now).toISOString().slice(0, 10)}/>
          <p className="st-cal-sum"><strong>{fmt(stats.calendar.days.reduce((sum, day) => sum + day.count, 0))}</strong> blackholed in {longMonth(month).split(' ')[0]}</p>
        </section>

        <Suspense fallback={<CareerSkeleton/>}><CareerSection students={dataset.students} campusId={campusId}/></Suspense>

        <section className="st-card" aria-labelledby="st-recent">
          <header><h2 id="st-recent">Recently blackholed</h2></header>
          {stats.latest.length ? <ul className="st-feed">{stats.latest.map((student) => <li key={student.id}>
            <Link href={profileHref(student.login)} {...external}>
              <span className="st-feed-avatar" style={{ '--ring': campusColors[student.campusIds[0]] ?? '#555' } as CSSProperties}><Avatar login={student.login} src={avatars[student.id]} size={38}/></span>
              <span className="st-who"><small>{shortDate(student.blackholedAt)}</small><b>{student.login}<ArrowUpRight size={12} weight="bold" className="st-ext"/></b><small>Level {student.level.toFixed(2)} · {student.commonCoreEntryYear ?? '?'} · {student.campusIds.map((id) => campusName(dataset, id)).join(' · ')}</small></span>
            </Link>
          </li>)}</ul> : <p className="st-empty">Nobody blackholed here yet.</p>}
        </section>

        <p className="st-foot">Blackholed means the Common Core enrollment ended after its blackhole date. Dates come from the 42 API and can differ by a few days from Intra when a freeze applied.</p>
      </aside>
    </div>
  </main>;
}
