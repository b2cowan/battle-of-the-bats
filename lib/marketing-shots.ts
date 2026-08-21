// `.ts` extension is deliberate and matches lib/help-shots.ts: this module is imported
// BOTH by the app (through the bundler) and directly by scripts/capture-marketing-shots.mjs
// running under Node's type-stripping, which needs the real filename.
import { DEMO_COACH_SHOWCASE, DEMO_COACH_TEAM_IDS } from './demo-org.ts';

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
 *
 * ── ⚠ EVERY SELECTOR HERE IS COUPLED TO THE APP, AND THAT IS AN OPEN QUESTION ──
 * This manifest addresses product elements three ways: by `aria-label`, by rendered TEXT
 * (`th:text-is("Balance")`, `button:has-text("Review settlement")`), and — where a CSS-module
 * element offers no semantic hook — by class substring (`[class*="duesPhoneLens"]`, the idiom
 * lib/help-shots.ts already uses). A /simplify pass in 2026-08 argued the class-substring form
 * should become `data-shot="…"` attributes on the product components, mirroring `data-sandbox-tour`.
 *
 * **Not done, deliberately, and here is the reasoning so it does not have to be re-derived.**
 * Roughly two dozen selectors here are text- or aria-based and are exactly as fragile as a class
 * name — a re-worded column header breaks a capture just as silently as a renamed class. So adding
 * hooks to the nine class-based ones would spread marketing-only markup through nine product
 * components while closing under a third of the exposure.
 *
 * ⚠ **And it would not close the failure that actually matters.** A broken selector does not fail
 * the build: the capture run reports it, but a failed shot LEAVES THE PREVIOUS PNG IN PLACE, and
 * `--check` only proves a file exists with alt, caption and size. So the real hazard is a STALE
 * picture that passes CI — and the fix for that is a staleness check, which is already **P3 of
 * this project** ("a check that fails when a slide's pictured screen or gated claim has moved").
 * Hooks now would be a partial measure taken instead of the whole one. Revisit if P3 is dropped.
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
   * Viewport-pinned chrome to take out of the way for this shot — applied before the prepare
   * clicks and left in place through the shutter.
   *
   * ⚠ Exists for the coach portal's phone navigation bar, which breaks a capture in two ways at
   * once (capture-core incidents #6 and #7). It swallows a prepare click aimed near the foot of a
   * long phone screen — reported as a timeout on an element Playwright has already found, so it
   * reads like an animation problem. And because a union crop is taken `fullPage` in document
   * coordinates while a `position: fixed` element paints at its VIEWPORT position, it lands as an
   * opaque band across the MIDDLE of the crop. The second one is the reason this is not
   * lifted before the screenshot: on a real phone that bar sits at the foot of the screen and
   * never covers the middle of a list, so hiding it photographs the product more honestly, not
   * less.
   */
  hide?: string;
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
    // ⚠ NOT `[aria-label="Dues view"]` — that is the lens toggle, and it is `duesDesktopOnly`, so
    // at 390px it never mounts and the old readiness wait would hang here forever. The phone
    // lens's own wrapper is the proof that the phone surface (not a loading state) has resolved.
    // Class-substring is the established idiom for a CSS-module element with no semantic hook
    // (lib/help-shots.ts does the same); it is why the class carries a meaningful name.
    ready: '[class*="duesPhoneLens"]',
    // Incidents #6/#7 — see the field's own note. Without this the pinned phone bar photographs
    // as an opaque band straight across the middle of this crop, over a family's card.
    hide: 'nav[aria-label="Coaches mobile navigation"]',
    /**
     * COMPOSED — the first seven families, which is deliberately the SAME editorial choice the
     * desktop crop made ("the rows that carry the story"): seven is the count that reaches the
     * first family in arrears, the thing the claim beside it promises, without naming a row
     * position the nightly re-anchor could move.
     *
     * ⚠ The collection-schedule band above these cards is NOT in frame, and that is a trade made
     * on purpose. Including it would put the crop at roughly 358×1005 — a 0.36 ratio, which the
     * fixed 16:10 stage would draw about 140px wide on a desktop reader's screen. Seven cards
     * come out near the scorekeeper capture's proportions, which is the shape the stage is known
     * to render at full size. The band's team-level totals are the part the caption carries.
     */
    clipAll: 'details[class*="duesCard"]:nth-of-type(-n+7)',
    size: { w: 358, h: 550 },
    alt: 'The Player Dues screen as a coach sees it on a phone: one card per family, each giving the player’s name, what they still owe and when it is next due — most of them a plain amount, one written in amber because part of it is already past due.',
    caption: 'Player Dues on a phone — every family, what is left to pay, and the ones who have fallen behind called out where a coach will actually read them.',
  },
  {
    id: 'coach-season-settlement',
    persona: 'coach',
    door: 'coach',
    // Season settlement is a door at the FOOT of the dues tab, not a screen of its own.
    path: `${COACH_TEAM('offSeason')}/accounting?section=dues`,
    // ⚠ Phone width, same defect and same reasoning as the dues entry above — measured at 39% of
    // true size at 390px before this. The settlement sheet has a real phone form: it opens as a
    // full-screen sheet and its family table re-flows into one stacked card per family.
    width: 390,
    ready: '[class*="duesPhoneLens"]',
    // The button's label is stateful: "Review settlement" while the season still has money
    // outstanding, "Close out the season" once everything is in.
    prepare: ['button:has-text("Review settlement")'],
    // ⚠ Capture-core incident #6. This door sits at the very foot of a ~2,100px phone screen and
    // the portal's phone navigation is pinned over the bottom of the viewport, so the click never
    // becomes actionable — reported as a timeout on an element Playwright has already found. The
    // bar is put back before anything is photographed, and the sheet covers it anyway.
    hide: 'nav[aria-label="Coaches mobile navigation"]',
    // The sheet FETCHES when it opens — without this wait the shot races a "Loading…" line.
    // ⚠ NOT the desktop entry's `th:has-text("Owed back")`: at phone width the table is stacked
    // into cards and the header cells are re-captioned per row rather than sitting in a `thead`.
    readyAfterPrepare: '[aria-label="Season settlement"]',
    /**
     * COMPOSED — the checklist of what is stopping the season closing, down through the first
     * family's figures. Both halves of the claim beside it, and nothing else.
     *
     * ⚠ The whole sheet was the first crop and it was 390×1000 — a 0.39 ratio, which the stage
     * draws about 165px wide on a laptop (42% of true size, measured). The team's-money summary
     * is nine lines of small figures that are unreadable at that scale anyway, so dropping it from
     * frame buys the rest of the picture ~90% at phone width and ~66% on a laptop. **A phone
     * capture has to be short enough to be drawn at full width** — the same arithmetic that
     * decided the dues crop one entry above, and the P1 lesson applied to height rather than rows.
     */
    clipAll: '[aria-label="Season settlement"] [class*="settlementNotes"], [aria-label="Season settlement"] table tbody tr:nth-child(1)',
    size: { w: 359, h: 395 },
    alt: 'The Season settlement sheet on a phone: a heading reading “before the season can close”, then each reason it cannot — families who still owe, a shortfall between what paying everyone needs and what the team is holding, and spending the season still plans — followed by the first family’s figures stacked as a card: what they are owed back, their even share, anything they still owe, and the refund that falls out.',
    caption: 'Season settlement on a phone — every reason the books are not ready to close, named one by one, and each family’s refund worked out from the season’s real ledger rather than a spreadsheet.',
  },

  /* ── P2a: the six coach slides whose picture is a real screen ─────────────────
     Every one is shot on the demo team whose SEASON PHASE makes that screen true, which is an
     editorial decision rather than a convenience: the settlement sheet photographed mid-season
     shows every family in debt and argues the opposite of what it means to.

     ⚠ Three of these could not be photographed at all until the demo world was widened in the
     same change (awards, the scouting book's contents, and a second testing day). A prospect
     walking the live sandbox was meeting the same empty screens. */
  {
    id: 'coach-fundraiser-credit',
    persona: 'coach',
    door: 'coach',
    // 12U, MID-SEASON: the only team with a CLOSED drive, so its rebates are real credits sitting
    // on real bills rather than a promise. An open drive has issued nothing and the picture would
    // be a leaderboard with an empty Rebate column.
    path: `${COACH_TEAM('midSeason')}/accounting?section=fundraisers`,
    // ⚠ The door's LABEL is on `aria-label`, not in the link's text — `a:has-text()` reads text
    // content and finds nothing here, which is a silent 20-second wait rather than an error.
    ready: 'a[aria-label="Open Bottle Drive"]',
    // ⚠ The drill-in's own URL carries the fundraiser's row id, which is regenerated on every
    // reseed — so this navigates by the door instead. The drive's NAME is a world constant
    // (`MIDSEASON_FUNDRAISER.name`), which is what makes the door itself stable.
    prepare: ['a[aria-label="Open Bottle Drive"]'],
    readyAfterPrepare: 'th:has-text("Rebate Earned")',
    // COMPOSED (slide #04): the four totals — including what the drive issued as credits — and
    // the families who raised something. ⚠ A union is a RECTANGLE: the drive's own name, its
    // rebate percentage and its dates sit above the tiles and are therefore in frame, which the
    // alt text says rather than describing only the matched elements.
    // ⚠ The `h2` is in the union to pull the rectangle's TOP up past the drive's totals — the
    // tiles (what was raised, what the team keeps, what went back to families as credit, how many
    // took part) sit between the heading and the table and are the half of this picture the claim
    // is actually about. A first crop started at the table header and lost all four of them.
    clipAll: 'h2, th:has-text("Rebate Earned"), tbody tr:nth-child(-n+5)',
    width: 1280,
    size: { w: 958, h: 546 },
    alt: 'A closed team fundraiser: a headline row of totals — everything raised, the share the team keeps, the amount issued back to families as dues credit, and how many families took part — above a ranked table naming each family with what they raised, the rebate they earned, and what is left of their own bill to send.',
    caption: 'A fundraiser’s own page — what each family raised, what it took off their bill, and what is left for them to pay. Nobody has to work it out afterwards.',
  },
  {
    id: 'coach-lineup-board',
    persona: 'coach',
    door: 'coach',
    // 12U, MID-SEASON — the only team with saved lineups across a run of games, which is what
    // makes the bench-time warning real rather than an artefact of a single game.
    path: `${COACH_TEAM('midSeason')}/lineups`,
    ready: 'a:has-text("Open lineup")',
    // Event ids are regenerated on every reseed, so the board is reached through the list. The
    // FIRST "Open lineup" is the most recent played game, which is the one whose grid is full.
    prepare: ['a:has-text("Open lineup")'],
    readyAfterPrepare: 'th:has-text("Bat")',
    // COMPOSED (slide #06): the warning the claim is actually about, plus the grid it is about.
    // ⚠ The warning is matched by its ROLE, not its wording — the sentence names how many innings
    // players sit for, and that number moves with the lineup.
    clipAll: 'p:has-text("bench time"), table:has(th:text-is("Bat")) thead, table:has(th:text-is("Bat")) tbody tr:nth-child(-n+6)',
    width: 1280,
    size: { w: 996, h: 353 },
    alt: 'A game’s lineup board: a warning line saying bench time is uneven and how many innings players are sitting for, above a grid with one row per player — batting order, name and number, then a position for every inning, several of them reading Bench.',
    caption: 'The lineup board — build it once, and it tells you who has been sitting while you are busy coaching.',
  },
  {
    id: 'coach-tryout-scorecard',
    persona: 'coach',
    door: 'coach',
    // 11U, TRYOUT DAY — the only team with a tryout in flight. Its sessions are re-anchored to
    // today by the nightly job, so the scoring screen is always live.
    path: `${COACH_TEAM('tryoutDay')}/tryouts/score`,
    // ⚠ PHONE WIDTH because the phone IS the subject: "evaluators score on their phones" is the
    // claim, and this screen is built dark with 44px targets for exactly that. Never enlarge it.
    width: 390,
    // The scorer's LIST view — "Back to Tryouts" is its header link. ⚠ NOT "All players": that is
    // the back link on the DETAIL view, i.e. the state this shot has not reached yet.
    ready: 'a:has-text("Back to Tryouts")',
    // Incidents #6/#7 — the same pinned phone bar as the money screens.
    hide: 'nav[aria-label="Coaches mobile navigation"]',
    // ⚠ The evaluator list is in BLIND mode — candidates show as a jersey number and a placeholder,
    // never a name. That is the product's own default, and it happens to be the right thing for a
    // public marketing picture too: there is no invented child's name to go stale or to explain.
    prepare: ['text=Player 2'],
    readyAfterPrepare: 'button:has-text("Done")',
    // COMPOSED — the candidate's header and the first three of five criteria. ⚠ The whole card is
    // ~830px tall against 342 wide, and the slide stage spends its height budget on the WIDTH, so
    // the full card would be drawn about 160px across on a desktop reader's screen — legible on a
    // phone and useless everywhere else. Three criteria come out near the scorekeeper capture's
    // proportions, which is the shape this stage is known to render at full size.
    clipAll: '[class*="detailBib"], [class*="cats"] > div:nth-child(-n+3)',
    size: { w: 334, h: 453 },
    alt: 'The tryout scorecard as an evaluator holds it: a dark phone screen showing one candidate by jersey number, then five criteria — hitting, fielding, throwing, speed and attitude — each with a row of large one-to-five buttons, and a Done button at the foot.',
    caption: 'The tryout scorecard on an evaluator’s phone — five taps a player, no clipboard, and the scores land in the ranking as they go.',
  },
  {
    id: 'coach-awards',
    persona: 'coach',
    door: 'coach',
    // 12U, MID-SEASON — awards handed out AT GAMES through the season, which is the beat the
    // slide is about ("in the moment", not written up the week before the banquet). The 13U's
    // banquet award belongs to a closed season and is unreachable behind the season gate.
    path: `${COACH_TEAM('midSeason')}/history?section=awards`,
    ready: 'text=Give an award',
    // COMPOSED (slide #21): the history table — who won what, for which game, when, and the note,
    // each row with the print icon that turns it into a certificate.
    // ⚠ A first crop reached up to the award-type filter pills, which dragged the whole leaderboard
    // into the rectangle: 996×890 of mostly whitespace, with the history — the part that carries
    // the claim — cut off at the bottom. The invented award names are in the Award column anyway,
    // so the pills were never load-bearing.
    clipAll: 'table:has(th:text-is("Award")) thead, table:has(th:text-is("Award")) tbody tr:nth-child(-n+4)',
    width: 1280,
    size: { w: 996, h: 327 },
    alt: 'A team’s award history: a table listing each award given this season — the player, the award the coach invented and its emoji, the game it was given at, the date, and the coach’s note about why — with a print icon on every row for that player’s certificate.',
    caption: 'Awards a coach makes up themselves, handed out game by game — so the list is already written when awards night comes, and every certificate prints from it.',
  },
  {
    id: 'coach-development',
    persona: 'coach',
    door: 'coach',
    // 14U, OFF-SEASON — the only team that has run its tests TWICE, which is the entire claim.
    // ⚠ Addressed by a fixed roster id (`DEMO_COACH_SHOWCASE.offSeasonPlayerId`): that player is
    // pinned because he is the one carrying both halves of this screen — an active focus area and
    // a reading at both testing days. See the constant's own note before repointing this.
    // ⚠ `?section=development` is the PRODUCT's own deep link (`CoachCollapseSection`), which
    // opens the card and scrolls to it. Clicking the summary instead is what a first attempt did,
    // and it timed out — the card is one of eight collapsed sections on a 3,400px page.
    path: `${COACH_TEAM('offSeason')}/roster/${DEMO_COACH_SHOWCASE.offSeasonPlayerId}?section=development`,
    ready: '#development',
    // One click, and it is the one that matters: opening a test's full history is the "beside
    // last month's" half of the claim. The closed row shows only the latest number and a spark.
    prepare: ['button:has-text("60-yard dash")'],
    readyAfterPrepare: 'button:has-text("Log a measurable")',
    // The collapse section carries its own section id as the element id — a real hook, not a
    // class-substring guess.
    clip: '#development',
    width: 1280,
    size: { w: 960, h: 727 },
    alt: 'One player’s development card: a focus area the coach set with a note about what they are working on and a “working on it” badge, then a list of the coach’s own tests — a sprint, exit velocity and a run to first — each showing the latest reading, its date and a small line showing the direction of travel, with one test opened out to show both readings and the months between them.',
    caption: 'Goals set, the same tests run again — so “he’s improved” becomes two numbers and the months between them.',
  },
  {
    id: 'coach-playing-time',
    persona: 'coach',
    door: 'coach',
    // 12U, MID-SEASON — six saved lineups behind it, and a deliberate playing-time outlier the
    // demo world seeds on purpose. ⚠ Never the word "fair" anywhere near this picture (standing
    // owner ruling): the screen measures, it does not judge.
    path: `${COACH_TEAM('midSeason')}/history?section=playing-time`,
    ready: 'th:has-text("Back-to-back sits")',
    // COMPOSED (slide #23): the header and the first rows, which is where the outlier sits — the
    // report is ordered fewest-innings-first, so the crop reaches the story without naming a row.
    clipAll: 'table:has(th:text-is("Back-to-back sits")) thead, table:has(th:text-is("Back-to-back sits")) tbody tr:nth-child(-n+7)',
    width: 1280,
    size: { w: 996, h: 333 },
    alt: 'The playing-time report: one row per player showing innings on the field with a small bar, innings on the bench, how many times they sat back-to-back, every position they have played, and innings pitched where it applies — the player with the least time on the field sitting at the top.',
    caption: 'Playing time counted from the lineups you already saved — innings on the field, innings on the bench, and who has sat back-to-back. Measured, in context.',
  },
  {
    id: 'coach-scouting-book',
    persona: 'coach',
    door: 'coach',
    /**
     * 12U, MID-SEASON, and specifically THIS SATURDAY'S OPPONENT — "you play them Saturday" is
     * the slide, so the book being photographed has to be the one that matters this week.
     *
     * ⚠ The plan carried this as an open question: the game console is Saturday-only, so the book
     * cannot be shot where a coach actually reads it. The opponents report is the answer, and it
     * turns out to be the better picture anyway — the console shows the book, this shows the book
     * AND how it got there.
     *
     * The URL key is the opponent's normalized name, and the opponent is `OPPONENTS[0]` in the
     * world module, so unlike an event or a fundraiser this address survives a reseed.
     */
    path: `${COACH_TEAM('midSeason')}/history/opponents/harborview%20falcons`,
    ready: '[class*="scoutBookLine"]',
    // COMPOSED (slide #24): the book line, the composer that fills it, and the log itself. ⚠ A
    // union is a rectangle — the three meetings against this opponent sit between the composer
    // and the log and are therefore in frame, which is a gain rather than a leak: it is what
    // "grows every time you meet them" looks like.
    // ⚠ A comma-separated list is CSS, so every member has to be CSS. The first attempt led with
    // `text=The book line`, and Playwright's text engine swallows the REST OF THE STRING as its
    // argument — the whole selector became one search for a sentence nothing contains, and it
    // failed as "matched nothing visible" rather than as a syntax error.
    clipAll: '[class*="scoutBookLine"], [class*="scoutObs"]',
    width: 1280,
    size: { w: 960, h: 577 },
    // ⚠ Re-written after the seed defect below was fixed: the notes are GROUPED UNDER THEIR GAME,
    // not listed in a block beneath the meetings. The first version of this alt described the
    // broken rendering, which is the quiet way a wrong picture gets an accurate-sounding caption.
    alt: 'A coach’s book on one opponent: a one-line read on the team at the top, a box for logging another observation with tags for pitching, hitting, defense, baserunning and coaching, then every game played against them — each with its result, score and date, and underneath it the notes logged at that game, tagged and one line each.',
    caption: 'The book on the team you play next — one line you would tell an assistant, and under each meeting, what you noticed the last time you played them.',
  },
  {
    id: 'coach-practice-plan',
    persona: 'coach',
    door: 'coach',
    // 12U, MID-SEASON — the team whose written-up practices include a real three-station circuit
    // on a clock, which is the only one of them that shows what a plan is FOR.
    path: `${COACH_TEAM('midSeason')}/practice`,
    ready: 'a:has-text("Open the plan")',
    // Event ids regenerate on every reseed, so the plan is reached through the list; the first
    // "Open the plan" is the most recent written-up practice, which is the circuit one.
    prepare: ['a:has-text("Open the plan")'],
    // ⚠ The plan FETCHES after the page frame renders — without this the shot photographs
    // "Loading practice…", which is exactly the half-loaded screen the readiness rules exist for.
    readyAfterPrepare: 'th:has-text("Group A")',
    // COMPOSED (slide #25): the "where everyone is" grid — every round with its clock time, and
    // the station each group is at. ⚠ The union that also took in the groups and the rotation
    // controls above measured 665×946, and the stage would have drawn that about 280px wide. This
    // one element is 638×261, which fills the stage's whole width. Wide beats complete here.
    clip: '[class*="ppGridWrap"]',
    width: 1280,
    size: { w: 638, h: 261 },
    alt: 'The rotation inside a practice plan: how many minutes before groups move, three named groups with the players in each, and a grid showing which station every group is at in each round of the circuit.',
    caption: 'A practice plan attached to a real practice on the schedule — the stations, the clock, and which group is where in every round.',
  },
  {
    id: 'coach-season-wrapped',
    persona: 'coach',
    door: 'coach',
    // 13U, SEASON'S END — a season that is actually closed, which is the only state this page
    // exists in. ⚠ The season gate sends every other route on this team here, so there is no
    // navigation to get wrong.
    path: `${COACH_TEAM('seasonsEnd')}/season-end`,
    ready: 'text=Season Wrapped',
    // PROOF, and the one slide in the coach deck deliberately NOT cropped to a point: this page
    // is designed to be looked at, and the claim beside it names all four shelves, so cropping to
    // the Wrapped card alone would leave the sentence half-illustrated.
    // ⚠ NOT `clip: 'main'` — that took the whole 1280×1000 viewport, two thirds of which is the
    // portal's sidebar and empty page below the content. That is P1's playoff-bracket lesson
    // exactly: a picture that spends half a slide on gutter reads as the least legible one there.
    // This union runs from the page's own title down to the last shelf, across both columns.
    // ⚠ The second member must be the full-width CONTAINER, not a heading inside it. A first
    // attempt paired the title with `h3:has-text("How the season added up")` and produced a crop
    // sliced down both sides — a union's x-range is the range of the MATCHED boxes, and that h3 is
    // a narrow text node in the right-hand column, so the rectangle stopped at the end of its own
    // words rather than at the edge of the page.
    clipAll: 'h1, [class*="seasonSpread"]',
    width: 1280,
    size: { w: 960, h: 591 },
    alt: 'A closed season on one page: a dark Season Wrapped card giving the final record, the longest winning streak, the closest game, attendance, the most-decorated player and a fact about the lineup, with a button to share it — beside four collapsed shelves for the results, the roster, the practices that were run and how the season added up, and a note saying how many families have opened their player’s recap.',
    caption: 'A season that has closed becomes one page — the record, the roster, the practices, the money — and it stays that way for years.',
  },
];
