/**
 * THE MARKETING SCREENSHOT MANIFEST — the one place a walkthrough image is declared.
 *
 * Sibling of `lib/help-shots.ts`, deliberately separate: help shots are rare, documentation-only
 * pictures governed by the help format standard; marketing shots are the SPINE of the pre-sales
 * walkthrough pages (docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md) — the page is built
 * around them. Different editorial rules, different output root.
 *
 * ── THE PICTURES STAY; THEIR CAPTURE SOURCE IS GONE (owner ruling 2026-11-25, plan D6) ──
 * Every image under `public/marketing/**` was photographed in the public demo worlds, which were
 * retired. The images are kept; the page addresses, readiness selectors and capture steps that
 * re-took them went with the demos, and `scripts/capture-marketing-shots.mjs` no longer takes a
 * picture. A future re-shoot needs another source (a dev fixture org or a prospect world) and is
 * new work, not this file's job. `--check` (wired into `verify:changed`) still fails when a
 * declared picture is missing its file, alt, caption, or size. The walkthrough page reads THIS
 * manifest for alt/caption/dimensions, so a picture and its words cannot drift apart.
 *
 * ── PANEL COPY MUST NOT READ THE PICTURE ALOUD ────────────────────────────────
 * Scores and counts in a picture are perishable. Panel sentences describe what the SCREEN DOES,
 * never quote a number a re-shoot might change.
 *
 * ⚠ A stale picture still passes `--check`: it proves a file exists with alt, caption and size,
 * never that the picture still looks like the screen. That gap is P3 of the pitch slide library
 * ("a check that fails when a slide's pictured screen or gated claim has moved").
 */

export interface MarketingShot {
  /** Stable id — also the file name (`public/marketing/<persona>/<id>.png`). Renaming orphans the asset. */
  id: string;
  /** Which walkthrough the picture belongs to; also its asset folder. */
  persona: 'tournament' | 'coach';
  /** The width the picture was taken at. 1280 = desktop; 390 when its subject is the phone experience. */
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
}

export const MARKETING_SHOTS: MarketingShot[] = [
  {
    id: 'fan-live-score',
    persona: 'tournament',
    width: 390,
    size: { w: 390, h: 240 },
    takenAt: '2026-09-02',
    alt: 'A phone-width view of the tournament’s public standings page: the playoff bracket, both semifinals complete and the championship matchup already filled in.',
    caption: 'The public tournament site on a family’s phone — the bracket fills itself in from real results. No account, no app store, nothing for the organizer to send.',
  },
  {
    id: 'scorekeeper-view',
    persona: 'tournament',
    width: 390,
    size: { w: 350, h: 546 },
    takenAt: '2026-08-20',
    alt: 'The Scorekeeper View board at phone width: today’s games as cards, the next one to score highlighted, with simple score entry.',
    caption: 'Scorekeeper View — the score-entry board a volunteer opens from a link or the Staff Kit’s QR card at the table. No admin access, nothing else they can touch.',
  },
  {
    id: 'rain-delay',
    persona: 'tournament',
    width: 1280,
    size: { w: 560, h: 684 },
    takenAt: '2026-08-20',
    alt: 'The Rain delay dialog over the admin schedule: pick the day and how long the delay is, and every remaining game on that day moves together.',
    caption: 'Tools → Rain delay — the whole day re-times in one action, and the notice to families and coaches is drafted for you.',
  },
  {
    id: 'playoff-bracket',
    persona: 'tournament',
    width: 1280,
    size: { w: 480, h: 266 },
    takenAt: '2026-08-20',
    alt: 'The playoff bracket on the public standings page: semifinal cards feeding the final’s slot, with scores and states filling in as games finish.',
    caption: 'The playoff bracket on the public site — seeded from pool play, filling itself in as games end. Nobody redraws a whiteboard.',
  },
  {
    id: 'registration-health',
    persona: 'tournament',
    width: 1280,
    size: { w: 976, h: 227 },
    takenAt: '2026-08-20',
    alt: 'The Registration Health panel: an overall readiness score with tiles for teams, reachability, payments, and registrations needing action, above rows describing each open issue.',
    caption: 'Registration Health — one score for the whole field, weeks out. Every figure opens the exact teams behind its number.',
  },

  /* ── The coach pictures ───────────────────────────────────────────────────────
     Each was taken on a coach team whose SEASON PHASE made that screen true, which is an editorial
     decision rather than a convenience: the settlement sheet photographed mid-season shows every
     family in debt and argues the opposite of what it means to. Money shots: Player dues from a
     mid-season team, Season settlement from an off-season one (squaring up is an end-of-season job). */
  {
    id: 'coach-player-dues',
    persona: 'coach',
    /**
     * ⚠⚠ **PHOTOGRAPHED AT PHONE WIDTH, AND THAT IS THE WHOLE POINT OF THIS ENTRY** (2026-08-20,
     * closing the QA §65/§66 defect). This used to be the 1280px desktop table, which measured
     * **33% of true size at 390px — illegible.** P1 tried to fix it with a tighter crop and
     * proved it cannot be done: cropping rows makes a picture SHORTER, not NARROWER, and
     * on-screen scale follows width, so seven rows scored exactly the same 33% as twelve.
     *
     * The Money hub has a genuinely different phone surface — the desktop table sits behind a
     * `duesDesktopOnly` rule and a per-family card list takes its place — so this is a
     * re-photograph, not a re-crop. ⚠ Do NOT "restore" it to 1280 to get a wider picture: that
     * is the defect, not the fix.
     */
    width: 390,
    size: { w: 358, h: 550 },
    takenAt: '2026-08-21',
    alt: 'The Player dues screen as a coach sees it on a phone: one card per family, each giving the player’s name, what they still owe and when it is next due — most of them a plain amount, one written in amber because part of it is already past due.',
    caption: 'Player dues on a phone — every family, what is left to pay, and the ones who have fallen behind called out where a coach will actually read them.',
  },
  {
    id: 'coach-season-settlement',
    persona: 'coach',
    // ⚠ Phone width, same defect and same reasoning as the dues entry above — measured at 39% of
    // true size at 390px before this. The settlement sheet has a real phone form: it opens as a
    // full-screen sheet and its family table re-flows into one stacked card per family.
    width: 390,
    size: { w: 359, h: 395 },
    takenAt: '2026-08-21',
    alt: 'The Season settlement sheet on a phone: a heading reading “before the season can close”, then each reason it cannot — families who still owe, a shortfall between what paying everyone needs and what the team is holding, and spending the season still plans — followed by the first family’s figures stacked as a card: what they are owed back, their even share, anything they still owe, and the refund that falls out.',
    caption: 'Season settlement on a phone — every reason the books are not ready to close, named one by one, and each family’s refund worked out from the season’s real ledger rather than a spreadsheet.',
  },

  /* ── The six coach slides whose picture is a real screen ────────────────────── */
  {
    id: 'coach-fundraiser-credit',
    persona: 'coach',
    width: 1280,
    size: { w: 958, h: 546 },
    takenAt: '2026-08-21',
    alt: 'A closed team fundraiser open inside the Fundraisers list: its row shows everything raised, the share the team keeps, and what went back to families as dues credit — and beneath it, one line per family naming what they raised and the credit it earned them, with the drive’s credit rule and how many families took part on a quiet line above.',
    caption: 'A fundraiser opens right in the list — what each family raised and what it took off their bill. Nobody has to work it out afterwards.',
  },
  {
    id: 'coach-lineup-board',
    persona: 'coach',
    width: 1280,
    size: { w: 996, h: 353 },
    takenAt: '2026-08-21',
    alt: 'A game’s lineup board: a warning line saying bench time is uneven and how many innings players are sitting for, above a grid with one row per player — batting order, name and number, then a position for every inning, several of them reading Bench.',
    caption: 'The lineup board — build it once, and it tells you who has been sitting while you are busy coaching.',
  },
  {
    id: 'coach-tryout-scorecard',
    persona: 'coach',
    // ⚠ PHONE WIDTH because the phone IS the subject: "evaluators score on their phones" is the
    // claim, and this screen is built dark with 44px targets for exactly that. Never enlarge it.
    width: 390,
    size: { w: 334, h: 453 },
    takenAt: '2026-08-21',
    alt: 'The tryout scorecard as an evaluator holds it: a dark phone screen showing one candidate by jersey number, then five criteria — hitting, fielding, throwing, speed and attitude — each with a row of large one-to-five buttons, and a Done button at the foot.',
    caption: 'The tryout scorecard on an evaluator’s phone — five taps a player, no clipboard, and the scores land in the ranking as they go.',
  },
  {
    id: 'coach-awards',
    persona: 'coach',
    width: 1280,
    size: { w: 996, h: 327 },
    takenAt: '2026-08-21',
    alt: 'A team’s award history: a table listing each award given this season — the player, the award the coach invented and its emoji, the game it was given at, the date, and the coach’s note about why — with a print icon on every row for that player’s certificate.',
    caption: 'Awards a coach makes up themselves, handed out game by game — so the list is already written when awards night comes, and every certificate prints from it.',
  },
  {
    id: 'coach-development',
    persona: 'coach',
    width: 1280,
    size: { w: 960, h: 678 },
    takenAt: '2026-09-13',
    alt: 'One player’s development record on its Results view: the coach’s own tests — a sprint, exit velocity and a run to first — each showing the latest result, its date and a small line showing the direction of travel, with the sprint opened out to show both testing days, the three attempts taken on each with the best and the average, and the months between them.',
    caption: 'The same tests run again, every attempt kept — so “he’s improved” becomes two numbers and the months between them.',
  },
  {
    id: 'coach-playing-time',
    persona: 'coach',
    width: 1280,
    size: { w: 996, h: 333 },
    takenAt: '2026-08-21',
    alt: 'The playing-time report: one row per player showing innings on the field with a small bar, innings on the bench, how many times they sat back-to-back, every position they have played, and innings pitched where it applies — the player with the least time on the field sitting at the top.',
    caption: 'Playing time counted from the lineups you already saved — innings on the field, innings on the bench, and who has sat back-to-back. Measured, in context.',
  },
  {
    id: 'coach-season-wrapped',
    persona: 'coach',
    width: 1280,
    size: { w: 468, h: 477 },
    takenAt: '2026-08-21',
    alt: 'The Season Wrapped card for a closed season: the final record over the number of games, then the longest winning streak, the closest game, game-day attendance, the most-decorated player and a fact about the lineup — with a button to share the season.',
    caption: 'The card a coach shares when the season closes — the record, the streak, the closest game, the attendance and the awards, kept for good.',
  },
  // ⚠ TWO COACH SHOTS WERE RETIRED HERE ON 2026-08-21 — coach-scouting-book, coach-practice-plan
  // — coach-scouting-book and coach-practice-plan. They are not missing; slides #24 and #25 are
  // DRAWINGS now. Their photographs rendered at 34% and 52% of readable size on a phone, and
  // re-capturing at phone width only trades the defect (the picture goes small on a laptop
  // instead). A drawing has no native size. ⚠ Season Wrapped came BACK as a capture on the same
  // day — see its entry above for why the card alone succeeds where the spread could not.
];
