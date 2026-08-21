// `.ts` extension is deliberate and matches lib/help-shots.ts: this module is imported
// BOTH by the app (through the bundler) and directly by scripts/capture-marketing-shots.mjs
// running under Node's type-stripping, which needs the real filename.
import { DEMO_COACH_TEAM_IDS } from './demo-org.ts';

/**
 * THE MARKETING SCREENSHOT MANIFEST — the one place a walkthrough image is declared.
 *
 * Sibling of `lib/help-shots.ts`, deliberately separate: help shots are rare, documentation-only
 * pictures governed by the help format standard; marketing shots are the SPINE of the pre-sales
 * walkthrough pages (docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md) — the page is built
 * around them. Different editorial rules, different output root, same non-negotiables:
 *
 * ── DEMO WORLD ONLY, ENFORCED ─────────────────────────────────────────────────
 * Every `path` must sit inside a `riverdale-*` demo organization. The capture script REFUSES any
 * other path before a browser opens. The failure this prevents — publishing a real family's name
 * or a real team's money onto the public marketing site — is permanent the moment it ships.
 *
 * ── A STALE SCREENSHOT IS WORSE THAN NO SCREENSHOT ────────────────────────────
 * These pictures are re-taken by machine (`npm run capture:marketing-shots`) so "the screen
 * changed" has a one-command answer, and `--check` (wired into `verify:changed`) fails when a
 * declared picture is missing its file, alt, caption, or size. The walkthrough page reads THIS
 * manifest for alt/caption/dimensions, so a picture and its words cannot drift apart.
 *
 * ── PANEL COPY MUST NOT READ THE PICTURE ALOUD ────────────────────────────────
 * The demo worlds re-anchor on a schedule; scores and counts in a capture are perishable. Panel
 * sentences describe what the SCREEN DOES, never quote a number the next capture might change.
 * (The demo-drift lesson from CLAUDE.md, applied to a surface prospects see first.)
 */

export interface MarketingShot {
  /** Stable id — also the file name (`public/marketing/<persona>/<id>.png`). Renaming orphans the asset. */
  id: string;
  /** Which walkthrough the picture belongs to; also its asset folder. */
  persona: 'tournament' | 'coach';
  /**
   * How the capture browser gets there:
   *  - 'tournament' / 'coach' press that demo door once per run (attaches the demo session —
   *    required for admin/coach screens, rate-limited so it is pressed once, never per shot)
   *  - 'public' uses a fresh visitor context with NO door press — for fan-facing pictures,
   *    where the operator session would leak operator chrome into "what parents see".
   */
  door: 'tournament' | 'coach' | 'public';
  /** Path INSIDE the demo world. Must be a riverdale-* org — the script enforces it. */
  path: string;
  /** Playwright selector proving the screen actually resolved (never an error/empty state). */
  ready: string;
  /** Optional clicks (by selector) to open the thing being pictured — a tab, a tool, a drawer. */
  prepare?: string[];
  /**
   * Optional: proof that what `prepare` OPENED has finished loading. `ready` covers the screen;
   * a panel that fetches its own data when it opens renders "Loading…" first, and without this
   * the shot is a race against that fetch. Same visibility discipline as `ready`.
   */
  readyAfterPrepare?: string;
  /** Optional selector to crop to ONE element. Without either clip the capture is the viewport. */
  clip?: string;
  /**
   * The COMPOSED crop: the union bounding box of every VISIBLE match. Lets a manifest say
   * "the header and the first seven rows" or "the three game cards" and stay re-derivable —
   * which is the rule that keeps a composed crop honest (cropping to the rows that make the
   * point is the technique; cropping to the rows that make a DIFFERENT point is falsification).
   * Mutually exclusive with `clip`; the capture script refuses both.
   *
   * ⚠ The callout rings that mark the point are NOT here and never will be — they are drawn
   * page-side over the picture (lib/walkthrough-content.ts), so the stored PNG stays exactly
   * what the machine took and can be re-taken and re-verified forever.
   */
  clipAll?: string;
  /** Capture width. 1280 = desktop; 390 when the picture's subject is the phone experience. */
  width: number;
  /** Rendered pixel size of the saved file, written back by the capture script. */
  size?: { w: number; h: number };
  /** Required. Describes what the picture SHOWS, for a reader who cannot see it. */
  alt: string;
  /** Stands alone under the image — a reader who skips the picture must lose nothing. */
  caption: string;
}

/**
 * One coach-sandbox team's workspace root. Built from `DEMO_COACH_TEAM_IDS` rather than typed
 * out, matching lib/help-shots.ts: a bare UUID is exactly the kind of value nobody can
 * eyeball-check against its source, so the compiler holds it instead of a comment.
 */
const COACH_TEAM = (team: keyof typeof DEMO_COACH_TEAM_IDS) =>
  `/riverdale-ridge/coaches/teams/${DEMO_COACH_TEAM_IDS[team]}`;

export const MARKETING_SHOTS: MarketingShot[] = [
  {
    id: 'fan-live-score',
    persona: 'tournament',
    // 'public' on purpose: this picture is "what a parent sees", and the operator session
    // would be a lie in it. The page is public — no door needed.
    door: 'public',
    path: '/riverdale-minor-ball/summer-classic',
    // A real DOM id, and the same anchor the demo's own guided tour points at. Only renders
    // while a game is live — the demo's 120-min cycle has a ~4-min seeding seam with nothing
    // live, so a capture can land in it (~3%): re-run with --only=fan-live-score.
    ready: '#live-now',
    clip: '#live-now',
    width: 390,
    size: { w: 390, h: 240 },
    alt: 'A phone-width view of the tournament’s public home page: the Live now section with a game in progress, its score, and where it is being played.',
    caption: 'The public tournament site on a family’s phone — the live game and its score, updating on its own. No account, no app store, nothing for the organizer to send.',
  },
  {
    id: 'scorekeeper-view',
    persona: 'tournament',
    door: 'tournament',
    path: '/riverdale-minor-ball/scorekeeper',
    // The ARIA label is only present on the populated board — the empty state is a different
    // section without it, so this doubles as the "never photograph an empty state" proof.
    ready: 'section[aria-label="Games"]',
    clip: 'section[aria-label="Games"]',
    width: 390,
    size: { w: 350, h: 546 },
    alt: 'The Scorekeeper View board at phone width: today’s games as cards, the next one to score highlighted, with simple score entry.',
    caption: 'Scorekeeper View — the score-entry board a volunteer opens from a link or the Staff Kit’s QR card at the table. No admin access, nothing else they can touch.',
  },
  {
    id: 'rain-delay',
    persona: 'tournament',
    door: 'tournament',
    path: '/riverdale-minor-ball/admin/tournaments/schedule?tournamentSlug=summer-classic',
    ready: 'button:has-text("Tools")',
    prepare: ['button:has-text("Tools")', '[role="menuitem"]:has-text("Rain delay")'],
    clip: '.modal',
    width: 1280,
    size: { w: 560, h: 684 },
    alt: 'The Rain delay dialog over the admin schedule: pick the day and how long the delay is, and every remaining game on that day moves together.',
    caption: 'Tools → Rain delay — the whole day re-times in one action, and the notice to families and coaches is drafted for you.',
  },
  {
    id: 'playoff-bracket',
    persona: 'tournament',
    // Public on purpose, same reason as the fan shot: the bracket every parent refreshes.
    door: 'public',
    path: '/riverdale-minor-ball/summer-classic/standings',
    // The demo tour's own anchor. The bracket sits on Standings, NOT the Playoffs page —
    // that page is the seeding narrative (lib/sandbox-chrome.ts step 2 records the same bug).
    ready: '[data-sandbox-tour="playoff-bracket"]',
    // COMPOSED (slide #14, "two semifinals feeding a final — not the whole bracket"). The
    // section is 984px wide but the bracket drawing inside it is only ~520 — the rest is empty
    // gutter, and photographing it is what made this the least legible picture on the page.
    // The union of the game cards and the round labels IS the bracket, at half the width.
    // ⚠ Deliberately expressed as "every game card", not "the third div": it re-derives
    // correctly if the demo's bracket ever gains a round.
    clipAll:
      '[data-sandbox-tour="playoff-bracket"] a[aria-label^="View game details"], [data-sandbox-tour="playoff-bracket"] svg text',
    width: 1280,
    // ⚠ Cycle-proof wording: the demo replays its game day, so this picture can show any
    // phase — a live semifinal, a waiting final, or a crowned champion. Describe the shape.
    size: { w: 480, h: 266 },
    alt: 'The playoff bracket on the public standings page: semifinal cards feeding the final’s slot, with scores and states filling in as games finish.',
    caption: 'The playoff bracket on the public site — seeded from pool play, filling itself in as games end. Nobody redraws a whiteboard.',
  },
  {
    id: 'registration-health',
    persona: 'tournament',
    door: 'tournament',
    // The Invitational is the event with a real registration pipeline mid-flight; the demo
    // world seeds it that way on purpose (waitlist, pending review, partial payments).
    path: '/riverdale-minor-ball/admin/tournaments/registrations?tournamentSlug=invitational',
    ready: '[data-sandbox-tour="registration-health"]',
    clip: '[data-sandbox-tour="registration-health"]',
    width: 1280,
    size: { w: 976, h: 227 },
    alt: 'The Registration Health panel: an overall readiness score with tiles for teams, reachability, payments, and registrations needing action, above rows describing each open issue.',
    caption: 'Registration Health — one score for the whole field, weeks out. Every tile opens the exact teams behind its number.',
  },

  /* ── The coach walkthrough ────────────────────────────────────────────────────
     The coach sandbox runs FIVE teams, one per season phase (`DEMO_COACH_TEAM_IDS` in
     lib/demo-org.ts — those ids are hardcoded there on purpose and are stable across reseeds
     and environments). Each picture is taken on the team whose PHASE makes that screen true,
     which is why the two money shots below come from two different teams:

       · Player Dues → 12U, MID-SEASON. The only team seeded rich enough to photograph:
         installments part-paid, two families genuinely past due, and a closed fundraiser
         crediting five families' dues. Everyone else is thin by design.
       · Season settlement → 14U, OFF-SEASON ("the books are open, the season isn't"), because
         squaring up is an END-of-season job. ⚠ Photographed mid-season instead, the same sheet
         is honest and useless: a team half-way through its spending is legitimately in the red,
         so every family's refund shows as a debt and the panel's whole point inverts. The
         phase is the picture. (The season's-end 13U team is NOT an option: its season is
         closed, and the season gate sends every money route to the closed-season page.)

     ⚠ THEME: these are captured with the SAME context as every other shot. The coach portal
     is warm-themed, and the capture context's `colorScheme: 'dark'` does not change that —
     the portal's palette is chosen by a `data-user-theme` attribute that defaults to warm
     with no stored preference, and nothing in the app reads `prefers-color-scheme`. A fresh
     capture context therefore photographs exactly what a coach's first visit renders. */
  {
    id: 'coach-player-dues',
    persona: 'coach',
    door: 'coach',
    // The Money hub is ONE page with a `?section=` tab; the old /accounting/dues route is now a
    // permanent redirect, so address the tab directly and skip the extra hop. The tab is open on
    // the first paint (the hub seeds its visited set from the URL), so no prepare click is needed.
    path: `${COACH_TEAM('midSeason')}/accounting?section=dues`,
    // No guided-tour anchor exists on this screen, and the panel's own "Player Dues" heading
    // renders as null when embedded in the hub — so the lens toggle's ARIA label is the most
    // stable proof, and it only mounts once at least one player has a dues schedule (i.e. it
    // cannot resolve on the loading, empty-roster, or no-dues-yet states).
    ready: '[aria-label="Dues view"]',
    // ⚠ Two <table> elements are mounted here: the by-installment grid ships hidden on desktop
    // (it is the phone lens) and sits FIRST in the DOM. `visible=true` in the capture core is
    // what makes this resolve to the one on screen — incident #2, load-bearing here.
    //
    // COMPOSED (slide #01, "the rows that carry the story"). Header plus seven families rather
    // than all twelve and the totals row: a slide gets about five seconds, and the full table
    // carries fifty numbers. Seven is the count that reaches the first family in arrears — the
    // thing the claim beside it promises — without the crop having to name a row position the
    // nightly re-anchor could move.
    // ⚠ SCOPED to the dues table by a header only it has, never a bare `table`. `clip` takes
    // `.first()` visible match; `clipAll` unions EVERY visible match, and the only thing that
    // throws is zero matches — so a second visible table (a future prepare step that visits
    // another Money tab first, or a section that ever stops hiding with real `display: none`)
    // would silently balloon the crop and still pass. Incident #2 is the same hazard one step
    // back; this is its `clipAll` form.
    clipAll:
      'table:has(th:text-is("Balance")) thead, table:has(th:text-is("Balance")) tbody tr:nth-child(-n+7)',
    width: 1280,
    size: { w: 994, h: 371 },
    alt: 'The top of the Player Dues table in a coach’s Money hub: one row per player with what they were charged, any credits, what they have paid and what is left, each row ending in a plain status word — most up to date, one already flagged as behind.',
    caption: 'Player Dues — every family on one page, with what they owe, what fundraising has already knocked off, and who has fallen behind.',
  },
  {
    id: 'coach-season-settlement',
    persona: 'coach',
    door: 'coach',
    // Season settlement is a door at the FOOT of the dues tab, not a screen of its own.
    path: `${COACH_TEAM('offSeason')}/accounting?section=dues`,
    ready: '[aria-label="Dues view"]',
    // The button's label is stateful: "Review settlement" while the season still has money
    // outstanding (12U's story), "Close out the season" once everything is in.
    prepare: ['button:has-text("Review settlement")'],
    // The sheet FETCHES when it opens — without this wait the shot races a "Loading…" line.
    // This column header exists only in the loaded, populated sheet.
    readyAfterPrepare: '[aria-label="Season settlement"] th:has-text("Owed back")',
    // COMPOSED (slide #03, "the blockers and three family rows"). The sheet's own title, the
    // reasons the books are not ready, and the first families — the rest of the roster repeats
    // the same shape and only makes the picture longer.
    //
    // ⚠ A UNION IS A RECTANGLE, SO IT CARRIES WHAT SITS BETWEEN THE MATCHES. Here that is the
    // whole "team's money" summary card, which no selector below names — it sits between the
    // heading and the table, so it is in the published picture whether or not it is matched.
    // The alt text says so on purpose: a composed crop has to be re-derivable AND honestly
    // described, and describing only the matched elements would be the second half failing.
    clipAll:
      '[aria-label="Season settlement"] h2, [aria-label="Season settlement"] table thead, [aria-label="Season settlement"] table tbody tr:nth-child(-n+3)',
    width: 1280,
    size: { w: 849, h: 541 },
    alt: 'The Season settlement sheet over the dues screen: a heading saying the books are not ready to close, a summary of the team’s money — what came in from dues and fundraising, what has been spent, what cash is left and the surplus to share — a checklist of what still stands in the way, and the first family rows giving what each is owed back, their even share, anything they still owe, and the resulting refund.',
    caption: 'Season settlement — the refund each family is owed, worked out from the season’s real ledger rather than a spreadsheet, with the reasons the books are not ready to close named one by one.',
  },
];
