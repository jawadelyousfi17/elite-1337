import Link from 'next/link';
import { Info } from '@/components/icons';
import { cn } from '@/lib/utils';
import { campusColors } from './charts';
import { loadValidated, projectDifficulty, returnRates, type ProjectDifficulty, type ValidatedWindow } from '@/lib/validated';

const LONG: Record<ValidatedWindow, string> = { week: 'last 7 days', month: 'last 30 days' };
const SHORT: Record<ValidatedWindow, string> = { week: '7d', month: '30d' };
/** Below this many evaluated attempts a project's rate is too noisy to rank. */
const MIN_ATTEMPTS = 10;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const fmt = (value: number) => value.toLocaleString('en-US');

type Campus = { id: number; name: string };
/** Below this many attempts on a project a campus's own rate is too noisy to quote. */
const MIN_CAMPUS = 5;

/**
 * The monthly-trend look turned sideways: one row per project, bar length is the return rate, and the bar is split by campus
 * (each campus's share of that project's returns). Without campuses the bar is one colour.
 */
export function DifficultyBars({ list, average, campuses }: { list: ProjectDifficulty[]; average: number | null; campuses?: Campus[] }) {
  const max = Math.max(.1, Math.ceil(Math.max(...list.map((item) => item.rate), average ?? 0) * 10) / 10);
  const at = (rate: number) => `${rate / max * 100}%`;
  const parts = campuses?.length ? [...campuses].sort((a, b) => a.id - b.id) : [];
  const ticks = [0, max / 2, max];
  return <>
    <div className={cn('st-hb', parts.length && 'is-campus')}>
      <ol className="st-hb-rows" role="list">{list.map((item, index) => <li key={item.project} className="st-hb-row" tabIndex={0}
        aria-label={`${item.project}: ${pct(item.rate)} returned, ${fmt(item.returned)} of ${fmt(item.attempts)} attempts${parts.length ? '. ' + parts.filter((part) => item.byCampus[part.id]).map((part) => `${part.name} ${fmt(item.byCampus[part.id].returned)} of ${fmt(item.byCampus[part.id].attempts)}`).join(', ') : ''}`}>
        <span className="st-hb-name"><em>{index + 1}</em><span>{item.project}</span></span>
        <span className="st-hb-plot" aria-hidden="true">
          <span className="st-hb-bar" style={{ width: at(item.rate) }}>
            {parts.map((part) => item.byCampus[part.id]?.returned ? <i key={part.id} style={{ width: `${item.byCampus[part.id].returned / item.returned * 100}%`, background: campusColors[part.id] ?? '#888' }}/> : null)}
          </span>
          {average !== null && <span className="st-hb-avg" style={{ left: at(average) }}/>}
        </span>
        <b>{pct(item.rate)}</b>
        <span className="sc-tip" role="tooltip">
          <small>{item.project}</small><strong>{pct(item.rate)}</strong> returned · {fmt(item.returned)} of {fmt(item.attempts)}
          {parts.length > 0 && <span className="sc-campus-counts">{parts.filter((part) => item.byCampus[part.id]).map((part) => {
            const tally = item.byCampus[part.id];
            return <span key={part.id}><i style={{ background: campusColors[part.id] ?? '#888' }}/>{part.name}<b>{tally.attempts >= MIN_CAMPUS ? `${pct(tally.returned / tally.attempts)} · ` : ''}{fmt(tally.returned)} of {fmt(tally.attempts)}</b></span>;
          })}</span>}
        </span>
      </li>)}</ol>
      <div className="st-hb-axis" aria-hidden="true"><span className="st-hb-ticks">{ticks.map((tick) => <span key={tick} style={{ left: at(tick) }}>{pct(tick)}</span>)}</span></div>
    </div>
    {parts.length > 0 && <ul className="sc-campus-legend" aria-label="Campus colors">
      {parts.map((part) => <li key={part.id}><i style={{ background: campusColors[part.id] ?? '#888' }} aria-hidden="true"/>{part.name}</li>)}
    </ul>}
    {average !== null && <p className="st-hb-note"><i aria-hidden="true"/>Average {pct(average)}{parts.length > 0 && ' · bars split by campus share of the returns'}</p>}
  </>;
}

/** Hardest projects by how often an evaluated attempt is returned; reuses the validated feed, so it costs no extra 42 requests. */
export async function DifficultySection({ campusId, campuses, scope, window, hrefFor }: { campusId?: number; campuses: Campus[]; scope: string; window: ValidatedWindow; hrefFor: Record<ValidatedWindow, string> }) {
  const state = await loadValidated();
  const header = <header>
    <h2 id="st-difficulty">Hardest projects</h2>
    <div className="st-head-tools">
      <nav data-keep-scroll className="st-period" aria-label="Hardest projects period">{(['week', 'month'] as const).map((key) => <Link key={key} href={hrefFor[key]} scroll={false} aria-current={key === window ? 'true' : undefined} title={LONG[key]}>{SHORT[key]}</Link>)}</nav>
      <span className="st-info" tabIndex={0} aria-label="How difficulty is measured" aria-describedby="st-difficulty-info">
        <Info size={18}/>
        <span className="st-info-tip" role="tooltip" id="st-difficulty-info">
          <strong>How it's measured</strong>
          <span>Share of evaluated attempts that were returned.</span>
          <span>{scope}, Common Core, {LONG[window]}.</span>
          {!campusId && <span>Dots show each campus with 5+ attempts on that project.</span>}
          <span>At least {MIN_ATTEMPTS} attempts to be listed; internships are left out.</span>
        </span>
      </span>
    </div>
  </header>;
  if (state.status !== 'ready') return <section className="st-card st-difficulty" aria-labelledby="st-difficulty">{header}<p className="st-empty">{state.status === 'rate-limited' ? 'The 42 API limit is reached; back shortly.' : 'Unavailable right now. Try again in a few minutes.'}</p></section>;
  const list = projectDifficulty(state.records, window, campusId, MIN_ATTEMPTS);
  return <section className="st-card st-difficulty" aria-labelledby="st-difficulty">
    {header}
    {list.length ? <DifficultyBars list={list} average={returnRates(state.records, campusId)[window].rate} campuses={campusId ? undefined : campuses}/> : <p className="st-empty">No project has {MIN_ATTEMPTS}+ evaluated attempts in the {LONG[window]} here yet.</p>}
  </section>;
}

export function DifficultySkeleton() {
  return <section className="st-card st-difficulty" aria-busy="true" aria-label="Loading hardest projects">
    <header><h2>Hardest projects</h2><span className="st-note-chip">Loading from 42…</span></header>
    <div className="st-career-loading"/>
  </section>;
}
