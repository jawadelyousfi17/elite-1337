import { loadCareer, summarizeCareer, type CareerStage } from '@/lib/career';
import type { StudentRank } from '@/lib/ranking';
import { Donut } from './charts';

/** Ordinal mint ramp, light to dark, following the waiting → internship → done order. */
const stages: { key: CareerStage; label: string; color: string }[] = [
  { key: 'waiting', label: 'Waiting for internship', color: '#cafbd2' },
  { key: 'internship', label: 'In internship', color: '#7fcf93' },
  { key: 'done', label: 'Internship done', color: '#3e9a5a' },
];

export async function CareerSection({ students, campusId }: { students: StudentRank[]; campusId?: number }) {
  const career = await loadCareer();
  return <section className="st-card st-career" aria-labelledby="st-career">
    <header><h2 id="st-career">Internships</h2><span className="st-note-chip">After ft_transcendence</span></header>
    {career.status === 'ready' ? (() => {
      const { counts } = summarizeCareer(students, career.records, campusId);
      return <Donut label="Internship track" caption="students" total={counts.waiting + counts.internship + counts.done} parts={stages.map((stage) => ({ key: stage.key, label: stage.label, value: counts[stage.key], color: stage.color }))}/>;
    })() : <p className="st-empty">{career.status === 'rate-limited' ? 'The 42 API limit is reached; internship numbers will be back shortly.' : 'Internship numbers are unavailable right now. Try again in a few minutes.'}</p>}
  </section>;
}

export function CareerSkeleton() {
  return <section className="st-card st-career" aria-busy="true" aria-label="Loading internship numbers">
    <header><h2>Internships</h2><span className="st-note-chip">Loading from 42…</span></header>
    <div className="st-career-loading"/>
  </section>;
}
