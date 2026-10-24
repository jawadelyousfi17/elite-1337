import Link from 'next/link';
import { ArrowUpRight, Search, Waves } from '@/components/icons';
import { z } from 'zod';
import { Avatar } from '@/components/avatar';
import { DatasetState } from '@/components/dataset-state';
import { campusIds } from '@/lib/config';
import { campusName, loadRankingDataset } from '@/lib/dataset';
import { requireStudent } from '@/lib/guard';
import { admissionOutcome } from '@/lib/classification';
import { loadPiscineCandidates } from '@/lib/piscines';
import { getStudentProfile } from '@/lib/student-overview';
import { Button } from '@/components/ui/button';
import { avatarReferencesOrEmpty } from '@/lib/avatars/storage';
import { photoReferences } from '@/lib/avatars/intra-photo';

export const metadata = { title: 'Piscine Explorer' };

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'] as const;
const schema = z.object({ campus: z.coerce.number().int().positive().optional(), year: z.string().regex(/^\d{4}$/).optional(), month: z.enum(months).optional(), outcome: z.enum(['Accepted','Not accepted','Unknown']).optional(), q: z.string().trim().max(40).optional(), page: z.coerce.number().int().min(1).max(10000).default(1) });

export default async function Piscines({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStudent();
  const raw = await searchParams;
  const [rankings, profile] = await Promise.all([loadRankingDataset(), getStudentProfile(user.id).catch(() => null)]);
  if (rankings.status !== 'ready') return <DatasetState status={rankings.status}/>;
  const dataset = rankings.data;
  const own = dataset.students.find((student) => String(student.id) === user.id);
  const defaultCampus = profile?.campus_users.find((entry) => entry.is_primary && campusIds().includes(entry.campus_id))?.campus_id ?? own?.campusIds[0] ?? dataset.campuses[0]?.id;
  const defaultYear = profile?.pool_year ?? own?.poolYear ?? String(new Date().getUTCFullYear());
  const defaultMonth = profile?.pool_month ?? own?.poolMonth;
  const parsed = schema.safeParse({ campus: raw.campus === undefined ? defaultCampus : raw.campus || undefined, year: raw.year || defaultYear, month: raw.month === undefined ? defaultMonth || undefined : raw.month || undefined, outcome: raw.outcome || undefined, q: raw.q || undefined, page: raw.page || 1 });
  const filters: z.infer<typeof schema> = parsed.success ? parsed.data : { campus: defaultCampus, year: defaultYear, page: 1 };
  if (filters.campus && !campusIds().includes(filters.campus)) filters.campus = undefined;
  const state = await loadPiscineCandidates(filters.campus ?? null, filters.year!, filters.month ?? null);
  const accepted = new Set(dataset.acceptedUserIds), current = new Set(dataset.students.map((student) => student.id));
  const candidates = state.status === 'ready' ? state.candidates.filter((candidate) => (!filters.outcome || filters.outcome === admissionOutcome(accepted.has(candidate.id))) && (!filters.q || candidate.login.toLowerCase().includes(filters.q.toLowerCase()))) : [];
  const pages = Math.max(1, Math.ceil(candidates.length / 25)), page = Math.min(filters.page, pages), rows = candidates.slice((page - 1) * 25, page * 25);
  const avatars = photoReferences(rows.map((candidate) => ({ id: candidate.id, photo: candidate.image })), await avatarReferencesOrEmpty(rows.map((candidate) => candidate.id)));
  const url = (requested: number) => { const query = new URLSearchParams(); for (const key of ['campus','year','month','outcome','q'] as const) if (filters[key]) query.set(key, String(filters[key])); query.set('page', String(requested)); return `/piscines?${query}`; };
  const intra = (login: string) => `https://profile.intra.42.fr/users/${encodeURIComponent(login)}`;
  return <main className="shell leaderboard-page piscine-page">
    <section className="leaderboard-intro"><div><h1>Piscine Explorer<span className="green">.</span></h1></div><div className="leaderboard-summary"><div className="summary-icon"><Waves size={22}/></div><span className="summary-label">Selected session</span><strong>{filters.campus ? campusName(dataset, filters.campus) : 'All campuses'} · {filters.month ?? 'All months'} {filters.year}</strong><span className="summary-count">{state.status === 'ready' ? `${state.candidates.length.toLocaleString()} accounts in session` : 'Session unavailable'}</span></div></section>
    <section className="panel leaderboard-panel"><div className="filter-heading"><Waves size={18}/><div><strong>Explore a Piscine</strong></div></div>
      <form className="filters filters-v2" action="/piscines">
        <label className="filter-field filter-search"><span>Candidate login</span><div className="search-field"><Search size={18}/><input className="input" name="q" maxLength={40} placeholder="Search by login" defaultValue={filters.q ?? ''}/></div></label>
        <label className="filter-field"><span>Campus</span><select className="input" name="campus" defaultValue={filters.campus ?? ''}><option value="">All campuses</option>{dataset.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
        <label className="filter-field"><span>Piscine year</span><select className="input" name="year" defaultValue={filters.year}>{Array.from({ length: new Date().getUTCFullYear() - 2013 + 1 }, (_, i) => String(new Date().getUTCFullYear() - i)).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label className="filter-field"><span>Month</span><select className="input" name="month" defaultValue={filters.month ?? ''}><option value="">All months</option>{months.map((month) => <option key={month} value={month}>{month[0].toUpperCase() + month.slice(1)}</option>)}</select></label>
        <label className="filter-field"><span>Admission</span><select className="input" name="outcome" defaultValue={filters.outcome ?? ''}><option value="">Any outcome</option><option value="Accepted">Accepted</option><option value="Not accepted">Not accepted</option><option value="Unknown">Unknown</option></select></label>
        <Button className="filter-submit" type="submit">Explore session</Button>
      </form>
      <p className="ranking-note">Accepted = verified Common Core enrollment. Everyone else shows as Unknown.</p>
      {state.status !== 'ready' ? <DatasetState status={state.status}/> : rows.length ? <>
        <div className="table-wrap desktop-ranks"><table className="rank-table piscine-table"><thead><tr><th>Candidate</th><th>Campus</th><th>Session</th><th>Admission</th><th>Profile</th></tr></thead><tbody>{rows.map((candidate) => <tr key={candidate.id}><td><span className="student-link"><Avatar login={candidate.login} src={avatars[candidate.id]}/><span className="student-name"><strong>{candidate.login}</strong><small>{candidate.displayname ?? '42 account'}</small></span></span></td><td className="campus-cell">{campusName(dataset, candidate.campusId)}</td><td>{candidate.pool_month ?? 'Unknown'} {candidate.pool_year ?? ''}</td><td><span className={`outcome-badge ${accepted.has(candidate.id) ? 'accepted' : ''}`}>{admissionOutcome(accepted.has(candidate.id))}</span></td><td><div className="row-actions">{current.has(candidate.id) && <Link href={`/students/${encodeURIComponent(candidate.login)}`}>On site</Link>}<a href={intra(candidate.login)} target="_blank" rel="noopener noreferrer">42 Intra <ArrowUpRight size={13}/></a></div></td></tr>)}</tbody></table></div>
        <div className="mobile-ranks">{rows.map((candidate) => <div className="mobile-rank-card" key={candidate.id}><div className="mobile-student"><Avatar login={candidate.login} src={avatars[candidate.id]}/><span className="student-name"><strong>{candidate.login}</strong><small>{candidate.displayname ?? '42 account'}</small></span><span className={`outcome-badge ${accepted.has(candidate.id) ? 'accepted' : ''}`}>{admissionOutcome(accepted.has(candidate.id))}</span></div><div className="mobile-rank-meta"><span>{campusName(dataset, candidate.campusId)}</span><span>{candidate.pool_month} {candidate.pool_year}</span></div><div className="mobile-rank-actions">{current.has(candidate.id) && <Link href={`/students/${encodeURIComponent(candidate.login)}`}>On site</Link>}<a href={intra(candidate.login)} target="_blank" rel="noopener noreferrer">42 Intra <ArrowUpRight size={14}/></a></div></div>)}</div>
      </> : <div className="empty leaderboard-empty"><Search size={26}/><h2>No candidates found</h2><p>Try another session or remove the admission filter.</p></div>}
      {state.status === 'ready' && <div className="leaderboard-footer"><span>Showing {candidates.length ? (page - 1) * 25 + 1 : 0}–{Math.min(page * 25, candidates.length)} of {candidates.length.toLocaleString()}</span><div className="pagination"><Link className={`page-button${page === 1 ? ' disabled' : ''}`} href={url(Math.max(1, page - 1))} aria-disabled={page === 1}>Previous</Link><span>Page {page} of {pages}</span><Link className={`page-button${page === pages ? ' disabled' : ''}`} href={url(Math.min(pages, page + 1))} aria-disabled={page === pages}>Next</Link></div></div>}
    </section>
  </main>;
}
