'use client';
import { useState } from 'react';
import Link from 'next/link';
import styles from './orgs.module.css';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  planId: string;
  tournamentLimit: number;
  subscriptionStatus: string;
  createdAt: string;
  enabledAddons: string[];
  internalNotes: string | null;
}

interface EditState {
  planId: string;
  tournamentLimit: number;
}

interface Props {
  orgs: OrgRow[];
  planDefaults: Record<string, number>;
  initialStatus: string;
}

const PLANS = ['tournament', 'tournament_plus', 'league', 'club'] as const;
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;

const PLAN_LABELS: Record<string, string> = {
  tournament:      'Tournament',
  tournament_plus: 'Tournament Plus',
  league:          'League',
  club:            'Club',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function statusClass(status: string) {
  if (status === 'active')   return styles.badgeActive;
  if (status === 'trialing') return styles.badgeTrialing;
  if (status === 'past_due') return styles.badgePastDue;
  return styles.badgeMuted;
}

export default function OrgsClient({ orgs, planDefaults, initialStatus }: Props) {
  const [search,       setSearch]       = useState('');
  const [planFilter,   setPlanFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const filteredOrgs = orgs.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.name.toLowerCase().includes(q) && !o.slug.toLowerCase().includes(q)) return false;
    }
    if (planFilter   && o.planId             !== planFilter)   return false;
    if (statusFilter && o.subscriptionStatus !== statusFilter) return false;
    return true;
  });

  const [edits, setEdits] = useState<Record<string, EditState>>(
    Object.fromEntries(
      orgs.map(o => [o.id, { planId: o.planId, tournamentLimit: o.tournamentLimit }])
    )
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});

  function handlePlanChange(id: string, planId: string) {
    setEdits(e => ({ ...e, [id]: { planId, tournamentLimit: planDefaults[planId] ?? 1 } }));
    setSaved(s => ({ ...s, [id]: false }));
  }

  function handleLimitChange(id: string, raw: string) {
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 0) return;
    setEdits(e => ({ ...e, [id]: { ...e[id], tournamentLimit: num } }));
    setSaved(s => ({ ...s, [id]: false }));
  }

  async function handleSave(id: string) {
    setSaving(s => ({ ...s, [id]: true }));
    setErrors(e => ({ ...e, [id]: '' }));
    setSaved(s => ({ ...s, [id]: false }));
    const { planId, tournamentLimit } = edits[id];
    try {
      const res = await fetch(`/api/platform-admin/orgs/${id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, tournamentLimit }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors(e => ({ ...e, [id]: (data as any).error ?? 'Save failed' }));
      } else {
        setSaved(s => ({ ...s, [id]: true }));
      }
    } catch {
      setErrors(e => ({ ...e, [id]: 'Network error' }));
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>Organizations</h1>
        <div className={styles.count}>
          {filteredOrgs.length === orgs.length
            ? `${orgs.length} total`
            : `${filteredOrgs.length} of ${orgs.length}`}
        </div>
      </header>

      <div className={styles.filterBar}>
        <input
          type="search"
          className={styles.filterInput}
          placeholder="Search name or slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
        >
          <option value="">All plans</option>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
        </select>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || planFilter || statusFilter) && (
          <button
            className={styles.filterClear}
            onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); }}
          >
            Clear
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Plan</th>
              <th>Limit</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrgs.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>No organizations match the current filter.</td>
              </tr>
            )}
            {filteredOrgs.map(org => {
              const edit     = edits[org.id] ?? { planId: org.planId, tournamentLimit: org.tournamentLimit };
              const isLimited = edit.planId === 'tournament';

              return (
                <tr key={org.id}>
                  <td>
                    <span className={styles.orgName}>{org.name}</span>
                    {org.internalNotes && (
                      <span className={styles.noteIndicator} title="Has internal note">●</span>
                    )}
                  </td>
                  <td><span className={styles.slug}>{org.slug}</span></td>
                  <td>
                    <select
                      className={styles.planSelect}
                      value={edit.planId}
                      onChange={e => handlePlanChange(org.id, e.target.value)}
                    >
                      {PLANS.map(p => (
                        <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {isLimited ? (
                      <input
                        type="number"
                        className={styles.limitInput}
                        value={edit.tournamentLimit}
                        min={0}
                        max={9999}
                        onChange={e => handleLimitChange(org.id, e.target.value)}
                      />
                    ) : (
                      <span className={styles.slug}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusClass(org.subscriptionStatus)}`}>
                      {org.subscriptionStatus}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{fmtDate(org.createdAt)}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionGroup}>
                      <button
                        className={styles.saveBtn}
                        onClick={() => handleSave(org.id)}
                        disabled={saving[org.id]}
                      >
                        {saving[org.id] ? 'Saving…' : saved[org.id] ? 'Saved ✓' : 'Save'}
                      </button>
                      <Link href={`/platform-admin/orgs/${org.id}`} className={styles.viewLink}>
                        View →
                      </Link>
                      <Link
                        href={`/${org.slug}/admin`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.adminLink}
                      >
                        ↗ Admin
                      </Link>
                    </div>
                    {errors[org.id] && (
                      <div className={styles.rowError}>{errors[org.id]}</div>
                    )}
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
