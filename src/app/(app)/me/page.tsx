import { RaceView } from '@/components/race/race-view';
import { requireStudent } from '@/lib/guard';
import { loadRankingDataset } from '@/lib/dataset';

export const metadata = { title: 'My Race' };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function Me({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const vs = (await searchParams).vs;
  // The rankings are only needed to find a "race against" opponent; the page itself never waits for them.
  const wanted = typeof vs === 'string' && vs.trim() ? vs.trim().slice(0, 40) : undefined;
  const state = wanted ? await loadRankingDataset() : null;
  const dataset = state?.status === 'ready' ? state.data : null;
  return <main className="shell race-page">
    <RaceView subject={{ id: Number(user.id), login: user.login }} self title="My race" path="/me" vs={wanted} dataset={dataset}/>
  </main>;
}
