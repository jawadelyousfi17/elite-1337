import { KiwiLoader } from '@/components/kiwi-guide';
import { Skel } from '@/components/page-skeletons';

export default function Loading() {
  return <main className="shell st" aria-busy="true">
    <header className="st-top"><div><h1>Stats</h1><p>Common Core</p></div></header>
    <div className="sk-stack">
      <KiwiLoader title="Kiwi is counting every student…" note="Stats cover all four campuses, so the first load can take a few seconds."/>
      <section className="st-kpis">{Array.from({ length: 4 }, (_, index) => <Skel key={index} className="sk-kpi" delay={index * 90}/>)}</section>
      <div className="st-layout">
        <div className="st-main">
          <div className="st-row is-wide-left"><Skel className="sk-chart"/><Skel className="sk-chart" delay={90}/></div>
          <div className="st-row"><Skel className="sk-chart" delay={180}/><Skel className="sk-chart" delay={270}/></div>
        </div>
        <Skel className="sk-side" delay={120}/>
      </div>
    </div>
  </main>;
}
