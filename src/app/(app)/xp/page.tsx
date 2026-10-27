import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { loadXpProjects } from '@/lib/xp';
import { XpCalculator } from '@/components/xp-calculator';
import { loadJourney } from '@/lib/journey';
import { CIRCLES } from '@/lib/circles';

export const metadata = { title: 'XP Calculator', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The level a student reaches after validating projects with a given mark, and the rank that level would give. */
export default async function XpPage() {
  const user = await requireStudent();
  // The journey is the same cached record the Me page uses: which projects are validated, and with what mark.
  const [state, projects, journey] = await Promise.all([loadRankingDataset(), loadXpProjects().catch(() => null), loadJourney(Number(user.id))]);
  const done: Record<string, number> = {};
  if (journey.status === 'ready') for (const stop of journey.journey.stops) if (stop.passed) done[stop.slug] = stop.attempts.at(-1)?.mark ?? 100;
  // Alternatives the student skipped: FdF once so_long is validated, webserv once ft_irc is.
  const skipped = CIRCLES.flat().filter((group) => group.some((slug) => done[slug] !== undefined)).flat().filter((slug) => done[slug] === undefined);
  const own = state.status === 'ready' ? state.data.students.find((student) => String(student.id) === user.id) : undefined;
  const level = own?.level ?? null;
  // Rank scope = the leaderboard's default view: same campus and Common Core cohort. Only the others' levels are sent.
  const campus = own?.campusIds[0];
  const peers = state.status === 'ready' && own ? state.data.students.filter((student) => student.id !== own.id && student.campusIds.includes(campus!) && student.commonCoreEntryYear === own.commonCoreEntryYear).map((student) => student.level) : null;
  const scope = state.status === 'ready' && own && campus ? `${own.commonCoreEntryYear ? `Cohort ${own.commonCoreEntryYear}` : 'Cohort'} · ${campusName(state.data, campus)}` : null;
  return <main className="shell xp">
    <header className="of-head">
      <h1>XP calculator</h1>
    </header>
    {projects ? <XpCalculator projects={projects.filter((project) => project.xp > 0)} level={level} done={done} skipped={skipped} peers={peers} scope={scope}/> : <p className="fa-empty">Project XP is unavailable right now. Try again in a minute.</p>}
  </main>;
}
