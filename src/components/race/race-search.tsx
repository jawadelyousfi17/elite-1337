'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/avatar';
import { Search } from '@/components/icons';
import { cn } from '@/lib/utils';

type Result = { id: number; login: string; name: string | null; level: number; blackholed: boolean; photo: string | null };

/** Student picker: type a login or a name, pick from live suggestions (Enter takes the first one). Races by default; the XP page reuses it for "calculate for". */
export function RaceSearch({ path, initial, param = 'vs', placeholder = 'Race against… login or name', label = 'Race against another student', action = 'Race', onPick, busy = false }: { path: string; initial?: string; param?: string; placeholder?: string; label?: string; action?: string; onPick?: (login: string) => void; busy?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial ?? '');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/students/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((response) => response.json()).then((data: { results: Result[] }) => { setResults(data.results); setActive(0); setSearching(false); })
        .catch((error) => { /* aborted (a newer search took over) or offline: keep the last list */ if (error?.name !== 'AbortError') setSearching(false); });
    }, 160);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const race = (login: string) => { setOpen(false); setQ(login); if (onPick) onPick(login); else router.push(`${path}?${param}=${encodeURIComponent(login)}`); };
  const submit = () => { const pick = results[active] ?? results[0]; if (pick) race(pick.login); else if (q.trim()) race(q.trim()); };

  return <div className="race-vs" ref={box} role="combobox" aria-expanded={open && results.length > 0} aria-haspopup="listbox">
    {searching || busy ? <i className="race-vs-spin" role="status" aria-label="Loading"/> : <Search size={17} className="race-vs-icon" aria-hidden="true"/>}
    <input value={q} onChange={(event) => { setQ(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
        else if (event.key === 'Enter') { event.preventDefault(); submit(); }
        else if (event.key === 'Escape') setOpen(false);
      }}
      placeholder={placeholder} maxLength={40} autoComplete="off" spellCheck={false} aria-label={label} aria-autocomplete="list" aria-controls="race-vs-list"/>
    <button type="button" onClick={submit} disabled={busy}>{action}</button>
    {open && results.length > 0 && <ul className="race-vs-list" id="race-vs-list" role="listbox">
      {results.map((student, i) => <li key={student.id} role="option" aria-selected={i === active} className={cn(i === active && 'is-active')} onPointerEnter={() => setActive(i)} onPointerDown={(event) => { event.preventDefault(); race(student.login); }}>
        <Avatar login={student.login} src={student.photo} size={32}/>
        <span><b>{student.login}</b><small>{student.name ?? '42 student'}</small></span>
        <em className={cn(student.blackholed && 'is-lost')}>{student.blackholed ? 'Blackholed' : `Lvl ${student.level.toFixed(2)}`}</em>
      </li>)}
    </ul>}
  </div>;
}
