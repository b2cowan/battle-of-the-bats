// `.ts` extension is deliberate and matches lib/help-shots.ts: this module is imported
// BOTH by the app (through the bundler) and directly by scripts/capture-marketing-shots.mjs
// running under Node's type-stripping, which needs the real filename.

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
  /** Optional selector to crop to. Without one the capture is the viewport. */
  clip?: string;
  /** Capture width. 1280 = desktop; 390 when the picture's subject is the phone experience. */
  width: number;
  /** Rendered pixel size of the saved file, written back by the capture script. */
  size?: { w: number; h: number };
  /** Required. Describes what the picture SHOWS, for a reader who cannot see it. */
  alt: string;
  /** Stands alone under the image — a reader who skips the picture must lose nothing. */
  caption: string;
}

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
    clip: '[data-sandbox-tour="playoff-bracket"]',
    width: 1280,
    size: { w: 984, h: 450 },
    // ⚠ Cycle-proof wording: the demo replays its game day, so this picture can show any
    // phase — a live semifinal, a waiting final, or a crowned champion. Describe the shape.
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
];
