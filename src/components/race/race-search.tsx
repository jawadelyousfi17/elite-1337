'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { Search } from '@/components/icons';
import { cn } from '@/lib/utils';

type Result = { id: number; login: string; name: string | null; level: number; blackholed: boolean; photo: string | null };

/** "Race against" picker: type a login or a name, pick from live suggestions (Enter races the first one). */
export function RaceSearch({ path, initial }: { path: string; initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial ?? '');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/students/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => response.json()).then((data: { results: Result[] }) => { setResults(data.results); setActive(0); })
        .catch(() => { /* aborted or offline: keep the last list */ });
    }, 160);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const race = (login: string) => { setOpen(false); setQ(login); router.push(`${path}?vs=${encodeURIComponent(login)}`); };
  const submit = () => { const pick = results[active] ?? results[0]; if (pick) race(pick.login); else if (q.trim()) race(q.trim()); };

  return <div className="race-vs" ref={box} role="combobox" aria-expanded={open && results.length > 0} aria-haspopup="listbox">
    <Search size={17} className="race-vs-icon" aria-hidden="true"/>
    <input value={q} onChange={(event) => { setQ(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
        else if (event.key === 'Enter') { event.preventDefault(); submit(); }
        else if (event.key === 'Escape') setOpen(false);
      }}
      placeholder="Race against… login or name" maxLength={40} autoComplete="off" spellCheck={false} aria-label="Race against another student" aria-autocomplete="list" aria-controls="race-vs-list"/>
    <button type="button" onClick={submit}>Race</button>
    {open && results.length > 0 && <ul className="race-vs-list" id="race-vs-list" role="listbox">
      {results.map((student, i) => <li key={student.id} role="option" aria-selected={i === active} className={cn(i === active && 'is-active')} onPointerEnter={() => setActive(i)} onPointerDown={(event) => { event.preventDefault(); race(student.login); }}>
        <Avatar login={student.login} src={student.photo} size={32}/>
        <span><b>{student.login}</b><small>{student.name ?? '42 student'}</small></span>
        <em className={cn(student.blackholed && 'is-lost')}>{student.blackholed ? 'Blackholed' : `Lvl ${student.level.toFixed(2)}`}</em>
      </li>)}
    </ul>}
  </div>;
}
