import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRight, X } from '@/components/icons';
import { KiwiNote } from '@/components/kiwi-guide';
import { loadJourney, summarizeJourney, type Journey } from '@/lib/journey';
import { circlesDone } from '@/lib/circles';
import { loadPresence } from '@/lib/presence';
import type { RankingDataset } from '@/lib/dataset';
import { JourneyRace } from './journey-race';
import { PresenceLoading, PresenceView } from './presence-view';
import { RaceSearch } from './race-search';

type Subject = { id: number; login: string; fell: string | null };

/** Finds a ranked or blackholed student by login, with their blackhole date when their enrollment ended. */
export function findStudent(dataset: RankingDataset, login: string): Subject | null {
  const wanted = login.trim().toLowerCase();
  const active = dataset.students.find((student) => student.login.toLowerCase() === wanted);
  if (active) return { id: active.id, login: active.login, fell: null };
  const lost = dataset.blackholed.find((student) => student.login.toLowerCase() === wanted);
  return lost ? { id: lost.id, login: lost.login, fell: lost.blackholedAt } : null;
}

function Stats({ journey }: { journey: Journey }) {
  const summary = summarizeJourney(journey);
  const stats = [
    { label: 'Circles finished', value: (() => { const done = circlesDone(journey.stops.filter((stop) => !stop.pending)); return done.length ? `${done.length} of 7` : 'None yet'; })() },
    { label: 'Days in Common Core', value: summary.days.toLocaleString('en-US') },
    { label: 'Projects passed', value: String(summary.passed) },
    { label: 'Crashes', value: String(summary.retries) },
    { label: 'Longest break', value: `${summary.longestBreak} days` },
    ...(summary.toughest ? [{ label: 'Toughest', value: `${summary.toughest.project} · ${summary.toughest.tries} tries` }] : []),
  ];
  return <dl className="race-stats">{stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>;
}

/** Logtime charts; only for the signed-in student's own page. */
async function Presence({ userId, from }: { userId: number; from: string }) {
  const result = await loadPresence(userId, from);
  if (result.status !== 'ready') return <p className="race-notice">{result.status === 'rate-limited' ? 'Your logtime stats are paused: the 42 API limit is reached.' : 'Your logtime stats could not load. Try again in a minute.'}</p>;
  return <PresenceView presence={result.presence}/>;
}

/** A student's race page body: header, "race against" picker, the race, and stats. */
export async function RaceView({ subject, self, title, path, vs, dataset }: { subject: Subject; self: boolean; title: string; path: string; vs?: string; dataset: RankingDataset | null }) {
  const opponent = vs && dataset ? findStudent(dataset, vs) : null;
  const [mine, theirs] = await Promise.all([loadJourney(subject.id, subject.fell), opponent && opponent.id !== subject.id ? loadJourney(opponent.id, opponent.fell) : null]);
  const intra = `https://profile.intra.42.fr/users/${encodeURIComponent(subject.login)}`;

  const head = <header className="race-head">
    <div><h1>{title}</h1><p>{self ? 'Your Common Core, from day one to today. Every crash is a failed attempt.' : `${subject.login}'s Common Core. Every crash is a failed attempt.`}</p></div>
    <div className="race-head-actions">
      <RaceSearch path={path} initial={vs}/>
      {!self && <a className="race-intra" href={intra} target="_blank" rel="noopener noreferrer">Intra<ArrowUpRight size={14} weight="bold"/></a>}
    </div>
  </header>;

  if (mine.status !== 'ready') return <>{head}<div className="race-empty"><KiwiNote><h2>{mine.status === 'empty' ? 'No Common Core yet' : 'The track is not ready'}</h2><p>{mine.status === 'empty' ? 'The race starts on the first Common Core day.' : mine.status === 'rate-limited' ? 'The 42 API limit is reached. Try again shortly.' : 'Kiwi could not reach 42 Intra. Try again in a minute.'}</p></KiwiNote></div></>;

  const versus = theirs?.status === 'ready' ? theirs.journey : null;
  const notice = vs && !versus ? (opponent ? (opponent.id === subject.id ? 'Pick someone else to race.' : 'Their race is not available right now.') : `No student called “${vs}”.`) : null;
  const runners = [
    { journey: mine.journey, login: subject.login, art: '/assets/cats/kiwi-mascot.webp', tag: !!versus },
    ...(versus && opponent ? [{ journey: versus, login: opponent.login, art: '/assets/cats/tiger-mascot.webp', tag: true }] : []),
  ];
  return <>
    {head}
    {notice && <p className="race-notice">{notice}</p>}
    {versus && opponent && <p className="race-versus-note"><span>{subject.login} vs {opponent.login}</span>Both start on their own first Common Core day.<Link href={path} aria-label="Stop racing"><X size={14}/></Link></p>}
    <JourneyRace runners={runners} label={versus && opponent ? `${subject.login} against ${opponent.login}` : `${subject.login}'s Common Core race`}/>
    <Stats journey={mine.journey}/>
    {self && <Suspense fallback={<PresenceLoading/>}><Presence userId={subject.id} from={mine.journey.start}/></Suspense>}
  </>;
}
