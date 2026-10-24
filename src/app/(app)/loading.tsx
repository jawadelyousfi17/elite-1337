import { KiwiLoader } from '@/components/kiwi-guide';
import { Skel } from '@/components/page-skeletons';

export default function Loading() {
  return <main className="shell" aria-busy="true">
    <div className="sk-stack sk-page">
      <Skel className="sk-title"/>
      <KiwiLoader title="Kiwi is fetching 42 Intra…"/>
      <Skel className="sk-chart"/>
      <div className="sk-pair"><Skel className="sk-chart" delay={90}/><Skel className="sk-chart" delay={180}/></div>
    </div>
  </main>;
}
