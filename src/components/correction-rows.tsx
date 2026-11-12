'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NewTabMark, appHref, newTab } from '@/components/rank-row';
import { Avatar } from '@/components/avatar';
import { ArrowUpRight, Check, ChevronUp, Clock3, LockKeyhole, X } from '@/components/icons';
import { projectTone } from '@/lib/correction-teams';
import { cn } from '@/lib/utils';

export type CorrectionMember = { userId: number; login: string; name?: string | null; mine: boolean; level: number; year: string | null; src: string | null };
/** One project push: a single student, or every member of the team that pushed it. `steps`: the internship steps it stands for. */
export type CorrectionRowData = { id: number; members: CorrectionMember[]; project: string; projectSlug: string; at: string; mark?: number | null; attempt?: number | null; steps?: string[] };
/** The team's project page on 42 Intra (`id` is a member's projects_user id, which shows the team). */
const teamHref = (row: CorrectionRowData) => `https://projects.intra.42.fr/projects/${encodeURIComponent(row.projectSlug)}/projects_users/${row.id}`;

const STEP = 25;
const pastels = ['var(--pastel-1)', 'var(--pastel-2)', 'var(--pastel-3)', 'var(--pastel-4)', 'var(--pastel-5)', 'var(--pastel-6)'];
function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * Waiting, recently validated or freshly locked team projects, 25 at a time: more appear as the end of the list comes into view. Like the
 * leaderboard, a click opens the student in the app and the hover button opens 42 Intra.
 */
export function CorrectionRows({ rows, mode }: { rows: CorrectionRowData[]; mode: 'waiting' | 'validated' | 'failed' | 'locked' }) {
  const [shown, setShown] = useState(STEP);
  const [far, setFar] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const done = shown >= rows.length;

  useEffect(() => {
    const target = end.current;
    if (!target || done) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + STEP); }, { rootMargin: '600px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [done, shown]);

  useEffect(() => {
    const update = () => setFar(window.scrollY > 320);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return <>
    <ol className="pl-rows">{rows.slice(0, shown).map((row) => {
      const [solo] = row.members, team = row.members.length > 1, mine = row.members.some((member) => member.mine);
      const years = [...new Set(row.members.map((member) => member.year ?? '?'))].join(', ');
      // Two logins fit a row; the rest collapse into "+N" (names on hover), with the viewer always among the named.
      const ordered = [...row.members].sort((a, b) => Number(b.mine) - Number(a.mine)), named = ordered.slice(0, ordered.length > 2 ? 2 : ordered.length), hidden = ordered.slice(named.length);
      return <li key={row.id} className="pl-item">
      <div className={cn('pl-row', mine && 'is-mine', team && 'pc-team')} style={{ '--pastel': pastels[projectTone(row.project, pastels.length)] } as React.CSSProperties}>
        {team ? <>
          {/* The whole card opens the team on Intra; member logins sit above it and open each student. */}
          <a className="pc-team-link" href={teamHref(row)} target="_blank" rel="noopener noreferrer" aria-label={`${row.project}: open the team on 42 Intra (opens in a new tab)`}/>
          <span className="pl-avatar pc-team-avatars">{row.members.slice(0, 3).map((member) => <Avatar key={member.userId} login={member.login} src={member.src} size={45}/>)}</span>
          <span className="pl-copy"><strong className="pc-team-names">{named.map((member, at) => <Fragment key={member.userId}>{at > 0 && <span aria-hidden="true">·</span>}<Link href={appHref(member.login)} {...newTab} className="pc-team-login">{member.login}</Link></Fragment>)}{hidden.length > 0 && <span className="pc-team-more" title={hidden.map((member) => member.login).join(', ')}>+{hidden.length}</span>}{mine && <em>You</em>}<span className="pl-ext" aria-hidden="true"><ArrowUpRight size={12} weight="bold"/></span></strong><span><b>Team of {row.members.length}</b> · {years}</span></span>
        </> : <>
          <span className="pl-avatar"><Avatar login={solo.login} src={solo.src} size={45}/></span>
          <span className="pl-copy"><strong><Link href={appHref(solo.login)} {...newTab} className="pl-row-link">{solo.login}<NewTabMark/></Link>{solo.mine && <em>You</em>}</strong><span><b>Level {solo.level.toFixed(2)}</b> · {solo.year ?? '?'}</span></span>
        </>}
        <span className="pc-project"><b>{row.project}</b><small suppressHydrationWarning title={row.steps?.join(', ')}>{mode === 'validated' ? <><Check size={12}/> {row.mark ?? '—'} · {ago(row.at)}</> : mode === 'failed' ? <><X size={12}/> {row.mark ?? '—'} · {ago(row.at)}</> : mode === 'locked' ? <><LockKeyhole size={12}/> locked {ago(row.at)}</> : <><Clock3 size={12}/> Updated {ago(row.at)}{row.attempt && row.attempt > 1 ? ` · try ${row.attempt}` : ''}{row.steps?.length ? ` · ${row.steps.length} ${row.steps.length === 1 ? 'step' : 'steps'}` : ''}</>}</small></span>
      </div>
    </li>;
    })}</ol>
    <div ref={end} className="pl-more">{done && rows.length > STEP && <span className="pl-more-end">You reached the end</span>}</div>
    <button type="button" className="pl-top" data-on={far || undefined} onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} tabIndex={far ? 0 : -1} aria-hidden={!far}><ChevronUp size={18}/>Back to top</button>
  </>;
}
