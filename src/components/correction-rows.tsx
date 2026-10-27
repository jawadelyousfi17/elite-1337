'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IntraButton, appHref } from '@/components/rank-row';
import { Avatar } from '@/components/avatar';
import { Check, ChevronUp, Clock3 } from '@/components/icons';
import { cn } from '@/lib/utils';

export type CorrectionRowData = { id: number; userId: number; login: string; mine: boolean; level: number; year: string | null; project: string; at: string; src: string | null; mark?: number | null; attempt?: number | null };

const STEP = 25;
const pastels = ['var(--pastel-1)', 'var(--pastel-2)', 'var(--pastel-3)', 'var(--pastel-4)', 'var(--pastel-5)', 'var(--pastel-6)'];
function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * Waiting or recently validated projects, 25 at a time: more appear as the end of the list comes into view. Like the
 * leaderboard, a click opens the student in the app and the hover button opens 42 Intra.
 */
export function CorrectionRows({ rows, validated }: { rows: CorrectionRowData[]; validated: boolean }) {
  const [shown, setShown] = useState(STEP);
  const [far, setFar] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const done = shown >= rows.length;

  useEffect(() => {
    const target = end.current;
    if (!target || done) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + STEP); }, { rootMargin: '600px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [done, shown]);

  useEffect(() => {
    const update = () => setFar(window.scrollY > window.innerHeight * 1.5);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return <>
    <ol className="pl-rows">{rows.slice(0, shown).map((row, index) => <li key={row.id} className="pl-item">
      <div className={cn('pl-row', row.mine && 'is-mine')} style={{ '--pastel': pastels[index % pastels.length] } as React.CSSProperties}>
        <span className="pl-avatar"><Avatar login={row.login} src={row.src} size={45}/></span>
        <span className="pl-copy"><strong><Link href={appHref(row.login)} className="pl-row-link">{row.login}</Link>{row.mine && <em>You</em>}</strong><span><b>Level {row.level.toFixed(2)}</b> · {row.year ?? '?'}</span></span>
        <IntraButton login={row.login}/>
        <span className="pc-project"><b>{row.project}</b><small suppressHydrationWarning>{validated ? <><Check size={12}/> {row.mark ?? '—'} · {ago(row.at)}</> : <><Clock3 size={12}/> {ago(row.at)}{row.attempt && row.attempt > 1 ? ` · try ${row.attempt}` : ''}</>}</small></span>
      </div>
    </li>)}</ol>
    <div ref={end} className="pl-more">{done && rows.length > STEP && <span className="pl-more-end">You reached the end</span>}</div>
    <button type="button" className="pl-top" data-on={far || undefined} onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} tabIndex={far ? 0 : -1} aria-hidden={!far}><ChevronUp size={18}/>Back to top</button>
  </>;
}
