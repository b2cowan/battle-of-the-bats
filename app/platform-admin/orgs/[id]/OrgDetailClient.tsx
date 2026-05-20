'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './orgDetail.module.css';
import HelpTooltip from '@/components/help/HelpTooltip';

interface Override {
  id: string;
  type: string;
  value: string | null;
  expiresAt: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

interface Member {
  userId: string;
  role: string;
  status: string;
  email: string;
  displayName: string;
  lastSignIn: string | null;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  orgId: string;
  orgName: string;
  orgSlug: string;
  planModules: string[];
  enabledAddons: string[];
  internalNotes: string | null;
  overrides: Override[];
  members: Member[];
  tournaments: Tournament[];
}

const STATUS_VALUES = ['active', 'trialing', 'past_due', 'canceled'] as const;

const ADDON_MODULE_LABELS: Record<string, string> = {
  module_public_site:  'Public Site',
  module_house_league: 'House League',
  module_accounting:   'Accounting',
  module_rep_teams:    'Rep Teams',
};

type ApiErrorBody = { error?: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function tournamentStatusClass(status: string, styles: Record<string, string>) {
  if (status === 'active')    return styles.badgeActive;
  if (status === 'completed') return styles.badgeMuted;
  if (status === 'draft')     return styles.badgeDraft;
  return styles.badgeMuted;
}

export default function OrgDetailClient({
  orgId,
  orgName,
  orgSlug,
  planModules,
  enabledAddons: initialAddons,
  internalNotes,
  overrides: initialOverrides,
  members,
  tournaments,
}: Props) {
  const router = useRouter();
  const [identityName, setIdentityName] = useState(orgName);
  const [identitySlug, setIdentitySlug] = useState(orgSlug);
  const [identityReason, setIdentityReason] = useState('');
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [identityError, setIdentityError] = useState('');

  async function handleIdentitySave(e: React.FormEvent) {
    e.preventDefault();
    setIdentitySaving(true);
    setIdentitySaved(false);
    setIdentityError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/identity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: identityName,
          slug: identitySlug,
          reason: identityReason,
        }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setIdentityError(data.error ?? 'Save failed');
        return;
      }
      setIdentitySaved(true);
      setIdentityReason('');
      router.refresh();
    } catch {
      setIdentityError('Network error');
    } finally {
      setIdentitySaving(false);
    }
  }

  // ─── Notes ───────────────────────────────────────────────────────────
  const [notes,       setNotes]       = useState(internalNotes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [notesError,  setNotesError]  = useState('');

  async function handleNotesSave() {
    setNotesSaving(true);
    setNotesSaved(false);
    setNotesError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/notes`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const d = await res.json().catch((): ApiErrorBody => ({}));
        setNotesError(d.error ?? 'Save failed');
      } else {
        setNotesSaved(true);
      }
    } catch {
      setNotesError('Network error');
    } finally {
      setNotesSaving(false);
    }
  }

  // ─── Module Overrides ─────────────────────────────────────────────
  const overrideableModules = Object.keys(ADDON_MODULE_LABELS).filter(
    m => !planModules.includes(m)
  );
  const [addonEdits,  setAddonEdits]  = useState<string[]>(initialAddons);
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonSaved,  setAddonSaved]  = useState(false);
  const [addonError,  setAddonError]  = useState('');

  function handleAddonToggle(module: string) {
    setAddonEdits(prev =>
      prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]
    );
    setAddonSaved(false);
  }

  async function handleAddonSave() {
    setAddonSaving(true);
    setAddonError('');
    setAddonSaved(false);
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/addons`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enabledAddons: addonEdits }),
      });
      if (!res.ok) {
        const d = await res.json().catch((): ApiErrorBody => ({}));
        setAddonError(d.error ?? 'Save failed');
      } else {
        setAddonSaved(true);
      }
    } catch {
      setAddonError('Network error');
    } finally {
      setAddonSaving(false);
    }
  }

  // ─── Overrides ───────────────────────────────────────────────────────
  const [overrides,     setOverrides]     = useState<Override[]>(initialOverrides);
  const [showHistory,   setShowHistory]   = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<Record<string, boolean>>({});
  const [revoking,      setRevoking]      = useState<Record<string, boolean>>({});

  const [showForm,    setShowForm]    = useState(false);
  const [formType,    setFormType]    = useState<'subscription_status' | 'comp_period'>('subscription_status');
  const [formValue,   setFormValue]   = useState('active');
  const [formExpires, setFormExpires] = useState('');
  const [formReason,  setFormReason]  = useState('');
  const [formSaving,  setFormSaving]  = useState(false);
  const [formError,   setFormError]   = useState('');

  const activeOverrides     = overrides.filter(o => !o.revokedAt);
  const historicalOverrides = overrides.filter(o => o.revokedAt);

  async function handleRevoke(oid: string) {
    setRevoking(r => ({ ...r, [oid]: true }));
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/overrides/${oid}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      setOverrides(prev => prev.map(o =>
        o.id === oid ? { ...o, revokedAt: new Date().toISOString(), revokedBy: 'superuser' } : o
      ));
      setRevokeConfirm(r => ({ ...r, [oid]: false }));
    } catch {
      // leave in confirm state so user can retry
    } finally {
      setRevoking(r => ({ ...r, [oid]: false }));
    }
  }

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!formReason.trim()) { setFormError('Reason is required'); return; }
    setFormSaving(true);
    setFormError('');
    try {
      const body: Record<string, string> = {
        type:   formType,
        reason: formReason,
      };
      if (formType === 'subscription_status') body.value = formValue;
      if (formExpires) body.expires_at = new Date(formExpires).toISOString();

      const res = await fetch(`/api/platform-admin/orgs/${orgId}/overrides`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Failed'); return; }

      const created = data.override;
      setOverrides(prev => [{
        id:        created.id,
        type:      created.type,
        value:     created.value ?? null,
        expiresAt: created.expires_at ?? null,
        reason:    created.reason,
        createdBy: created.created_by,
        createdAt: created.created_at,
        revokedAt: null,
        revokedBy: null,
      }, ...prev]);

      setShowForm(false);
      setFormReason('');
      setFormExpires('');
      setFormValue('active');
      setFormType('subscription_status');
    } catch {
      setFormError('Network error');
    } finally {
      setFormSaving(false);
    }
  }

  return (
    <>
      {/* Organization Identity */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Organization Identity</h2>
        <form className={styles.overrideForm} onSubmit={handleIdentitySave}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Name</label>
            <input
              className={styles.formInput}
              value={identityName}
              onChange={e => { setIdentityName(e.target.value); setIdentitySaved(false); }}
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Slug</label>
            <input
              className={styles.formInput}
              value={identitySlug}
              onChange={e => { setIdentitySlug(e.target.value.trim().toLowerCase()); setIdentitySaved(false); }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <p className={styles.warningNote}>
              Changing the slug updates public and admin URLs immediately. Existing links may break.
            </p>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Reason</label>
            <textarea
              className={styles.formTextarea}
              value={identityReason}
              onChange={e => setIdentityReason(e.target.value)}
              rows={2}
              placeholder="Support reason for this identity change"
              required
            />
          </div>
          {identityError && <div className={styles.rowError}>{identityError}</div>}
          <div className={styles.notesActions}>
            <button type="submit" className={styles.saveBtn} disabled={identitySaving}>
              {identitySaving ? 'Saving...' : identitySaved ? 'Saved' : 'Save Identity'}
            </button>
          </div>
        </form>
      </section>

      {/* Active Overrides */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Active Overrides
            <HelpTooltip
              title="Active Overrides"
              body="Overrides let you manually set subscription status or grant comp periods for this org. All changes are audit-logged with a required reason."
            />
          </h2>
          <button className={styles.addBtn} onClick={() => setShowForm(f => !f)}>
            {showForm ? 'Cancel' : '+ Add Override'}
          </button>
        </div>

        {showForm && (
          <form className={styles.overrideForm} onSubmit={handleAddOverride}>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Type</label>
              <select
                className={styles.formSelect}
                value={formType}
                onChange={e => setFormType(e.target.value as typeof formType)}
              >
                <option value="subscription_status">Subscription Status</option>
                <option value="comp_period">Comp Period</option>
              </select>
            </div>

            {formType === 'subscription_status' && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Status Value</label>
                <select
                  className={styles.formSelect}
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                >
                  {STATUS_VALUES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Expires (optional)</label>
              <input
                type="datetime-local"
                className={styles.formInput}
                value={formExpires}
                onChange={e => setFormExpires(e.target.value)}
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Reason *</label>
              <textarea
                className={styles.formTextarea}
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                rows={2}
                placeholder="Why is this override being applied?"
                required
              />
            </div>

            {formError && <div className={styles.rowError}>{formError}</div>}

            <button type="submit" className={styles.saveBtn} disabled={formSaving}>
              {formSaving ? 'Saving…' : 'Apply Override'}
            </button>
          </form>
        )}

        {activeOverrides.length === 0 ? (
          <p className={styles.emptyNote}>None</p>
        ) : (
          <div className={styles.overrideList}>
            {activeOverrides.map(o => (
              <div key={o.id} className={styles.overrideRow}>
                <div className={styles.overrideMeta}>
                  <span className={styles.overrideType}>{o.type.replace('_', ' ')}</span>
                  {o.value && <span className={styles.overrideValue}>{o.value}</span>}
                  {o.expiresAt && (
                    <span className={styles.overrideExpiry}>
                      expires {fmtDate(o.expiresAt)}
                    </span>
                  )}
                  <span className={styles.overrideReason}>{o.reason}</span>
                  <span className={styles.overrideBy}>by {o.createdBy} · {fmtDateTime(o.createdAt)}</span>
                </div>

                {isExpired(o.expiresAt) && (
                  <div className={styles.expiredWarning}>
                    ⚠ Expired on {fmtDate(o.expiresAt!)} — revoke or extend
                  </div>
                )}

                <div className={styles.revokeCell}>
                  {revokeConfirm[o.id] ? (
                    <>
                      <span className={styles.confirmLabel}>Confirm revoke?</span>
                      <button
                        className={styles.confirmBtn}
                        onClick={() => handleRevoke(o.id)}
                        disabled={revoking[o.id]}
                      >
                        {revoking[o.id] ? 'Revoking…' : 'Yes, revoke'}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setRevokeConfirm(r => ({ ...r, [o.id]: false }))}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.revokeBtn}
                      onClick={() => setRevokeConfirm(r => ({ ...r, [o.id]: true }))}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {historicalOverrides.length > 0 && (
          <div className={styles.historySection}>
            <button
              className={styles.historyToggle}
              onClick={() => setShowHistory(h => !h)}
            >
              {showHistory ? '▾' : '▸'} {historicalOverrides.length} revoked override{historicalOverrides.length !== 1 ? 's' : ''}
            </button>
            {showHistory && (
              <div className={styles.overrideList}>
                {historicalOverrides.map(o => (
                  <div key={o.id} className={`${styles.overrideRow} ${styles.overrideRowRevoked}`}>
                    <div className={styles.overrideMeta}>
                      <span className={styles.overrideType}>{o.type.replace('_', ' ')}</span>
                      {o.value && <span className={styles.overrideValue}>{o.value}</span>}
                      <span className={styles.overrideReason}>{o.reason}</span>
                      <span className={styles.overrideBy}>by {o.createdBy} · {fmtDateTime(o.createdAt)}</span>
                      <span className={styles.overrideBy}>revoked by {o.revokedBy} · {fmtDateTime(o.revokedAt!)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Module Overrides */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Module Overrides</h2>
        {overrideableModules.length === 0 ? (
          <p className={styles.emptyNote}>All add-on modules are included in this org&apos;s plan.</p>
        ) : (
          <>
            <div className={styles.addonGrid}>
              {overrideableModules.map(m => {
                const enabled = addonEdits.includes(m);
                return (
                  <div key={m} className={styles.addonRow}>
                    <span className={styles.addonLabel}>{ADDON_MODULE_LABELS[m] ?? m}</span>
                    <button
                      className={`${styles.addonToggle} ${enabled ? styles.addonToggleOn : styles.addonToggleOff}`}
                      onClick={() => handleAddonToggle(m)}
                    >
                      {enabled ? 'Enabled' : 'Off'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className={styles.notesActions}>
              <button
                className={styles.saveBtn}
                onClick={handleAddonSave}
                disabled={addonSaving}
              >
                {addonSaving ? 'Saving…' : addonSaved ? 'Saved ✓' : 'Save Overrides'}
              </button>
              {addonError && <span className={styles.rowError}>{addonError}</span>}
            </div>
          </>
        )}
      </section>

      {/* Members */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Members</h2>
        {members.length === 0 ? (
          <p className={styles.emptyNote}>No members found.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Sign In</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.userId}>
                    <td>{m.displayName || <span className={styles.dimText}>—</span>}</td>
                    <td className={styles.mono}>{m.email}</td>
                    <td className={styles.capText}>{m.role}</td>
                    <td className={styles.capText}>{m.status}</td>
                    <td className={styles.dimText}>
                      {m.lastSignIn ? fmtDate(m.lastSignIn) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Non-archived Tournaments */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Non-Archived Tournaments</h2>
        {tournaments.length === 0 ? (
          <p className={styles.emptyNote}>No non-archived tournaments.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <span className={`${styles.badge} ${tournamentStatusClass(t.status, styles)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className={styles.dimText}>{t.startDate ? fmtDate(t.startDate) : '—'}</td>
                    <td className={styles.dimText}>{t.endDate ? fmtDate(t.endDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Internal Notes */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Internal Notes</h2>
        <textarea
          className={styles.notesTextarea}
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
          rows={5}
          placeholder="Support context, billing notes, account flags…"
        />
        <div className={styles.notesActions}>
          <button
            className={styles.saveBtn}
            onClick={handleNotesSave}
            disabled={notesSaving}
          >
            {notesSaving ? 'Saving…' : notesSaved ? 'Saved ✓' : 'Save Notes'}
          </button>
          {notesError && <span className={styles.rowError}>{notesError}</span>}
        </div>
      </section>
    </>
  );
}
