import type { CSSProperties, ReactNode } from 'react';
import type { Bucket, MatrixCell, MonthBucket } from '@/lib/stats';
import { ArrowDownRight, ArrowUpRight } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Donut } from './donut';

/** Campus identity colors in campus-id order: pastel-leaning, checked for chroma, CVD separation and contrast on the #202020 card. */
export const campusColors: Record<number, string> = { 16: '#8fd99f', 21: '#c58ae6', 55: '#e6c35a', 75: '#ee8aa3' };
/** One mint hue, dark to pastel, for magnitude (heatmap, calendar). */
const ramp = ['#26302a', '#2f4a37', '#3f6b4c', '#5f9a6d', '#97d3a4', '#cafbd2'];
/** One red hue for blackhole counts on the calendar: darkest = one student, lightest = the busiest day. */
const redRamp = ['#b3313a', '#e5484d', '#ff7f85', '#ffb3b3'];
const rampStep = (value: number) => Math.min(ramp.length - 1, Math.max(0, Math.ceil(value * (ramp.length - 1))));

const fmt = (value: number) => value.toLocaleString('en-US');
const shortDay = (time: number | string) => new Date(time).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const monthName = (key: string, style: 'short' | 'long' = 'short') => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: style });

function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value)), unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function Tip({ children }: { children: ReactNode }) {
  return <span className="sc-tip" role="tooltip">{children}</span>;
}

/** Straight-segment area chart with a hover crosshair. */
export function WeeklyArea({ weeks }: { weeks: Bucket[] }) {
  const width = 640, height = 200, max = niceMax(Math.max(...weeks.map((week) => week.count)));
  const points = weeks.map((week, index) => [index / (weeks.length - 1) * width, height - week.count / max * height] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const monthStarts = weeks.flatMap((week, index) => index > 0 && new Date(week.start).getUTCMonth() !== new Date(weeks[index - 1].start).getUTCMonth() ? [{ index, label: monthName(new Date(week.start).toISOString().slice(0, 7)) }] : []);

  return <div className="sc-plot is-red">
    <div className="sc-y" aria-hidden="true">{[max, max / 2, 0].map((tick) => <span key={tick}>{fmt(tick)}</span>)}</div>
    <div className="sc-area">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {[0, .5, 1].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="sc-grid"/>)}
        <path d={`${line} L${width},${height} L0,${height} Z`} fill="#ff6b70" fillOpacity=".16"/>
        <path d={line} className="sc-line" vectorEffect="non-scaling-stroke"/>
      </svg>
      <div className="sc-hits">{weeks.map((week, index) => <span key={week.key} className="sc-hit" tabIndex={0} aria-label={`Week of ${shortDay(week.start)}: ${week.count} blackholed`}>
        <i className="sc-cross"/><b className="sc-dot" style={{ top: `${points[index][1] / height * 100}%` }}/>
        <Tip><small>Week of {shortDay(week.start)}</small><strong>{week.count}</strong> blackholed</Tip>
      </span>)}</div>
    </div>
    <div className="sc-x" aria-hidden="true">{monthStarts.map((mark) => <span key={mark.index} style={{ left: `${mark.index / (weeks.length - 1) * 100}%` }}>{mark.label}</span>)}</div>
  </div>;
}

/** All-campus months stack unique students by their first listed campus. */
export function MonthBars({ months, campuses }: { months: MonthBucket[]; campuses?: { id: number; name: string }[] }) {
  const max = niceMax(Math.max(...months.map((month) => month.count)));
  const peak = Math.max(...months.map((month) => month.count));
  const parts = campuses ? [...campuses].sort((a, b) => a.id - b.id) : [];
  if (campuses && months.some((month) => month.byCampus[0])) parts.push({ id: 0, name: 'Unknown campus' });
  const breakdown = (month: MonthBucket) => parts.map((part) => `${part.name}: ${fmt(month.byCampus[part.id] ?? 0)}`).join(', ');
  return <>
    <div className={cn('sc-plot', campuses ? 'is-campus-stack' : 'is-red')}>
      <div className="sc-y" aria-hidden="true">{[max, max / 2, 0].map((tick) => <span key={tick}>{fmt(tick)}</span>)}</div>
      <div className="sc-bars">
        {months.map((month) => <span key={month.key} className={cn('sc-col', peak > 0 && month.count === peak && 'is-peak')} tabIndex={0} aria-label={`${monthName(month.key, 'long')}: ${month.count} blackholed${campuses ? `. ${breakdown(month)}` : ''}`}>
          <span className="sc-bar" style={{ height: `${month.count / max * 100}%` }}>
            {campuses && <span className="sc-stack" aria-hidden="true">{parts.map((part) => <span key={part.id} style={{ height: `${month.count ? (month.byCampus[part.id] ?? 0) / month.count * 100 : 0}%`, background: campusColors[part.id] ?? '#888' }}/>)}</span>}
            {month.change !== null && <em className="sc-change">{month.change >= 0 ? <ArrowUpRight size={11} weight="bold"/> : <ArrowDownRight size={11} weight="bold"/>}{Math.abs(Math.round(month.change * 100))}%</em>}
          </span>
          <Tip><small>{monthName(month.key, 'long')}</small><strong>{month.count}</strong> blackholed
            {campuses && <span className="sc-campus-counts">{parts.map((part) => <span key={part.id}><i style={{ background: campusColors[part.id] ?? '#888' }}/>{part.name}<b>{fmt(month.byCampus[part.id] ?? 0)}</b></span>)}</span>}
          </Tip>
        </span>)}
      </div>
      <div className="sc-x is-even" aria-hidden="true">{months.map((month) => <span key={month.key}>{monthName(month.key)}</span>)}</div>
    </div>
    {campuses && <>
      <ul className="sc-campus-legend" aria-label="Campus colors">{parts.map((part) => <li key={part.id}><i style={{ background: campusColors[part.id] ?? '#888' }} aria-hidden="true"/>{part.name}</li>)}</ul>
    </>}
  </>;
}

/** Survival rate per cohort and campus, one green hue from low to high. */
export function SurvivalHeatmap({ years, campusIds, cells, names, focus }: { years: string[]; campusIds: number[]; cells: Record<string, Record<number, MatrixCell>>; names: Record<number, string>; focus?: number }) {
  return <div className="sc-heat">
    <table>
      <thead><tr><th scope="col"><span className="sr-only">Cohort</span></th>{campusIds.map((id) => <th key={id} scope="col" className={cn(focus && focus !== id && 'is-dim')}>{names[id]}</th>)}</tr></thead>
      <tbody>{years.map((year) => <tr key={year}>
        <th scope="row">{year}</th>
        {campusIds.map((id) => {
          const cell = cells[year][id], step = cell.rate === null ? -1 : rampStep(cell.rate);
          return <td key={id} className={cn(focus && focus !== id && 'is-dim')}>
            <span className={cn('sc-cell', step >= 4 && 'is-light', step < 0 && 'is-empty')} style={step >= 0 ? { background: ramp[step] } : undefined} tabIndex={0}>
              {cell.rate === null ? '–' : `${Math.round(cell.rate * 100)}%`}
              <Tip><small>{year} · {names[id]}</small>{cell.rate === null ? 'No students' : <><strong>{fmt(cell.active)}</strong> active · {fmt(cell.blackholed)} blackholed</>}</Tip>
            </span>
          </td>;
        })}
      </tr>)}</tbody>
    </table>
    <div className="sc-scale" aria-hidden="true"><span>0%</span>{ramp.map((color) => <i key={color} style={{ background: color }}/>)}<span>100% still active</span></div>
  </div>;
}

export { Donut, type DonutPart } from './donut';

/** Active students per campus. */
export function CampusDonut({ parts, total, focus }: { parts: { id: number; name: string; value: number }[]; total: number; focus?: number }) {
  return <Donut label="Active students per campus" caption="active" total={total} parts={parts.map((part) => ({ key: part.id, label: part.name, value: part.value, color: campusColors[part.id] ?? '#888', dim: !!focus && focus !== part.id }))}/>;
}

/** Students per whole level, with median and signed-in student's band marked. */
export function LevelBars({ levels, median, viewerLevel }: { levels: { level: number; count: number }[]; median: number; viewerLevel?: number }) {
  const viewerBand = viewerLevel !== undefined && Number.isFinite(viewerLevel) && viewerLevel >= 0 ? Math.floor(viewerLevel) : undefined;
  const bands = [...levels];
  if (viewerBand !== undefined) while (bands.length <= viewerBand) bands.push({ level: bands.length, count: 0 });
  const max = niceMax(Math.max(1, ...bands.map((band) => band.count)));
  const medianAt = (median + .5) / bands.length * 100;
  return <div className={cn('sc-plot', viewerBand !== undefined && 'has-viewer')}>
    <div className="sc-y" aria-hidden="true">{[max, max / 2, 0].map((tick) => <span key={tick}>{fmt(tick)}</span>)}</div>
    <div className="sc-bars is-dense">
      <span className="sc-median" style={{ left: `${medianAt}%` } as CSSProperties} aria-hidden="true"><em>median {median.toFixed(1)}</em></span>
      {bands.map((band, index) => <span key={band.level} className="sc-col" tabIndex={0} aria-label={`Level ${band.level}: ${band.count} students${band.level === viewerBand ? `. You are here, level ${viewerLevel!.toFixed(2)}` : ''}`}>
        <span className="sc-bar" style={{ height: `${band.count / max * 100}%` }}/>
        {band.level === viewerBand && <span className={cn('sc-you', index < bands.length / 3 && 'is-start', index > bands.length * 2 / 3 && 'is-end')} style={{ bottom: `max(2px, ${band.count / max * 100}%)` }} aria-hidden="true">
          <span className="sc-you-label">You are here</span><span className="sc-you-arrow"/>
        </span>}
        <Tip><small>Level {band.level}–{band.level + 1}</small><strong>{fmt(band.count)}</strong> students{band.level === viewerBand && <small>Your level: {viewerLevel!.toFixed(2)}</small>}</Tip>
      </span>)}
    </div>
    <div className="sc-x is-even" aria-hidden="true">{bands.map((band) => <span key={band.level}>{band.level % 2 === 0 ? band.level : ''}</span>)}</div>
  </div>;
}

/** Month calendar; days shaded by how many students were blackholed. */
export function BlackholeCalendar({ month, days, today }: { month: string; days: { date: string; count: number }[]; today: string }) {
  const lead = new Date(`${month}-01T00:00:00Z`).getUTCDay(), peak = Math.max(1, ...days.map((day) => day.count));
  return <div className="sc-cal" role="grid" aria-label={`Blackholes in ${monthName(month, 'long')}`}>
    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name) => <span key={name} className="sc-cal-head" role="columnheader">{name}</span>)}
    {Array.from({ length: lead }, (_, index) => <span key={`pad${index}`} aria-hidden="true"/>)}
    {days.map((day) => {
      const step = day.count ? Math.min(redRamp.length - 1, Math.ceil(day.count / peak * redRamp.length) - 1) : -1, future = day.date > today;
      return <span key={day.date} role="gridcell" tabIndex={day.count ? 0 : -1} className={cn('sc-day', day.count > 0 && 'has-count', step >= 2 && 'is-light', day.date === today && 'is-today', future && 'is-future')} style={step >= 0 ? { background: redRamp[step] } : undefined} aria-label={`${shortDay(day.date)}: ${day.count} blackholed`}>
        {Number(day.date.slice(8))}
        {day.count > 0 && <Tip><small>{shortDay(day.date)}</small><strong>{day.count}</strong> blackholed</Tip>}
      </span>;
    })}
  </div>;
}
