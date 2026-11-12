import { Suspense } from 'react';
import { Avatar } from '@/components/avatar';
import { HackerBadge } from '@/components/hacker-badge';
import { ArrowUpRight, Star } from '@/components/icons';
import { intraPhotoUrl } from '@/lib/avatars/intra-photo';
import { CORRECTOR_SAMPLE, loadCorrectorProfile } from '@/lib/corrector-profile';
import { campusName, type RankingDataset } from '@/lib/dataset';
import { cohortRank, topPercent } from '@/lib/ranking';
import { withTimeout } from '@/lib/timeout';

const fmt = (value: number) => value.toLocaleString('en-US');
// Intra shows levels cut to two decimals, not rounded; the XP calculator does the same.
const lvl = (value: number) => (Math.floor(value * 100) / 100).toFixed(2);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** Below this many evaluations, the corrector numbers say little; they are shown with a note. */
const FEW_EVALUATIONS = 5;

/** The student as corrector, as an XP-calculator panel: return rate with its bar, then the details. */
export async function CorrectorCard({ userId, login, self }: { userId: number; login: string; self: boolean }) {
  // One cached 42 request; past 4 s the panel is left out rather than holding the page.
  const result = await withTimeout(loadCorrectorProfile(userId), 4000, null);
  if (!result || result.status !== 'ready' || !result.profile.evaluations) return null;
  const { evaluations, returned, rate, rated, rating } = result.profile;
  return <section className="xp-panel sp-panel" aria-labelledby="sp-corrector">
    <h3 id="sp-corrector">As a corrector</h3>
    <p className="sp-figure"><b>{rate === null ? '—' : `${Math.round(rate * 100)}%`}</b><span>of {fmt(evaluations)} evaluations returned the project</span></p>
    {rate !== null && <div className="xp-bar sp-bar-coral" role="img" aria-label={`${Math.round(rate * 100)}% of evaluations returned`}><i style={{ width: `${rate * 100}%` }}/></div>}
    <dl className="sp-rows">
      <div><dt>Projects returned</dt><dd>{fmt(returned)}</dd></div>
      <div><dt>Average rating</dt><dd>{rating === null ? '—' : <span className="sp-rating">
        <span className="sp-stars" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`} style={{ '--fill': `${rating / 5 * 100}%` } as React.CSSProperties}>
          <span>{[0, 1, 2, 3, 4].map((at) => <Star key={at} size={13}/>)}</span><span className="sp-stars-on">{[0, 1, 2, 3, 4].map((at) => <Star key={at} size={13} weight="fill"/>)}</span>
        </span>{rating.toFixed(1)}</span>}</dd></div>
      <div><dt>Ratings received</dt><dd>{fmt(rated)}</dd></div>
    </dl>
    <p className="xp-note">{evaluations < FEW_EVALUATIONS ? `Only ${evaluations} ${evaluations === 1 ? 'evaluation' : 'evaluations'} so far${self ? '' : ` for ${login}`}, so these numbers can move a lot.` : `From the ${evaluations >= CORRECTOR_SAMPLE ? `last ${CORRECTOR_SAMPLE}` : fmt(evaluations)} evaluations.`}</p>
  </section>;
}

/**
 * Another student's page, built from the XP calculator's pieces: the level hero, then panels for ranks, details and
 * corrections. Uses the shared rankings plus one cached per-student read (corrector).
 */
export async function StudentProfile({ dataset, userId }: { dataset: RankingDataset; userId: number }) {
  const ranked = dataset.students.find((student) => student.id === userId);
  const lost = ranked ? undefined : dataset.blackholed.find((student) => student.id === userId);
  const person = ranked ?? lost;
  if (!person) return null;
  const campus = person.campusIds[0];
  const campusLabel = campus ? campusName(dataset, campus) : null;
  const level = person.level, whole = Math.floor(level), progress = level - whole;
  const peers = ranked && campus ? dataset.students.filter((student) => student.campusIds.includes(campus)) : [];
  const cohortPeers = ranked?.commonCoreCohort ? peers.filter((student) => student.commonCoreCohort === ranked.commonCoreCohort) : [];
  const inCohort = ranked && campus ? cohortRank(dataset.students, ranked, campus) : null;
  const pool = ranked?.poolMonth && ranked.poolYear ? `Piscine ${ranked.poolMonth[0].toUpperCase()}${ranked.poolMonth.slice(1)} ${ranked.poolYear}` : null;
  const status = lost ? `Blackholed ${dateOf(lost.blackholedAt)}` : ranked?.alumni ? 'Alumni' : ranked?.frozen ? 'Frozen' : null;
  const ranks = ranked ? [
    ...(campus && ranked.campusRanks[campus] ? [{ label: `at ${campusLabel}`, rank: ranked.campusRanks[campus], total: peers.length }] : []),
    ...(inCohort ? [{ label: `in cohort ${ranked.commonCoreCohort}`, rank: inCohort, total: cohortPeers.length }] : []),
    { label: 'across 1337', rank: ranked.globalRank, total: dataset.students.length },
  ] : [];
  const chips = [campusLabel, person.commonCoreCohort && `Cohort ${person.commonCoreCohort}`, pool, status].filter((item): item is string => !!item);

  return <>
    <header className="of-head sp-head">
      <Avatar login={person.login} name={person.displayName} src={intraPhotoUrl(person.id, person.photo)} size={64} className="sp-avatar"/>
      <div className="sp-who"><h1>{person.login}{person.hacker && <HackerBadge/>}</h1>{person.displayName && <p>{person.displayName}</p>}</div>
      <a className="xp-chip sp-intra" href={`https://profile.intra.42.fr/users/${encodeURIComponent(person.login)}`} target="_blank" rel="noopener noreferrer">Intra<ArrowUpRight size={13} weight="bold"/></a>
    </header>

    <div className="xp-side sp-stack">
      <div className="xp-hero">
        <div className="xp-hero-levels">
          <div className="xp-hero-to"><span>Level{lost ? ' when they left' : ''}</span><strong>{lvl(level)}</strong></div>
        </div>
        <div className="xp-bar" role="img" aria-label={`${Math.round(progress * 100)}% of the way to level ${whole + 1}`}><i style={{ width: `${progress * 100}%` }}/></div>
        <p className="xp-note">{Math.round(progress * 100)}% of the way to level {whole + 1}</p>
      </div>

      {ranks.length > 0 && <section className="xp-panel" aria-labelledby="sp-ranks">
        <h3 id="sp-ranks">Ranks</h3>
        <ul className="sp-ranks">{ranks.map((item) => <li key={item.label} className="xp-rank">
          <b>#{fmt(item.rank)}</b><span>of {fmt(item.total)} {item.label}</span><em className="is-same">top {topPercent(item.rank, item.total)}%</em>
        </li>)}</ul>
      </section>}

      {chips.length > 0 && <section className="xp-panel" aria-labelledby="sp-about">
        <h3 id="sp-about">About</h3>
        <div className="xp-chips">{chips.map((chip) => <span key={chip} className="xp-chip">{chip}</span>)}</div>
      </section>}

      <Suspense fallback={null}><CorrectorCard userId={person.id} login={person.login} self={false}/></Suspense>
    </div>
  </>;
}
