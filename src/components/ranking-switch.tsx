import Link from 'next/link';
import { Students, Waves } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * Students / Piscine switch, styled like the Corrections tabs. "Students" rather than "Common Core": the leaderboard also ranks
 * students who moved on to the advanced curriculum. `inPanel` is the copy inside the filter panel, used where filters collapse.
 */
export function RankingSwitch({ active, inPanel = false }: { active: 'students' | 'piscine'; inPanel?: boolean }) {
  const students = active === 'students';
  return <nav className={cn('fa-tabs pc-tabs pp-switch', inPanel && 'is-in-panel')} aria-label="Ranking type">
    <Link href="/leaderboard" className={cn('fa-tab is-students', students && 'is-picked')} aria-current={students ? 'page' : undefined}><Students size={18}/>Students</Link>
    <Link href="/piscines" className={cn('fa-tab is-piscine', !students && 'is-picked')} aria-current={students ? undefined : 'page'}><Waves size={18}/>Piscine</Link>
  </nav>;
}
