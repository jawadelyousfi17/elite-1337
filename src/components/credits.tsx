'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, GitHub, Heart, Instagram, LinkedIn } from '@/components/icons';
import type { Contributor } from '@/lib/contributors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Creator = { alias: string; name: string; login: string; photo: string; links: { label: string; href: string; icon: 'github' | 'instagram' | 'linkedin' | 'intra' }[] };

const creators: Creator[] = [
  {
    alias: 'ikosoft', name: 'Yassine Ikoubazene', login: 'yikoubaz', photo: '/assets/credit-ikosoft.webp',
    links: [
      { label: 'GitHub', href: 'https://github.com/ikosoftT', icon: 'github' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/yassine-ikoubazene-7ab090384/', icon: 'linkedin' },
      { label: '42 Intra', href: 'https://profile.intra.42.fr/users/yikoubaz', icon: 'intra' },
    ],
  },
  {
    alias: 'Fury', name: 'Jawad El Yousfi', login: 'jel-yous', photo: '/assets/credit-fury.webp',
    links: [
      { label: 'GitHub', href: 'https://github.com/jawadelyousfi17', icon: 'github' },
      { label: 'Instagram', href: 'https://www.instagram.com/jawad_elyo/', icon: 'instagram' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jawad-el-yousfi-6200402b1/', icon: 'linkedin' },
      { label: '42 Intra', href: 'https://profile.intra.42.fr/users/jel-yous', icon: 'intra' },
    ],
  },
];

const icons = { github: GitHub, instagram: Instagram, linkedin: LinkedIn, intra: ArrowUpRight };

/** Opens its card on hover (mouse) or tap, after a short delay so moving across the row does not flicker. */
function HoverCard({ label, face, children }: { label: string; face: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hover = (next: boolean) => (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), next ? 120 : 220);
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="credit-face" onPointerEnter={hover(true)} onPointerLeave={hover(false)} aria-label={label}>{face}</button>
    </PopoverTrigger>
    <PopoverContent side="top" sideOffset={12} className="creator-card w-80 rounded-[26px] border-white/10 p-0" onPointerEnter={hover(true)} onPointerLeave={hover(false)}>{children}</PopoverContent>
  </Popover>;
}

function CreatorCard({ creator }: { creator: Creator }) {
  return <HoverCard label={`About ${creator.alias}`} face={<img src={creator.photo} alt="" width={28} height={28}/>}>
    <header className="creator-head">
      <img src={creator.photo} alt="" width={64} height={64}/>
      <div>
        <p className="creator-name">{creator.name}</p>
        <p className="creator-login">@{creator.login} · aka <b>{creator.alias}</b></p>
      </div>
    </header>
    <div className="creator-body">
      <div className="creator-links">{creator.links.map((link) => {
        const Icon = icons[link.icon];
        return <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"><Icon size={17}/>{link.label}</a>;
      })}</div>
    </div>
  </HoverCard>;
}

function ContributorCard({ person }: { person: Contributor }) {
  return <HoverCard label={`About ${person.login}`} face={<img src={person.avatar} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer"/>}>
    <header className="creator-head">
      <img src={person.avatar} alt="" width={64} height={64} referrerPolicy="no-referrer"/>
      <div>
        <p className="creator-name">{person.login}</p>
        <p className="creator-login">Contributor{person.commits > 0 && <> · {person.commits} {person.commits === 1 ? 'commit' : 'commits'}</>}</p>
      </div>
    </header>
    <div className="creator-body">
      <div className="creator-links"><a href={person.url} target="_blank" rel="noopener noreferrer"><GitHub size={17}/>GitHub</a></div>
    </div>
  </HoverCard>;
}

const SHOWN = 8;

/** The contributors in one row: Jawad and ikosoft first, then everyone else who has code in the repository. */
export function Credits({ className, contributors = [] }: { className?: string; contributors?: Contributor[] }) {
  const shown = contributors.slice(0, SHOWN), more = contributors.length - shown.length;
  return <div className={`credits ${className ?? ''}`}>
    <span className="credits-label">Built with <Heart size={13} weight="fill" aria-label="love"/> by</span>
    <ul className="credits-faces">
      <li><CreatorCard creator={creators[1]}/></li>
      <li><CreatorCard creator={creators[0]}/></li>
      {shown.map((person) => <li key={person.login}><ContributorCard person={person}/></li>)}
      {more > 0 && <li className="credits-more" aria-label={`${more} more contributors`}>+{more}</li>}
    </ul>
  </div>;
}
