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
   * ⚠ A TILE THAT HIDES WHEN ITS ABSENCE IS THE GOOD NEWS (recipe deviation 2) — off-plan spending,
   * money past due. The band re-fits from 4 to 3 rather than printing a decorative zero.
   */
  hidden?: boolean;
}

/**
 * ⚠⚠ THE BAND STACKS ALL-OR-NOTHING, AND THAT IS INHERITED KNOWLEDGE, NOT A GUESS. The Club band's
 * own header records why it refused the portal's auto-fit summary grid: at the widths this hub
 * actually gets, an auto-fit row reflows 3 → 2 + 1 and orphans whichever figure lands alone. These
 * tiles are one sentence about one tab, so they hold one row and stack together at 760.
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
              <span className={styles.moneyBandCaption}>{t.caption}</span>
            )}
          </div>
        ))}
      </div>
      {note != null && <p className={styles.moneyBandNote}>{note}</p>}
    </>
  );
}
