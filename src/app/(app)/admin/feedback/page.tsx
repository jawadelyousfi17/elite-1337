import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { FEEDBACK_KINDS, isFeedbackAdmin, isFeedbackKind, listFeedback, type FeedbackKind } from '@/lib/feedback';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Feedback', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const LABELS: Record<FeedbackKind, string> = { bug: 'Bug', idea: 'Idea', other: 'Other' };

/** Reports from the feedback dialog, readable only by the logins in ADMIN_LOGINS; everyone else gets a 404. */
export default async function FeedbackAdminPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requireStudent();
  if (!isFeedbackAdmin(user.login)) notFound();
  const { kind: requested } = await searchParams;
  const kind = isFeedbackKind(requested) ? requested : null;
  const entries = await listFeedback();
  const shown = entries?.filter((entry) => !kind || entry.kind === kind) ?? [];
  const count = (value: FeedbackKind | null) => entries?.filter((entry) => !value || entry.kind === value).length ?? 0;

  return <main className="shell of fa">
    <header className="of-head">
      <h1>Feedback</h1>
      <p>Reports sent from the feedback button, newest first.</p>
    </header>
    <nav className="fa-filters" aria-label="Filter by type">
      {([null, ...FEEDBACK_KINDS] as const).map((value) => <Link key={value ?? 'all'} href={value ? `?kind=${value}` : '?'} className={cn('fa-filter', kind === value && 'is-picked')} aria-current={kind === value ? 'page' : undefined}>
        {value ? LABELS[value] : 'All'} <span>{count(value)}</span>
      </Link>)}
    </nav>
    {entries === null ? <p className="fa-empty">Feedback is unavailable. Check DATABASE_URL.</p>
      : !shown.length ? <p className="fa-empty">No feedback yet.</p>
      : <ol className="fa-list">
        {shown.map((entry) => <li key={entry.id} className="fa-item">
          <div className="fa-meta">
            <span className={cn('fa-kind', `is-${entry.kind}`)}>{LABELS[entry.kind]}</span>
            {entry.login ? <a href={`https://profile.intra.42.fr/users/${encodeURIComponent(entry.login)}`} target="_blank" rel="noreferrer">{entry.login}</a> : <span>Anonymous</span>}
            <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Casablanca' })}>{timeAgo(entry.createdAt)}</time>
          </div>
          <p className="fa-message">{entry.message}</p>
          <p className="fa-context">{entry.page || '—'} · {entry.screen || '—'}</p>
        </li>)}
      </ol>}
  </main>;
}
