import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { isFeedbackAdmin } from '@/lib/feedback';
import { rankTestResults, type RankTestSummary, type ScrollMode } from '@/lib/rank-test';
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
  const results = await rankTestResults();
  const totals = results?.summary.reduce((sum, row) => ({ seen: sum.seen + row.seen, answered: sum.answered + row.answered }), { seen: 0, answered: 0 });
  // Final preference: who kept page numbers plus who switched to them, and the same for infinite scroll.
  const prefer = (mode: ScrollMode) => results?.summary.reduce((sum, row) => sum + (row.variant === mode ? row.keep : row.switched), 0) ?? 0;

  return <main className="shell of fa">
    <header className="of-head">
      <h1>Experiments</h1>
      <p>Leaderboard A/B test: half the students get page numbers, half get infinite scroll. Each is asked once to keep it or switch.</p>
    </header>
    <AdminTabs current="/admin/experiments"/>
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
