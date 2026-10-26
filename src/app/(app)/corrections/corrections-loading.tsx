import { KiwiLoader } from '@/components/kiwi-guide';
import { Corrections } from '@/components/icons';
import { RowSkeletons } from '@/components/page-skeletons';

export function CorrectionsLoading() {
  return <main className="shell pl pc" aria-busy="true">
    <aside className="pl-side">
      <section className="pc-head"><h1><Corrections size={28}/> Waiting for correction</h1></section>
      <KiwiLoader title="Kiwi is checking 42 Intra…" note="Fresh results can take a few seconds. Repeat visits load instantly for the next 5 minutes."/>
    </aside>
    <section className="pl-list"><RowSkeletons count={6}/></section>
  </main>;
}
