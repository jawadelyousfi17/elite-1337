import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from '@/components/icons';
import { requireStudent } from '@/lib/guard';
import { isAccessAdmin } from '@/lib/user-controls';
import { siteStats, type DayPoint, type PromoRow } from '@/lib/site-stats';
import { change, parsePeriod, PERIOD_LABEL, ratio, STATS_PERIODS, type StatsPeriod } from '@/lib/site-stats-core';
import { cn } from '@/lib/utils';
import { AdminTabs } from '../admin-tabs';

export const metadata = { title: 'Site stats', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const fmt = (value: number) => value.toLocaleString('en-US');
const PROMO_NAMES: Record<string, string> = { robotics: '1337 Robotics Club', 'cp0-ctf': 'CP0 CTF' };
const PAGE_NAMES: Record<string, string> = { '/': 'Landing', '/students/:id': 'Student profiles', '/xp': 'XP calculator', '/me': 'My journey' };
const pageName = (path: string) => PAGE_NAMES[path] ?? path.slice(1).split('/').map((part) => part === ':id' ? '…' : part.charAt(0).toUpperCase() + part.slice(1)).join(' / ');
const COMPARE: Record<StatsPeriod, string> = { today: 'yesterday by now', '7d': 'the 7 days before', '30d': 'the 30 days before' };

function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value)), unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function Card({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return <section className="st-card" aria-labelledby={id}>
    <header><h2 id={id}>{title}</h2>{note && <span className="st-note-chip">{note}</span>}</header>
    {children}
  </section>;
}

function Delta({ now, before, period }: { now: number; before: number; period: StatsPeriod }) {
  const pct = change(now, before);
  if (pct === null) return <>Nothing to compare with yet</>;
  return <>{pct > 0 ? <ArrowUpRight size={13} weight="bold"/> : pct < 0 ? <ArrowDownRight size={13} weight="bold"/> : null}{pct === 0 ? 'Same as' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs`} {COMPARE[period]}</>;
}

/** Admin-only first-party traffic: who uses Elite 1337, how often, and what the landing promos bring in. Counts only, never names. */
export default async function SiteStatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  if (!await isAccessAdmin(user.login)) notFound();
  const period = parsePeriod((await searchParams).period);
  const stats = await siteStats(period);

  return <main className="shell st as">
    <header className="st-top">
      <div>
        <h1>Site stats</h1>
        <p>Counted by Elite 1337 itself · Morocco time{stats && <> · <span className="as-online"><i aria-hidden="true"/>{fmt(stats.online)} online now</span></>}</p>
      </div>
      <nav className="st-seg" aria-label="Period">
        {STATS_PERIODS.map((value) => <Link key={value} href={value === 'today' ? '/admin/stats' : `/admin/stats?period=${value}`} aria-current={period === value ? 'true' : undefined}>{PERIOD_LABEL[value]}</Link>)}
      </nav>
    </header>
    <AdminTabs current="/admin/stats"/>

    {!stats ? <p className="fa-empty">Stats are unavailable. Check DATABASE_URL.</p> : <>
      <section className="st-kpis as-kpis" aria-label="Key numbers">
        <div className="st-kpi"><div><span className="st-kpi-label">Students signed in</span><strong>{fmt(stats.totals.students)}</strong><small>{ratio(stats.totals.studentVisits, stats.totals.students).toFixed(1)} visits per student</small></div></div>
        <div className="st-kpi is-blue"><div><span className="st-kpi-label">Visitors</span><strong>{fmt(stats.totals.visitors)}</strong><small><Delta now={stats.totals.visitors} before={stats.previous.visitors} period={period}/></small></div></div>
        <div className="st-kpi is-gold"><div><span className="st-kpi-label">Visits</span><strong>{fmt(stats.totals.visits)}</strong><small>{ratio(stats.totals.views, stats.totals.visits).toFixed(1)} pages per visit</small></div></div>
        <div className="st-kpi is-coral"><div><span className="st-kpi-label">Page views</span><strong>{fmt(stats.totals.views)}</strong><small><Delta now={stats.totals.views} before={stats.previous.views} period={period}/></small></div></div>
      </section>

      <div className="st-row as-row">
        <Card id="as-views" title="Page views" note={stats.hourly ? 'Per hour, today' : `Per day, ${PERIOD_LABEL[period]}`}><Bars points={stats.series} hourly={stats.hourly} metric="views" unit="page views"/></Card>
        <Card id="as-students" title="Students signed in" note={stats.hourly ? 'Per hour, today' : `Per day, ${PERIOD_LABEL[period]}`}><Bars points={stats.series} hourly={stats.hourly} metric="students" unit="students" tone="is-sky"/></Card>
      </div>

      <div className="st-row as-row is-wide-left">
        <Card id="as-promos" title="Landing banners" note={PERIOD_LABEL[period]}>
          {!stats.promos.length ? <p className="as-empty">No banner clicks yet in this period.</p> : <div className="as-promos">{stats.promos.map((row) => <Promo key={row.promo} row={row}/>)}</div>}
        </Card>
        <Card id="as-pages" title="Top pages" note={PERIOD_LABEL[period]}><Pages pages={stats.pages}/></Card>
      </div>
      <p className="as-foot">Visitors are browsers, visits end after 30 idle minutes, and students are counted once each by a private key, never by login. Local and preview runs are not counted.</p>
    </>}
  </main>;
}

/** One series per chart (page views, or students), so each keeps a single scale. */
function Bars({ points, hourly, metric, unit, tone }: { points: DayPoint[]; hourly: boolean; metric: 'views' | 'students'; unit: string; tone?: string }) {
  const max = niceMax(Math.max(1, ...points.map((point) => point[metric])));
  const label = (key: string, long = false) => hourly ? `${key}:00` : new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...(long ? { weekday: 'short', month: 'short', day: 'numeric' } : points.length <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }) });
  const every = hourly ? 6 : points.length <= 7 ? 1 : 5;
  return <div className={cn('sc-plot as-bars', tone)}>
    <div className="sc-y" aria-hidden="true">{[max, max / 2, 0].map((tick) => <span key={tick}>{fmt(tick)}</span>)}</div>
    <div className={cn('sc-bars', points.length > 12 && 'is-dense')}>
      {points.map((point) => <span key={point.key} className="sc-col" tabIndex={0} aria-label={`${label(point.key, true)}: ${point[metric]} ${unit}`}>
        <span className="sc-bar" style={{ height: `${point[metric] / max * 100}%` }}/>
        <span className="sc-tip" role="tooltip"><small>{label(point.key, true)}</small><strong>{fmt(point[metric])}</strong> {unit}{metric === 'views' && <small>{fmt(point.visitors)} visitors · {fmt(point.students)} students</small>}</span>
      </span>)}
    </div>
    <div className="sc-x is-even" aria-hidden="true">{points.map((point, index) => <span key={point.key}>{index % every === 0 ? label(point.key) : ''}</span>)}</div>
  </div>;
}

/** Where banner clicks end up: let through, turned away (other campus), or lost at the 42 sign-in. */
function Promo({ row }: { row: PromoRow }) {
  const decided = row.allowed + row.denied + row.error;
  const dropped = Math.max(0, row.signin - row.returned);
  const parts = [{ key: 'allowed', label: 'Let through', value: row.allowed }, { key: 'denied', label: 'Other campus', value: row.denied }, { key: 'dropped', label: 'Left at sign-in', value: dropped }, { key: 'error', label: 'Errors', value: row.error }];
  return <article className="as-promo">
    <div className="as-promo-head"><h3>{PROMO_NAMES[row.promo] ?? row.promo}</h3><span><b>{fmt(row.clicks)}</b> clicks · <b>{fmt(row.students)}</b> students</span></div>
    <div className="as-stack" role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(', ')}>
      {parts.map((part) => part.value > 0 && <i key={part.key} className={`is-${part.key}`} style={{ flexGrow: part.value }}/>)}
      {decided + dropped === 0 && <i className="is-none" style={{ flexGrow: 1 }}/>}
    </div>
    <ul className="as-legend">{parts.map((part) => <li key={part.key}><i className={`is-${part.key}`} aria-hidden="true"/>{part.label}<b>{fmt(part.value)}</b></li>)}</ul>
  </article>;
}

function Pages({ pages }: { pages: { path: string; views: number; visitors: number }[] }) {
  if (!pages.length) return <p className="as-empty">No page views yet in this period.</p>;
  const max = Math.max(...pages.map((page) => page.views));
  return <ol className="as-pages">{pages.map((page) => <li key={page.path}>
    <span className="as-page-name" title={page.path}>{pageName(page.path)}</span>
    <span className="as-page-track" aria-hidden="true"><em style={{ width: `${page.views / max * 100}%` }}/></span>
    <span className="as-page-value"><b>{fmt(page.views)}</b><small>{fmt(page.visitors)} visitors</small></span>
  </li>)}</ol>;
}
