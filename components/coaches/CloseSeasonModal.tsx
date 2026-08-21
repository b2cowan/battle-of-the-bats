'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useOverlayOpen } from '@/lib/coaches-overlay';

/**
 * "Close the season" — the quiet door out of a live season (COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN
 * §3.1, owner-approved 2026-08-18; the mockups are the spec).
 *
 * ⚠ **THIS IS THE ONLY THING IN THE PRODUCT THAT ENDS A SEASON WITHOUT STARTING ANOTHER.** Until
 * now the Overview's "Close out the season" button opened the ROLLOVER sheet — so a team that had
 * aged out, or a coach not ready to plan next year, had no way to finish at all. That is the defect
 * this component exists for, and the reason its sibling (`StartNextSeasonModal`) is the loud door
 * and this one the quiet one.
 *
 * ⚠⚠ **IT WARNS ABOUT UNSETTLED MONEY AND NEVER BLOCKS** (owner ruling 2026-08-18). Naming what is
 * outstanding is required; refusing to close is forbidden. A coach who settled up in cash, forgave
 * a balance, or knows something the product cannot see would otherwise be stranded — and blocking
 * would make the product the arbiter of a real-world debt it only partly sees. The route behind
 * this is the same shape: it reports the two figures and returns nothing that could refuse.
 *
 * ⚠ The money block is ABSENT for a coach without the books, rather than zeroed. "0 families still
 * owe" from a screen that cannot see the money is a confident wrong answer; saying nothing is the
 * honest shape, and the same posture the money shelf on Season's End takes.
 */

type ClosePreflight = {
  season: { id: string; name: string; year: number; status: string; isLive: boolean };
  canReopen: boolean;
  money: { familiesOwing: number; duesOutstanding: number; waitingToReturn: number } | null;
};

/** Two decimal places, matching every other money figure a coach reads in the portal. */
const fmtMoney = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CloseSeasonModal({
  orgSlug,
  teamId,
  seasonName,
  onClose,
  onDone,
}: {
  orgSlug: string;
  teamId: string;
  seasonName: string;
  /** The coach backed out. */
  onClose: () => void;
  /** The season is closed. The caller re-seeds the coaches context and lands the coach somewhere. */
  onDone: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [preflight, setPreflight] = useState<ClosePreflight | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useOverlayOpen(true);

  /**
   * ⚠ The warnings are fetched when the dialog OPENS, not carried in from the screen behind it.
   * The figures move with every payment and payout, and a dialog that named a stale one would be
   * warning about money that arrived last week — worse than not warning at all, because a coach
   * who checks and finds it settled learns to ignore the block.
   *
   * ⚠ Fails QUIET: a preflight that could not load leaves the dialog with its plain explanation and
   * no warning block. Money is a secondary read here; a red line where the warning belongs would
   * stop a coach ending a season over a report that failed to load.
   */
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/seasons`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: ClosePreflight) => { if (!cancelled) setPreflight(json); })
      .catch(() => { /* quiet by design — see above */ });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  async function handleClose() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/seasons`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not close the season.');
        return;
      }
      await onDone();
    } catch {
      setError('Could not close the season. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const money = preflight?.money ?? null;
  const owesDues = !!money && money.familiesOwing > 0 && money.duesOutstanding > 0;
  const owesBack = !!money && money.waitingToReturn > 0;
  const hasWarnings = owesDues || owesBack;

  return (
    <div
      className={`${styles.modalOverlay} ${styles.centeredOnMobile}`}
      onPointerDown={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Close ${seasonName}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Close {seasonName}?</h2>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close" disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', color: 'var(--white-80)', lineHeight: 1.55 }}>
          This season becomes a record. You keep everything — the results, the roster, the money, the
          practices — on one page you can open any time.
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--white-55)' }}>
          You can start a new season later; closing now does not prevent it.
        </p>

        {/* ── What is still outstanding. Names it, offers the way back, and lets the coach close
            anyway (owner ruling 2026-08-18). ─────────────────────────────────────────────────── */}
        {hasWarnings && (
          <div style={{
            background: 'rgba(var(--warning-rgb), 0.1)', border: '1px solid rgba(var(--warning-rgb), 0.3)',
            borderRadius: 8, padding: '0.8rem 0.9rem', marginBottom: '1rem',
          }}>
            <p style={{
              margin: '0 0 0.55rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--warning)',
            }}>
              Before you do
            </p>
            {owesDues && (
              <p style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', margin: '0 0 0.4rem', fontSize: '0.86rem', color: 'var(--white-80)' }}>
                <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} aria-hidden />
                <span>
                  <strong>{money!.familiesOwing} {money!.familiesOwing === 1 ? 'family' : 'families'}</strong>
                  {' '}still {money!.familiesOwing === 1 ? 'owes' : 'owe'} {fmtMoney(money!.duesOutstanding)}
                </span>
              </p>
            )}
            {owesBack && (
              <p style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', margin: '0 0 0.4rem', fontSize: '0.86rem', color: 'var(--white-80)' }}>
                <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} aria-hidden />
                <span>
                  <strong>{fmtMoney(money!.waitingToReturn)}</strong> is waiting to go back to families
                </span>
              </p>
            )}
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.79rem', color: 'var(--white-55)' }}>
              You can still close — but these get harder to sort out afterwards.
            </p>
          </div>
        )}

        {error && <p className={styles.errorText} style={{ marginTop: '0.4rem' }}>{error}</p>}

        <div className={styles.modalFooter}>
          {/* ⚠ The way back is a real navigation, not a dismissal — a coach who reads a warning and
              presses this expects to land where the money is, with the dialog gone. */}
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={submitting}
            onClick={() => {
              onClose();
              if (hasWarnings) router.push(`/${orgSlug}/coaches/teams/${teamId}/accounting`);
            }}
          >
            {hasWarnings ? 'Not yet — take me to Money' : 'Cancel'}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleClose} disabled={submitting}>
            {submitting ? 'Closing...' : 'Close the season'}
          </button>
        </div>
      </div>
    </div>
  );
}
