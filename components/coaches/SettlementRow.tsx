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
/* ⚠ NOTHING HERE SAYS WHO SHARES A PAYMENT WITH WHOM (owner ruling 2026-08-14). A caption row
   named the guardian's family; a per-row "· paid with Blair" replaced it; BOTH are gone. This
   sheet works out what each family is owed — it does not issue the payments, so how the cheques
   are combined is somebody else's screen and only crowded this one. Siblings still sort adjacent
   and are still paid as one household when the season closes; the sheet just stops saying so. */
export default function SettlementRow({
  row, name, isOpen, onToggle, canWrite, onChangeChoice, fmtDate,
}: {
  row: SettlementSheetRow;
  /** Already assembled by the caller, which also uses it for the payout sheet's title. */
  name: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Money-write, and a live season. A finished season renders the record with no controls. */
  canWrite: boolean;
  /** ⚠ There is NO `onPayOut` — the season settlement pays every family at once when the season
   *  closes, or nobody (owner ruling 2026-08-14). A family needing money early (someone leaving
   *  mid-season) is paid from their OWN money record, where the rest of their history already is.
   *  `onChangeChoice` stays: deciding who takes what share IS closing out. */
  onChangeChoice: () => void;
  fmtDate: (iso: string) => string;
}) {
  const owes = row.refund < -0.005;

  return (
    <Fragment>
      <tr className={styles.tr} onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td className={styles.td} data-label="Player">
          {name}
          {row.departed && <span className={styles.mutedInline} style={{ fontSize: '0.72rem' }}> · left the team</span>}
        </td>
        <td
          className={`${styles.td} ${styles.tdNum}`} data-label="Owed back"
          style={{ color: row.owedBack > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}
        >
          {row.owedBack > 0.005 ? fmt(row.owedBack) : '—'}
        </td>
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Even share">
          {row.choice === 'none'
            ? <span className={styles.mutedInline} style={{ fontSize: '0.76rem' }}>No share</span>
            : row.cashShare > 0.005
              ? <>{fmt(row.cashShare)}{row.choice === 'fixed' && <span className={styles.mutedInline} style={{ fontSize: '0.72rem' }}> · set</span>}</>
              : <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>—</span>}
        </td>
        {/* The term the Refund column subtracts. Its own column since 2026-08-14, so the row can
            be checked by reading across it. */}
        <td
          className={`${styles.td} ${styles.tdNum}`} data-label="Still owes"
          style={{ color: row.leftToSend > 0.005 ? 'var(--warning)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}
        >
          {row.leftToSend > 0.005 ? fmt(row.leftToSend) : '—'}
        </td>
        {/* ⚠ Never colour alone (the olive↔danger ΔE 1.0 deutan finding). The "Still owes" CAPTION
            that used to do that job is gone — the BRACKETS the formatter now draws round a
            negative say it independently of hue, and the owner asked for the word to go. */}
        <td
          className={`${styles.td} ${styles.tdNum}`} data-label="Refund"
          style={{ fontWeight: 700, color: owes ? 'var(--warning)' : row.refund > 0.005 ? 'var(--success-light)' : 'var(--home-dim, rgba(255,255,255,0.4))' }}
        >
          {fmt(row.refund)}
          {row.settled && !owes && row.lastPaidDate && (
            <span className={styles.mutedInline} style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400 }}>
              Paid {fmtDate(row.lastPaidDate)}
            </span>
          )}
        </td>
      </tr>

      {/* ⚠ THE `Change` BUTTON MOVED IN HERE (2026-08-14) and its column went with it.
          It carries the portal's 44px tap floor, and a 44px control in every row set the ROW's
          height — eight families needed a scroll to show four, which is what the owner was seeing
          when they asked why the table was so big. The row was already a disclosure; changing what
          a family takes now lives where its arithmetic is explained, which is where a coach
          deciding to change it is already looking. The table is a list again. */}
      {isOpen && (
        <tr className={styles.tr}>
          <td className={styles.td} colSpan={5} style={{ background: 'var(--home-card, rgba(255,255,255,0.03))' }}>
            {/* The arithmetic reads at ~420px; the action sits in the width beside it rather than
                under it, where it added a row of height to every opened family. */}
            <div className={styles.settlementRowOpen}>
            <div style={{ maxWidth: 420, fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: 'var(--home-ink, rgba(255,255,255,0.85))' }}>
                {name}&apos;s {fmt(row.refund)}
              </div>
              {row.breakdown.map((line, i) => (
                <div key={i} style={LINE}>
                  <span>
                    {line.label}
                    {line.detail && <span className={styles.mutedInline}> — {fmtDate(line.detail)}</span>}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {Math.abs(line.amount) > 0.005 ? fmt(line.amount) : '—'}
                  </span>
                </div>
              ))}
              <div style={LINE_TOTAL}>
                <span>{owes ? 'Still owes' : 'Refund'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.abs(row.refund))}</span>
              </div>
              {row.choiceNote && (
                <p className={styles.mutedInline} style={{ fontSize: '0.74rem', margin: '0.4rem 0 0' }}>{row.choiceNote}</p>
              )}
            </div>
            {canWrite && !row.departed && (
              <button
                className={styles.btnGhost}
                style={ROW_ACTION}
                aria-label={`Change what ${name} takes`}
                onClick={(e) => { e.stopPropagation(); onChangeChoice(); }}
              >
                Change what {name.split(' ')[0] || 'they'} takes
              </button>
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
