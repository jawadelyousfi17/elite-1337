'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { cn } from '@/lib/utils';

/** A horizontal row that a mouse can scroll: arrow buttons at the overflowing edges, and the wheel scrolls sideways. */
export function ScrollRow({ className, children }: { className?: string; children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    const wheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    update();
    el.addEventListener('scroll', update, { passive: true });
    el.addEventListener('wheel', wheel, { passive: false });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => { el.removeEventListener('scroll', update); el.removeEventListener('wheel', wheel); observer.disconnect(); };
  }, []);
  const step = (direction: 1 | -1) => row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.7, behavior: 'smooth' });
  return <div className={cn('scroll-row', edges.start && 'at-start', edges.end && 'at-end')}>
    <button type="button" className="scroll-row-btn is-prev" onClick={() => step(-1)} aria-label="Scroll left" tabIndex={-1} hidden={!edges.start}><ChevronLeft size={16}/></button>
    <div ref={row} className={className}>{children}</div>
    <button type="button" className="scroll-row-btn is-next" onClick={() => step(1)} aria-label="Scroll right" tabIndex={-1} hidden={!edges.end}><ChevronRight size={16}/></button>
  </div>;
}
