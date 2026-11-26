/**
 * THE HELP SCREENSHOT MANIFEST — the one place a help image is declared.
 *
 * `components/help/HelpScreenshot.tsx` renders `alt`, `caption`, `size` and `highlight`;
 * `scripts/capture-help-shots.mjs --check` (wired into `verify:changed`) fails when a declared
 * picture is missing its file, alt, caption or size.
 *
 * ── THE PICTURES STAY; THEIR CAPTURE SOURCE IS GONE (owner ruling 2026-11-25, plan D6) ──
 * Every image under `public/help/**` was photographed in a public demo world, which was retired.
 * The images are kept; the page addresses, readiness selectors and capture steps that re-took them
 * went with the demos, and no script takes a picture any more. A future re-shoot needs another
 * source (a dev fixture org or a prospect world) and is new work, not this file's job.
 *
 * ── THE RULE THAT KEEPS THESE HONEST (format standard, `.claude/commands/docs.md`) ──
 * Screenshots are OPT-IN and RARE: only where the answer is spatial ("where is that
 * control?") or visual (a form you fill once, a report you must recognise). Never
 * decoration, never a picture of a sentence. A picture that no longer matches the screen
 * comes OUT and the text carries the answer — a stale screenshot is worse than no
 * screenshot, because the reader believes it.
 *
 * ⚠ NOT A VERIFICATION TOOL. `check:layout` renders pages and reads COMPUTED STYLES
 * precisely because eyeballing a screenshot produced the wrong fix twice in this
 * portal. These images are documentation for readers; they prove nothing about
 * layout and must never be used to decide whether a screen is correct.
 */

export interface HelpShot {
  /** Stable id — also the file name (`public/help/<module>/<id>.png`). Renaming orphans the asset. */
  id: string;
  /** Which guide the picture belongs to; also its asset folder. */
  module: 'coaches' | 'tournaments' | 'accounting' | 'org' | 'house-league' | 'registrations' | 'exports';
  /** The width the picture was taken at. 1280 = desktop; 390 only where the ANSWER is phone-specific. */
  width: number;
  /** Rendered pixel size of the saved file. */
  size?: { w: number; h: number };
  /**
   * The day this picture was last taken, `YYYY-MM-DD` in the org’s zone.
   *
   * ⚠ Never typed by hand: it was stamped by the capture run, and a hand-typed date would be a claim
   * about when a machine did something. Missing means "taken before we started recording this".
   *
   * ⚠⚠ AND IT IS A PROXY, NOT AN ANSWER. It tells a reader WHEN, never WHETHER the picture still
   * resembles the screen. A six-month-old picture of a screen nobody has touched is fine; a
   * one-week-old picture of a screen redesigned on Tuesday is not. The studio says so in words
   * beside it — do not let a surface present this as a freshness check.
   */
  takenAt?: string;
  /** Required. Describes what the picture SHOWS, for a reader who cannot see it. */
  alt: string;
  /** Stands alone under the image — a reader who skips the picture must lose nothing. */
  caption: string;
  /** Optional highlight ring over one control, as % of the image box. */
  highlight?: { top: string; left: string; width: string; height: string };
}

export const HELP_SHOTS: HelpShot[] = [
  {
    id: 'money-record-payment',
    module: 'coaches',
    width: 1280,
    /* ⚠ RE-TAKEN AND RE-DESCRIBED 2026-09-08 (QA §151 docs pass). Both lines described a table
       that had stopped existing the day before: a single "Credits" column, and a status word
       ("Partial") the shared list no longer produces. The picture itself pre-dated the ladder and
       the totals row. A screenshot's alt and caption are read by people who cannot see the image,
       so a stale one is not a cosmetic problem — it is the guide asserting a product that is gone. */
    size: { w: 1280, h: 1000 },
    takenAt: '2026-09-08',
    /* ⚠ THE FRAME IS THE VIEWPORT, so these describe what is ACTUALLY IN IT — the band, the
       collection schedule and the first rows — and deliberately NOT the totals row at the foot of
       the table, which sits below the fold of this capture. The first rewrite claimed it, which
       would have been the same defect in a new coat: a caption is what a reader who cannot see the
       image is given INSTEAD of the image, so it may only promise what the picture delivers. */
    alt: 'The Player dues screen: four figures across the top — dues, collected, balance owing and past due — then the collection schedule, then a table where each family’s row reads left to right as a subtraction: dues, fundraising, other credits, what they have paid, and the balance they still owe. A dash marks a column with nothing in it.',
    caption: 'Player dues — a family’s row reads across as a subtraction, and a dash means there is nothing of that kind on the row. Credits lower the bill itself, so a family whose fundraising finished the job reads Settled rather than Paid. A row opens to Record payment.',
  },
  {
    id: 'money-budget-vs-actual-months',
    module: 'coaches',
    width: 1280,
    size: { w: 1280, h: 1000 },
    takenAt: '2026-10-01',
    alt: 'The Budget vs. Actual report in its Months view: budget lines down the side, the season’s months across the top, and View and Showing dropdowns above the grid.',
    caption: 'Budget vs. Actual in its Months view — your lines down the side, the season across the top, and the Showing dropdown changing what every cell holds.',
  },
];
