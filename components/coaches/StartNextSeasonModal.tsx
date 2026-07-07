'use client';
import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/** Local mirror of the parts of RepSeasonRolloverSummary this modal renders (the source type lives
 *  in the server-only lib/rep-season-rollover.ts). */
interface RolloverSummary {
  ok: boolean;
  newSeason: { id: string; name: string; year: number };
  coaches: { copied: number };
  roster: { copied: number; failed: number };
  budget: { carried: boolean; linesCopied: number; periodsCopied: number; failed: number };
  fees: { carried: boolean; playersCopied: number; failed: number; dueDatesShifted: boolean };
  notes: string[];
  warnings: string[];
}

export default function StartNextSeasonModal({
  orgSlug,
  teamId,
  currentSeasonName,
  defaultNextYear,
  onClose,
  onDone,
}: {
  orgSlug: string;
  teamId: string;
  currentSeasonName: string;
  defaultNextYear: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(`${defaultNextYear} Season`);
  const [nameTouched, setNameTouched] = useState(false);
  const [year, setYear] = useState(String(defaultNextYear));
  const [carryBudget, setCarryBudget] = useState(true);
  const [carryFees, setCarryFees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<RolloverSummary | null>(null);

  // Escape closes the form (not the success view — that only exits via "Go to ...").
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting && !summary) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitting, summary, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/seasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), year: Number(year), carryBudget, carryFees }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not start the new season.');
        return;
      }
      setSummary(data.summary as RolloverSummary);
    } catch {
      setError('Could not start the new season. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={e => { if (e.target === e.currentTarget && !submitting) { if (summary) onDone(); else onClose(); } }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Start next season">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{summary ? 'New season started' : 'Start next season'}</h2>
          {!summary && (
            <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close" disabled={submitting}>
              <X size={18} />
            </button>
          )}
        </div>

        {summary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--lime, #b6e34d)', flexShrink: 0 }} />
              <p style={{ margin: 0, color: 'var(--white-90)' }}>
                <strong>{summary.newSeason.name}</strong> is now your active season.
              </p>
            </div>

            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
              <li>{summary.roster.copied} player{summary.roster.copied === 1 ? '' : 's'} carried forward{summary.roster.failed > 0 ? ` (${summary.roster.failed} couldn't be copied)` : ''}.</li>
              {summary.budget.carried && (
                <li>{summary.budget.linesCopied} planned budget line{summary.budget.linesCopied === 1 ? '' : 's'} carried.</li>
              )}
              {summary.fees.carried && (
                <li>{summary.fees.playersCopied} player{summary.fees.playersCopied === 1 ? '' : 's'}&apos; fee plan{summary.fees.playersCopied === 1 ? '' : 's'} carried.</li>
              )}
              <li>The schedule starts fresh — last season&apos;s games, payments, and spending stay with {currentSeasonName}.</li>
            </ul>

            {summary.notes.length > 0 && (
              <div style={{ background: 'var(--white-05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.7rem 0.85rem' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--white-55)' }}>Check these</p>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--white-70)' }}>
                  {summary.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            {summary.warnings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {summary.warnings.map((w, i) => (
                  <p key={i} style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--danger, #e6794d)' }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{w}</span>
                  </p>
                ))}
              </div>
            )}

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnPrimary} onClick={onDone}>
                Go to {summary.newSeason.name}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
              Roll <strong>{currentSeasonName}</strong> into a new season. Your active roster comes with you
              (you can prune or add after), and the schedule starts fresh.
            </p>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="snsName">Season name</label>
                <input id="snsName" className={styles.input} value={name} maxLength={100}
                  onChange={e => { setName(e.target.value); setNameTouched(true); }} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="snsYear">Year</label>
                <input id="snsYear" className={styles.input} type="number" value={year} min={2000} max={2100}
                  onChange={e => { const v = e.target.value; setYear(v); if (!nameTouched) setName(v ? `${v} Season` : ''); }} required />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
                <input type="checkbox" checked={carryBudget} onChange={e => setCarryBudget(e.target.checked)} style={{ marginTop: 3 }} />
                <span>Carry over the <strong>planned budget</strong> (projected buckets only — actual spending stays behind).</span>
              </label>
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
                <input type="checkbox" checked={carryFees} onChange={e => setCarryFees(e.target.checked)} style={{ marginTop: 3 }} />
                <span>Carry over the <strong>fee plan</strong> (amounts &amp; installments; due dates shift forward a year — paid history does not carry).</span>
              </label>
            </div>

            {/* Clear, unmissable caution — starting a season is a one-way lock (no reopen). */}
            <div style={{
              display: 'flex', gap: '0.55rem', alignItems: 'flex-start', marginTop: '1rem',
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8, padding: '0.7rem 0.85rem',
            }}>
              <AlertTriangle size={16} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} aria-hidden />
              <span style={{ fontSize: '0.85rem', color: 'var(--white-80)', lineHeight: 1.5 }}>
                Once you start, <strong>{currentSeasonName}</strong> is locked as read-only. You can always look
                back at its roster, schedule, and finances — but you won&apos;t be able to change them.
              </span>
            </div>

            {error && <p className={styles.errorText} style={{ marginTop: '0.9rem' }}>{error}</p>}

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                {submitting ? 'Starting...' : 'Start next season'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
