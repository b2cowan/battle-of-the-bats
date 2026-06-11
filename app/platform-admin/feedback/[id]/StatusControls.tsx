'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../feedback.module.css';

const STATUSES = ['new', 'triaged', 'acknowledged', 'resolved'] as const;

/**
 * Inline status dropdown for one feedback row. Disabled for view-only roles — the status API also
 * rejects their writes (defense-in-depth). Optimistically updates, reverts on failure.
 */
export default function StatusControls({
  id,
  currentStatus,
  readOnly,
}: {
  id: string;
  currentStatus: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply(next: string) {
    if (readOnly || busy || next === status) return;
    const prev = status;
    setStatus(next);
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/platform-admin/feedback/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setStatus(prev);
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={styles.statusControl}>
      <select
        className={styles.statusSelect}
        value={status}
        disabled={readOnly || busy}
        onChange={e => apply(e.target.value)}
        aria-label="Feedback status"
        title={readOnly ? 'View-only for your role' : undefined}
      >
        {STATUSES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {error && <span className={styles.statusError}>{error}</span>}
    </span>
  );
}
