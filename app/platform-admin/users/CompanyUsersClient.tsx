'use client';
import { useState } from 'react';
import { UserPlus, Check, Copy } from 'lucide-react';
import type { PlatformUser } from '@/lib/types';
import styles from './users.module.css';

interface Props {
  users: PlatformUser[];
  bootstrapEmails: string[];
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CompanyUsersClient({ users: initial, bootstrapEmails }: Props) {
  const [users,      setUsers]      = useState<PlatformUser[]>(initial);
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail,   setInvEmail]   = useState('');
  const [invName,    setInvName]    = useState('');
  const [inviting,   setInviting]   = useState(false);
  const [inviteErr,  setInviteErr]  = useState('');
  const [setupLink,  setSetupLink]  = useState('');
  const [copied,     setCopied]     = useState(false);
  const [busy,       setBusy]       = useState<Record<string, boolean>>({});
  const [rowErr,     setRowErr]     = useState<Record<string, string>>({});

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteErr('');
    setSetupLink('');
    try {
      const res  = await fetch('/api/platform-admin/company-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail, displayName: invName }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteErr(data.error ?? 'Failed'); return; }
      setUsers(u => [...u, data.user]);
      setSetupLink(data.setupLink ?? '');
      setInvEmail('');
      setInvName('');
    } catch {
      setInviteErr('Network error');
    } finally {
      setInviting(false);
    }
  }

  async function handleToggle(u: PlatformUser) {
    setBusy(b => ({ ...b, [u.id]: true }));
    setRowErr(r => ({ ...r, [u.id]: '' }));
    try {
      const res  = await fetch(`/api/platform-admin/company-users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json();
      if (!res.ok) { setRowErr(r => ({ ...r, [u.id]: data.error ?? 'Failed' })); return; }
      setUsers(us => us.map(x => x.id === u.id ? data : x));
    } catch {
      setRowErr(r => ({ ...r, [u.id]: 'Network error' }));
    } finally {
      setBusy(b => ({ ...b, [u.id]: false }));
    }
  }

  async function handleRemove(u: PlatformUser) {
    if (!confirm(`Remove ${u.email} from platform admin? This cannot be undone.`)) return;
    setBusy(b => ({ ...b, [u.id]: true }));
    setRowErr(r => ({ ...r, [u.id]: '' }));
    try {
      const res  = await fetch(`/api/platform-admin/company-users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setRowErr(r => ({ ...r, [u.id]: data.error ?? 'Failed' })); return; }
      setUsers(us => us.filter(x => x.id !== u.id));
    } catch {
      setRowErr(r => ({ ...r, [u.id]: 'Network error' }));
    } finally {
      setBusy(b => ({ ...b, [u.id]: false }));
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isBootstrap = (email: string) => bootstrapEmails.includes(email.toLowerCase());

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>FieldLogicHQ</div>
          <h1 className={styles.title}>Company Users</h1>
        </div>
        <button className={styles.inviteBtn} onClick={() => { setShowInvite(s => !s); setSetupLink(''); setInviteErr(''); }}>
          <UserPlus size={14} />
          Add User
        </button>
      </header>

      {showInvite && (
        <div className={styles.inviteCard}>
          <h2 className={styles.inviteTitle}>Invite Company User</h2>
          <form onSubmit={handleInvite} className={styles.inviteForm}>
            <div className={styles.inviteRow}>
              <div className={styles.inviteField}>
                <label className={styles.fieldLabel}>Display Name</label>
                <input
                  className={styles.fieldInput}
                  value={invName}
                  onChange={e => setInvName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                />
              </div>
              <div className={styles.inviteField}>
                <label className={styles.fieldLabel}>Email <span className={styles.required}>*</span></label>
                <input
                  className={styles.fieldInput}
                  type="email"
                  value={invEmail}
                  onChange={e => setInvEmail(e.target.value)}
                  placeholder="jane@fieldlogichq.ca"
                  required
                />
              </div>
              <button className={styles.submitBtn} type="submit" disabled={inviting}>
                {inviting ? 'Creating…' : 'Create'}
              </button>
            </div>
            {inviteErr && <p className={styles.rowError}>{inviteErr}</p>}
          </form>
          {setupLink && (
            <div className={styles.linkBox}>
              <span className={styles.linkLabel}>Password setup link — share with the new user:</span>
              <code className={styles.link}>{setupLink}</code>
              <button className={styles.copyBtn} onClick={handleCopy}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Added</th>
              <th>Invited By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyCell}>No company users yet.</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id}>
                <td className={styles.nameCell}>{u.displayName || '—'}</td>
                <td className={styles.emailCell}>
                  {u.email}
                  {isBootstrap(u.email) && <span className={styles.bootstrapBadge}>bootstrap</span>}
                </td>
                <td>
                  <span className={u.isActive ? styles.badgeActive : styles.badgeInactive}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className={styles.dateCell}>{fmtDate(u.createdAt)}</td>
                <td className={styles.dateCell}>{u.invitedBy || '—'}</td>
                <td className={styles.actionsCell}>
                  {rowErr[u.id] && <span className={styles.rowError}>{rowErr[u.id]}</span>}
                  {!isBootstrap(u.email) && (
                    <>
                      <button
                        className={styles.resetBtn}
                        onClick={() => handleToggle(u)}
                        disabled={busy[u.id]}
                      >
                        {busy[u.id] ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className={styles.removeBtn}
                        onClick={() => handleRemove(u)}
                        disabled={busy[u.id]}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
