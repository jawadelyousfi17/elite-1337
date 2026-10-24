import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Presence } from '@/lib/presence';

const ZONE = 'Africa/Casablanca', DAY = 86_400_000, WEEKS = 53;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const hrs = (value: number) => value >= 100 ? Math.round(value).toLocaleString('en-US') : value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
const dayLabel = (date: string, weekday = false) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(weekday && { weekday: 'short' }) });
const monthLabel = (key: string, style: 'short' | 'long' = 'short') => new Date(`${key}-01T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: style, ...(style === 'long' && { year: 'numeric' }) });
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value)), unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function Tip({ children }: { children: ReactNode }) {
  return <span className="sc-tip" role="tooltip">{children}</span>;
}

/** When the busiest hours fall: late night, early morning, or the working day. */
function rhythm(hours: number[]) {
  const total = hours.reduce((sum, h) => sum + h, 0) || 1;
  const share = (from: number, to: number) => hours.slice(from, to).reduce((sum, h) => sum + h, 0) / total;
  const night = share(0, 5) + hours[22] / total + hours[23] / total, morning = share(5, 10);
  return night >= .2 ? { name: 'Night owl', note: `${Math.round(night * 100)}% of your time is after 22:00` }
    : morning >= .25 ? { name: 'Early bird', note: `${Math.round(morning * 100)}% of your time is before 10:00` }
    : { name: 'Daytime coder', note: 'Most of your time is between 10:00 and 22:00' };
}

function Bars({ items, label, dense, axis }: { items: { key: string; value: number; tip: string }[]; label: string; dense?: boolean; axis: (key: string, index: number) => string }) {
  const max = niceMax(Math.max(...items.map((item) => item.value))), peak = Math.max(...items.map((item) => item.value));
  return <div className="sc-plot pr-plot">
    <div className="sc-y" aria-hidden="true">{[max, max / 2, 0].map((tick) => <span key={tick}>{hrs(tick)}h</span>)}</div>
    <div className={cn('sc-bars', dense && 'is-dense')} role="list" aria-label={label}>
      {items.map((item) => <span key={item.key} role="listitem" className={cn('sc-col', peak > 0 && item.value === peak && 'is-peak')} tabIndex={0} aria-label={`${item.tip}: ${hrs(item.value)} hours`}>
        <span className="sc-bar" style={{ height: `${item.value / max * 100}%` }}/>
        <Tip><small>{item.tip}</small><strong>{hrs(item.value)}h</strong></Tip>
      </span>)}
    </div>
    <div className="sc-x is-even" aria-hidden="true">{items.map((item, index) => <span key={item.key}>{axis(item.key, index)}</span>)}</div>
  </div>;
}

/** GitHub-style grid of the last year, one column per week, Monday on top. */
function Calendar({ days, today }: { days: Record<string, number>; today: string }) {
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7, first = addDays(today, -weekday - (WEEKS - 1) * 7);
  const weeks = Array.from({ length: WEEKS }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
  const peak = Math.max(1, ...weeks.flat().map((date) => days[date] ?? 0));
  const level = (h: number) => h < .25 ? 0 : Math.min(4, Math.ceil(h / peak * 4));
  // right-to-left scroller so narrow screens open on the latest weeks
  return <div className="pr-cal-scroll"><div className="pr-cal-wrap">
    <div className="pr-cal-days" aria-hidden="true"><span/>{WEEKDAYS.map((name, index) => <span key={name}>{index % 2 ? '' : name}</span>)}</div>
    <div className="pr-cal" role="grid" aria-label="Logtime per day, last year">
      {weeks.map((week, index) => {
        const month = week[0].slice(0, 7), label = index === 0 || month !== weeks[index - 1][0].slice(0, 7) ? monthLabel(month) : '';
        return <div key={week[0]} className={cn('pr-week', index < 3 && 'is-start', index > WEEKS - 4 && 'is-end')} role="row">
          <span className="pr-month" aria-hidden="true">{label}</span>
          {week.map((date) => {
            const h = days[date] ?? 0;
            if (date > today) return <span key={date} className="pr-cell is-future" aria-hidden="true"/>;
            return <span key={date} role="gridcell" tabIndex={-1} className={cn('pr-cell', `is-l${level(h)}`)} aria-label={`${dayLabel(date, true)}: ${hrs(h)} hours`}>
              <Tip><small>{dayLabel(date, true)}</small><strong>{hrs(h)}h</strong></Tip>
            </span>;
          })}
        </div>;
      })}
    </div>
  </div></div>;
}

function Card({ title, note, children, wide }: { title: string; note?: ReactNode; children: ReactNode; wide?: boolean }) {
  return <section className={cn('st-card pr-card', wide && 'is-wide')}>
    <header><h2>{title}</h2>{note && <span className="pr-note">{note}</span>}</header>
    {children}
  </section>;
}

/** Your own logtime habits under the race. Seats and schedules are personal, so this only renders on /me. */
export function PresenceView({ presence }: { presence: Presence }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(Date.now());
  const mood = rhythm(presence.hours), topSeat = presence.seats[0];
  const tiles = [
    { label: 'Total logtime', value: `${hrs(presence.totalHours)}h`, sub: `${presence.activeDays.toLocaleString('en-US')} days on campus` },
    { label: 'Longest streak', value: `${presence.longestStreak} ${presence.longestStreak === 1 ? 'day' : 'days'}`, sub: 'in a row', tone: 'gold' },
    { label: 'Current streak', value: `${presence.currentStreak} ${presence.currentStreak === 1 ? 'day' : 'days'}`, sub: presence.currentStreak ? 'keep it going' : 'start one today', tone: presence.currentStreak ? 'mint' : undefined },
    { label: 'Favorite seat', value: topSeat?.host ?? '—', sub: topSeat ? `${hrs(topSeat.hours)}h there` : 'no sessions yet' },
    { label: 'Favorite cluster', value: presence.cluster?.name ?? '—', sub: presence.cluster ? `${hrs(presence.cluster.hours)}h there` : 'no sessions yet' },
    { label: 'Longest day', value: presence.bestDay ? `${hrs(presence.bestDay.hours)}h` : '—', sub: presence.bestDay ? dayLabel(presence.bestDay.date) : 'no sessions yet' },
  ];
  const seatMax = Math.max(1, ...presence.seats.map((seat) => seat.hours));

  return <div className="pr" aria-label="Your logtime">
    <h2 className="pr-title">Your logtime <small>Only you can see this</small></h2>
    <dl className="pr-kpis">{tiles.map((tile) => <div key={tile.label} className={cn(tile.tone && `is-${tile.tone}`)}><dt>{tile.label}</dt><dd>{tile.value}</dd><dd className="pr-sub">{tile.sub}</dd></div>)}</dl>
    <div className="pr-grid">
      <Card title="Activity" note={`${hrs(Object.entries(presence.days).filter(([date]) => date >= addDays(today, -WEEKS * 7)).reduce((sum, [, h]) => sum + h, 0))}h in the last year`} wide>
        <Calendar days={presence.days} today={today}/>
        <div className="pr-scale" aria-hidden="true"><span>Less</span>{[0, 1, 2, 3, 4].map((step) => <i key={step} className={`pr-cell is-l${step}`}/>)}<span>More</span></div>
      </Card>
      <Card title="Hours per month">
        <Bars label="Hours per month" items={presence.months.map((month) => ({ key: month.key, value: month.hours, tip: monthLabel(month.key, 'long') }))} axis={(key, index) => index % 2 === presence.months.length % 2 ? '' : monthLabel(key)}/>
      </Card>
      <Card title="When you code" note={<><b>{mood.name}</b> · {mood.note}</>}>
        <Bars dense label="Hours by time of day" items={presence.hours.map((value, hour) => ({ key: String(hour), value, tip: `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}` }))} axis={(_, hour) => hour % 6 === 0 ? hourLabel(hour) : ''}/>
      </Card>
      <Card title="Weekdays">
        <Bars label="Hours by weekday" items={presence.weekdays.map((value, index) => ({ key: WEEKDAYS[index], value, tip: WEEKDAYS[index] }))} axis={(key) => key}/>
      </Card>
      <Card title="Top seats">
        {presence.seats.length ? <ol className="pr-seats">{presence.seats.map((seat, index) => <li key={seat.host}>
          <span className="pr-seat"><b>{index + 1}</b>{seat.host}</span><strong>{hrs(seat.hours)}h</strong>
          <i aria-hidden="true"><em style={{ width: `${seat.hours / seatMax * 100}%` }}/></i>
        </li>)}</ol> : <p className="pr-empty">No sessions yet.</p>}
      </Card>
    </div>
  </div>;
}

/** Placeholder in the shape of the stats while the 42 sessions load. */
export function PresenceLoading() {
  return <div className="pr is-loading" role="status" aria-live="polite">
    <h2 className="pr-title">Your logtime <small className="pr-loading-note"><i aria-hidden="true"/>Counting your hours on campus…</small></h2>
    <div className="pr-kpis" aria-hidden="true">{['Total logtime', 'Longest streak', 'Current streak', 'Favorite seat', 'Favorite cluster', 'Longest day'].map((label) => <div key={label}><span className="pr-kpi-label">{label}</span><b className="pr-skel is-value"/><b className="pr-skel is-sub"/></div>)}</div>
    <div className="pr-grid" aria-hidden="true">
      <section className="st-card pr-card is-wide"><header><h2>Activity</h2></header><b className="pr-skel is-cal"/></section>
      {['Hours per month', 'When you code', 'Weekdays', 'Top seats'].map((title) => <section key={title} className="st-card pr-card"><header><h2>{title}</h2></header><b className="pr-skel is-chart"/></section>)}
    </div>
  </div>;
}
