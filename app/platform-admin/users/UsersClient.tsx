'use client';
import { Fragment, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import styles from './users.module.css';

interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
}

interface Props {
  users: UserRow[];
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function UsersClient({ users }: Props) {
  const [resetting, setResetting] = useState<Record<string, boolean>>({});
  const [links,     setLinks]     = useState<Record<string, string>>({});
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [copied,    setCopied]    = useState<Record<string, boolean>>({});

  async function handleReset(id: string, email: string) {
    if (links[id]) {
      setLinks(l => { const n = { ...l }; delete n[id]; return n; });
      return;
    }
    setResetting(r => ({ ...r, [id]: true }));
    setErrors(e => ({ ...e, [id]: '' }));
    try {
      const res = await fetch(`/api/platform-admin/users/${id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(e => ({ ...e, [id]: (data as any).error ?? 'Failed' }));
      } else {
        setLinks(l => ({ ...l, [id]: (data as any).link }));
      }
    } catch {
      setErrors(e => ({ ...e, [id]: 'Network error' }));
    } finally {
      setResetting(r => ({ ...r, [id]: false }));
    }
  }

  async function handleCopy(id: string, link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(c => ({ ...c, [id]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [id]: false })), 2000);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>Users</h1>
        <div className={styles.count}>{users.length} total</div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Created</th>
              <th>Last Sign In</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <Fragment key={u.id}>
                <tr>
                  <td className={styles.emailCell}>{u.email}</td>
                  <td className={styles.dateCell}>{fmtDate(u.createdAt)}</td>
                  <td className={styles.dateCell}>{fmtDate(u.lastSignInAt)}</td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.resetBtn}
                      onClick={() => handleReset(u.id, u.email)}
                      disabled={resetting[u.id]}
                    >
                      {resetting[u.id]
                        ? 'Generating…'
                        : links[u.id]
                        ? 'Hide Link'
                        : 'Reset Password'}
                    </button>
                    {errors[u.id] && (
                      <span className={styles.rowError}>{errors[u.id]}</span>
                    )}
                  </td>
                </tr>
                {links[u.id] && (
                  <tr className={styles.linkRow}>
                    <td colSpan={4}>
                      <div className={styles.linkBox}>
                        <span className={styles.linkLabel}>Recovery Link</span>
                        <code className={styles.link}>{links[u.id]}</code>
                        <button
                          className={styles.copyBtn}
                          onClick={() => handleCopy(u.id, links[u.id])}
                        >
                          {copied[u.id] ? <Check size={12} /> : <Copy size={12} />}
                          {copied[u.id] ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
