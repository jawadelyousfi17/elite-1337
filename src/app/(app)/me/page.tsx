import { RaceView } from '@/components/race/race-view';
import { requireStudent } from '@/lib/guard';
import { loadRankingDataset } from '@/lib/dataset';

export const metadata = { title: 'My Race' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function Me({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const vs = (await searchParams).vs;
  const state = await loadRankingDataset();
  const dataset = state.status === 'ready' ? state.data : null;
  const fell = dataset?.blackholed.find((student) => String(student.id) === user.id)?.blackholedAt ?? null;
  return <main className="shell race-page">
    <RaceView subject={{ id: Number(user.id), login: user.login, fell }} self title="My race" path="/me" vs={typeof vs === 'string' && vs.trim() ? vs.trim().slice(0, 40) : undefined} dataset={dataset}/>
  </main>;
}
