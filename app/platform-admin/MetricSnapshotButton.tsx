'use client';

import { useState } from 'react';
import styles from './overview.module.css';

type State = 'idle' | 'saving' | 'saved' | 'error';

export default function MetricSnapshotButton({ canSnapshot = true }: { canSnapshot?: boolean }) {
  const [state, setState] = useState<State>('idle');

  // View-only roles can't write a snapshot (the API rejects it) — don't show the button.
  if (!canSnapshot) return null;

  async function handleClick() {
    setState('saving');
    try {
      const res = await fetch('/api/platform-admin/metrics/snapshot', { method: 'POST' });
      setState(res.ok ? 'saved' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <button
      type="button"
      className={styles.snapshotButton}
      onClick={handleClick}
      disabled={state === 'saving'}
    >
      {state === 'saving' ? 'Saving...' : state === 'saved' ? 'Snapshot Saved' : 'Save Today Snapshot'}
    </button>
  );
}
