import { Snowflake } from '@/components/icons';

/** Shown next to students whose account looks frozen (see likelyFrozen). */
export function FrozenBadge() {
  return <span className="fz-badge" title="Likely in freeze: account paused, blackhole not reached"><Snowflake size={12} weight="bold"/>FROZEN</span>;
}
