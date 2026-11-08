'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Calendar, Snowflake } from '@/components/icons';
import { daysAgo } from '@/lib/time';
import { requestSeen, seenOf, subscribe } from '@/lib/frozen-seen-client';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

/** Shown next to students whose account looks frozen (see likelyFrozen). The freeze date (their last session) loads after the page, so it never slows it down. */
export function FrozenBadge({ id, lastSeen }: { id: number; lastSeen?: string }) {
  const live = useSyncExternalStore(subscribe, () => seenOf(id), () => undefined);
  useEffect(() => { if (!lastSeen) requestSeen(id); }, [id, lastSeen]);
  const at = lastSeen ?? live ?? undefined;
  return <>
    <span className="fz-badge"><Snowflake size={12} weight="bold"/>FROZEN</span>
    {at && <span className="fz-badge fz-since pl-anon-tip" tabIndex={0} data-tip={`Approximately ${shortDate(at)}`}><Calendar size={12} weight="bold"/>{daysAgo(at)}</span>}
  </>;
}
