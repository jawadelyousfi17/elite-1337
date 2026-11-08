import { Calendar, Snowflake } from '@/components/icons';

/** Shown next to students whose account looks frozen (see likelyFrozen); `since` is how long ago they were last seen and `date` the exact day, shown in the tip. */
export function FrozenBadge({ since, date }: { since?: string; date?: string }) {
  const note = 'Likely in freeze: account paused, blackhole not reached';
  return <>
    <span className="fz-badge pl-anon-tip" tabIndex={0} data-tip={note}><Snowflake size={12} weight="bold"/>FROZEN</span>
    {since && <span className="fz-badge fz-since pl-anon-tip" tabIndex={0} data-tip={`Approximate: last session${date ? ` on ${date}` : ''}, about when the freeze started`}><Calendar size={12} weight="bold"/>{since}</span>}
  </>;
}
