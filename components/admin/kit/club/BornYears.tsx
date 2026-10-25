'use client';
/**
 * The pair of birth-year boxes (Club Tier Stage 4c-2; words CLUB_TIER_STAGE4C2_COPY.md A2, A3, K5) — Team details uses it
 * and so do the house-league division windows (ONE recipe: the markup, the placeholder, the dates and the accessible names
 * live only here). Two boxes, placeholder "Year", a dash between. Off January 1
 * each box wears its date ("Sep 1," before the first, "Aug 31," before the second), so the admin types years and sees what
 * they mean. The accessible names say the same thing aloud (K5).
 *
 * Everything else — the hint, the held reason, the cut-off line — is `lib/born-years.ts`; this file only draws the boxes.
 *
 * `classes` is for the OLD-LOOK windows (the division windows keep their own field look and Save): they pass their own
 * box, affix and dash classes so the boxes wear the window's look while the markup and words stay this file's.
 */
import ck from './ClubKit.module.css';
import styles from './BornYears.module.css';
import { boxAffixes, type Cutoff } from '@/lib/born-years';

const noComma = (s: string) => s.replace(/,$/, '');

export type BornYearsClasses = Partial<Record<'pair' | 'box' | 'boxAffixed' | 'affix' | 'dash', string>>;

export function BornYearsBoxes({ from, to, onFrom, onTo, cutoff, held, describedBy, classes }: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  cutoff: Cutoff;
  /** A held value: both boxes take the red edge (the reason sits under them). */
  held?: boolean;
  describedBy?: string;
  /** Another look for the boxes (the old-look windows); omitted = the kit's. */
  classes?: BornYearsClasses;
}) {
  const affixes = boxAffixes(cutoff);
  const edge = held ? ` ${styles.boxHeld}` : '';
  const boxClass = classes
    ? `${classes.box ?? ''}${affixes && classes.boxAffixed ? ` ${classes.boxAffixed}` : ''}${edge}`
    : `${ck.input} ${affixes ? styles.boxAffixed : styles.box}${edge}`;
  const affixClass = classes?.affix ?? styles.affix;
  const dashClass = classes?.dash ?? styles.dash;
  return (
    <span className={classes?.pair ?? styles.years}>
      {affixes && <span className={affixClass} aria-hidden>{affixes.from}</span>}
      <input
        className={boxClass}
        value={from}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="Year"
        aria-label={affixes ? `Earliest birth year, counted from ${noComma(affixes.from)}` : 'Earliest birth year'}
        aria-invalid={held || undefined}
        aria-describedby={describedBy}
        onChange={e => onFrom(e.target.value)}
      />
      <span className={dashClass} aria-hidden>–</span>
      {affixes && <span className={affixClass} aria-hidden>{affixes.to}</span>}
      <input
        className={boxClass}
        value={to}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="Year"
        aria-label={affixes ? `Latest birth year, up to ${noComma(affixes.to)}` : 'Latest birth year'}
        aria-invalid={held || undefined}
        aria-describedby={describedBy}
        onChange={e => onTo(e.target.value)}
      />
    </span>
  );
}

/** The held reason under the boxes (A15–A18, C12b): red, read aloud when it appears. */
export function BornHeld({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} className={styles.held} role="status">{children}</p>;
}

/** "Mentions 2025 — still true?" — amber, never a block (the site editor's `.yearHint`, the same ink). */
export function PastYearLine({ children }: { children: React.ReactNode }) {
  return <p className={styles.yearHint}>{children}</p>;
}
