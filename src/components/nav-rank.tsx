'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronDown, LogOut } from '@/components/icons';
import { Avatar } from '@/components/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export type ViewerRanks = { login: string; photo: string | null; level: number; cohort: number | null; cohortLabel: string; campus: number | null; campusLabel: string; global: number };

/** Profile chip: opens on hover (mouse) or click/tap, shows ranks and holds the log-out action. */
export function NavRank({ ranks, login, logout }: { ranks: ViewerRanks | null; login: string; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpened = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  useEffect(() => clear, []);
  const hover = (next: boolean) => (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clear();
    if (open && !hoverOpened.current) return;
    timer.current = setTimeout(() => { if (next && !open) hoverOpened.current = true; setOpen(next); }, next ? 120 : 220);
  };
  const change = (next: boolean) => { clear(); if (!next) hoverOpened.current = false; setOpen(next); };

  const rows: [string, number | null][] = ranks ? [[ranks.cohortLabel, ranks.cohort], [ranks.campusLabel, ranks.campus], ['All 1337', ranks.global]] : [];
  const name = ranks?.login ?? login;
  return <Popover open={open} onOpenChange={change}>
    <PopoverTrigger asChild>
      <button type="button" className="nav-rank" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onPointerDown={() => { clear(); hoverOpened.current = false; }} aria-label={ranks ? `Your rank: ${ranks.cohort ? `#${ranks.cohort} in ${ranks.cohortLabel}` : 'unranked'}. Open profile menu` : 'Open profile menu'}>
        <Avatar login={name} src={ranks?.photo ?? null} size={34}/>
        {ranks && <span className="nav-rank-value">{ranks.cohort ? `#${ranks.cohort}` : '—'}</span>}
        <span className="nav-rank-caret"><ChevronDown size={15} aria-hidden="true"/></span>
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} className="nav-rank-pop w-72 rounded-2xl border-white/10 bg-popover p-4" onPointerEnter={hover(true)} onPointerLeave={hover(false)} onOpenAutoFocus={(event) => { if (hoverOpened.current) event.preventDefault(); }}>
      <div className="flex items-center gap-3">
        <Avatar login={name} src={ranks?.photo ?? null} size={44}/>
        <div className="min-w-0"><p className="truncate font-medium">{name}</p>{ranks && <p className="text-sm text-muted-foreground">Level {ranks.level.toFixed(2)}</p>}</div>
      </div>
      {ranks && <>
        <Separator className="my-3 bg-white/10"/>
        <dl className="grid gap-2">{rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3"><dt className="truncate text-sm text-muted-foreground">{label}</dt><dd className="nav-rank-num">{value ? `#${value}` : '—'}</dd></div>)}</dl>
      </>}
      <Button asChild className="mt-4 w-full"><Link href="/me" onClick={() => change(false)}>Open my dashboard</Link></Button>
      <form action={logout} className="mt-2"><button type="submit" className="nav-rank-logout"><LogOut size={17} aria-hidden="true"/>Log out</button></form>
    </PopoverContent>
  </Popover>;
}
