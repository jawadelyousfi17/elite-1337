'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Campus, Check, Cohort, Corrections, RefreshCw, Users, X } from '@/components/icons';
import { CorrectionRows, type CorrectionRowData } from '@/components/correction-rows';

type Mode = 'waiting' | 'validated' | 'failed' | 'locked';
/** `periods`: the day windows this tab offers (empty when it has none), each with its link; `days` is the one shown. */
export type CorrectionScope = { campus: string; days: number; periods: { days: number; href: string }[]; cohort?: string; project?: string | null; updated: string | null };

/**
 * The count line and the list. `problem` replaces the list when the data could not load; `empty` is shown when there is nothing to list.
 */
export function CorrectionsResults({ rows, mode, scope, problem, empty }: { rows: CorrectionRowData[]; mode: Mode; scope: CorrectionScope; problem: ReactNode; empty: ReactNode }) {
  const shown = rows;
  const Icon = mode === 'locked' ? Users : mode === 'validated' ? Check : mode === 'failed' ? X : Corrections;
  const unit = mode === 'locked' ? (shown.length === 1 ? 'team' : 'teams') : shown.length === 1 ? 'project' : 'projects';
  return <>
    <div className="pc-summary">
      <span className="is-count"><Icon size={16}/><strong>{shown.length.toLocaleString('en-US')}</strong> {unit}{mode === 'validated' && ' validated'}{mode === 'failed' && ' failed'}{mode === 'locked' && ' locked'}</span>
      <span className="is-campus"><Campus size={16}/>{scope.campus}</span>
      {scope.periods.length > 0 && <nav data-keep-scroll className="st-period pc-period" aria-label="Period">{scope.periods.map((period) => <Link key={period.days} href={period.href} scroll={false} aria-current={period.days === scope.days ? 'true' : undefined} title={`Last ${period.days} days`}>{period.days}d</Link>)}</nav>}
      {scope.cohort && <span className="is-extra"><Cohort size={16}/>Promo {scope.cohort}</span>}
      {scope.project && <span className="is-extra"><Corrections size={16}/>{scope.project}</span>}
      {scope.updated && <span className="is-time"><RefreshCw size={15}/>Updated {scope.updated}</span>}
    </div>
    {problem ?? (shown.length ? <CorrectionRows mode={mode} rows={shown}/> : empty)}
  </>;
}
