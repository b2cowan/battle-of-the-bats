import type { ReactNode } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE MONEY TAB'S SUMMARY — one recipe, every tab (owner ruling 2026-09-03, D1; mockup of record
 * artifact `2b5bd78b-cbc5-4c5c-b7e0-d3956121caf6`).
 *
 * ⚠⚠ WHY THIS EXISTS, MEASURED. Five money tabs opened with a summary and drew it five ways — a
 * prose strip on Budget vs. Actual, three cells on Club, four bordered cards on Fundraising, a
 * titled panel on Budget Plan, and nothing at all on Player Dues (its figures sat in a table foot).
 * Read off the stylesheets the differences were not stylistic choices but accidents of build order:
 * label 11px vs 12px, tracking .07em vs .04em, figure weight 700 vs 900, tabular numerals on three
 * of four. A treasurer reads all five in one sitting and had to find the summary somewhere new each
 * time.
 *
 * ⚠ THE PRECEDENT IS ONE LAYER DOWN AND IT IS THE REASON THIS IS A COMPONENT RATHER THAN A
 * CONVENTION. `tests/unit/money-hierarchy-type-scale.test.ts` exists because the money TABLES forked
 * into two type scales twice in a single day, each time fixed only on the half someone was looking
 * at; its header records that a comment asking the next contributor to change both had already
 * failed twice. A convention here would fail the same way.
 *
 * ⚠ AND THE SHAPE IS ALREADY RATIFIED BELOW IT: List · Room · Question gives every ROOM a strip of
 * 3–4 money tiles (Billed/Paid/Left, Raised/Team keeps/Credited, Pledged/Arrived/To come). This is
 * that rule applied upward to the tab header, not a new idea.
 */

/** How a figure is inked. ⚠ COLOUR MARKS A VERDICT, NEVER A TOTAL — see `tone` below. */
export type MoneyTileTone = 'plain' | 'good' | 'warn' | 'danger';

export interface MoneyTile {
  /** React key, and the id the layout baseline will see. */
  key: string;
  /** ≤4 words. Rendered uppercase at the label step — do not shout in the string itself. */
  label: string;
  /**
   * ONE number, formatted by the caller.
   *
   * ⚠ THE TAB OWNS ITS OWN FORMATTER, deliberately. Budget vs. Actual prints accounting brackets
   * (its binding screen notation), Player Dues prints a plain minus; a formatter in here would have
   * to learn both and would become the place their rules drift together.
   */
  figure: ReactNode;
  /**
   * ⚠⚠ COLOUR IS FOR A VERDICT, NOT A TOTAL (recipe deviation 1). Headroom over/under, money
   * overdue, a request awaiting an answer — things where the hue IS the reading. A figure that is
   * merely a sum stays in primary ink: Fundraising's totals were green and purple for no reason
   * beyond having been built on a different day, and they read as meaning something.
   */
  tone?: MoneyTileTone;
  /** ≤6 words: the qualifier the figure cannot carry itself. Omitted rather than padded. */
  caption?: ReactNode;
  /**
   * ⚠⚠ THE CAPTION'S PHONE FORM — and it exists because three tabs had outgrown the contract one
   * line up (Money phone walk, decision M1, owner 2026-09-22). Measured at 390: Budget Plan's
   * expenses caption ran to 60 characters and two lines, Player Dues' collected caption to 54, and
   * at two-up they would have taken a third. The desk caption is NOT wrong — at three tiles across
   * a 1,100px column it fits on one line and carries detail worth having — so the fix is a phone
   * form, not a shorter caption everywhere.
   *
   * ⚠ OMIT IT WHEN THE CAPTION ALREADY HOLDS. Budget vs. Actual (12–23 characters) and Fundraising
   * (10–37) pass nothing and render one caption at every width; only a tab that genuinely needs a
   * second wording declares one. A `captionShort` that merely restates `caption` is drift.
   *
   * ⚠ BOTH ARE IN THE DOM and CSS shows one — `display: none` removes the other from the
   * accessibility tree too, so a screen reader reads the form its width is on and never both.
   */
  captionShort?: ReactNode;
  /**
   * ⚠ A TILE THAT HIDES WHEN ITS ABSENCE IS THE GOOD NEWS (recipe deviation 2) — off-plan spending,
   * money past due. The band re-fits from 4 to 3 rather than printing a decorative zero.
   */
  hidden?: boolean;
}

/**
 * ⚠⚠ THE BAND NARROWS TO TWO-UP, NEVER TO ONE, AND NEVER BY AUTO-FIT (Money phone walk, decision
 * M1, owner 2026-09-22). The Club band's original refusal of the portal's auto-fit summary grid
 * still stands and its reason is untouched: an auto-fit row reflows 3 → 2 + 1 and orphans whichever
 * figure lands alone. What that argument settled was *not auto-fit*; it did not settle *one column*,
 * and for a year the band read that as the same thing.
 *
 * ⚠ THE ONE-COLUMN STACK WAS THE MEASURED DEFECT. At 390 it made a four-tile band 387px — a
 * Budget vs. Actual tile carries twelve to twenty-three characters of caption, so no amount of
 * editing the words could shrink it. Budget Plan's first budget line rendered 122px BELOW the
 * phone's bottom bar, Budget vs. Actual's 34px below: a coach opened the budget and saw no budget.
 *
 * A FIXED two-column grid orphans nothing, because the odd tile takes the whole width rather than
 * sitting beside a gap — see the stylesheet. Every band on every tab is now the same height on a
 * phone, which is what this component was built for and had never achieved (291–405px before).
 */
export default function MoneySummaryBand({
  tiles,
  note,
  ariaLabel,
}: {
  tiles: MoneyTile[];
  /** ⚠ ONE note, BENEATH the band and never inside it (recipe deviation 3). */
  note?: ReactNode;
  /** Names the region for a screen reader — "Club money summary". */
  ariaLabel?: string;
}) {
  const shown = tiles.filter(t => !t.hidden);
  if (shown.length === 0) return null;

  return (
    <>
      <div
        className={styles.moneyBand}
        /* The column count rides an attribute rather than N classes: one rule per count, and the
           stacking media query does not have to know how many there are. */
        data-tiles={Math.min(shown.length, 4)}
        role="group"
        aria-label={ariaLabel}
      >
        {shown.map(t => (
          <div key={t.key} className={styles.moneyBandTile}>
            <span className={styles.moneyBandLabel}>{t.label}</span>
            <span className={styles.moneyBandFigure} data-tone={t.tone ?? 'plain'}>{t.figure}</span>
            {/* ⚠ RENDERED ONLY WHEN THERE IS ONE. An empty caption element still occupies a line
                box, which is what left two of Fundraising's four cards a row shorter than their
                neighbours and made the row read as ragged. */}
            {t.caption != null && t.caption !== '' && (
              <span className={styles.moneyBandCaption}>
                {t.captionShort != null && t.captionShort !== '' ? (
                  <>
                    <span className={styles.moneyBandCapDesk}>{t.caption}</span>
                    <span className={styles.moneyBandCapPhone}>{t.captionShort}</span>
                  </>
                ) : t.caption}
              </span>
            )}
          </div>
        ))}
      </div>
      {note != null && <p className={styles.moneyBandNote}>{note}</p>}
    </>
  );
}
