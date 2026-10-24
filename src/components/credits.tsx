'use client';

import { useRef, useState } from 'react';
import { ArrowUpRight, GitHub, Instagram, LinkedIn } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Creator = { alias: string; name: string; login: string; photo: string; bio: string; tags: string[]; links: { label: string; href: string; icon: 'github' | 'instagram' | 'linkedin' | 'intra' }[] };

const creators: Creator[] = [
  {
    alias: 'ikosoft', name: 'Yassine Ikoubazene', login: 'yikoubaz', photo: '/assets/credit-ikosoft.webp',
    bio: 'Best at coding and Python.', tags: ['Coding', 'Python'],
    links: [
      { label: 'GitHub', href: 'https://github.com/ikosoftT', icon: 'github' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/yassine-ikoubazene-7ab090384/', icon: 'linkedin' },
      { label: '42 Intra', href: 'https://profile.intra.42.fr/users/yikoubaz', icon: 'intra' },
    ],
  },
  {
    alias: 'Fury', name: 'Jawad El Yousfi', login: 'jel-yous', photo: '/assets/credit-fury.webp',
    bio: 'Loves traveling, creating content and vibe coding.', tags: ['Traveling', 'Content creation', 'Vibe coding'],
    links: [
      { label: 'GitHub', href: 'https://github.com/jawadelyousfi17', icon: 'github' },
      { label: 'Instagram', href: 'https://www.instagram.com/jawad_elyo/', icon: 'instagram' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/jawad-el-yousfi-6200402b1/', icon: 'linkedin' },
      { label: '42 Intra', href: 'https://profile.intra.42.fr/users/jel-yous', icon: 'intra' },
    ],
  },
];

const icons = { github: GitHub, instagram: Instagram, linkedin: LinkedIn, intra: ArrowUpRight };

function CreatorCard({ creator }: { creator: Creator }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hover = (next: boolean) => (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), next ? 120 : 220);
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="credit" onPointerEnter={hover(true)} onPointerLeave={hover(false)} aria-label={`About ${creator.alias}`}>
        <img src={creator.photo} alt="" width={28} height={28}/>
        <strong>{creator.alias}</strong>
      </button>
    </PopoverTrigger>
    <PopoverContent side="top" sideOffset={12} className="creator-card w-80 rounded-[26px] border-white/10 p-0" onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
      <header className="creator-head">
        <img src={creator.photo} alt="" width={64} height={64}/>
        <div>
          <p className="creator-name">{creator.name}</p>
          <p className="creator-login">@{creator.login} · aka <b>{creator.alias}</b></p>
        </div>
      </header>
      <div className="creator-body">
        <p>{creator.bio}</p>
        <ul className="creator-tags">{creator.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
        <div className="creator-links">{creator.links.map((link) => {
          const Icon = icons[link.icon];
          return <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"><Icon size={17}/>{link.label}</a>;
        })}</div>
      </div>
    </PopoverContent>
  </Popover>;
}

export function Credits({ className }: { className?: string }) {
  return <div className={`credits ${className ?? ''}`}>
    <span>Made by</span>
    <CreatorCard creator={creators[0]}/>
    <span className="credit-amp" aria-hidden="true">&amp;</span>
    <CreatorCard creator={creators[1]}/>
  </div>;
}
