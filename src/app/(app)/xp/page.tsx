import { requireStudent } from '@/lib/guard';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { loadAdvancedProjects, loadXpProjects } from '@/lib/xp';
import { advancedOptions } from '@/lib/xp-advanced';
import { XpCalculator } from '@/components/xp-calculator';
import { loadJourney } from '@/lib/journey';
import { circlesDone, circlesFor, trackOf } from '@/lib/circles';
import { loadOwnCoalition } from '@/lib/coalitions';
import { withTimeout } from '@/lib/timeout';
import { cookies } from 'next/headers';
import { XP_VIEW_COOKIE, type XpView } from '@/components/xp-view-tabs';
import { XpFor } from '@/components/xp-for';

export const metadata = { title: 'XP Calculator', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const isView = (value: unknown): value is XpView => value === 'core' || value === 'advanced';

/** The level a student reaches after validating projects with a given mark, and the rank that level would give. */
export default async function XpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const query = await searchParams;
  const asked = query.view, wanted = typeof query.user === 'string' ? query.user.trim().slice(0, 40) : '';
  const rankings = loadRankingDataset();
  // "Calculate for" another student: only the rankings can turn a login into a student, so wait for them just then.
  const early = wanted && wanted.toLowerCase() !== user.login?.toLowerCase() ? await rankings : null;
  const other = early?.status === 'ready' ? early.data.students.find((student) => !student.anonymous && student.login.toLowerCase() === wanted.toLowerCase() && String(student.id) !== user.id) : undefined;
  // The journey is the same cached record the Me page uses: which projects are validated, and with what mark.
  const journey = await loadJourney(other?.id ?? Number(user.id));
  const stops = journey.status === 'ready' ? journey.journey.stops : [];
  const done: Record<string, number> = {};
  for (const stop of stops) if (stop.passed) done[stop.slug] = stop.attempts.at(-1)?.mark ?? 100;
  // Students from 2025 on follow the new Common Core (Python modules, Codexion…), with its own projects.
  const track = journey.status === 'ready' ? trackOf(stops.map((stop) => stop.slug), journey.journey.start) : 'core';
  // Students who finished every circle open on the Advanced list; either view stays one click away.
  const finished = circlesDone(stops, track).length === circlesFor(track).length;
  // A tab picked in the project picker is saved as the student's default and wins over the guess.
  const saved = (await cookies()).get(XP_VIEW_COOKIE)?.value;
  const view: XpView = isView(asked) ? asked : isView(saved) ? saved : finished ? 'advanced' : 'core';
  // Common Core XP loads alongside the rankings (cached for 30 days). The Advanced list starts now but is not awaited:
  // a cold one takes about 30 s, so it streams into the picker later, and past 50 s it shows as unavailable instead
  // of hitting the 60 s function limit.
  const catalog = withTimeout(loadAdvancedProjects(), 50_000, null).catch(() => null);
  const [state, coreProjects] = await Promise.all([rankings, loadXpProjects().catch(() => null)]);

  const own = state.status === 'ready' ? other ?? state.data.students.find((student) => String(student.id) === user.id) : undefined;
  const level = own?.level ?? null;
  // Rank scope = the leaderboard's default view: same campus and Common Core cohort. Only the others' levels are sent.
  const campus = own?.campusIds[0];
  const peers = state.status === 'ready' && own ? state.data.students.filter((student) => student.id !== own.id && student.campusIds.includes(campus!) && student.commonCoreCohort === own.commonCoreCohort).map((student) => student.level) : null;
  // The coalition only offers the bonus switch: never hold the page for it.
  const standing = own && campus ? await withTimeout(loadOwnCoalition(own.id, campus), 3000, null) : null;
  const coalition = standing && { name: standing.name, color: standing.color, rank: standing.rank, total: standing.total };
  const scope = state.status === 'ready' && own && campus ? `${own.commonCoreCohort ? `Cohort ${own.commonCoreCohort}` : 'Cohort'} · ${campusName(state.data, campus)}` : null;
  // Alternatives the student skipped: FdF once so_long is validated, webserv once ft_irc is.
  const skipped = circlesFor(track).flat().filter((group) => group.some((slug) => done[slug] !== undefined)).flat().filter((slug) => done[slug] === undefined);
  const core = coreProjects && coreProjects[track].filter((project) => project.xp > 0).map((project) => ({ ...project, tag: `C${project.circle}` }));
  const records = new Set(stops.map((stop) => stop.slug));
  // Only what the student's campus offers: Tétouan and Rabat have apprenticeships Khouribga does not.
  const advanced = catalog.then((list) => list && advancedOptions(list, (slug) => records.has(slug), own?.campusIds ?? null));

  return <main className="shell xp">
    <header className="of-head xp-head">
      <h1>XP calculator</h1>
      <XpFor viewing={other?.login ?? null} missing={wanted && early && !other ? wanted : null}/>
    </header>
    <XpCalculator key={own?.id ?? "me"} core={core} advanced={advanced} view={view} level={level} done={done} skipped={skipped} peers={peers} scope={scope} coalition={coalition}/>
  </main>;
}
