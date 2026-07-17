'use client';
import type { ContinuityRow } from '@/lib/continuity-match';

/**
 * ONE compare card for a suggested returning-player pair — the same copy, layout, and
 * amber treatment on both verify doors (profile card + Decision Board), extracted by the
 * 3C /simplify pass (the amber literals had already drifted between three call sites).
 * Name + birth date lead; a guardian email is never shown alone (sibling-collision rule).
 */
export default function ContinuityCompareCard({ row, busy, onConfirm, onReject, onDismiss }: {
  row: ContinuityRow;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      margin: '0 0 0.5rem',
      padding: '0.6rem 0.75rem',
      border: '1px solid var(--warning, #b45309)',
      borderRadius: 10,
      background: 'rgba(180, 83, 9, 0.1)',
    }}>
      <p style={{ margin: '0 0 0.15rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fcd34d' }}>
        Possible returning player — verify
      </p>
      <p style={{ margin: '0 0 0.45rem', fontSize: '0.8rem' }}>
        <strong>{row.prior.seasonLabel}:</strong> {row.prior.firstName} {row.prior.lastName ?? ''}
        {row.prior.dateOfBirth ? ` · born ${row.prior.dateOfBirth}` : ' · no birth date on file'}
        {(row.prior.guardianFirstName || row.prior.guardianEmail)
          ? ` · guardian ${[row.prior.guardianFirstName, row.prior.guardianLastName].filter(Boolean).join(' ') || '—'}${row.prior.guardianEmail ? ` (${row.prior.guardianEmail})` : ''}`
          : ''}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-lime" style={{ fontSize: '0.77rem' }} disabled={busy} onClick={onConfirm}>
          Confirm — same player
        </button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.77rem' }} disabled={busy} onClick={onReject}>
          Not the same player
        </button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.77rem' }} disabled={busy} onClick={onDismiss}>
          Not sure yet
        </button>
      </div>
    </div>
  );
}
