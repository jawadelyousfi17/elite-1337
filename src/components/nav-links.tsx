'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Calculator, ChartNoAxesCombined, Corrections, Trophy, UserRound } from '@/components/icons';
import { cn } from '@/lib/utils';

// Short label: the top bar only fits a word as wide as "Offers"; longer ones push "Me" onto a second line.
const xp = { href: '/xp', label: 'XP', icon: Calculator };
const LINKS = [
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: ChartNoAxesCombined },
  { href: '/corrections', label: 'Corrections', icon: Corrections },
  xp,
  { href: '/me', label: 'Me', icon: UserRound },
];

const HIGHLIGHT_CLICKS = 'xp-highlight-clicks', HIGHLIGHT_AFTER_MS = 1000, HIGHLIGHT_UNTIL_CLICKS = 2;
const highlightClicks = () => { try { return Number(localStorage.getItem(HIGHLIGHT_CLICKS) ?? 0); } catch { return 0; } };

/** Main navigation. The XP calculator link gets a "New!" badge 1 s after load until it has been clicked twice (always in development). */
export function NavLinks({ variant }: { variant: 'top' | 'bottom' }) {
  const current = usePathname();
  // Light up the tapped tab right away; the real path takes over once the page arrives.
  const [clicked, setClicked] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  useEffect(() => setClicked(null), [current]);
  const pathname = clicked ?? current;

  useEffect(() => {
    if (current === xp.href) return;
    if (process.env.NODE_ENV !== 'development' && highlightClicks() >= HIGHLIGHT_UNTIL_CLICKS) return;
    const timer = setTimeout(() => setHighlight(true), HIGHLIGHT_AFTER_MS);
    return () => { clearTimeout(timer); setHighlight(false); };
  }, [current]);

  const open = (href: string) => {
    if (href !== xp.href) return;
    setHighlight(false);
    try { localStorage.setItem(HIGHLIGHT_CLICKS, String(highlightClicks() + 1)); } catch { /* nothing to remember */ }
  };

  return <>{LINKS.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`) || (href === '/leaderboard' && pathname.startsWith('/students/'));
    const glowing = highlight && href === xp.href && !active;
    return <Link key={href} href={href} className={cn(active && 'is-active', glowing && 'is-new')} aria-current={active ? 'page' : undefined} aria-label={href === xp.href ? 'XP calculator' : undefined} title={href === xp.href ? 'XP calculator' : undefined}
      onClick={(event) => { open(href); if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) setClicked(href); }}>
      {variant === 'bottom' && <Icon size={24} strokeWidth={1.7} fill={active && href === '/leaderboard' ? 'currentColor' : 'none'} aria-hidden="true"/>}
      <span>{label}</span>
      {glowing && <em className="nav-new" aria-label="New feature">New!</em>}
    </Link>;
  })}</>;
}
