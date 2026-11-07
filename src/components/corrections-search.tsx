'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { ArrowRight, Corrections, Search, X } from '@/components/icons';
import { matchesSearch } from '@/lib/search';

export type SearchStudent = [login: string, name: string | null, photo: string | null];
export type SearchProject = [slug: string, name: string, count: number];
type Option = { key: string; href: string; label: string; hint?: string; kind: 'search' | 'student' | 'project'; photo?: string | null };

/**
 * A search box with suggestions: typing does not change the list. A popover under the box offers the students and projects
 * in the loaded list that match, and choosing one opens the page filtered by it (Enter searches the typed text).
 */
export function CorrectionsSearch({ action, base, initial, placeholder, clearHref, students, projects }: {
  action: string; base: Record<string, string>; initial: string; placeholder: string; clearHref: string; students: SearchStudent[]; projects: SearchProject[];
}) {
  const router = useRouter(), id = useId(), input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const href = (change: Record<string, string | null>) => {
    const query = new URLSearchParams(base);
    for (const [name, to] of Object.entries(change)) if (to === null) query.delete(name); else query.set(name, to);
    return query.size ? `${action}?${query}` : action;
  };
  const text = value.trim();
  const options = useMemo<Option[]>(() => {
    if (!text) return [];
    const found: Option[] = [{ key: 'search', kind: 'search', href: href({ q: text }), label: `Search “${text}”` }];
    for (const [login, name, photo] of students.filter(([login, name]) => matchesSearch(text, [login, name])).slice(0, 6)) found.push({ key: `s:${login}`, kind: 'student', href: href({ q: login }), label: login, hint: name ?? undefined, photo });
    for (const [slug, name, count] of projects.filter(([slug, name]) => matchesSearch(text, [name, slug])).slice(0, 5)) found.push({ key: `p:${slug}`, kind: 'project', href: href({ project: slug, q: null }), label: name, hint: `${count}` });
    return found;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, students, projects, base, action]);
const listed = open && options.length > 0;
  // Photos load only once typing pauses, so fast typing does not request a picture for every letter; initials show meanwhile.
  const [settled, setSettled] = useState(text);
  useEffect(() => { const timer = setTimeout(() => setSettled(text), 250); return () => clearTimeout(timer); }, [text]);
  const photosReady = settled === text;
  const go = (option: Option) => { setOpen(false); router.push(option.href); };
  const move = (step: number) => { setOpen(true); setActive((at) => options.length ? (at + step + options.length + (at < 0 && step < 0 ? 1 : 0)) % options.length : -1); };
  const groups: [string, Option['kind']][] = [['Search', 'search'], ['Students', 'student'], ['Projects', 'project']];

  return <div className="pc-search">
    <form className="pl-searchbar" action={action} role="search" onSubmit={(event) => { if (active >= 0 && options[active]) { event.preventDefault(); go(options[active]); } }}>
      {Object.entries(base).map(([name, to]) => <input key={name} type="hidden" name={name} value={to}/>)}
      <Search size={20} className="pl-searchbar-icon"/>
      <input ref={input} name="q" placeholder={placeholder} value={value} maxLength={40} aria-label={placeholder} autoComplete="off" enterKeyHint="search"
        role="combobox" aria-expanded={listed} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={listed && active >= 0 ? `${id}-${active}` : undefined}
        onChange={(event) => { setValue(event.target.value); setActive(-1); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
          else if (event.key === 'Escape') { setOpen(false); setActive(-1); }
        }}/>
      {value && <button type="button" className="pl-searchbar-clear" aria-label="Clear search" onMouseDown={(event) => event.preventDefault()} onClick={() => { setValue(''); setActive(-1); input.current?.focus(); if (initial) router.push(clearHref); }}><X size={16}/></button>}
      <button type="submit" className="pl-searchbar-go" aria-label="Search"><ArrowRight size={20} weight="bold"/></button>
    </form>
    {listed && <div className="pc-suggest" id={`${id}-list`} role="listbox" aria-label="Suggestions" onMouseDown={(event) => event.preventDefault()}>
      {groups.map(([title, kind]) => {
        const group = options.filter((option) => option.kind === kind);
        return group.length > 0 && <div key={kind} className="pc-suggest-group" role="group" aria-label={title}>
          {kind !== 'search' && <span className="pc-suggest-title">{title}</span>}
          {group.map((option) => { const at = options.indexOf(option); return <Link key={option.key} id={`${id}-${at}`} href={option.href} role="option" aria-selected={at === active} data-active={at === active || undefined} className="pc-suggest-row" onClick={() => setOpen(false)} onMouseEnter={() => setActive(at)}>
            {option.kind === 'student' ? <Avatar login={option.label} name={option.hint} src={photosReady ? option.photo : null} size={30}/> : option.kind === 'project' ? <Corrections size={17}/> : <Search size={17}/>}
            <span className="pc-suggest-label">{option.label}</span>
            {option.hint && <small>{option.hint}</small>}
          </Link>; })}
        </div>;
      })}
    </div>}
  </div>;
}
