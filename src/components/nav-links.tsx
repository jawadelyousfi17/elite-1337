'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChartNoAxesCombined, Corrections, Gift, Trophy, UserRound } from '@/components/icons';

const links = [
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: ChartNoAxesCombined },
  { href: '/corrections', label: 'Corrections', icon: Corrections },
  { href: '/offers', label: 'Offers', icon: Gift },
  { href: '/me', label: 'Me', icon: UserRound },
] as const;

export function NavLinks({ variant }: { variant: 'top' | 'bottom' }) {
  const current = usePathname();
  // Light up the tapped tab right away; the real path takes over once the page arrives.
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => setClicked(null), [current]);
  const pathname = clicked ?? current;
  return <>{links.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`) || (href === '/leaderboard' && pathname.startsWith('/students/'));
    return <Link key={href} href={href} className={active ? 'is-active' : undefined} aria-current={active ? 'page' : undefined} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) setClicked(href); }}>
      {variant === 'bottom' && <Icon size={24} strokeWidth={1.7} fill={active && href === '/leaderboard' ? 'currentColor' : 'none'} aria-hidden="true"/>}
      <span>{label}</span>
    </Link>;
  })}</>;
}
