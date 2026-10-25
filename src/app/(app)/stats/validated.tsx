import Link from 'next/link';
import { countValidated, loadValidated, topValidated, type ValidatedWindow } from '@/lib/validated';
import { cn } from '@/lib/utils';
import { campusColors, Donut } from './charts';

const windows: { key: ValidatedWindow; label: string; long: string; short: string }[] = [
  { key: 'day', label: '24 hours', long: 'last 24 hours', short: '24h' },
  { key: 'week', label: '7 days', long: 'last 7 days', short: '7d' },
  { key: 'month', label: '30 days', long: 'last 30 days', short: '30d' },
];
const fmt = (value: number) => value.toLocaleString('en-US');

export async function ValidatedWidget({ campusId, window, hrefFor }: { campusId?: number; window: ValidatedWindow; hrefFor: Record<ValidatedWindow, string> }) {
  const state = await loadValidated();
  if (state.status !== 'ready') return <section className="st-card st-validated" aria-labelledby="st-validated">
    <header><h2 id="st-validated">Validated projects</h2></header>
    <p className="st-empty">{state.status === 'rate-limited' ? 'The 42 API limit is reached; back shortly.' : 'Unavailable right now. Try again in a few minutes.'}</p>
  </section>;

  const counts = countValidated(state.records, campusId), top = topValidated(state.records, window, campusId);
  const peak = Math.max(1, ...top.map((item) => item.count));
  const active = windows.find((item) => item.key === window)!;
  return <section className="st-card st-validated" aria-labelledby="st-validated">
    <header><h2 id="st-validated">Validated projects</h2></header>
    <nav data-keep-scroll className="st-validated-tiles" aria-label="Time window">
      {windows.map((item) => <Link key={item.key} href={hrefFor[item.key]} scroll={false} aria-current={item.key === window ? 'true' : undefined}><span>{item.label}</span><strong>{fmt(counts[item.key])}</strong></Link>)}
    </nav>
    <h3 className="st-validated-sub">Most validated · {active.long}</h3>
    {top.length ? <ol className="st-validated-top">{top.map((item) => <li key={item.project}>
      <span className="st-validated-name" title={item.project}>{item.project}</span>
      <b>{fmt(item.count)}</b>
      <i aria-hidden="true"><em style={{ width: `${item.count / peak * 100}%` }}/></i>
    </li>)}</ol> : <p className="st-empty">Nothing validated in the {active.long}.</p>}
  </section>;
}

export function ValidatedSkeleton() {
  return <section className="st-card st-validated" aria-busy="true" aria-label="Loading validated projects">
    <header><h2>Validated projects</h2></header>
    <div className="st-validated-tiles">{windows.map((item) => <span key={item.key} className={cn('is-loading')}><span>{item.label}</span><strong>—</strong></span>)}</div>
  </section>;
}

export async function ValidatedCampusesWidget({ campuses, window, hrefFor }: { campuses: { id: number; name: string }[]; window: ValidatedWindow; hrefFor: Record<ValidatedWindow, string> }) {
  const state = await loadValidated();
  const active = windows.find((item) => item.key === window)!;
  const now = Date.now();
  const parts = state.status === 'ready' ? [...campuses].sort((a, b) => a.id - b.id).map((campus) => ({
    key: campus.id, label: campus.name, color: campusColors[campus.id] ?? '#888', value: countValidated(state.records, campus.id, now)[window],
  })) : [];
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return <section className="st-card st-validated-campuses" aria-labelledby="st-validated-campuses">
    <header>
      <h2 id="st-validated-campuses">Validated projects by campus</h2>
      <nav data-keep-scroll className="st-period" aria-label="Time window">{windows.map((item) => <Link key={item.key} href={hrefFor[item.key]} scroll={false} aria-current={item.key === window ? 'true' : undefined} title={`Last ${item.label}`}>{item.short}</Link>)}</nav>
    </header>
    {state.status !== 'ready' ? <p className="st-empty">{state.status === 'rate-limited' ? 'The 42 API limit is reached; back shortly.' : 'Unavailable right now. Try again in a few minutes.'}</p> : <>
      <Donut label={`Validated projects by campus, ${active.long}`} caption="validated" total={total} parts={parts}/>
      {total === 0 && <p className="st-empty">Nothing validated in the {active.long}.</p>}
    </>}
  </section>;
}

export function ValidatedCampusesSkeleton() {
  return <section className="st-card st-validated-campuses" aria-busy="true" aria-label="Loading validated projects by campus">
    <header><h2>Validated projects by campus</h2><span className="st-period is-loading">{windows.map((item) => <span key={item.key}>{item.short}</span>)}</span></header>
    <p className="st-empty">Loading campus totals…</p>
  </section>;
}
