import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { AnonymousAvatar, AnonymousTip } from '@/components/anonymous-tip';
import { HackerBadge } from '@/components/hacker-badge';
import { AlumniBadge } from '@/components/alumni-badge';
import { FrozenBadge } from '@/components/frozen-badge';
import { ArrowUpRight, Hourglass } from '@/components/icons';
import { cn } from '@/lib/utils';

/** One leaderboard row as plain data, so the server page and the infinite list render it the same way. */
export type RankRowData = { id: number; login: string; level: number; year: string | null; campus: string; src: string | null; hacker: boolean }
  & ({ kind: 'ranked'; rank: number; mine: boolean; alumni: boolean; frozen: boolean; lastSeen?: string; anonymous?: boolean } | { kind: 'lost'; blackholedAt: string });

const pastels = ['var(--pastel-1)', 'var(--pastel-2)', 'var(--pastel-3)', 'var(--pastel-4)', 'var(--pastel-5)', 'var(--pastel-6)'];
export const pastel = (rank: number) => pastels[(rank - 2 + pastels.length * 100) % pastels.length];
const profileHref = (login: string) => `https://profile.intra.42.fr/users/${encodeURIComponent(login)}`;
/** Where a click on a student goes: their 42 Intra profile for now (the in-app student page is switched off). */
export const appHref = profileHref;
/** Student links leave the site, so they open in a new tab. */
export const newTab = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** The arrow that fades in on a hovered card to say the link opens in a new tab; screen readers get it as text. */
export function NewTabMark() {
  return <><span className="pl-ext" aria-hidden="true"><ArrowUpRight size={12} weight="bold"/></span><span className="sr-only"> (opens in a new tab)</span></>;
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

export function RankRow({ row }: { row: RankRowData }) {
  const ranked = row.kind === 'ranked';
  // A student who asked to be removed: only their place in the list, no name, level or link.
  if (ranked && row.anonymous) return <div className="pl-row is-anonymous" style={{ '--pastel': '#3a3a3a' } as React.CSSProperties}>
    <span className="pl-avatar"><AnonymousAvatar size={45}/></span>
    <span className="pl-copy"><strong><AnonymousTip/></strong></span>
    <span className="pl-rank" aria-label={`Rank ${row.rank}`}>{row.rank}</span>
  </div>;
  return <div className={cn('pl-row', ranked ? row.mine && 'is-mine' : 'is-lost')} style={{ '--pastel': ranked ? pastel(row.rank) : '#3a3a3a' } as React.CSSProperties}>
    <span className="pl-avatar"><Avatar login={row.login} src={row.src} size={45}/></span>
    <span className="pl-copy">
      <strong><Link href={appHref(row.login)} {...newTab} className="pl-row-link">{row.login}<span className="sr-only"> (opens in a new tab)</span></Link>{ranked && row.alumni && <AlumniBadge/>}{ranked && row.frozen && <FrozenBadge id={row.id} lastSeen={row.lastSeen}/>}{row.hacker && <HackerBadge/>}{ranked && row.mine && <em>You</em>}</strong>
      <span><b>Level {row.level.toFixed(2)}</b> · {row.year ?? '?'} · {row.campus}</span>
    </span>
    <span className="pl-ext" aria-hidden="true"><ArrowUpRight size={12} weight="bold"/></span>
    {ranked ? <span className="pl-rank" aria-label={`Rank ${row.rank}`}>{row.rank}</span> : <span className="pl-bh is-lost"><Hourglass size={12}/>{shortDate(row.blackholedAt)}</span>}
  </div>;
}
