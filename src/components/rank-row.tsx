import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { HackerBadge } from '@/components/hacker-badge';
import { AlumniBadge } from '@/components/alumni-badge';
import { FrozenBadge } from '@/components/frozen-badge';
import { ArrowUpRight, Hourglass } from '@/components/icons';
import { cn } from '@/lib/utils';

/** One leaderboard row as plain data, so the server page and the infinite list render it the same way. */
export type RankRowData = { id: number; login: string; level: number; year: string | null; campus: string; src: string | null; hacker: boolean }
  & ({ kind: 'ranked'; rank: number; mine: boolean; alumni: boolean; frozen: boolean } | { kind: 'lost'; blackholedAt: string });

const pastels = ['var(--pastel-1)', 'var(--pastel-2)', 'var(--pastel-3)', 'var(--pastel-4)', 'var(--pastel-5)', 'var(--pastel-6)'];
export const pastel = (rank: number) => pastels[(rank - 2 + pastels.length * 100) % pastels.length];
export const appHref = (login: string) => `/students/${encodeURIComponent(login)}`;
const profileHref = (login: string) => `https://profile.intra.42.fr/users/${encodeURIComponent(login)}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

/** Ghost button before the rank, shown on hover: the rest of the row opens the student in the app. */
export function IntraButton({ login, podium }: { login: string; podium?: boolean }) {
  return <a className={podium ? 'pl-intra is-podium' : 'pl-intra'} href={profileHref(login)} target="_blank" rel="noopener noreferrer" aria-label={`${login} on 42 Intra (opens in a new tab)`}>Intra<ArrowUpRight size={13} weight="bold"/></a>;
}

export function RankRow({ row }: { row: RankRowData }) {
  const ranked = row.kind === 'ranked';
  return <div className={cn('pl-row', ranked ? row.mine && 'is-mine' : 'is-lost')} style={{ '--pastel': ranked ? pastel(row.rank) : '#3a3a3a' } as React.CSSProperties}>
    <span className="pl-avatar"><Avatar login={row.login} src={row.src} size={45}/></span>
    <span className="pl-copy">
      <strong><Link href={appHref(row.login)} className="pl-row-link">{row.login}</Link>{ranked && row.alumni && <AlumniBadge/>}{ranked && row.frozen && <FrozenBadge/>}{row.hacker && <HackerBadge/>}{ranked && row.mine && <em>You</em>}</strong>
      <span><b>Level {row.level.toFixed(2)}</b> · {row.year ?? '?'} · {row.campus}</span>
    </span>
    <IntraButton login={row.login}/>
    {ranked ? <span className="pl-rank" aria-label={`Rank ${row.rank}`}>{row.rank}</span> : <span className="pl-bh is-lost"><Hourglass size={12}/>{shortDate(row.blackholedAt)}</span>}
  </div>;
}
