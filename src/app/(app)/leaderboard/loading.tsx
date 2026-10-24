import { KiwiLoader } from '@/components/kiwi-guide';
import { RowSkeletons, Skel } from '@/components/page-skeletons';

export default function Loading() {
  return <main className="shell pl pc" aria-busy="true" aria-label="Loading the leaderboard">
    <aside className="pl-side">
      <section className="pl-hero"><h1>Leaderboard</h1><div className="sk-podium" aria-hidden="true"><Skel className="sk-avatar" delay={90}/><Skel className="sk-avatar is-big"/><Skel className="sk-avatar" delay={180}/></div></section>
      <div className="lb-skeleton-search"/>
    </aside>
    <section className="pl-list sk-stack">
      <KiwiLoader title="Kiwi is ranking the students…" note="Fresh rankings can take a few seconds."/>
      <RowSkeletons count={7}/>
    </section>
  </main>;
}
