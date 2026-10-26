'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Instant feedback for in-app links. A filter or page link is a server navigation, so React keeps the old screen until the new
 * one arrives. On click this marks a filter chip as chosen right away, dims the content and runs a top bar until the
 * URL changes. The next render then sets the real state again, so nothing here can drift from the server.
 */
export function InstantNav() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState(false);
  const kept = useRef<number | null>(null);

  // Period switches deep in a page (marked data-keep-scroll) must not jump to the top when the new view commits.
  // Restored before paint, so the jump never shows.
  useLayoutEffect(() => {
    if (kept.current === null) return;
    const y = kept.current;
    kept.current = null;
    window.scrollTo(0, y);
    requestAnimationFrame(() => { if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y); });
  }, [pathname, search]);

  // The new page has rendered: stop the pending state.
  useEffect(() => {
    setPending(false);
    document.querySelector('main[data-pending]')?.removeAttribute('data-pending');
  }, [pathname, search]);

  // Safety net: a navigation that fails or never lands must not leave the page dimmed and the bar running.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(false);
      document.querySelector('main[data-pending]')?.removeAttribute('data-pending');
    }, 20_000);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const start = (main: Element | null) => {
      main?.setAttribute('data-pending', '');
      setPending(true);
    };
    const onClick = (event: MouseEvent) => {
      // Capture phase: Next's <Link> prevents the default before a bubbling listener would see the click.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (url.pathname === location.pathname) {
        choose(link);
        if (link.closest('[data-keep-scroll]')) kept.current = window.scrollY;
      }
      start(link.closest('main') ?? document.querySelector('main'));
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (form.method.toLowerCase() === 'get' && !event.defaultPrevented) start(form.closest('main'));
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit);
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('submit', onSubmit); };
  }, []);

  return <div className="instant-bar" data-on={pending || undefined} aria-hidden="true"><span/></div>;
}

/** Moves the "selected" marker within the clicked link's group, the same way the server will render it. */
function choose(link: HTMLAnchorElement) {
  if (link.hasAttribute('aria-pressed')) {
    const on = link.getAttribute('aria-pressed') !== 'true';
    link.setAttribute('aria-pressed', String(on));
    link.classList.toggle('is-on', on);
    return;
  }
  const group = link.parentElement?.closest('.pl-chips, .st-seg, .pl-pages, .pc-projects, [role="group"]') ?? link.parentElement;
  if (!group) return;
  const siblings = [...group.querySelectorAll<HTMLAnchorElement>('a[href]')];
  for (const marker of ['data-active', 'aria-current'] as const) {
    const value = siblings.find((item) => item.hasAttribute(marker))?.getAttribute(marker);
    if (value == null) continue;
    for (const item of siblings) item.removeAttribute(marker);
    link.setAttribute(marker, value);
  }
  if (siblings.some((item) => item.classList.contains('is-current'))) {
    for (const item of siblings) item.classList.remove('is-current');
    link.classList.add('is-current');
  }
}
