'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Reports page views plus a lightweight signed-in heartbeat; the server ignores non-production hosts. */
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    const admin = pathname.startsWith('/admin');
    const send = (presence = false) => {
      const payload = JSON.stringify({ path: pathname, ...(presence ? { presence: true } : {}) });
      try {
        if (!navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }))) void fetch('/api/track', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
      } catch { /* stats must never break the app */ }
    };
    send(admin);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') send(true); }, 60_000);
    const visible = () => { if (document.visibilityState === 'visible') send(true); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [pathname]);
  return null;
}
