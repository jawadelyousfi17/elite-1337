import { KiwiLoader } from '@/components/kiwi-guide';
import { Skel } from '@/components/page-skeletons';

export default function Loading() {
  return <main className="shell of" aria-busy="true">
    <header className="of-head"><h1>Offers</h1><p>Tools to build. Perks to enjoy. All in one place.</p></header>
    <div className="sk-stack">
      <KiwiLoader title="Kiwi is unpacking the offers…"/>
      <div className="of-grid">{Array.from({ length: 6 }, (_, index) => <Skel key={index} className="sk-offer" delay={index * 90}/>)}</div>
    </div>
  </main>;
}
