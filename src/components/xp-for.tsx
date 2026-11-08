'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RaceSearch } from '@/components/race/race-search';
import { customLevelSchema } from '@/lib/xp-custom';
import { MAX_XP_LEVEL } from '@/lib/xp-math';

const levelHint = `Enter a level from 0 to ${MAX_XP_LEVEL}, with up to two decimal places.`;

/** Choose a student's progress or a fresh plan with a custom starting level. */
export function XpFor({ viewing, missing, customLevel, invalidLevel }: { viewing: string | null; missing: string | null; customLevel: number | null; invalidLevel: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(customLevel !== null);
  const [value, setValue] = useState(invalidLevel ? '' : customLevel?.toString() ?? '');
  const [error, setError] = useState<string | null>(invalidLevel ? `${levelHint} Using level 0 for now.` : null);
  useEffect(() => {
    setEditing(customLevel !== null);
    setValue(invalidLevel ? '' : customLevel?.toString() ?? '');
    setError(invalidLevel ? `${levelHint} Using level 0 for now.` : null);
  }, [customLevel, invalidLevel, viewing]);
  const go = (href: string) => start(() => router.push(href, { scroll: false }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = customLevelSchema.safeParse(value);
    if (!parsed.success) { setError(levelHint); return; }
    setError(null);
    go(`/xp?level=${parsed.data}`);
  };
  return <div className="xp-for" data-pending={pending || undefined}>
    <div className="xp-for-modes" role="group" aria-label="Calculate from">
      <button type="button" aria-pressed={!editing} disabled={pending} onClick={() => { if (customLevel !== null) go('/xp'); else setEditing(false); }}>Student</button>
      <button type="button" aria-pressed={editing} disabled={pending} onClick={() => setEditing(true)}>Custom level</button>
    </div>
    {pending ? <p className="xp-viewing is-loading" role="status"><i className="race-vs-spin" aria-hidden="true"/>Loading calculator…</p>
      : !editing && (viewing ? <p className="xp-viewing">Calculating for <b>{viewing}</b><button type="button" onClick={() => go('/xp')}>Back to me</button></p>
      : missing && <p className="xp-viewing is-miss">No active student called “{missing}” in the rankings. Showing your own.</p>)}
    {editing ? <form className="xp-custom-level" onSubmit={submit} noValidate>
      <label htmlFor="xp-start-level">Starting level <span>0 to {MAX_XP_LEVEL}</span></label>
      <div className="race-vs xp-custom-field">
        <input id="xp-start-level" name="level" type="number" inputMode="decimal" min={0} max={MAX_XP_LEVEL} step="0.01" required placeholder="e.g. 10.89" value={value} disabled={pending} onChange={(event) => { setValue(event.target.value); setError(null); }} aria-invalid={!!error} aria-describedby={error ? 'xp-level-error' : undefined}/>
        <button type="submit" disabled={pending}>Use level</button>
      </div>
      {error && <p id="xp-level-error" className="xp-level-error" role="alert">{error}</p>}
    </form> : <RaceSearch path="/xp" param="user" placeholder="Calculate for… login or name" label="Calculate for another student" action="Go" busy={pending} onPick={(login) => go(`/xp?user=${encodeURIComponent(login)}`)}/>}
  </div>;
}
