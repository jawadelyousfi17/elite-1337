'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RankRow, type RankRowData } from '@/components/rank-row';
import { ChevronUp } from '@/components/icons';

/** Leaderboard rows that keep loading while you scroll, one 25-row page at a time, for the infinite half of the A/B test. */
export function InfiniteRanks({ initial, query, pages }: { initial: RankRowData[]; query: string; pages: number }) {
  const [rows, setRows] = useState(initial);
  const [next, setNext] = useState(2);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const end = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const done = next > pages;
  const [far, setFar] = useState(false);

  // "Back to top" appears once the list has carried the student well down the page.
  useEffect(() => {
    const update = () => setFar(window.scrollY > window.innerHeight * 1.5);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const toTop = () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  const load = useCallback(async () => {
    if (busy.current || next > pages) return;
    busy.current = true;
    setState('loading');
    try {
      const response = await fetch(`/api/leaderboard/rows?${query}${query ? '&' : ''}page=${next}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json() as { rows: RankRowData[] };
      setRows((current) => { const seen = new Set(current.map((row) => row.id)); return [...current, ...body.rows.filter((row) => !seen.has(row.id))]; });
      setNext((page) => page + 1);
      setState('idle');
      if (next === 2) window.dispatchEvent(new Event('rank-test:engaged'));
    } catch { setState('error'); }
    finally { busy.current = false; }
  }, [next, pages, query]);

  useEffect(() => {
    const target = end.current;
    if (!target || done || state === 'error') return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) void load(); }, { rootMargin: '600px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [done, load, state]);

  return <>
    <ol className="pl-rows">{rows.map((row) => <li key={row.id} className="pl-item"><RankRow row={row}/></li>)}</ol>
    <div ref={end} className="pl-more" data-rank-end={done || undefined} aria-live="polite">
      {state === 'loading' && <span className="pl-more-dots" aria-label="Loading more students"><i/><i/><i/></span>}
      {state === 'error' && <button type="button" className="pl-more-retry" onClick={() => { setState('idle'); void load(); }}>Could not load more. Try again</button>}
      {done && pages > 1 && <span className="pl-more-end">You reached the end</span>}
    </div>
    <button type="button" className="pl-top" data-on={far || undefined} onClick={toTop} tabIndex={far ? 0 : -1} aria-hidden={!far}><ChevronUp size={18}/>Back to top</button>
  </>;
}
