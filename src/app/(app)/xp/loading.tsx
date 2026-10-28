import { KiwiLoader } from '@/components/kiwi-guide';
import { Skel } from '@/components/page-skeletons';

/** Sets expectations while the calculator waits for project and student data. */
export default function Loading() {
  return <main className="shell xp" aria-busy="true">
    <header className="of-head"><h1>XP calculator</h1></header>
    <div className="sk-stack">
      <KiwiLoader title="Kiwi is preparing your XP calculator…" note="This one may take a little longer. Allow about a minute for the first load."/>
      <div className="xp-calc" aria-hidden="true">
        <div className="xp-side"><div className="xp-hero"><Skel className="sk-chart"/></div></div>
        <div className="xp-projects"><Skel className="sk-chart" delay={90}/></div>
      </div>
    </div>
  </main>;
}
