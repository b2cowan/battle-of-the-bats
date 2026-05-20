'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, KeyRound, Search } from 'lucide-react';
import styles from './customer-users.module.css';

export type CustomerUserRow = {
  userId: string;
  email: string;
  displayName: string;
  authStatus: string;
  lastSignIn: string | null;
  memberships: {
    orgId: string;
    orgName: string;
    orgSlug: string;
    planId: string;
    subscriptionStatus: string;
    role: string;
    status: string;
  }[];
};

type Props = {
  initialRows: CustomerUserRow[];
  query: string;
  searched: boolean;
};

type ResetState = {
  link?: string;
  error?: string;
  copied?: boolean;
};

function fmtDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusClass(value: string) {
  if (value === 'active') return styles.badgeActive;
  if (value === 'banned' || value === 'canceled') return styles.badgeDanger;
  if (value === 'unconfirmed' || value === 'trialing' || value === 'past_due') return styles.badgeWarn;
  return styles.badgeMuted;
}

export default function CustomerUsersClient({ initialRows, query, searched }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetState, setResetState] = useState<Record<string, ResetState>>({});

  async function generateReset(row: CustomerUserRow) {
    if (!row.email || row.email === '(unknown)') return;
    setBusyId(row.userId);
    setResetState(state => ({ ...state, [row.userId]: {} }));
    try {
      const res = await fetch(`/api/platform-admin/users/${encodeURIComponent(row.userId)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: row.email }),
      });
      const data = await res.json() as { link?: string; error?: string };
      if (!res.ok || !data.link) {
        setResetState(state => ({
          ...state,
          [row.userId]: { error: data.error ?? 'Failed to generate reset link' },
        }));
        return;
      }
      setResetState(state => ({ ...state, [row.userId]: { link: data.link } }));
    } catch {
      setResetState(state => ({
        ...state,
        [row.userId]: { error: 'Network error' },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(userId: string, link: string) {
    await navigator.clipboard.writeText(link);
    setResetState(state => ({ ...state, [userId]: { ...state[userId], copied: true } }));
    window.setTimeout(() => {
      setResetState(state => ({ ...state, [userId]: { ...state[userId], copied: false } }));
    }, 1800);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Customer Support</div>
          <h1 className={styles.title}>Customer Users</h1>
        </div>
        <div className={styles.count}>
          {searched ? `${initialRows.length} result${initialRows.length === 1 ? '' : 's'}` : 'Search required'}
        </div>
      </header>

      <form method="GET" action="/platform-admin/customer-users" className={styles.searchBar}>
        <label className={styles.searchBox}>
          <Search size={14} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search email, name, user id, org, or slug..."
            minLength={2}
          />
        </label>
        <button className={styles.searchBtn} type="submit">Search</button>
        {query && <Link href="/platform-admin/customer-users" className={styles.clearLink}>Clear</Link>}
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Auth</th>
              <th>Last Sign In</th>
              <th>Organizations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!searched && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Search at least two characters to look up customer users.
                </td>
              </tr>
            )}
            {searched && initialRows.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>No customer users match this search.</td>
              </tr>
            )}
            {initialRows.map(row => {
              const reset = resetState[row.userId] ?? {};
              return (
                <tr key={row.userId}>
                  <td>
                    <div className={styles.primaryText}>{row.displayName || '-'}</div>
                    <div className={styles.emailText}>{row.email}</div>
                    <div className={styles.userId}>{row.userId}</div>
                    {reset.link && (
                      <div className={styles.linkBox}>
                        <span className={styles.linkLabel}>Reset link</span>
                        <code className={styles.link}>{reset.link}</code>
                        <button
                          className={styles.copyBtn}
                          type="button"
                          onClick={() => copyLink(row.userId, reset.link!)}
                        >
                          {reset.copied ? <Check size={12} /> : <Copy size={12} />}
                          {reset.copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    {reset.error && <div className={styles.rowError}>{reset.error}</div>}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusClass(row.authStatus)}`}>
                      {row.authStatus}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{fmtDate(row.lastSignIn)}</td>
                  <td>
                    <div className={styles.membershipList}>
                      {row.memberships.length === 0 && <span className={styles.dimText}>No org memberships found</span>}
                      {row.memberships.map(membership => (
                        <div key={`${row.userId}-${membership.orgId}`} className={styles.membership}>
                          <Link href={`/platform-admin/orgs/${membership.orgId}`} className={styles.orgLink}>
                            {membership.orgName}
                          </Link>
                          <span className={styles.slug}>/{membership.orgSlug}</span>
                          <span className={`${styles.badge} ${styles.badgeMuted}`}>{membership.role}</span>
                          <span className={`${styles.badge} ${statusClass(membership.status)}`}>{membership.status}</span>
                          <span className={styles.dimText}>{membership.planId} / {membership.subscriptionStatus}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.actionBtn}
                      type="button"
                      onClick={() => generateReset(row)}
                      disabled={busyId === row.userId || !row.email || row.email === '(unknown)'}
                    >
                      <KeyRound size={13} />
                      {busyId === row.userId ? 'Generating...' : 'Reset'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
