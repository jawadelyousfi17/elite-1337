'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from '@/components/icons';

/** Refreshes the server-rendered presence roster while the admin keeps this page visible. */
export function OnlineRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60_000);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  });
  return <button type="button" className="ao-refresh" onClick={refresh} disabled={pending} aria-label="Refresh online students"><RefreshCw size={15} className={pending ? 'spinning' : undefined}/></button>;
}
