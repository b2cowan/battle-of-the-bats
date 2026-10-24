'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './orgDetail.module.css';

/**
 * A club's own web address, for platform support (Club Tier Stage 4e close-out): what the club has connected, how it stands, and a
 * Release that lets the name go (the same as the owner's Stop, run for a club that will not or cannot press it). A reason is required
 * and goes on the audit log. Shown only to a role that can manage support, and only when the club has an address.
 */
export default function OwnAddressSection({ orgId, address, status }: { orgId: string; address: string; status: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function release() {
    if (!reason.trim()) { setError('Reason is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/own-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) setError(data.error ?? 'Release failed');
      else { setAsking(false); setReason(''); router.refresh(); }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Own web address</h3>
      <p className={styles.emptyNote}>
        <strong>{address}</strong> ({status.replace(/_/g, ' ')}). Releasing lets the host go of the name, removes it from this club and
        lets another club (or this one) connect it. The club&apos;s pages go back to the FieldLogicHQ address at once.
      </p>
      {!asking ? (
        <button type="button" className={styles.saveBtn} onClick={() => { setAsking(true); setError(''); }}>Release this address…</button>
      ) : (
        <div className={styles.formRow}>
          <label className={styles.formLabel} htmlFor="release-address-reason">Reason *</label>
          <textarea
            id="release-address-reason"
            className={styles.formTextarea}
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          {error && <span className={styles.rowError}>{error}</span>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className={styles.saveBtn} disabled={saving} onClick={release}>{saving ? 'Releasing…' : 'Release address'}</button>
            <button type="button" className={styles.cancelBtn} disabled={saving} onClick={() => { setAsking(false); setReason(''); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
