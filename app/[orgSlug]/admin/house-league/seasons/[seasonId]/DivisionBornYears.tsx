'use client';
/**
 * "Birth years" in the Add division and Edit division windows (Club Tier Stage 4c-2 Part A; copy B1–B4, C12(b), K5). The
 * windows keep their old look and their own Save: this is one more field in them. The boxes are the shared pair
 * (`BornYearsBoxes`, with this window's own classes); the hint, the held line and the cut-off sentence stay here because they
 * sit in the window's own type, and the window has no "Change in Settings" link (B3). The rule is `lib/born-years.ts`; what to
 * say and whether Save may go is `divisionBornState`, worked out ONCE by the page (it needs the same answer for its button) and
 * handed down — this file only draws it.
 */
import { cutoffSentence, divisionBornHint, type Cutoff } from '@/lib/born-years';
import { BornYearsBoxes } from '@/components/admin/kit/club/BornYears';
import type { divisionBornState } from '@/lib/birthday-cutoff';
import styles from '../../house-league.module.css';

export default function DivisionBornYears({
  idPrefix, from, to, state, onChange, cutoff, sportLabel,
}: {
  idPrefix: string;
  from: string;
  to: string;
  /** What the boxes say and whether Save may go (`divisionBornState`) — the page's one answer, also read by its button. */
  state: ReturnType<typeof divisionBornState>;
  onChange: (from: string, to: string) => void;
  cutoff: Cutoff;
  /** The season's sport, as families and the admin read it ("Softball"). */
  sportLabel: string;
}) {
  const describedBy = `${idPrefix}-born-note`;

  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${idPrefix}-born-label`}>Birth years</span>
      <div role="group" aria-labelledby={`${idPrefix}-born-label`}>
        {/* The one pair of boxes (components/admin/kit/club/BornYears.tsx), wearing this old-look window's own field look. */}
        <BornYearsBoxes
          from={from}
          to={to}
          onFrom={v => onChange(v, to)}
          onTo={v => onChange(from, v)}
          cutoff={cutoff}
          describedBy={describedBy}
          classes={{ pair: styles.bornPair, box: `${styles.input} ${styles.bornBox}`, affix: styles.bornAffix, dash: styles.bornDash }}
        />
      </div>
      <p id={describedBy} className={state.held ? styles.bornHeld : styles.hint} role={state.held ? 'alert' : undefined}>
        {state.held ?? divisionBornHint(state.years ?? { from: null, to: null }, cutoff)}
      </p>
      <p className={styles.hint}>{cutoffSentence(sportLabel, cutoff)}</p>
    </div>
  );
}
