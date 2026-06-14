'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../feedback.module.css';

/**
 * Flag-for-product toggle for one feedback row. Rendered only for write-capable roles (the page
 * gates it). Posts to the escalate API; the API also enforces the `feedback` write gate
 * (defense-in-depth). Reverts optimistic state on failure.
 */
export default function EscalateControls({
  id,
  escalated: initialEscalated,
}: {
  id: string;
  escalated: boolean;
}) {
  const router = useRouter();
  const [escalated, setEscalated] = useState(initialEscalated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (busy) return;
    const next = !escalated;
    setEscalated(next);
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/platform-admin/feedback/${id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalate: next }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setEscalated(!next);
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={styles.escalateControl}>
      <button
        type="button"
        className={escalated ? styles.escalateBtnActive : styles.escalateBtn}
        disabled={busy}
        onClick={toggle}
        title={escalated ? 'Clear the product escalation flag' : 'Flag this item for the product team'}
      >
        {escalated ? 'Clear escalation' : 'Escalate to product'}
      </button>
      {error && <span className={styles.statusError}>{error}</span>}
    </span>
  );
}
