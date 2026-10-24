import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { ArrowUpRight, Info } from '@/components/icons';
import { loadValidated, returnRates, type ValidatedWindow } from '@/lib/validated';
import { CORRECTOR_WINDOWS, loadEvaluations, minEvaluations, strictCorrectors, type CorrectorWindow } from '@/lib/correctors';
import type { StudentRank } from '@/lib/ranking';
import { avatarReferencesOrEmpty } from '@/lib/avatars/storage';
import { photoReferences } from '@/lib/avatars/intra-photo';
import { cn } from '@/lib/utils';
import { campusColors } from './charts';

const windows: { key: ValidatedWindow; short: string; long: string }[] = [{ key: 'day', short: '24h', long: 'last 24 hours' }, { key: 'week', short: '7d', long: 'last 7 days' }, { key: 'month', short: '30d', long: 'last 30 days' }];
/** Below this many evaluated attempts a campus's rate is too noisy to compare. */
const MIN_SAMPLE = 20;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const fmt = (value: number) => value.toLocaleString('en-US');

export async function ReturnsSection({ campuses, focus, window, hrefFor }: { campuses: { id: number; name: string }[]; focus?: number; window: ValidatedWindow; hrefFor: Record<ValidatedWindow, string> }) {
  const state = await loadValidated();
  const active = windows.find((item) => item.key === window)!;
  const header = <header>
    <h2 id="st-returns">Project return rate</h2>
    <div className="st-head-tools">
      <nav className="st-period" aria-label="Return rate period">{windows.map((item) => <Link key={item.key} href={hrefFor[item.key]} scroll={false} aria-current={item.key === window ? 'true' : undefined} title={item.long}>{item.short}</Link>)}</nav>
      <span className="st-info" tabIndex={0} aria-label="How the return rate is counted" aria-describedby="st-returns-info">
        <Info size={18}/>
        <span className="st-info-tip" role="tooltip" id="st-returns-info">
          <strong>How it's counted</strong>
          <span>Each evaluated attempt counts once.</span>
          <span>Returned means the student has to retry.</span>
          <span>Internships are left out.</span>
        </span>
      </span>
    </div>
  </header>;
  if (state.status !== 'ready') return <section className="st-card st-returns" aria-labelledby="st-returns">{header}<p className="st-empty">{state.status === 'rate-limited' ? 'The 42 API limit is reached; back shortly.' : 'Unavailable right now. Try again in a few minutes.'}</p></section>;

  const now = Date.now();
  const overall = returnRates(state.records, undefined, now)[window];
  const rows = [...campuses].sort((a, b) => a.id - b.id).map((campus) => ({ ...campus, ...returnRates(state.records, campus.id, now)[window] }));
  const max = Math.max(.1, Math.ceil(Math.max(overall.rate ?? 0, ...rows.map((row) => row.rate ?? 0)) * 10) / 10);
  const at = (rate: number) => `${rate / max * 100}%`;

  return <section className="st-card st-returns" aria-labelledby="st-returns">
    {header}
    <p className="st-returns-lead">{overall.rate === null ? `Nothing was evaluated in the ${active.long}.` : <><strong>{pct(overall.rate)}</strong> of evaluated attempts were returned in the {active.long} · {fmt(overall.returned)} of {fmt(overall.marked)}</>}</p>
    <div className="st-rbars" role="list">
      <div className="st-rbars-plot" aria-hidden="true">
        {[0, max / 2, max].filter((tick) => tick === 0 || overall.rate === null || Math.abs(tick - overall.rate) > max * .14).map((tick) => <span key={tick} className="st-rbars-tick" style={{ left: at(tick) }}>{pct(tick)}</span>)}
        {overall.rate !== null && <span className="st-rbars-avg" style={{ left: at(overall.rate) }}><em>avg {pct(overall.rate)}</em></span>}
      </div>
      {rows.map((row) => {
        const few = row.marked < MIN_SAMPLE;
        return <div key={row.id} role="listitem" className={cn('st-rbar', few && 'is-few', focus && focus !== row.id && 'is-dim')}>
          <span className="st-rbar-name"><i style={{ background: campusColors[row.id] ?? '#888' }} aria-hidden="true"/>{row.name}</span>
          <span className="st-rbar-track" aria-hidden="true">{row.rate !== null && <em style={{ width: at(row.rate) }}/>}</span>
          <span className="st-rbar-value">{row.rate === null ? <b>–</b> : <b>{pct(row.rate)}</b>}<small>{row.rate === null ? 'none evaluated' : `${fmt(row.returned)} of ${fmt(row.marked)}${few ? ' · few' : ''}`}</small></span>
        </div>;
      })}
    </div>
    {rows.some((row) => row.marked > 0 && row.marked < MIN_SAMPLE) && <p className="st-rbars-legend"><i aria-hidden="true"/>Striped: fewer than {MIN_SAMPLE} attempts, read with care</p>}
  </section>;
}

export function ReturnsSkeleton() {
  return <section className="st-card st-returns" aria-busy="true" aria-label="Loading project return rate">
    <header><h2>Project return rate</h2><span className="st-period is-loading">{windows.map((item) => <span key={item.key}>{item.short}</span>)}</span></header>
    <div className="st-career-loading"/>
  </section>;
}

export async function StrictCorrectors({ students, campusId, names, days, hrefFor }: { students: StudentRank[]; campusId?: number; names: Record<number, string>; days: CorrectorWindow; hrefFor: Record<CorrectorWindow, string> }) {
  const state = await loadEvaluations();
  const min = minEvaluations(days);
  const list = state.status === 'ready' ? strictCorrectors(state.evaluations, { days, min, campusId }) : [];
  const known = students.filter((student) => list.some((item) => item.correctorId === student.id));
  const avatars = known.length ? photoReferences(known, await avatarReferencesOrEmpty(known.map((student) => student.id))) : {};
  return <section className="st-card st-correctors" aria-labelledby="st-correctors">
    <header>
      <h2 id="st-correctors">Strictest correctors</h2>
      <div className="st-head-tools">
        <nav className="st-period" aria-label="Strict correctors period">{CORRECTOR_WINDOWS.map((window) => <Link key={window} href={hrefFor[window]} scroll={false} aria-current={window === days ? 'true' : undefined} title={`Last ${window} days`}>{window}d</Link>)}</nav>
        <span className="st-info" tabIndex={0} aria-label="How strictness is measured" aria-describedby="st-correctors-info">
          <Info size={18}/>
          <span className="st-info-tip" role="tooltip" id="st-correctors-info">
            <strong>How it's measured</strong>
            <span>Share of a corrector's evaluations that returned the project.</span>
            <span>{campusId ? names[campusId] : 'All campuses'}, Common Core, last {days} days.</span>
            <span>At least {min} evaluations and one return to be listed.</span>
          </span>
        </span>
      </div>
    </header>
    {state.status !== 'ready' ? <p className="st-empty">{state.status === 'rate-limited' ? 'The 42 API limit is reached; back shortly.' : 'Unavailable right now. Try again in a few minutes.'}</p>
      : list.length ? <ol className="st-correctors-list">{list.map((item, index) => <li key={item.correctorId}>
        <Link href={`https://profile.intra.42.fr/users/${encodeURIComponent(item.login)}`} target="_blank" rel="noopener noreferrer">
          <span className={cn('st-correctors-rank', index < 3 && `is-top is-top-${index + 1}`)}>{index + 1}</span>
          <Avatar login={item.login} src={avatars[item.correctorId]} size={38}/>
          <span className="st-who"><b>{item.login}<ArrowUpRight size={12} weight="bold" className="st-ext"/></b><small>{!campusId && <><i className="st-correctors-campus" style={{ background: campusColors[item.campusId] ?? '#888' }} aria-hidden="true"/>{names[item.campusId]} · </>}returned {fmt(item.returned)} of {fmt(item.evaluations)}</small></span>
          <span className="st-correctors-score">
            <strong>{pct(item.rate)}</strong>
            <i className="st-correctors-bar" aria-hidden="true"><em style={{ width: `${item.rate * 100}%` }}/></i>
          </span>
        </Link>
      </li>)}</ol> : <p className="st-empty">Nobody has {min}+ evaluations with a return yet.</p>}
  </section>;
}

export function StrictCorrectorsSkeleton() {
  return <section className="st-card st-correctors" aria-busy="true" aria-label="Loading strict correctors">
    <header><h2>Strictest correctors</h2><span className="st-note-chip">Loading from 42…</span></header>
    <div className="st-career-loading"/>
  </section>;
}
