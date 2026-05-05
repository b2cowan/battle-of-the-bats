'use client';
import { useState } from 'react';
import styles from './orgs.module.css';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  planId: string;
  tournamentLimit: number;
  subscriptionStatus: string;
  createdAt: string;
}

interface EditState {
  planId: string;
  tournamentLimit: number;
}

interface Props {
  orgs: OrgRow[];
  planDefaults: Record<string, number>;
}

const PLANS = ['starter', 'pro', 'elite'] as const;

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

export default function OrgsClient({ orgs, planDefaults }: Props) {
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
        <div className={styles.headerLabel}>Platform Node</div>
        <h1 className={styles.title}>Organizations</h1>
        <div className={styles.count}>{orgs.length} total</div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Plan</th>
              <th>Active Limit</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => {
              const edit = edits[org.id] ?? { planId: org.planId, tournamentLimit: org.tournamentLimit };
              return (
                <tr key={org.id}>
                  <td><span className={styles.orgName}>{org.name}</span></td>
                  <td><span className={styles.slug}>{org.slug}</span></td>
                  <td>
                    <select
                      className={styles.planSelect}
                      value={edit.planId}
                      onChange={e => handlePlanChange(org.id, e.target.value)}
                    >
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className={styles.limitInput}
                      value={edit.tournamentLimit}
                      min={0}
                      max={9999}
                      onChange={e => handleLimitChange(org.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusClass(org.subscriptionStatus)}`}>
                      {org.subscriptionStatus}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{fmtDate(org.createdAt)}</td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.saveBtn}
                      onClick={() => handleSave(org.id)}
                      disabled={saving[org.id]}
                    >
                      {saving[org.id] ? 'Saving…' : saved[org.id] ? 'Saved ✓' : 'Save'}
                    </button>
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
