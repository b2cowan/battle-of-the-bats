'use client';

import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import type { BasicCoachInterestOption } from '@/lib/basic-coach-interest';
import styles from './ScopeCeilingInterest.module.css';

type Props = {
  basicTeamId: string;
};

type SubmitResponse = {
  error?: string;
};

const OPTIONS: Array<{ value: BasicCoachInterestOption; label: string }> = [
  { value: 'lineups', label: 'Lineups' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'documents', label: 'Documents' },
  { value: 'budget', label: 'Budget' },
  { value: 'dues_automation', label: 'Dues automation' },
];

export default function ScopeCeilingInterest({ basicTeamId }: Props) {
  const [selected, setSelected] = useState<BasicCoachInterestOption[]>([
    'lineups',
    'documents',
    'budget',
    'dues_automation',
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(value: BasicCoachInterestOption) {
    setSaved(false);
    setSelected(prev => (
      prev.includes(value)
        ? prev.filter(item => item !== value)
        : [...prev, value]
    ));
  }

  async function submit() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/coaches/teams/${basicTeamId}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selected }),
      });
      const data = (await res.json().catch(() => ({}))) as SubmitResponse;
      if (!res.ok) throw new Error(data.error ?? 'Could not save your interest.');
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your interest.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.copy}>
        <h3>Need more than Basic?</h3>
        <p>Tell us which team tools matter next. Basic stays free; this just helps us prioritize follow-up.</p>
      </div>

      <div className={styles.options} role="group" aria-label="Team tools of interest">
        {OPTIONS.map(option => (
          <label key={option.value} className={styles.option}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {saved && (
        <p className={styles.success}>
          <Check size={14} aria-hidden /> Interest saved.
        </p>
      )}

      <button
        type="button"
        className={styles.button}
        onClick={submit}
        disabled={busy || selected.length === 0}
      >
        <Send size={15} aria-hidden /> {busy ? 'Saving...' : 'Express interest'}
      </button>
    </div>
  );
}
