'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Reports each page view to /api/track for the admin site stats; the server ignores non-production hosts. */
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    const payload = JSON.stringify({ path: pathname });
    try {
      if (!navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }))) {
        void fetch('/api/track', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
      }
    } catch { /* stats must never break the app */ }
  }, [pathname]);
  return null;
}
