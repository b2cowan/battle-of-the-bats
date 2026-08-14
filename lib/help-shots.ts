// `.ts` extension is deliberate and matches lib/demo-coach.ts: this module is imported
// BOTH by the app (through the bundler) and directly by scripts/capture-help-shots.mjs
// running under Node's type-stripping, which needs the real filename.
import { DEMO_COACH_TEAM_IDS } from './demo-org.ts';

/**
 * THE HELP SCREENSHOT MANIFEST — the one place a help image is declared.
 *
 * Read by BOTH sides so a picture and its capture can never drift apart:
 *   - `components/help/HelpScreenshot.tsx` renders `alt`, `caption`, `width`/`height`
 *   - `scripts/capture-help-shots.mjs` uses `door`, `path`, `ready`, `prepare`, `clip`
 *     to re-take the picture, and writes `width`/`height` back here after it does.
 *
 * ── WHY A MANIFEST AT ALL ─────────────────────────────────────────────────────
 * A screenshot is the one kind of help content that goes stale SILENTLY: the product
 * moves, the words get updated because someone read them, and the picture underneath
 * keeps showing last quarter's screen. The manifest is what makes staleness findable —
 * a change to a screen listed here has a `path` you can grep for, and re-taking every
 * affected picture is one command.
 *
 * ── THE RULE THAT KEEPS THESE HONEST (format standard, `.claude/commands/docs.md`) ──
 * Screenshots are OPT-IN and RARE: only where the answer is spatial ("where is that
 * control?") or visual (a form you fill once, a report you must recognise). Never
 * decoration, never a picture of a sentence. A picture that can no longer be re-taken
 * from the demo world comes OUT and the text carries the answer — a stale screenshot
 * is worse than no screenshot, because the reader believes it.
 *
 * ── DEMO WORLD ONLY, AND IT IS ENFORCED, NOT REMEMBERED ───────────────────────
 * Every `path` must sit inside a `riverdale-*` demo organization. The capture script
 * REFUSES any other path (see its DEMO-ONLY assertion) rather than trusting whoever
 * edits this file, because the failure mode is publishing a real family's name or a
 * real team's money into the product's own documentation. The demo worlds are also
 * write-blocked at the proxy, so a capture run cannot mutate anything either.
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
  /** Which demo door to press before navigating (it attaches the demo session). */
  door: 'coach' | 'tournament';
  /** Path INSIDE the demo world. Must be a riverdale-* org — the script enforces it. */
  path: string;
  /** Playwright selector proving the screen actually resolved (never an error/empty state). */
  ready: string;
  /** Optional clicks (by selector) to open the thing being pictured — a form, a tab, a drawer. */
  prepare?: string[];
  /** Optional selector to crop to. Without one the capture is the viewport. */
  clip?: string;
  /** Capture width. 1280 = desktop; use 390 only when the ANSWER is phone-specific. */
  width: number;
  /** Rendered pixel size of the saved file, written back by the capture script. */
  size?: { w: number; h: number };
  /** Required. Describes what the picture SHOWS, for a reader who cannot see it. */
  alt: string;
  /** Stands alone under the image — a reader who skips the picture must lose nothing. */
  caption: string;
  /** Optional highlight ring over one control, as % of the image box. */
  highlight?: { top: string; left: string; width: string; height: string };
}

const RIDGE = '/riverdale-ridge/coaches/teams';
const MID = `${RIDGE}/${DEMO_COACH_TEAM_IDS.midSeason}`;

export const HELP_SHOTS: HelpShot[] = [
  {
    id: 'money-record-payment',
    module: 'coaches',
    door: 'coach',
    path: `${MID}/accounting?section=dues`,
    ready: 'table, [class*="cardList"]',
    width: 1280,
    size: { w: 1280, h: 1000 },
    alt: 'The Player Dues table, with each family’s assessed, paid and balance figures, and the Record payment control on a player’s row.',
    caption: 'Player Dues — a family’s row opens to Record payment, where any amount and the day it arrived go in.',
  },
  {
    id: 'money-budget-vs-actual-months',
    module: 'coaches',
    door: 'coach',
    path: `${MID}/accounting?section=budget-vs-actual`,
    // The report opens on Categories, which has no table — the month grid this picture
    // is about only exists after the view toggle moves.
    ready: 'button:has-text("Months")',
    prepare: ['button:has-text("Months")'],
    width: 1280,
    size: { w: 1280, h: 1000 },
    alt: 'The Budget vs. Actual report, showing budget lines down the side and the season’s months across the top.',
    caption: 'Budget vs. Actual in its Months view — your lines down the side, the season across the top, and one toggle changing what every cell shows.',
  },
];
