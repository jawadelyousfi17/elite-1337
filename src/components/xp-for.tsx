'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RaceSearch } from '@/components/race/race-search';

/** "Calculate for" picker: shows who the calculator is for and a loading state while that student's data loads. */
export function XpFor({ viewing, missing }: { viewing: string | null; missing: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) => start(() => router.push(href, { scroll: false }));
  return <div className="xp-for" data-pending={pending || undefined}>
    {pending ? <p className="xp-viewing is-loading" role="status"><i className="race-vs-spin" aria-hidden="true"/>Loading their data…</p>
      : viewing ? <p className="xp-viewing">Calculating for <b>{viewing}</b><button type="button" onClick={() => go('/xp')}>Back to me</button></p>
      : missing && <p className="xp-viewing is-miss">No active student called “{missing}” in the rankings. Showing your own.</p>}
    <RaceSearch path="/xp" param="user" placeholder="Calculate for… login or name" label="Calculate for another student" action="Go" busy={pending} onPick={(login) => go(`/xp?user=${encodeURIComponent(login)}`)}/>
  </div>;
}
