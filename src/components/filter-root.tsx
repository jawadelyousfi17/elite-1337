'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Collapsible } from '@/components/ui/collapsible';

type Ended = 'close' | 'outside' | 'button' | 'left';
const MOBILE = '(max-width: 1023px)';

/**
 * The filter panel's open state. With `track`, phones and tablets (where it is a dialog) report each open-to-close
 * session: how many filters were tapped while it was open, and how it was closed. Desktop is never recorded.
 */
export function FilterRoot({ track, defaultOpen, className, children }: { track?: 'leaderboard'; defaultOpen: boolean; className: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const session = useRef<{ start: number; clicks: number } | null>(null);
  const closer = useRef<Ended>('button');

  const finish = (ended: Ended) => {
    const current = session.current;
    session.current = null;
    if (!current || !track) return;
    const body = JSON.stringify({ page: track, clicks: current.clicks, durationMs: Math.min(Date.now() - current.start, 3_600_000), ended });
    try { navigator.sendBeacon('/api/stats/filter-session', new Blob([body], { type: 'application/json' })); } catch { /* stats are best effort */ }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const change = (next: boolean) => {
    if (next && track && matchMedia(MOBILE).matches) session.current = { start: Date.now(), clicks: 0 };
    if (!next) finish(closer.current);
    closer.current = 'button';
    setOpen(next);
  };

  useEffect(() => {
    const element = root.current;
    if (!element || !track) return;
    // On window, in the capture phase: runs before InstantNav (document) marks the tapped chip as picked.
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || !element.contains(target)) return;
      if (target?.closest('.pl-backdrop')) closer.current = 'outside';
      else if (target?.closest('.pl-panel-close')) closer.current = 'close';
      const link = target?.closest<HTMLAnchorElement>('.pl-panel a[href]');
      // A filter that changes the list; tapping the one already picked does nothing, so it is not counted.
      if (link && session.current && !link.hasAttribute('data-active') && link.getAttribute('aria-current') !== 'true') session.current.clicks++;
    };
    const leave = () => finishRef.current('left');
    window.addEventListener('click', onClick, true);
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('click', onClick, true); window.removeEventListener('pagehide', leave); finishRef.current('left'); };
  }, [track]);

  return <Collapsible ref={root} open={open} onOpenChange={change} className={className}>{children}</Collapsible>;
}
