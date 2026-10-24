import { notFound, redirect } from 'next/navigation';
import { DatasetState } from '@/components/dataset-state';
import { RaceView, findStudent } from '@/components/race/race-view';
import { requireStudent } from '@/lib/guard';
import { loadRankingDataset } from '@/lib/dataset';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }) {
  return { title: `${(await params).login}'s race` };
}

export default async function StudentPage({ params, searchParams }: { params: Promise<{ login: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const { login } = await params;
  if (!/^[\w.-]{1,40}$/.test(login)) notFound();
  const vs = (await searchParams).vs;
  if (login.toLowerCase() === user.login.toLowerCase()) redirect(typeof vs === 'string' && vs ? `/me?vs=${encodeURIComponent(vs)}` : '/me');
  const state = await loadRankingDataset();
  if (state.status !== 'ready') return <DatasetState status={state.status}/>;
  const subject = findStudent(state.data, login);
  if (!subject) notFound();
  return <main className="shell race-page">
    <RaceView subject={subject} self={false} title={`${subject.login}'s race`} path={`/students/${encodeURIComponent(subject.login)}`} vs={typeof vs === 'string' && vs.trim() ? vs.trim().slice(0, 40) : undefined} dataset={state.data}/>
  </main>;
}
