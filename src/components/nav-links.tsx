'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Calculator, ChartNoAxesCombined, Corrections, Gift, Trophy, UserRound } from '@/components/icons';
import { cn } from '@/lib/utils';

const offers = { href: '/offers', label: 'Offers', icon: Gift };
// Short label: the top bar only fits a word as wide as "Offers"; longer ones push "Me" onto a second line.
const xp = { href: '/xp', label: 'XP', icon: Calculator };
const linksFor = (xpTest: boolean) => [
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: ChartNoAxesCombined },
  { href: '/corrections', label: 'Corrections', icon: Corrections },
  xpTest ? xp : offers,
  { href: '/me', label: 'Me', icon: UserRound },
];

const SEEN = 'nav-test-seen', HIGHLIGHT_CLICKS = 'xp-highlight-clicks', HIGHLIGHT_AFTER_MS = 1000, HIGHLIGHT_UNTIL_CLICKS = 2;
/** Sends one nav A/B test event; also used by the profile menu's Offers link. */
export const beacon = (event: 'seen' | 'xp' | 'offers') => { try { navigator.sendBeacon('/api/stats/nav-test', new Blob([JSON.stringify({ event })], { type: 'application/json' })); } catch { /* stats are best effort */ } };
const highlightClicks = () => { try { return Number(localStorage.getItem(HIGHLIGHT_CLICKS) ?? 0); } catch { return 0; } };

/**
 * Main navigation. `xpTest` is the student's half of the nav A/B test: "XP calculator" replaces "Offers", and the new
 * link gets a "New!" badge 1 s after load until it has been clicked twice (always in development).
 */
export function NavLinks({ variant, xpTest = false }: { variant: 'top' | 'bottom'; xpTest?: boolean }) {
  const current = usePathname();
  // Light up the tapped tab right away; the real path takes over once the page arrives.
  const [clicked, setClicked] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  useEffect(() => setClicked(null), [current]);
  const pathname = clicked ?? current;

  // Once per browser session (top nav only, so it counts once): this student saw their version of the nav.
  useEffect(() => {
    if (variant !== 'top') return;
    try { if (sessionStorage.getItem(SEEN)) return; sessionStorage.setItem(SEEN, '1'); } catch { /* still count it */ }
    beacon('seen');
  }, [variant]);

  useEffect(() => {
    if (!xpTest || current === xp.href) return;
    if (process.env.NODE_ENV !== 'development' && highlightClicks() >= HIGHLIGHT_UNTIL_CLICKS) return;
    const timer = setTimeout(() => setHighlight(true), HIGHLIGHT_AFTER_MS);
    return () => { clearTimeout(timer); setHighlight(false); };
  }, [xpTest, current]);

  const open = (href: string) => {
    if (href === xp.href) {
      beacon('xp');
      setHighlight(false);
      try { localStorage.setItem(HIGHLIGHT_CLICKS, String(highlightClicks() + 1)); } catch { /* nothing to remember */ }
    } else if (href === offers.href) beacon('offers');
  };

  return <>{linksFor(xpTest).map(({ href, label, icon: Icon }) => {
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
