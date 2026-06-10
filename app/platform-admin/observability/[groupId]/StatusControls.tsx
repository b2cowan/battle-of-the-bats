'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ObsStatus } from '@/lib/observability/dashboard';
import styles from '../observability.module.css';

const SNOOZE_OPTIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

/**
 * Triage controls for a single error group. Renders Resolve / Ignore / Snooze / Reopen.
 * Disabled (and shows a note) for view-only roles — the status API also rejects their
 * writes server-side, so this is defense-in-depth, not the only gate.
 */
export default function StatusControls({
  groupId,
  currentStatus,
  readOnly,
}: {
  groupId: string;
  currentStatus: ObsStatus;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [snoozeHours, setSnoozeHours] = useState(24);

  async function apply(status: ObsStatus, extra?: { snoozeHours?: number }) {
    if (readOnly || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/platform-admin/observability/${groupId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.triage}>
      <span className={styles.triageLabel}>Triage</span>

      {currentStatus !== 'open' && (
        <button className={styles.triageBtn} disabled={readOnly || busy} onClick={() => apply('open')}>Reopen</button>
      )}
      <button
        className={`${styles.triageBtn} ${currentStatus === 'resolved' ? styles.triageBtnActive : ''}`}
        disabled={readOnly || busy}
        onClick={() => apply('resolved')}
      >
        Resolve
      </button>
      <button
        className={`${styles.triageBtn} ${currentStatus === 'ignored' ? styles.triageBtnActive : ''}`}
        disabled={readOnly || busy}
        onClick={() => apply('ignored')}
      >
        Ignore
      </button>

      <select
        className={styles.snoozeSelect}
        value={snoozeHours}
        disabled={readOnly || busy}
        onChange={e => setSnoozeHours(Number(e.target.value))}
        aria-label="Snooze duration"
      >
        {SNOOZE_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.label}</option>)}
      </select>
      <button
        className={`${styles.triageBtn} ${currentStatus === 'snoozed' ? styles.triageBtnActive : ''}`}
        disabled={readOnly || busy}
        onClick={() => apply('snoozed', { snoozeHours })}
      >
        Snooze
      </button>

      {readOnly && <span className={styles.readOnlyNote}>View-only for your role</span>}
      {error && <span className={styles.triageError}>{error}</span>}
    </div>
  );
}
