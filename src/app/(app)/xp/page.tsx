import Link from 'next/link';
import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { loadAdvancedProjects, loadXpProjects } from '@/lib/xp';
import { advancedOptions } from '@/lib/xp-advanced';
import { XpCalculator } from '@/components/xp-calculator';
import { loadJourney } from '@/lib/journey';
import { circlesDone, circlesFor, trackOf } from '@/lib/circles';
import { loadOwnCoalition } from '@/lib/coalitions';
import { withTimeout } from '@/lib/timeout';

export const metadata = { title: 'XP Calculator', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VIEWS = [{ key: 'core', label: 'Common Core' }, { key: 'advanced', label: 'Advanced' }] as const;
type View = typeof VIEWS[number]['key'];

/** The level a student reaches after validating projects with a given mark, and the rank that level would give. */
export default async function XpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const asked = (await searchParams).view;
  // The journey is the same cached record the Me page uses: which projects are validated, and with what mark.
  const rankings = loadRankingDataset(), journey = await loadJourney(Number(user.id));
  const stops = journey.status === 'ready' ? journey.journey.stops : [];
  const done: Record<string, number> = {};
  for (const stop of stops) if (stop.passed) done[stop.slug] = stop.attempts.at(-1)?.mark ?? 100;
  // Students from 2025 on follow the new Common Core (Python modules, Codexion…), with its own projects.
  const track = journey.status === 'ready' ? trackOf(stops.map((stop) => stop.slug), journey.journey.start) : 'core';
  // Students who finished every circle open on the Advanced list; either view stays one click away.
  const finished = circlesDone(stops, track).length === circlesFor(track).length;
  const view: View = asked === 'core' || asked === 'advanced' ? asked : finished ? 'advanced' : 'core';
  // Project XP loads alongside the rankings. A cold Advanced list takes about 30 s: past 50 s, show the
  // "unavailable" note instead of hitting the 60 s function limit.
  const [state, coreProjects, catalog] = await Promise.all([rankings, view === 'core' ? loadXpProjects().catch(() => null) : null, view === 'advanced' ? withTimeout(loadAdvancedProjects(), 50_000, null).catch(() => null) : null]);

  const own = state.status === 'ready' ? state.data.students.find((student) => String(student.id) === user.id) : undefined;
  const level = own?.level ?? null;
  // Rank scope = the leaderboard's default view: same campus and Common Core cohort. Only the others' levels are sent.
  const campus = own?.campusIds[0];
  const peers = state.status === 'ready' && own ? state.data.students.filter((student) => student.id !== own.id && student.campusIds.includes(campus!) && student.commonCoreEntryYear === own.commonCoreEntryYear).map((student) => student.level) : null;
  // The coalition only offers the bonus switch: never hold the page for it.
  const standing = own && campus ? await withTimeout(loadOwnCoalition(own.id, campus), 3000, null) : null;
  const coalition = standing && { name: standing.name, color: standing.color, rank: standing.rank, total: standing.total };
  const scope = state.status === 'ready' && own && campus ? `${own.commonCoreEntryYear ? `Cohort ${own.commonCoreEntryYear}` : 'Cohort'} · ${campusName(state.data, campus)}` : null;
  const shared = { level, done, peers, scope, coalition };

  let calculator: React.ReactNode;
  if (view === 'core') {
    // Alternatives the student skipped: FdF once so_long is validated, webserv once ft_irc is.
    const skipped = circlesFor(track).flat().filter((group) => group.some((slug) => done[slug] !== undefined)).flat().filter((slug) => done[slug] === undefined);
    calculator = coreProjects && <XpCalculator key="core" {...shared} skipped={skipped} projects={coreProjects[track].filter((project) => project.xp > 0).map((project) => ({ ...project, tag: `C${project.circle}` }))}/>;
  } else {
    const records = new Set(stops.map((stop) => stop.slug));
    // Only what the student's campus offers: Tétouan and Rabat have apprenticeships Khouribga does not.
    const projects = catalog && advancedOptions(catalog, (slug) => records.has(slug), own?.campusIds ?? null);
    calculator = projects && <XpCalculator key="advanced" {...shared} skipped={[]} projects={projects} upNext={false}/>;
  }

  return <main className="shell xp">
    <header className="of-head xp-head">
      <h1>XP calculator</h1>
      <nav data-keep-scroll className="st-period" aria-label="Curriculum">
        {VIEWS.map((item) => <Link key={item.key} href={`/xp?view=${item.key}`} scroll={false} aria-current={item.key === view ? 'page' : undefined}>{item.label}</Link>)}
      </nav>
    </header>
    {calculator ?? <p className="fa-empty">Project XP is unavailable right now. Try again in a minute.</p>}
  </main>;
}
