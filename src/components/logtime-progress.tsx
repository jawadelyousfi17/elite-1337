import { Clock3 } from '@/components/icons';
import type { LogtimeSummary } from '@/lib/student-overview';

export function formatLogtime(seconds: number): string {
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}m`;
}

const dateLabel = (date: Date) => date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

export function LogtimeProgress({ summary }: { summary: LogtimeSummary | null }) {
  const weekStart = summary && new Date(summary.weekStartIso);
  const monthStart = summary && new Date(summary.monthStartIso);
  const monthEnd = summary && new Date(Date.parse(summary.monthEndIso) - 86_400_000);
  const weekEnd = weekStart && new Date(weekStart.getTime() + 6 * 86_400_000);

  return <section className="panel logtime-panel" aria-label="Logtime progress">
    <div className="logtime-heading"><div><h2>Workstation session time</h2></div><Clock3 size={24}/></div>
    <div className="logtime-grid">
      <div className="logtime-today"><span>Today · UTC</span><strong>{summary ? formatLogtime(summary.todaySeconds) : '—'}</strong><small>{summary ? 'Recorded so far' : '42 logtime unavailable'}</small></div>
      <ProgressCard label="This week" dates={weekStart && weekEnd ? `${dateLabel(weekStart)} – ${dateLabel(weekEnd)}` : 'Monday – Sunday'} seconds={summary?.weekSeconds ?? null} targetHours={30}/>
      <ProgressCard label="This cycle" dates={monthStart && monthEnd ? `${dateLabel(monthStart)} – ${dateLabel(monthEnd)}` : '28th – 27th'} seconds={summary?.monthSeconds ?? null} targetHours={120}/>
    </div>
  </section>;
}

function ProgressCard({ label, dates, seconds, targetHours }: { label: string; dates: string; seconds: number | null; targetHours: number }) {
  const percent = seconds === null ? 0 : Math.floor(seconds / (targetHours * 3600) * 100);
  const remaining = seconds === null ? null : Math.max(0, targetHours * 3600 - seconds);
  return <div className="logtime-goal"><div className="logtime-goal-head"><span>{label}</span><small>{dates}</small></div><div className="logtime-goal-value"><strong>{seconds === null ? '—' : formatLogtime(seconds)}</strong><span>/ {targetHours}h</span></div><div className="logtime-track" role="progressbar" aria-label={`${label} logtime target`} aria-valuenow={seconds === null ? undefined : Math.min(targetHours, Math.floor(seconds / 3600))} aria-valuetext={seconds === null ? 'Unavailable' : `${formatLogtime(seconds)} of ${targetHours} hours`} aria-valuemin={0} aria-valuemax={targetHours}><span style={{ width: `${Math.min(100, percent)}%` }}/></div><small className="logtime-remaining">{remaining === null ? '42 logtime unavailable' : remaining === 0 ? `${percent}% of target · Goal reached` : `${formatLogtime(remaining)} left · ${percent}% of target`}</small></div>;
}
