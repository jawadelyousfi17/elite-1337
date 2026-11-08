import { Calendar, Snowflake } from '@/components/icons';
import { daysAgo } from '@/lib/time';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

/** Shown next to students whose account looks frozen (see likelyFrozen); `lastSeen` is their last session, so about when the freeze began. */
export function FrozenBadge({ lastSeen }: { lastSeen?: string }) {
  return <>
    <span className="fz-badge"><Snowflake size={12} weight="bold"/>FROZEN</span>
    {lastSeen && <span className="fz-badge fz-since pl-anon-tip" tabIndex={0} data-tip={`Approximately ${shortDate(lastSeen)}`}><Calendar size={12} weight="bold"/>{daysAgo(lastSeen)}</span>}
  </>;
}
