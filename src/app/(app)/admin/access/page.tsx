import { notFound } from 'next/navigation';
import { Plus, Trash } from '@/components/icons';
import { requireStudent } from '@/lib/guard';
import { isAccessAdmin, listUserControls } from '@/lib/user-controls';
import { AdminTabs } from '../admin-tabs';
import { addManagedUser, removeManagedUser, updateUserControl } from './actions';

export const metadata = { title: 'User access', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const notices: Record<string, string> = { saved: 'User setting updated.', added: 'User added.', removed: 'Database overrides removed.', invalid: 'Enter a valid 42 login.', self: 'You cannot revoke or anonymize your own active admin account.', unavailable: 'The change could not be saved. Check DATABASE_URL.' };

function Toggle({ login, field, value, label }: { login: string; field: 'admin' | 'hacker' | 'anonymized' | 'allowed'; value: boolean; label: string }) {
  return <form action={updateUserControl}><input type="hidden" name="login" value={login}/><input type="hidden" name="field" value={field}/><input type="hidden" name="value" value={String(!value)}/><button type="submit" className="ac-toggle" data-on={value || undefined} aria-pressed={value}><i/><span>{label}</span></button></form>;
}

/** Admin-only role and access controls backed by Neon with environment fallbacks. */
export default async function AccessAdminPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const user = await requireStudent();
  if (!await isAccessAdmin(user.login)) notFound();
  const [controls, query] = await Promise.all([listUserControls(), searchParams]);
  return <main className="shell of fa ac">
    <header className="of-head"><div><h1>User access</h1><p>Manage site access, administrators, hacker credits and anonymous profiles.</p></div></header>
    <AdminTabs current="/admin/access"/>
    {query.result && notices[query.result] && <p className={`ac-notice is-${query.result}`}>{notices[query.result]}</p>}
    <form action={addManagedUser} className="ac-add"><label htmlFor="ac-login">42 login</label><input id="ac-login" name="login" required minLength={2} maxLength={40} pattern="[A-Za-z0-9_.-]+" placeholder="jdoe"/><button type="submit"><Plus size={15}/>Add user</button></form>
    <div className="ac-table-wrap"><table className="ex-table ac-table"><thead><tr><th>User</th><th>Site access</th><th>Admin</th><th>Hacker</th><th>Anonymous</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
      {controls.map((control) => <tr key={control.login}>
        <td><strong>{control.login}</strong><small>{control.source === 'database' ? 'Database override' : 'Environment default'}</small></td>
        <td><Toggle login={control.login} field="allowed" value={control.allowed} label={control.allowed ? 'Allowed' : 'Blocked'}/></td>
        <td><Toggle login={control.login} field="admin" value={control.admin} label={control.admin ? 'Admin' : 'User'}/></td>
        <td><Toggle login={control.login} field="hacker" value={control.hacker} label={control.hacker ? 'Credited' : 'No'}/></td>
        <td><Toggle login={control.login} field="anonymized" value={control.anonymized} label={control.anonymized ? 'Hidden' : 'Visible'}/></td>
        <td><form action={removeManagedUser}><input type="hidden" name="login" value={control.login}/><button className="ac-remove" type="submit" aria-label={`Remove database overrides for ${control.login}`} title="Restore environment defaults"><Trash size={15}/></button></form></td>
      </tr>)}
    </tbody></table></div>
    <p className="ao-foot">Changes take effect across app instances within about 30 seconds. Removing a row restores its environment-variable defaults.</p>
  </main>;
}
