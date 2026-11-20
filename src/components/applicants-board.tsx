'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { KiwiNote } from '@/components/kiwi-guide';
import { ArrowUpRight, Plus, Search, Trash, Upload, WhatsApp, X } from '@/components/icons';
import { DEFAULT_ROLES, STATUSES, applicantsFromCsv, whatsappLink, type Applicant, type ApplicantStatus } from '@/lib/applicants';
import { lookupApplicants, type ApplicantProfile } from '@/app/(app)/admin/form/actions';
import { cn } from '@/lib/utils';

type Mark = { status: ApplicantStatus; roles: string[]; note: string };
type Saved = { applicants: Applicant[]; marks: Record<string, Mark>; roles: string[] };
const STORAGE_KEY = 'elite-wedesign-applicants-v1';
const LABEL: Record<ApplicantStatus, string> = { new: 'New', interviewing: 'Interviewing', done: 'Done', rejected: 'Rejected' };
const EMPTY: Saved = { applicants: [], marks: {}, roles: DEFAULT_ROLES };
const blank = (): Mark => ({ status: 'new', roles: [], note: '' });

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null;
    if (!saved || !Array.isArray(saved.applicants)) return EMPTY;
    return { applicants: saved.applicants, marks: saved.marks ?? {}, roles: Array.isArray(saved.roles) ? saved.roles : DEFAULT_ROLES };
  } catch { return EMPTY; }
}

/** Reviews Wedesign applications from the Tally CSV; statuses, roles and notes live only in this browser's storage. */
export function ApplicantsBoard() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ApplicantProfile>>({});
  const [filter, setFilter] = useState<ApplicantStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [newRole, setNewRole] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { setSaved(load()); }, []);
  useEffect(() => { if (saved) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* storage full or blocked: changes last for this visit */ } }, [saved]);
  const logins = saved?.applicants.map((item) => item.login).join(',') ?? '';
  useEffect(() => {
    if (!logins) return;
    let live = true;
    lookupApplicants(logins.split(',')).then((found) => { if (live) setProfiles(found); }).catch(() => {});
    return () => { live = false; };
  }, [logins]);

  const markOf = (login: string) => saved?.marks[login] ?? blank();
  const update = (login: string, change: Partial<Mark>) => setSaved((current) => current && { ...current, marks: { ...current.marks, [login]: { ...(current.marks[login] ?? blank()), ...change } } });

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: saved?.applicants.length ?? 0 };
    for (const item of saved?.applicants ?? []) { const status = saved?.marks[item.login]?.status ?? 'new'; out[status] = (out[status] ?? 0) + 1; }
    return out;
  }, [saved]);
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return (saved?.applicants ?? []).filter((item) => {
      if (filter !== 'all' && (saved?.marks[item.login]?.status ?? 'new') !== filter) return false;
      if (!words) return true;
      const name = profiles[item.login]?.name ?? '';
      return [item.login, name, item.promo, ...item.interests, ...(saved?.marks[item.login]?.roles ?? [])].some((text) => text.toLowerCase().includes(words));
    });
  }, [saved, filter, query, profiles]);

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    const applicants = applicantsFromCsv(await picked.text());
    if (!applicants.length) { setNotice('No applicants found. Use the CSV export from Tally.'); return; }
    // Re-importing a newer export keeps every status, role and note already given.
    setSaved((current) => ({ ...(current ?? EMPTY), applicants }));
    setNotice(`${applicants.length} applicants imported.`);
  }
  function addRole() {
    const role = newRole.trim().slice(0, 30);
    if (role && saved && !saved.roles.some((item) => item.toLowerCase() === role.toLowerCase())) setSaved({ ...saved, roles: [...saved.roles, role] });
    setNewRole('');
  }
  function removeRole(role: string) {
    if (!saved || !confirm(`Remove the role "${role}" from everyone?`)) return;
    const marks = Object.fromEntries(Object.entries(saved.marks).map(([login, mark]) => [login, { ...mark, roles: mark.roles.filter((item) => item !== role) }]));
    setSaved({ ...saved, roles: saved.roles.filter((item) => item !== role), marks });
  }
  function clearAll() {
    if (confirm('Remove every applicant, status, role and note from this browser? This cannot be undone.')) { setSaved(EMPTY); setProfiles({}); setNotice(null); }
  }

  if (!saved) return null;
  const picker = <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={importCsv}/>;
  if (!saved.applicants.length) return <section className="ap-empty">
    {picker}
    <KiwiNote><h2>No applicants yet</h2><p>{notice ?? 'Export the submissions from Tally as CSV and import the file here.'}</p></KiwiNote>
    <button type="button" className="ap-import is-main" onClick={() => file.current?.click()}><Upload size={16}/>Import CSV</button>
  </section>;

  return <section className="ap-board">
    {picker}
    <div className="ap-bar">
      <label className="ap-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search login, name, interest or role" aria-label="Search applicants"/></label>
      <button type="button" className="ap-import" onClick={() => file.current?.click()}><Upload size={15}/>Import CSV</button>
      <button type="button" className="ap-import is-quiet" onClick={clearAll}><Trash size={15}/>Clear</button>
    </div>
    {notice && <p className="ac-notice">{notice}</p>}
    <div className="fa-filters" role="group" aria-label="Filter by status">
      {(['all', ...STATUSES] as const).map((status) => <button key={status} type="button" className={cn('fa-filter', filter === status && 'is-picked')} aria-pressed={filter === status} onClick={() => setFilter(status)}>
        {status === 'all' ? 'All' : LABEL[status]}<span>{counts[status] ?? 0}</span>
      </button>)}
    </div>
    <div className="ap-roles">
      <span className="ap-roles-label">Roles</span>
      {saved.roles.map((role) => <span key={role} className="ap-role-tag">{role}<button type="button" onClick={() => removeRole(role)} aria-label={`Remove role ${role}`}><X size={11}/></button></span>)}
      <form className="ap-role-add" onSubmit={(event) => { event.preventDefault(); addRole(); }}>
        <input value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="New role" maxLength={30} aria-label="New role"/>
        <button type="submit" aria-label="Add role" disabled={!newRole.trim()}><Plus size={13}/></button>
      </form>
    </div>
    {!shown.length ? <div className="ap-none"><KiwiNote><h2>Nobody here</h2><p>No applicant matches this filter.</p></KiwiNote></div> : <ul className="ap-list">{shown.map((item) => {
      const mark = markOf(item.login), profile = profiles[item.login], wa = whatsappLink(item.whatsapp);
      return <li key={item.login} className={cn('ap-card', `is-${mark.status}`)}>
        <div className="ap-head">
          <Avatar login={item.login} name={profile?.name} src={profile?.photo} size={48}/>
          <div className="ap-who">
            <strong>{profile?.name ?? item.login}</strong>
            <a href={`https://profile.intra.42.fr/users/${item.login}`} target="_blank" rel="noopener noreferrer">{item.login}<ArrowUpRight size={12}/></a>
          </div>
          {wa && <a className="ap-wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${item.login}`} title={item.whatsapp}><WhatsApp size={16}/></a>}
        </div>
        <div className="ap-facts">
          {item.promo && <span>Promo {item.promo}</span>}
          {profile && <span>Level {profile.level.toFixed(2)}</span>}
          {profile?.blackholed && <span className="is-red">Blackholed</span>}
          {item.submittedAt && <span>{item.submittedAt.slice(0, 10)}</span>}
        </div>
        {!!item.interests.length && <div className="ap-interests">{item.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}
        <div className="ap-status" role="radiogroup" aria-label={`Status of ${item.login}`}>
          {STATUSES.map((status) => <button key={status} type="button" role="radio" aria-checked={mark.status === status} className={cn(`is-${status}`, mark.status === status && 'is-on')} onClick={() => update(item.login, { status })}>{LABEL[status]}</button>)}
        </div>
        <div className="ap-role-pick" role="group" aria-label={`Roles of ${item.login}`}>
          {saved.roles.map((role) => { const on = mark.roles.includes(role); return <button key={role} type="button" aria-pressed={on} className={cn(on && 'is-on')} onClick={() => update(item.login, { roles: on ? mark.roles.filter((value) => value !== role) : [...mark.roles, role] })}>{role}</button>; })}
        </div>
        <textarea className="ap-note" value={mark.note} onChange={(event) => update(item.login, { note: event.target.value.slice(0, 500) })} placeholder="Note" rows={1} aria-label={`Note about ${item.login}`}/>
      </li>;
    })}</ul>}
  </section>;
}
