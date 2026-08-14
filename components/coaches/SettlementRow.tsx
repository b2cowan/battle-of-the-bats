'use client';
import { Fragment } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { fmt } from '@/lib/coach-money-summary';
import type { SettlementSheetRow } from '@/lib/season-settlement';

/**
 * One family's line on the season settlement sheet — and, when it is open, the breakdown that
 * explains its number.
 *
 * It lives out here because the dues panel's settlement table nests four levels deep before a row
 * even begins (groups → rows → the row → its breakout), and a 170-line block at that indentation
 * is a block nobody re-reads. Everything it renders is SERVER-DERIVED and handed in: this
 * component performs no money arithmetic of its own, which is the rule the whole pass rests on.
 */
export default function SettlementRow({
  row, name, isOpen, onToggle, canWrite, onPayOut, onChangeChoice, fmtDate,
}: {
  row: SettlementSheetRow;
  /** Already assembled by the caller, which also uses it for the payout sheet's title. */
  name: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Money-write, and a live season. A finished season renders the record with no controls. */
  canWrite: boolean;
  onPayOut: () => void;
  onChangeChoice: () => void;
  fmtDate: (iso: string) => string;
}) {
  const owes = row.refund < -0.005;

  return (
    <Fragment>
      <tr className={styles.tr} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td className={styles.td} data-label="Player">
          {name}
          {row.departed && <span className={styles.muted} style={{ fontSize: '0.72rem' }}> · left the team</span>}
        </td>
        <td
          className={`${styles.td} ${styles.tdNum}`} data-label="Owed back"
          style={{ color: row.owedBack > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}
        >
          {row.owedBack > 0.005 ? fmt(row.owedBack) : '—'}
        </td>
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Even share">
          {row.choice === 'none'
            ? <span className={styles.muted} style={{ fontSize: '0.76rem' }}>No share</span>
            : row.cashShare > 0.005
              ? <>{fmt(row.cashShare)}{row.choice === 'fixed' && <span className={styles.muted} style={{ fontSize: '0.72rem' }}> · set</span>}</>
              : <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>—</span>}
        </td>
        {/* ⚠ Never colour alone: "still owes" carries the WORDS as well as the amber (the
            olive↔danger ΔE 1.0 deutan finding). */}
        <td
          className={`${styles.td} ${styles.tdNum}`} data-label="Refund"
          style={{ fontWeight: 700, color: owes ? 'var(--warning)' : row.refund > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.4))' }}
        >
          {fmt(row.refund)}
          {owes && <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400 }}>Still owes</span>}
          {row.settled && !owes && row.lastPaidDate && (
            <span className={styles.muted} style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400 }}>
              Paid {fmtDate(row.lastPaidDate)}
            </span>
          )}
        </td>
        {/* The actions never open the breakdown — a click meant for Pay out must not also
            expand the row underneath it. */}
        <td className={styles.td} data-label="" onClick={e => e.stopPropagation()}>
          <span style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {canWrite && row.payableNow > 0.005 && (
              <button className={styles.btnSecondary} style={ROW_ACTION} onClick={onPayOut}>Pay out</button>
            )}
            {canWrite && !row.departed && (
              <button
                className={styles.btnGhost}
                style={ROW_ACTION}
                aria-label={`Change what ${name} takes`}
                onClick={onChangeChoice}
              >
                Change
              </button>
            )}
          </span>
        </td>
      </tr>

      {/* The row OPENS to its breakdown — nothing is explained in the table itself, which stays
          four clean columns. The lines are the server's and sum to the refund exactly. */}
      {isOpen && (
        <tr className={styles.tr}>
          <td className={styles.td} colSpan={5} style={{ background: 'var(--home-card, rgba(255,255,255,0.03))' }}>
            <div style={{ maxWidth: 420, fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--home-ink, rgba(255,255,255,0.85))' }}>
                {name}&apos;s {fmt(row.refund)}
              </div>
              {row.breakdown.map((line, i) => (
                <div key={i} style={LINE}>
                  <span>
                    {line.label}
                    {line.detail && <span className={styles.muted}> — {fmtDate(line.detail)}</span>}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {line.amount < 0 ? `−${fmt(Math.abs(line.amount))}` : line.amount > 0 ? fmt(line.amount) : '—'}
                  </span>
                </div>
              ))}
              <div style={LINE_TOTAL}>
                <span>{owes ? 'Still owes' : 'Refund'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.abs(row.refund))}</span>
              </div>
              {row.choiceNote && (
                <p className={styles.muted} style={{ fontSize: '0.74rem', margin: '0.4rem 0 0' }}>{row.choiceNote}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/** Both row actions, and the family header's "Pay in one", share one shape — quiet by TYPE SIZE
 *  and never by tap size (44px is the portal's floor). */
export const ROW_ACTION: React.CSSProperties = { fontSize: '0.74rem', padding: '0.2rem 0.55rem', minHeight: 44 };

const LINE: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: '1rem',
  padding: '0.18rem 0', color: 'var(--home-ink-soft, rgba(255,255,255,0.65))',
};

const LINE_TOTAL: React.CSSProperties = {
  ...LINE,
  borderTop: '1px solid var(--home-line, rgba(255,255,255,0.12))',
  marginTop: '0.3rem', paddingTop: '0.35rem',
  fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))',
};
