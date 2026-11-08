import { Calendar, Snowflake } from '@/components/icons';

/** Shown next to students whose account looks frozen (see likelyFrozen); `since` is the approximate freeze date. */
export function FrozenBadge({ since }: { since?: string }) {
  return <><span className="fz-badge" title="Likely in freeze: account paused, blackhole not reached"><Snowflake size={12} weight="bold"/>FROZEN</span>{since && <span className="fz-badge fz-since" title="Last session, so about when the freeze started"><Calendar size={12} weight="bold"/>{since}</span>}</>;
}
