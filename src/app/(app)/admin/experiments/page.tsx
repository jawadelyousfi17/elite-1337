import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { isFeedbackAdmin } from '@/lib/feedback';
import { rankTestResults, type RankTestSummary, type ScrollMode } from '@/lib/rank-test';
import { filterStats, type FilterStats } from '@/lib/filter-stats';
import { navTestResults, type NavTestGroup } from '@/lib/nav-test';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { AdminTabs } from '../admin-tabs';

export const metadata = { title: 'Experiments', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NAME: Record<ScrollMode, string> = { pages: 'Page numbers', infinite: 'Infinite scroll' };
const pct = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : '—';

/** Leaderboard A/B test results, readable only by the logins in ADMIN_LOGINS; everyone else gets a 404. */
export default async function ExperimentsPage() {
  const user = await requireStudent();
  if (!isFeedbackAdmin(user.login)) notFound();
  const [results, filters, nav] = await Promise.all([rankTestResults(), filterStats(), navTestResults()]);
  const totals = results?.summary.reduce((sum, row) => ({ seen: sum.seen + row.seen, answered: sum.answered + row.answered }), { seen: 0, answered: 0 });
  // Final preference: who kept page numbers plus who switched to them, and the same for infinite scroll.
  const prefer = (mode: ScrollMode) => results?.summary.reduce((sum, row) => sum + (row.variant === mode ? row.keep : row.switched), 0) ?? 0;

  return <main className="shell of fa">
    <header className="of-head">
      <h1>Experiments</h1>
      <p>Leaderboard A/B test: half the students get page numbers, half get infinite scroll. Each is asked once to keep it or switch.</p>
    </header>
    <AdminTabs current="/admin/experiments"/>
    <NavTest groups={nav}/>
    <FilterSessions stats={filters}/>
    <h2 className="ex-sub">Page numbers or infinite scroll</h2>
    {!results || !totals ? <p className="fa-empty">Results are unavailable. Check DATABASE_URL.</p> : <>
      <section className="ex-kpis" aria-label="Overall">
        <div><span>Students in the test</span><strong>{totals.seen}</strong></div>
        <div><span>Answered</span><strong>{totals.answered}</strong><small>{pct(totals.answered, totals.seen)} of them</small></div>
        <div><span>Prefer page numbers</span><strong>{prefer('pages')}</strong><small>{pct(prefer('pages'), totals.answered)} of answers</small></div>
        <div><span>Prefer infinite scroll</span><strong>{prefer('infinite')}</strong><small>{pct(prefer('infinite'), totals.answered)} of answers</small></div>
      </section>
      <section className="ex-groups" aria-label="By group">{results.summary.map((row) => <Group key={row.variant} row={row}/>)}</section>
      <h2 className="ex-sub">Students</h2>
      {!results.people.length ? <p className="fa-empty">Nobody has opened the leaderboard since the test started.</p> : <div className="ex-table-wrap"><table className="ex-table">
        <thead><tr><th>Login</th><th>Got</th><th>Answer</th><th>Visits</th><th>First visit</th><th>Answered</th></tr></thead>
        <tbody>{results.people.map((person) => <tr key={person.login}>
          <td><a href={`https://profile.intra.42.fr/users/${encodeURIComponent(person.login)}`} target="_blank" rel="noreferrer">{person.login}</a></td>
          <td>{NAME[person.variant]}</td>
          <td>{person.choice ? <span className={cn('ex-choice', `is-${person.choice}`)}>{person.choice === 'keep' ? 'Kept it' : 'Switched'}</span> : <span className="ex-muted">—</span>}</td>
          <td>{person.views}</td>
          <td title={person.firstSeen}>{timeAgo(person.firstSeen)}</td>
          <td title={person.answeredAt ?? ''}>{person.answeredAt ? timeAgo(person.answeredAt) : <span className="ex-muted">not yet</span>}</td>
        </tr>)}</tbody>
      </table></div>}
    </>}
  </main>;
}

function Group({ row }: { row: RankTestSummary }) {
  return <article className="ex-group">
    <h2>{NAME[row.variant]}</h2>
    <p className="ex-muted">{row.seen} {row.seen === 1 ? 'student' : 'students'} · {row.avgViews.toFixed(1)} visits each on average</p>
    <div className="ex-bar" role="img" aria-label={`${row.keep} kept, ${row.switched} switched, ${row.seen - row.answered} not answered`}>
      <i className="is-keep" style={{ flexGrow: row.keep }}/><i className="is-switch" style={{ flexGrow: row.switched }}/><i className="is-none" style={{ flexGrow: row.seen - row.answered }}/>
    </div>
    <ul className="ex-legend">
      <li><i className="is-keep"/>Kept it <b>{row.keep}</b> <span>{pct(row.keep, row.answered)}</span></li>
      <li><i className="is-switch"/>Switched <b>{row.switched}</b> <span>{pct(row.switched, row.answered)}</span></li>
      <li><i className="is-none"/>No answer yet <b>{row.seen - row.answered}</b></li>
    </ul>
  </article>;
}

const ENDED: Record<string, string> = { close: 'Close button', outside: 'Tapped outside', button: 'Filter icon', left: 'Left the page' };

/** Mobile filter dialog: filters tapped per open, to decide whether it should close after the first one. */
function FilterSessions({ stats }: { stats: FilterStats | null }) {
  if (!stats) return <p className="fa-empty">Filter stats are unavailable. Check DATABASE_URL.</p>;
  const used = stats.one + stats.several;
  const verdict = used < 30 ? 'Not enough data yet: wait for at least 30 sessions with a filter.'
    : stats.one > stats.several ? 'Most students tap one filter and stop: closing the dialog after a filter would save them a tap.'
    : 'Most students tap several filters: keep the dialog open after a filter.';
  return <section className="ex-filters" aria-labelledby="ex-filters-title">
    <h2 id="ex-filters-title" className="ex-sub ex-sub-first">Mobile filter dialog</h2>
    <p className="ex-muted ex-lead">Phones and tablets only. One session is one open-to-close of the leaderboard filters.</p>
    <section className="ex-kpis" aria-label="Filter sessions">
      <div><span>Sessions</span><strong>{stats.sessions}</strong><small>{stats.students} {stats.students === 1 ? 'student' : 'students'}</small></div>
      <div><span>One filter</span><strong>{stats.one}</strong><small>{pct(stats.one, used)} of sessions with a filter</small></div>
      <div><span>2 or more filters</span><strong>{stats.several}</strong><small>{pct(stats.several, used)} of sessions with a filter</small></div>
      <div><span>No filter</span><strong>{stats.none}</strong><small>opened and closed · {pct(stats.none, stats.sessions)}</small></div>
    </section>
    <article className="ex-group">
      <h2>{verdict}</h2>
      <p className="ex-muted">{stats.avgClicks.toFixed(1)} filters per session on average · open for {Math.round(stats.medianSeconds)} s (median)</p>
      <div className="ex-bar" role="img" aria-label={`${stats.one} one filter, ${stats.several} several, ${stats.none} none`}>
        <i className="is-keep" style={{ flexGrow: stats.one }}/><i className="is-switch" style={{ flexGrow: stats.several }}/><i className="is-none" style={{ flexGrow: stats.none }}/>
      </div>
      <ul className="ex-legend">
        <li><i className="is-keep"/>One filter <b>{stats.one}</b></li>
        <li><i className="is-switch"/>2 or more <b>{stats.several}</b></li>
        <li><i className="is-none"/>None <b>{stats.none}</b></li>
        <li className="ex-ended">Closed with: {Object.entries(stats.ended).sort((a, b) => b[1] - a[1]).map(([key, count]) => `${ENDED[key] ?? key} ${count}`).join(' · ') || '—'}</li>
      </ul>
    </article>
  </section>;
}

/** Navigation test: how many students in each half open the XP calculator (or Offers) from the nav. */
function NavTest({ groups }: { groups: NavTestGroup[] | null }) {
  if (!groups) return <p className="fa-empty">Navigation test results are unavailable. Check DATABASE_URL.</p>;
  const [xp, offers] = groups;
  return <section className="ex-filters" aria-labelledby="ex-nav-title">
    <h2 id="ex-nav-title" className="ex-sub ex-sub-first">XP calculator in the navigation</h2>
    <p className="ex-muted ex-lead">Half the students see “XP calculator” where “Offers” was. Counted from nav clicks; a student counts once per browser session for “seen”.</p>
    <section className="ex-kpis" aria-label="Navigation test">
      <div><span>XP half · saw the nav</span><strong>{xp.students}</strong><small>{xp.sessions} sessions</small></div>
      <div><span>Opened the XP calculator</span><strong>{xp.xpStudents}</strong><small>{pct(xp.xpStudents, xp.students)} of the XP half · {xp.xpClicks} clicks</small></div>
      <div><span>Offers half · saw the nav</span><strong>{offers.students}</strong><small>{offers.sessions} sessions</small></div>
      <div><span>Opened Offers</span><strong>{offers.offersStudents}</strong><small>{pct(offers.offersStudents, offers.students)} of the Offers half · {offers.offersClicks} clicks</small></div>
    </section>
  </section>;
}
