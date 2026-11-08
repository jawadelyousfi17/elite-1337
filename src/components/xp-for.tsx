'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RaceSearch } from '@/components/race/race-search';

/** Student search remains available alongside a custom starting level. */
export function XpFor({ viewing, missing, custom }: { viewing: string | null; missing: string | null; custom: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) => start(() => router.push(href, { scroll: false }));
  return <div className="xp-for" data-pending={pending || undefined}>
    {pending ? <p className="xp-viewing is-loading" role="status"><i className="race-vs-spin" aria-hidden="true"/>Loading calculator…</p>
      : custom ? <p className="xp-viewing">Custom starting level<button type="button" onClick={() => go('/xp')}>Back to me</button></p>
      : viewing ? <p className="xp-viewing">Calculating for <b>{viewing}</b><button type="button" onClick={() => go('/xp')}>Back to me</button></p>
      : missing && <p className="xp-viewing is-miss">No active student called “{missing}” in the rankings. Showing your own.</p>}
    <RaceSearch path="/xp" param="user" placeholder="Calculate for… login or name" label="Calculate for another student" action="Go" busy={pending} onPick={(login) => go(`/xp?user=${encodeURIComponent(login)}`)}/>
  </div>;
}
