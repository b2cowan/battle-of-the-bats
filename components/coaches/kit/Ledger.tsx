/**
 * THE LEDGER'S SHARED PARTS — both portals (Ledger Parity, owner 2026-10-02). See `Ledger.module.css`
 * for what lives here and why: the What's name, the one phone card (K-25), the phone's balance lines,
 * a record's facts box, and the read window's shape.
 *
 * ⚠ THE READ SHAPE IS SHARED; THE WINDOW IS EACH PORTAL'S. A line another screen wrote opens a READ
 * window on both Ledgers (D3): its facts, one sentence naming where it is changed, one door there.
 * The club draws it in the admin's window (`KitDialog`, admin-only by rule — its tokens live on the
 * admin shell's wrapper) and the coach in the portal's (`QuestionShell`); both render THIS body, so
 * the two cannot drift into two looks for one kind of window.
 */
import type { ReactNode } from 'react';
import styles from './Ledger.module.css';

export { styles as ledgerKit };

/** One fact: a label and its value. A falsy entry is skipped, so a caller lists facts conditionally. */
export type RecordFact = readonly [string, ReactNode] | null | false | undefined;

/** A record's facts: a label on the left, its value on the right (the drawing's record box). */
export function RecordFacts({ rows }: { rows: ReadonlyArray<RecordFact> }) {
  return (
    <div className={styles.facts}>
      {rows.filter((r): r is readonly [string, ReactNode] => !!r).map(([label, value]) => (
        <div key={label} className={styles.factRow}>
          <span className={styles.factLabel}>{label}</span>
          <span className={styles.factValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The body of a ledger line's READ window: the facts, then the one sentence saying where the line is
 * changed ("Recorded on Player Dues. Change it there, and the Ledger follows."). The door to that
 * place is the window's foot button — each portal's own window draws it.
 */
export function LedgerLineRead({ lead, facts, where }: {
  /** A line above the facts (a void line's reason). */
  lead?: ReactNode;
  facts: ReadonlyArray<RecordFact>;
  where?: ReactNode;
}) {
  return (
    <>
      {lead}
      <RecordFacts rows={facts} />
      {where != null && where !== false && <p className={styles.where}>{where}</p>}
    </>
  );
}
