'use client';

import { useEffect } from 'react';

/** Publishes the sidebar's height so CSS can pin its bottom edge when it is taller than the screen. */
export function StickySide({ selector = '.pl-side' }: { selector?: string }) {
  useEffect(() => {
    const side = document.querySelector<HTMLElement>(selector);
    if (!side) return;
    const publish = () => side.style.setProperty('--side-h', `${side.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(side);
    return () => observer.disconnect();
  }, [selector]);
  return null;
}
