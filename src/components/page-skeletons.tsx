import { KiwiLoader } from '@/components/kiwi-guide';

/** Pulsing placeholder block; `delay` staggers neighbours so the page breathes instead of blinking. */
export const Skel = ({ className, delay = 0 }: { className?: string; delay?: number }) => <div className={`sk ${className ?? ''}`} style={{ animationDelay: `${delay}ms` }} aria-hidden="true"/>;

/** Student-row placeholders shared by the leaderboard and corrections loaders. */
export const RowSkeletons = ({ count }: { count: number }) => <div className="pl-rows" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div key={index} className="pc-skeleton" style={{ animationDelay: `${index * 90}ms` }}><i/><span><b/><em/></span><u/></div>)}</div>;

/** My race and a student's race: the track, its numbers, then (on My race) the logtime cards. */
export function RaceLoading({ title }: { title?: string }) {
  return <main className="shell race-page" aria-busy="true">
    <header className="race-head"><div>{title ? <h1>{title}</h1> : <Skel className="sk-title"/>}<p>Common Core, from day one to today.</p></div></header>
    <div className="sk-stack">
      <KiwiLoader title="Kiwi is drawing the track…" note="Projects, attempts and blackhole dates come straight from 42 Intra."/>
      <Skel className="sk-race"/>
      <div className="race-stats">{Array.from({ length: 4 }, (_, index) => <Skel key={index} className="sk-stat" delay={index * 90}/>)}</div>
    </div>
  </main>;
}
