/**
 * THE PITCH SLIDE LIBRARY — one bank of slides, composed into decks by audience.
 *
 * Plan: docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md · approved library + both deck
 * running orders: https://claude.ai/code/artifact/a5dd16a5-519b-4b92-8958-d36195b9df3e
 * The format: https://claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f
 * The three image classes: https://claude.ai/code/artifact/d0cf0ea2-35fe-4f3c-a99c-dd68c2afc793
 *
 * ── THREE LEVELS, AND THEY ARE NOT THE SAME THING ─────────────────────────────
 *   THE LIBRARY  every slide, each keyed by a PERMANENT number (#01…#25) so it can be
 *                tracked as the product changes underneath it. Numbers are never reused
 *                and never renumbered — #08 is retired, #18–#20 are held for the club deck.
 *   A DECK       one audience, in a running order. ⚠ Since stage C a deck's running order is an
 *                owner-saved row too (pitch_decks, read by lib/pitch-deck-store.ts); `PITCH_DECKS`
 *                below is what the two standing decks fall back to when no row is usable — the
 *                known-good composition of record, same discipline as `fallbackPull`. Owner-
 *                created decks (the club deck, stage D's prospect decks) are rows with NO code
 *                fallback: broken means "does not render", and the studio says why.
 *                `deckProblems()` is the save path's whole rulebook for a deck.
 *   THE PAGE     a SHORT PULL from a deck — the 90-second version, a handful of slides, not the
 *                deck. ⚠ Since stage B the LIVE pull is an owner-saved row (pitch_page_pulls,
 *                read by lib/pitch-pull-store.ts); `fallbackPull` below is what the page shows
 *                when no row is saved or the store is unreachable. Which slides a page shows is
 *                a dial the owner turns, not an editorial ruling — `pullProblems()` at the
 *                bottom of this file is the save path's whole rulebook.
 * Conflating them is how a fourteen-slide coach deck ends up on a marketing page nobody
 * scrolls to the bottom of.
 *
 * ── COPY RULES (binding — docs/agents/brand/BRAND_STRATEGY.md) ────────────────
 * Brand voice: practical, direct, warm; the forbidden-word list applies. Never a competitor
 * name — the villain is "the old way". Never a price on this surface. Pain vocabulary stays
 * consistent with lib/plan-article-content.ts painItems — same voice, no parallel bank.
 *
 * ⚠⚠ NO PLAN, TIER, PRICE OR SUBSCRIPTION APPEARS ANYWHERE IN THIS FILE — not on a slide, and
 * NOT on a page panel either (owner ruling 2026-08-21, widening the 2026-08-20 one).
 *
 * The original ruling was a split: slides plan-free so they stay portable between decks, but the
 * unattended PAGE carrying a plan line "because nobody is standing there to answer *is that
 * included?*". **The owner overturned the page half**, in his words: *"we don't need to mention
 * any subscriptions here… we don't want to compartmentalize features at this stage, we want to
 * show people all we have to offer and how we will improve their lives, period."*
 *
 * ⚠ THE DIVISION OF LABOUR IS NOW BY SURFACE, and it is worth understanding before "restoring"
 * anything: **this page creates desire, the pricing page qualifies, and a human answers in the
 * room.** A gate named beside a feature, on a page whose entire job is "here is what stops being
 * your problem", argues against the page. Nine plan chips and one "(the free portal keeps…)"
 * aside were deleted for that reason; `tests/unit/pitch-slide-library.test.ts` now reads the page
 * panels' own copy, not just the slides, so they cannot creep back.
 *
 * ⚠ CYCLE-PROOF OR IT IS WRONG. The demo worlds re-anchor on a schedule (the tournament every
 * two minutes, the coach club nightly), so any score, count or name in a capture is perishable.
 * Slide claims and page answers describe what the SCREEN DOES; they never quote a number the
 * next capture might change, and a callout ring marks a COLUMN or a structural region, never
 * "the third row". (The pain headline MAY stage a scene with invented specifics — "eleven
 * texts" — because it describes the old way, not our screen.)
 */

import type { Metadata } from 'next';
import type { DrawingId } from '@/components/marketing/SlideDrawings';
import { SEE_IT_LIVE_COACHES_PATH, SEE_IT_LIVE_PATH } from './sandbox-door';
import { derivedSeoDescriptionFrom } from './walkthrough-derive';

/**
 * The three image classes, and the forbidden fourth (owner ruling 2026-08-20).
 *  - `proof`     a real capture, unretouched. Carries "this is genuinely our software".
 *  - `composed`  the same real capture, cropped to the rows that carry the story and marked
 *                with rings drawn OVER it. The workhorse.
 *  - `explainer` an obvious illustration, for the *before* a finished screen can never show.
 * ⚠ THE FORBIDDEN FOURTH: a drawn picture that LOOKS like our interface but isn't. The test —
 * could a reasonable person mistake this for a screenshot? If yes, it must BE one.
 */
export type SlideImageClass = 'proof' | 'composed' | 'explainer';

/**
 * A callout ring, drawn OVER the picture and never baked into it — so the stored PNG stays
 * exactly what the machine captured and can be re-taken and re-verified forever.
 *
 * Geometry is percentages OF THE PICTURE (not of the stage): the renderer gives the picture
 * box the capture's own aspect ratio inside the fixed stage, so these percentages land on the
 * same pixels at every width. Mark a structural region — a column, a header, a card — never a
 * row position, which the next re-anchor can move underneath you.
 *
 * ⚠ The ratified format also allows a short mono LABEL above a ring. No slide in the library
 * needs one yet — P1's rings sit on table columns whose own headers are inside the ring and
 * already name them — so it is not built. It arrives with the first slide that needs it.
 *
 * ⚠ THERE IS A SIBLING, AND IT IS DELIBERATELY NOT SHARED: `HelpShot.highlight` in
 * lib/help-shots.ts, rendered by components/help/HelpScreenshot.tsx. Same idea, opposite
 * contract — that one is a SPOTLIGHT (amber, at most one, and a 9999px shadow dimming the whole
 * rest of the picture so a reader's eye lands on a single control). A pitch slide rings two
 * columns it wants the reader to COMPARE, so dimming everything else would defeat the picture,
 * and it sits on both dark and near-white captures where amber-on-cream fails. If a future
 * change makes the two contracts converge, merge them then — do not merge them on the strength
 * of the shape alone.
 */
export interface CalloutRing {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * ONE SLIDE. Its id is permanent; everything else can be re-shot, re-cropped and re-worded.
 * A slide carries the pain and the claim ONLY — no plan name, no call to action, no caption
 * (the caption belongs to the picture and lives in lib/marketing-shots.ts beside it).
 */
/** What every slide carries, whichever kind of picture it has. */
interface PitchSlideBase {
  /** The permanent library number, e.g. '#01'. Never renumbered — it is how a slide is tracked. */
  id: string;
  /** The old-way headline, in the volunteer's own words. Staged, visceral, recognizable. */
  pain: string;
  /** The slide's answer — two sentences at most. Verbatim from the approved library artifact. */
  claim: string;
  /**
   * THE UNATTENDED VERSION (plan finding F4) — what the public page says under this slide, with
   * the qualifications and "your call" clauses a deck doesn't need because a human is in the
   * room. REQUIRED on every slide since stage B: the pull is owner-composable, so any deck slide
   * must be droppable onto its page and simply work — a picker where most options cannot be
   * picked is worse than no picker (ruling 4). It lives HERE, in code, never in a row (ruling 1):
   * the build's plan-words check reads it, and nothing watches a sentence once it is data.
   */
  pageAnswer: string;
  /**
   * The short noun phrase the DERIVED SEO description names this slide by ("volunteer score
   * entry", "one-action rain delays"). The description used to be hand-written per page and
   * named each panel in order; once the pull is owner-editable that rots silently (finding F3),
   * so it is now assembled from these — see `derivedSeoDescription()`.
   */
  seoPhrase: string;
}

/**
 * ONE SLIDE, and it is a UNION because a photographed slide and a drawn one genuinely differ —
 * they are not one shape with optional fields (tightened 2026-08-21 after P2b).
 *
 * ⚠ THE POINT OF THE UNION IS THAT THE COMPILER NOW HOLDS WHAT A UNIT TEST USED TO. Four
 * pairings have to be true at once, and every one of them was previously a runtime `assert` that
 * only ran if someone remembered `npm test`: an explainer names a drawing and never a capture, a
 * capture names a capture and never a drawing, a drawing carries its own alt + caption, and a
 * capture never does. A slide that gets any of them wrong is now rejected at the `PITCH_SLIDES`
 * literal itself. It also deletes the `?? ''` fallbacks the renderer needed — a missing alt used
 * to become `alt=""` on a public page rather than a build failure.
 *
 * ⚠ The `?: undefined` exclusions are load-bearing, not noise. TypeScript's excess-property check
 * against a union permits any property declared on ANY member, so without them an explainer could
 * quietly carry a `shotId` and still typecheck.
 */
export type PitchSlide = PitchSlideBase & (
  | {
      /** A real capture — see `SlideImageClass`. Its alt and caption live in the shot manifest. */
      imageClass: Exclude<SlideImageClass, 'explainer'>;
      /** Joins the slide to its picture in lib/marketing-shots.ts. */
      shotId: string;
      /** Rings drawn over the picture. More than two means it is two slides (format rule 3). */
      rings?: CalloutRing[];
      drawingId?: undefined;
      alt?: undefined;
      caption?: undefined;
    }
  | {
      imageClass: 'explainer';
      /**
       * Joins an explainer to its hand-drawn picture in components/marketing/SlideDrawings.tsx.
       *
       * ⚠ The import is `import type`, so it is erased entirely and creates NO runtime edge from
       * lib to components — this module is loaded by tests/unit under Node's type stripping, which
       * cannot execute a `.tsx` file's JSX, so a real import would crash the suite. What it buys
       * is the compile error: naming a drawing the registry does not hold cannot ship as a blank
       * stage. **Do not drop the `type` keyword.**
       */
      drawingId: DrawingId;
      /**
       * ⚠ REQUIRED ON A DRAWING, AND FORBIDDEN ON A CAPTURE — the asymmetry is the whole reason
       * these live here. A capture keeps its alt and caption in lib/marketing-shots.ts beside the
       * picture, where `check:marketing-shots` fails when either is missing. A drawing has no
       * manifest entry for that check to look at, so it would sail through a green build with no
       * description at all; the type is what closes that hole.
       */
      alt: string;
      caption: string;
      /** A drawing puts its emphasis IN the drawing — a ring would mark what is already marked. */
      rings?: undefined;
      shotId?: undefined;
    }
);

/**
 * THE BANK — every slide that has its picture and its words today.
 *
 * ⚠ Not the whole library: the fourteen slides the approved artifact adds are P2 (new captures
 * and hand-drawn explainers, mostly editorial work). They are named in `SLIDE_NUMBERS_SPOKEN_FOR`
 * so the running orders can be recorded now, in full, and P2 is a pure content addition rather
 * than a resequencing.
 */
export const PITCH_SLIDES = {
  /* ── The coach's year ──────────────────────────────────────────────────────── */
  /**
   * ⚠ THE OVERVIEW SLIDE, AND IT SITS SECOND IN THE DECK RATHER THAN FIRST (owner call
   * 2026-08-21). Open on the visceral moment the deck already opens on — tryout day — then the
   * wheel: "here is the whole shape of it". Opening cold on a diagram is opening on abstraction.
   */
  '#26': {
    id: '#26',
    imageClass: 'explainer',
    drawingId: 'coach-year',
    pain: 'Every season starts from a blank page.',
    claim: 'One place for the whole year — tryouts, the roster, the games, the money and the record — and closing a season is what starts the next one.',
    // ⚠ The rollover specifics ("paid history stripped, the schedule empty, each a toggle") are
    // verified against the rollover itself — see the caption note below. "One page you can still
    // read years later" is the binding closed-season ruling (CLAUDE.md), not copy licence.
    pageAnswer:
      'Tryouts, the roster, the schedule, practices, the money and the record all sit in one place, so nothing has to be re-typed from one into another. The year is a loop rather than a list: closing a season is what starts the next one, and it carries the active roster, your planned budget and the fee setup forward with it — paid history stripped, the schedule empty, each of those a toggle you can turn off. A finished season collapses to a single page you can still read years later.',
    seoPhrase: 'the whole season in one place',
    alt: 'A ring of five stations — tryouts, the roster, games, books and the wrapped season — joined by four faint arrows. The fifth arc, returning from the wrapped season to tryouts, is drawn bright and labelled “start next season”.',
    // ⚠ VERIFIED AGAINST THE ROLLOVER ITSELF, not against a plan. Starting the next season copies
    // the ACTIVE roster (always), the planned budget lines and periods, and the per-player fee
    // structure with paid history stripped — the last two are opt-out toggles that default on.
    // The schedule starts fresh, and actual spending and dues payments do not carry.
    // Naming the three specifically is stronger than "everything carries forward", AND true.
    caption: 'The year the portal is built around. Closing a season is what starts the next one — and the roster, the planned budget and the fee setup come with it.',
  },
  '#01': {
    id: '#01',
    imageClass: 'composed',
    shotId: 'coach-player-dues',
    // ⚠ Shorter than the sentence this page carried before the library existed, and
    // deliberately so: the e-transfer half of the old headline is now slide #02's whole
    // subject (the explainer, P2). Until #02 ships, the coach deck opens its money run one
    // beat blander than it used to — recorded in the plan as a known P1 cost.
    pain: 'Team fees are tracked in your head.',
    claim: 'Every family on one page — charged, paid, left to pay, and who has fallen behind.',
    // ⚠ "automatic overdue reminders" is what the mockup said and it is NOT written here. The
    // scheduled sweep (lib/dues-reminders.ts, ticked daily by pg_cron) runs two waves 30 and 7
    // days BEFORE an installment is due — ahead of the date, not after it — and it is on for a
    // new team (rep_program_years.auto_reminders_enabled DEFAULT true). The never-paid nudge
    // stays deliberately manual because it has no sent-stamp, so it is NOT what "one button"
    // means here: that is the toolbar's **Send Due Reminders**, which chases everyone past due
    // or due within three days, partial payers included. Do not conflate the two buttons.
    //
    // ⚠ "or waits for season's end" is not hedging for its own sake. Credits meeting bills is
    // a per-team setting (rep_program_years.credit_application): two of its three modes reduce
    // the bill, and `keep_separate` deliberately does not ("Credits don't reduce bills —
    // settled at season's end"). Unqualified, this sentence would be false for any team on
    // that mode. The demo world pins the default, so the PICTURE stays true either way.
    pageAnswer:
      'Player Dues puts every family on one page — what they were charged, what they have paid, what is left, and who has fallen behind. Reminders go out on their own ahead of each installment’s due date, and one button chases whoever is still behind. Money a family raised fundraising comes off their own bill, or waits for season’s end — your call.',
    seoPhrase: 'every family’s dues on one page',
    /**
     * ⚠⚠ **THE RINGS ARE GONE, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT** (2026-08-20,
     * with the phone re-capture). They marked the desktop table's Balance and Status COLUMNS. The
     * phone layout has no columns — it is one card per family — so there was nothing structural
     * left for them to point at, and a ring on a card would have been a row position wearing a
     * different shape: which families are behind moves with the nightly re-anchor, so it would
     * eventually have ringed a family who had paid.
     *
     * Re-pointing them was the alternative and it was rejected on its own merits too. A ring's
     * job on this format is to tell a reader who CANNOT resolve the numbers which part of the
     * picture the sentence is about. That job existed because the old capture rendered at 33% of
     * true size; the phone capture renders at full size, where the amber past-due line is already
     * the loudest thing in frame. A ring around it would be marking what is already marked.
     */
  },
  /**
   * ⚠ THE SLIDE THAT GIVES #01 BACK ITS OTHER HALF. #01 reads "Team fees are tracked in your
   * head." because the visceral half of that sentence is THIS slide's whole subject. The owner
   * confirmed 2026-08-21 that #01 stays short now that #02 sits immediately before it and says
   * the missing half louder than a half-sentence ever did. Do not merge them back.
   */
  '#02': {
    id: '#02',
    imageClass: 'explainer',
    drawingId: 'money-sources',
    pain: 'The e-transfers arrive with no name on them.',
    claim: 'The inbox, the spreadsheet and the bank app stop being three separate jobs.',
    // ⚠ VERIFIED AGAINST THE DUES PANEL, and the verbs are chosen to stay true: a payment is
    // RECORDED — amount, date received, method (E-transfer / Cash / Cheque / Other), optional
    // note — against the family's own row. There is NO bank or inbox integration anywhere in
    // the product, so this answer never says "imported", "synced" or "matched". "Keeps the
    // trail" is literal: an edit is a void-and-repost correction (the mig 232 receipt book),
    // never an in-place rewrite.
    pageAnswer:
      'Every payment is recorded once, against the family it came from — the amount, the date, and whether it arrived by e-transfer, cash or cheque — and the family’s row keeps the running answer: charged, paid, what’s left. Corrections keep the trail rather than rewriting it, so the number you read in March is one you can still explain in October.',
    seoPhrase: 'payments with a name on them',
    alt: 'Three tilted paper slips — a spreadsheet grid, a bank statement and an e-transfer email whose name field is an empty dashed line with a question mark. Three lines converge from them onto a single settled row: a circle, a name, an amount and a tick.',
    caption: 'Three places to look, and none of them says who paid. One line, with a name on it.',
  },
  '#03': {
    id: '#03',
    imageClass: 'composed',
    shotId: 'coach-season-settlement',
    // ⚠ Was "It's October, and you owe ELEVEN FAMILIES a refund…" on the shipped page. Verbatim
    // from the approved library — and the invented count going is no loss: a staged specific in
    // a pain headline is allowed, but it was the only number on the page a reader could try to
    // reconcile against the picture beside it.
    pain: 'It’s October and you owe families a refund you can’t calculate.',
    claim:
      'The season’s real ledger works out what each family gets back, and won’t pay out until the money is actually there.',
    // ⚠⚠ THE MOCKUP'S CLAIM WAS FALSE AND IS NOT WRITTEN HERE. It read "won't let you close
    // the books until every family is made whole" — but closing a season WARNS and never
    // blocks (owner ruling 2026-08-18, CLAUDE.md; the PATCH handler does a bare status flip
    // with zero money checks, and CloseSeasonModal's primary button is never disabled by
    // money). What DOES refuse is the settlement sheet's bulk payout — disabled until
    // closeOutBlockers().canClose, i.e. dues collected, enough cash held, and nothing left
    // pending with the club. That is the honest, and better, version of the same promise.
    pageAnswer:
      'Season settlement works it out from the season’s real ledger — what the team is holding, each family’s even share, who is owed money back and who still owes. It names every reason the books are not ready to close, and keeps the pay-everyone button locked until they are.',
    seoPhrase: 'the season squared up from the real ledger',
  },
  '#04': {
    id: '#04',
    imageClass: 'composed',
    shotId: 'coach-fundraiser-credit',
    pain: 'A family fundraised all season, and nobody can say what it took off their bill.',
    claim: 'Money a family raises lands on their own bill — or waits for season’s end, whichever way you run it.',
    // ⚠ The same per-team qualification as #01's answer, and it is load-bearing: whether credits
    // meet bills is rep_program_years.credit_application — two of its three modes reduce the
    // bill, keep_separate holds credits for season-end settlement. "Fundraiser by fundraiser"
    // is real (every fundraiser lookup requires a program year; the drill-in shows per-family
    // raised amounts — the ringed column). "The settlement already knows" is the season-end
    // sheet reading the same ledger.
    pageAnswer:
      'Money a family raises is credited to them by name, fundraiser by fundraiser. Whether that credit comes straight off their bill or waits to be settled at season’s end is a team setting — your call — and the season settlement already knows either way.',
    seoPhrase: 'fundraising credited to the family who raised it',
    // ⚠ ONE ring, on the column that IS the claim — what each family's fundraising took off what
    // they owe. Measured against the crop rather than estimated from the PNG. The "credits issued"
    // tile above says the same thing at team level and was the second candidate; two rings sitting
    // almost exactly above one another read as a single broken ring rather than two marks.
    rings: [{ left: 51, top: 47.9, width: 19, height: 51.3 }],
  },
  /**
   * ⚠ THE RISKIEST DRAWING IN THE SET, named as such in the mockup round and approved knowing it.
   * A list of rows with badges is the closest any drawing gets to a real screen. It stays on the
   * right side of the picture rule by having no header, no container and no controls — and a "#"
   * in the badge rather than a number, i.e. "a number goes here" rather than a datum.
   */
  '#05': {
    id: '#05',
    imageClass: 'explainer',
    drawingId: 'roster-group-text',
    pain: 'The roster lives in a group text.',
    claim: 'One roster with positions, numbers and contact details — and families who can see their own schedule without asking you for it.',
    // ⚠ VERIFIED, AND ONE TIER IS DELIBERATELY NOT PROMISED. A roster row carries the jersey
    // number, a primary and second position (derived from the profile's Best/Okay/Never picker)
    // and the family contacts. Family access is a coach-minted share link with per-request
    // approval — and only the FOLLOWER tier is live (schedule, results, game updates, calendar
    // feed). The guardian/parent tier is env-gated OFF (lib/family-guardian.ts,
    // GUARDIAN_TIER_ENABLED) pending privacy review, so this answer promises FOLLOWING the
    // team and nothing more — no parent portal, no player questions.
    pageAnswer:
      'One roster, not a thread: jersey numbers, a primary and second position for each player, and the family contacts beside them. Share one link and approve who joins — an approved family follows the team on its own page, with the schedule, results and a calendar feed, without you forwarding anything.',
    seoPhrase: 'one roster instead of a group text',
    alt: 'Four overlapping chat bubbles, two carrying fragments of team admin and one holding only a question mark. Beside them, three aligned roster rows — a number badge, a name, a position and a contact dot each — with a dotted line running down to a small phone showing a calendar.',
    // Both halves verified against the product: the roster carries jersey numbers, ranked
    // positions and contact details, and a connected family reads the team's schedule on their
    // own page without the coach sending it.
    caption: 'The roster stops being a thread nobody can search — and the family gets the schedule without asking.',
  },
  '#06': {
    id: '#06',
    imageClass: 'composed',
    shotId: 'coach-lineup-board',
    pain: 'The lineup is in a notes app.',
    claim: 'Build it once, and the board quietly tracks who has been sitting too long while you coach.',
    // ⚠ THE FLAG IS PER-GAME AND THE SENTENCE MUST STAY PER-GAME. lib/lineup-analysis.ts
    // computes consecutiveBench = benched two innings in a row within THIS game's grid — never
    // a season judgment (the season view is the playing-time report, slide #23). Auto-fill
    // "spreads bench time evenly… a starting point" is the feature's own wording; every change
    // saves itself (~0.9s debounce, no save button); the game console writes substitutions to
    // the same lineup; the dugout poster PDF prints from it.
    pageAnswer:
      'Lay out the batting order and who is where each inning, or let auto-fill spread the bench time and tweak it from there. While you build, the board flags any player it has sitting two innings in a row, and the same lineup follows you into the game — every change saves itself, and the dugout poster prints straight from it.',
    seoPhrase: 'a lineup board that watches the bench',
    // Unringed on purpose: the thing to look at is the amber warning line, and it is already the
    // only coloured element in the picture. A ring would be marking what is marked.
  },
  /**
   * ⚠⚠ THE ONLY SLIDE IN THE LIBRARY THAT IS A DRAWING BECAUSE IT CANNOT BE PHOTOGRAPHED, rather
   * than because drawing is the better answer. The demo world's live game console exists about
   * seven hours a week, the seeded Saturday game deliberately has no lineup, and game rows take a
   * fresh id every reseed. Do NOT "solve" this by trying to capture it.
   *
   * The claim is exact rather than a flattering paraphrase, verified in the code: the bench
   * console saves the running score with a QUIET write that notifies nobody, so families watching
   * the team's page see it move on their own; ending the game is the one non-quiet write, and it
   * sends a single final-score message.
   */
  '#07': {
    id: '#07',
    imageClass: 'explainer',
    drawingId: 'one-message',
    pain: 'Parents text “score?” while you are coaching third base.',
    claim: 'Families follow the score themselves; ending the game sends them one message, not one per run.',
    // Same verification as the slide comment above: the bench console's running-score save is a
    // QUIET write that notifies nobody, families watching the team's page see it move on their
    // own, and ending the game is the one non-quiet write — a single final-score message.
    // "Families who follow the team" is the coach-approved follower tier, same as #05.
    pageAnswer:
      'Keep score from the bench and it shows up on the team’s own page as it moves — families who follow the team just watch it there. Nothing is sent while the game runs; ending it sends the one message that matters, the final score.',
    seoPhrase: 'a score families watch themselves',
    alt: 'Four chat bubbles down one side, two of them reading “score?” and one holding only a question mark. Facing them, a two-box scoreboard with a broadcast symbol, and below a dividing rule a single envelope with one arrow leaving it.',
    caption: 'The same question all afternoon, answered once — by a scoreboard they can watch themselves, and one message when it is over.',
  },
  /**
   * ⚠ THIS SLIDE WENT CAPTURE → DRAWING → CAPTURE IN ONE DAY (2026-08-21), and the round trip is
   * the useful part rather than an embarrassment. Its ORIGINAL crop paired the Season Wrapped card
   * with the four collapsed shelves beside it — 960×591, which renders at 34% of true size in a
   * phone column and is simply unreadable. That is what made it a drawing.
   *
   * The owner's answer was better than either: **photograph the CARD ALONE.** It is the artifact a
   * coach actually shares, its type is the largest in the portal, and ONE element is far narrower
   * than two side by side — which is the only lever that has ever moved phone legibility on this
   * project. So the deck keeps a real screen shown whole AND the picture reads on a phone.
   *
   * ⚠ The claim still names all four shelves ("the record, the roster, the practices, the money")
   * while the picture now shows only the front of that page. Deliberate — the caption carries what
   * the card does not — but if the claim is ever reworded, do NOT narrow it to match the crop: one
   * page with four shelves is the binding product ruling, not a description of a photograph.
   */
  '#09': {
    id: '#09',
    imageClass: 'proof',
    shotId: 'coach-season-wrapped',
    pain: 'The season ends and nobody writes down what happened.',
    claim: 'A closed season becomes one page — the record, the roster, the practices, the money — and it stays that way for years.',
    // ⚠ "one page" is the owner's binding ruling (CLAUDE.md), not a simplification for copy:
    // a closed season is ONE page, the same page whether it closed yesterday or three years ago.
    // The four shelves named here are the four that exist — do not add a fifth to this sentence
    // without adding it to the page.
    pageAnswer:
      'Close the season and the whole team workspace becomes one page: Season Wrapped — the record, the longest run, the closest game, who was on the field most — above four shelves holding the results, the roster, the practices you ran and how the money came out. It reads the same in three years as it does the week you close it, and starting next season does not take it away.',
    seoPhrase: 'a closed season kept on one page for good',
    // PROOF, never ringed. The class exists for a screen designed to be looked at whole.
  },
  '#10': {
    id: '#10',
    imageClass: 'composed',
    shotId: 'coach-tryout-scorecard',
    pain: 'Tryout day runs on a clipboard and a group chat.',
    // ⚠ The picture carries the first half of this sentence — an evaluator's phone. The weighting
    // is a setup screen and the ranking is a third; the artifact's image note asks for the
    // scorecard "beside the resulting ranked list", which is two sources in one frame and
    // therefore new artwork, exactly like slide #12's note. Shot as the phone alone, because that
    // is the half nothing else in the deck says and the half a clipboard cannot answer.
    claim: 'Evaluators score on their phones, and the weighting you set decides what the ranking means.',
    // ⚠ "the weighting you set" is real and is worth spelling out here rather than on the slide:
    // the ranking is a weighted composite of the coach's OWN categories, and blind mode is the
    // default rather than an option somebody has to find.
    pageAnswer:
      'Evaluators score on their phones — a link, no login, and one card per player. You choose the categories and how much each is worth, so the ranked list at the end means what you decided it means, not what a spreadsheet averaged. Names stay hidden while scoring unless you say otherwise — one switch shows them, and puts them back. Tap any player to see what made their score, right down to each helper’s own number. Sort each player into Offering, Waitlist or Not this season, and one tap puts them on your roster — dues come later, once the team is settled.',
    seoPhrase: 'tryout scoring on a phone',
  },
  '#21': {
    id: '#21',
    imageClass: 'composed',
    shotId: 'coach-awards',
    pain: 'The awards list gets rebuilt from memory the week before the banquet.',
    claim: 'Invent your own awards, hand them out in the moment all season, and the list is already written when awards night comes — the certificates print themselves.',
    // ⚠ VERIFIED, and "in the moment" is rendered as "right after a game" here on purpose: an
    // award is given from the schedule against a completed game, or from the awards report with
    // a typed occasion — there is no award control in the LIVE game console, so the unattended
    // page must not imply mid-game. The leaderboard and history build themselves from given
    // awards; the certificate page prints one award or every winner of a type at once, stamped
    // with the season it was won in.
    pageAnswer:
      'Make up your own awards or use the team’s, and hand one out whenever it is earned — from the schedule right after a game, or for any occasion you type in. The list keeps itself all season, by player and by award, so awards night starts from a page instead of from memory — and the certificates print straight from it, one at a time or every winner of an award at once.',
    seoPhrase: 'awards recorded as you hand them out',
  },
  '#22': {
    id: '#22',
    imageClass: 'composed',
    shotId: 'coach-development',
    pain: '“He’s improved” is the only progress report a parent ever gets.',
    claim: 'Set goals, run the same test again, and put this month’s number beside last month’s — so improvement is measured rather than remembered.',
    // ⚠ VERIFIED — two mechanisms, and the nouns are the UI's own: free-text FOCUS AREAS with a
    // working → achieved → parked cycle, and coach-defined numeric TESTS (name + unit) run
    // through EVALUATION SESSIONS — the whole roster, the whole list, usually at a practice.
    // The trend lives on the player's OWN profile and appears from the second reading on.
    // ⚠ NOT claimed: any season-wide comparison — the coverage report deliberately shows a flag
    // or a blank, never a comparable number beside a child's name (its own binding rule).
    pageAnswer:
      'Give each player a focus area and mark it working or achieved as the season moves. For the measurable part, keep your own list of tests — your names, your units — and run the whole roster through them in an evaluation session at practice. From the second reading on, the player’s own page draws the trend, with every dated number underneath it.',
    seoPhrase: 'player progress measured, not remembered',
  },
  '#23': {
    id: '#23',
    imageClass: 'composed',
    shotId: 'coach-playing-time',
    pain: 'Playing time is an argument you can’t settle from memory.',
    // ⚠ NEVER the word "fair" (standing owner ruling, `decision_playing_time_vocabulary`). The
    // screen measures; it does not judge, and the claim ends by saying so.
    claim: 'The season’s own record shows the innings each player has been on the field, who has sat back-to-back, and how attendance has moved — measured, in context.',
    // ⚠ VERIFIED against the report itself: On field / Bench innings per player, back-to-back
    // sits as a count of games where the per-game flag fired, positions played and how recently
    // (from saved lineups only), pitching innings against the coach's OWN per-game cap — no
    // product-wide limit exists, so no sentence may imply one. Recomputed from saved lineups,
    // live-season-only PERMANENTLY (the route may never learn a year — CLAUDE.md guard).
    // ⚠ NEVER the word "fair" (decision_playing_time_vocabulary): "it measures; the judgment
    // stays yours" is the allowed register, and the answer ends on it deliberately.
    pageAnswer:
      'Recomputed from the lineups you actually saved: innings on the field and on the bench for every player, who has sat two innings back-to-back and in how many games, which positions each player has covered and how recently — and pitching innings against the cap you set. It measures; the judgment stays yours.',
    seoPhrase: 'playing time measured in context',
    // On field and Back-to-back sits — the two the claim names. ⚠ COLUMNS, not rows: the report is
    // ordered fewest-innings-first, so WHICH player leads it changes with the lineups. Geometry
    // measured against the crop rect in the browser, not read off the PNG.
    rings: [
      { left: 21.6, top: 0.8, width: 14, height: 98.4 },
      { left: 42.1, top: 0.8, width: 14.9, height: 98.4 },
    ],
  },
  /**
   * Drawn 2026-08-21 (the §69 phone batch) — its photograph rendered at 34% of readable size on a
   * phone. ⚠ "opens on the bench while the game is running" is TRUE and has never been what the
   * picture shows: the demo world's game console exists about seven hours a week, so the book was
   * photographed where it is WRITTEN. The drawing shows the same thing and gains what no capture
   * could — the book receding into earlier meetings, which is the "grows every time you meet them"
   * half of the claim.
   */
  '#24': {
    id: '#24',
    imageClass: 'explainer',
    drawingId: 'opponent-book',
    pain: 'What you learned about that team last time is in your head — and you play them Saturday.',
    claim: 'Your book on an opponent — what they do, what worked, what to watch — opens on the bench while the game is running, and grows every time you meet them.',
    // ⚠ "opens on the bench" is true — the game console shows the book. Said here rather than
    // left implied, because the picture is the report the book is WRITTEN in, not the bench.
    pageAnswer:
      'One page per team you play: your record against them, every meeting, and the lines you and your assistants logged — tagged for pitching, hitting, defense, baserunning or coaching. It opens on the bench during the game as well as here, and the week you play them again the portal tells you the book is there. Opposing players are referred to by number and position, never by name.',
    seoPhrase: 'your book on Saturday’s opponent',
    alt: 'Three blank dashed frames stacked on the left, the front one holding only a question mark. Facing them, a book: a heading line at the top, then three meeting entries each with a result chip, a note and a tag, fading as they go down.',
    caption: 'Nothing was written down, so nothing survives the winter. One book per team, and every meeting adds to it.',
  },
  /**
   * ⚠ THE ONE CASE WHERE A DRAWING BEAT THE PHOTOGRAPH ON MERIT, not just on phone size (2026-08-21).
   * The capture spelled the rotation out in words — three rows of station names — so "everyone does
   * everything" was something a reader had to READ. Three shapes stepping diagonally make it
   * something they SEE. The generalisation: when a screen's point is a PATTERN, a drawing of the
   * pattern can outperform a capture of the screen.
   */
  '#25': {
    id: '#25',
    imageClass: 'explainer',
    drawingId: 'practice-rotation',
    pain: 'The practice plan is a text you send at 9 PM and re-explain at the field.',
    claim: 'A plan attaches to a real practice on your schedule — stations, timings, who runs what — and it is on your phone at the field.',
    // ⚠ "it records nothing" is a deliberate product claim, not modesty — the one field-time job
    // worth finishing is attendance, and the field mode is built around that.
    pageAnswer:
      'A plan belongs to a real practice on your schedule, so it is never a text nobody can find. Blocks with their own minutes, stations with what you are watching for, and a rotation that works out which group is where in every round. At the field it opens on your phone one block at a time with the clock running — and it records nothing, because the one field-time job worth finishing is attendance.',
    seoPhrase: 'practice plans that reach the field',
    alt: 'A phone filled with a wall of message text, and beneath it a bubble holding only a question mark. Facing them, a three-by-three grid: three groups across, three rounds down, and three shapes stepping diagonally so each group meets each station once.',
    caption: 'A wall of text at nine at night, re-explained at the field. Or the rotation itself — three groups, three rounds, everyone does everything.',
  },

  /* ── The tournament weekend ────────────────────────────────────────────────── */
  /**
   * ⚠ THE OVERVIEW SLIDE, SECOND IN THE DECK — and it deliberately DOES NOT STEAL #17's JOB.
   * The deck already ENDS on "next year starts from last year", so if this slide's punchline were
   * the loop it would be #17 wearing a wheel. Its pain is FRAGMENTATION; the loop is a closing
   * clause that #17 then proves in full. Overview opens the deck, proof closes it.
   */
  '#27': {
    id: '#27',
    imageClass: 'explainer',
    drawingId: 'tournament-year',
    pain: 'Every part of the weekend lives in a different tool.',
    claim: 'One system from setup to the final out — registration, the schedule, live scores, the bracket and the wrap-up — and next year starts from this one.',
    pageAnswer:
      'Registration, the schedule, live scores, the bracket and the wrap-up are one system rather than five, so a team that registers is already on the schedule and a score entered at the diamond is already on the public site. Nothing is exported from one tool and imported into the next, which is where a weekend usually loses an hour and gains a mistake. When it is over, this year becomes next year’s starting point — divisions, venues, registration setup and your public site copy forward.',
    seoPhrase: 'one system instead of five',
    alt: 'A ring of five stations — set up, entries, the weekend, playoffs and the wrap-up — joined by four faint arrows. The fifth arc, returning from the wrap-up to set up, is drawn bright and labelled “copied forward”.',
    caption: 'The whole event in one place — and copying it forward carries the divisions, the venues, the registration setup and the public site.',
  },
  '#11': {
    id: '#11',
    imageClass: 'proof',
    shotId: 'fan-live-score',
    pain: 'Saturday, 2:14 p.m. — eleven texts asking for the score.',
    claim: 'Families follow their team on the public site. You never answer that text again.',
    pageAnswer:
      'Families follow their team on the tournament’s public site — live scores, schedule, and standings, no account, no app store. You never answer that text again.',
    seoPhrase: 'live scores families check themselves',
  },
  '#12': {
    id: '#12',
    // The artifact's target is a COMPOSED shot pairing the scoring card with the staff kit's
    // printed QR — two sources in one image, which is new artwork and therefore P2. What
    // ships today is the unretouched board, so the class says so.
    imageClass: 'proof',
    shotId: 'scorekeeper-view',
    pain: 'You’re chained to the scoring laptop while the tournament happens outside.',
    claim:
      'Any volunteer scores from the field through a link and a QR card. No admin access, nothing they can break.',
    pageAnswer:
      'Any volunteer enters scores from the field through Scorekeeper View — a link and a QR code from the Staff Kit, no admin access, nothing they can break. You walk the diamonds.',
    seoPhrase: 'volunteer score entry',
  },
  '#13': {
    id: '#13',
    // Already a tight 560px-wide dialog capture — there is nothing to crop away. ⚠ The
    // artifact's note ("the re-timed list and the three send switches") describes controls
    // this dialog does not have; the code outranks the artifact, so the crop is left alone.
    imageClass: 'proof',
    shotId: 'rain-delay',
    pain: 'Rain at 9 AM. Forty coaches to call, one at a time.',
    claim: 'The whole day re-times in one action, and the notice writes itself.',
    pageAnswer:
      'Rain delay re-times the whole day and hands you one notice — pinned as a banner on the public schedule, pushed to followers’ phones, sent to every coach. One action, not forty calls.',
    seoPhrase: 'one-action rain delays',
  },
  '#14': {
    id: '#14',
    imageClass: 'composed',
    shotId: 'playoff-bracket',
    // ⚠ Was "The bracket LIVES ON a whiteboard" on the shipped page. Taken verbatim from the
    // approved library, like every other line here — noted because this is public copy and a
    // reader comparing the two versions should find the change accounted for, not discovered.
    pain: 'The bracket is on a whiteboard, and the seeds keep changing.',
    claim:
      'The bracket builds itself from live standings and fills in as games end. A big division splits into Gold and Silver tiers in one click — and nobody redraws a whiteboard.',
    // ⚠ "Every plan gets the inline bracket editor" survived the 2026-08-21 plan-line deletion
    // pass deliberately: it names no tier and gates nothing — it says the opposite. Moved here
    // verbatim from the page panel it was written for.
    pageAnswer:
      'The Playoff Wizard builds the bracket from live standings, and it fills itself in as games end. A big division splits into Gold and Silver tiers in one click. Every plan gets the inline bracket editor.',
    seoPhrase: 'self-building brackets',
  },
  /**
   * ⚠ VERIFIED AGAINST THE PRODUCT, and NOT plan-gated. The public registration form shows the
   * total fee and its due date (and the deposit and its due date) before a team submits; a
   * submission lands as pending, or is automatically waitlisted when its division is already at
   * capacity; and the organizer's list acts on them as approve, waitlist or decline. Team
   * self-registration and waitlist collection are both on the BASE tournament plan, so this slide
   * needs no plan line on the page either — unlike #17 below, which does.
   */
  '#16': {
    id: '#16',
    imageClass: 'explainer',
    drawingId: 'registration-inbox',
    pain: 'Teams register by email.',
    claim: 'Teams enter themselves, see their fee and due date, and land in your list already sorted — you approve, waitlist or decline.',
    // Same verification as the slide note above: the public form shows the total fee and its
    // due date (and the deposit and its due date) before a team submits; a submission lands
    // pending, or is automatically waitlisted when its division is already at capacity; the
    // organizer's list acts approve, waitlist or decline.
    pageAnswer:
      'A team registers itself on your public site and sees the fee, the deposit and the due dates before it submits. Each entry lands in your list as a decision waiting — approve, waitlist or decline — and when a division is already full, the form waitlists the team on its own. Nothing arrives as an attachment.',
    seoPhrase: 'teams that register themselves',
    alt: 'Four email slips stacked askew, each with a paperclip, one duplicated behind another. Facing them, four aligned rows on hairlines — a team, a fee and a date each — marked at the right with a tick, a tick, a hold and a cross, the last two rows dimmed.',
    caption: 'Forwarded attachments, one of them sent twice — against a list that arrives sorted and waits on one decision each.',
  },
  '#15': {
    id: '#15',
    // The panel is already a short wide strip. ⚠ NOT ringed: the artifact asks for "the two
    // tiles that are wrong", but this world re-anchors every two minutes and WHICH tiles are
    // unhealthy moves with it — a ring on a position would start pointing at a healthy tile.
    imageClass: 'proof',
    shotId: 'registration-health',
    pain: 'A team’s payment fell through — and you find out at the gate.',
    claim:
      'One readiness score for the whole field, weeks out, and every tile opens the exact teams behind it.',
    // The Payments tile shows a badge instead of numbers on the free plan
    // (lib/help-content/tournaments.tsx) — same disclosure rule as the other gated panels.
    pageAnswer:
      'Registration Health scores the whole field weeks out — who’s paid, whose email bounces, who still needs a decision — and every tile clicks through to the exact teams.',
    seoPhrase: 'registration health',
  },
  /**
   * ⚠ THE CLAIM THE APPROVED LIBRARY MARKED "TO CONFIRM" — the only one of the five explainers
   * never checked against the product. Confirmed 2026-08-21 against the clone itself: copying a
   * tournament forward carries divisions (with their pools and slots), venues, the registration
   * fields and fee schedule, and the branding, public pages, welcome text and rules/resources.
   * All four nouns in the sentence are real, and each is an opt-out the organizer can clear.
   *
   * ⚠ It IS plan-gated — and NOTHING in the pitch material says so anymore (owner ruling
   * 2026-08-21 deleted every plan line; the page half of this comment used to point at one).
   * The gate lives in the plan configuration; the pricing page qualifies; a human answers in
   * the room. Do not restate the tier anywhere in this file.
   */
  '#17': {
    id: '#17',
    imageClass: 'explainer',
    drawingId: 'copied-forward',
    pain: 'Next year, you start from scratch.',
    claim: 'Last year’s tournament is this year’s starting point — divisions, venues, registration setup and your public site, copied forward.',
    // ⚠ Verified against the clone itself (slide note above): divisions with pools and slots,
    // venues, registration fields + fee schedule, and the branding/public pages/welcome/rules
    // all carry, each an opt-out the organizer can clear. The feature is gated — and NO tier is
    // named anywhere in pitch material (owner ruling 2026-08-21): the pricing page qualifies,
    // a human answers in the room.
    pageAnswer:
      'Copying a tournament forward carries the four things you built by hand: divisions with their pools and slots, venues, the registration form and fee schedule, and your public site — branding, welcome text, rules and resources. Each is a toggle you can clear, and what is left to do is the part that actually changed: the dates.',
    seoPhrase: 'next year copied forward from this one',
    alt: 'Two columns of the same four symbols — stacked bars, a map pin beside a field, a form with a checkbox, and a globe. The left column is faint and labelled “last year”, the right is bright and labelled “this year”, with dotted arrows carrying each across, marked divisions, venues, registration and your site.',
    caption: 'Four things you set up once, arriving already made — and the dates, which are the part you actually change.',
  },
  // `satisfies` rather than a `Record<string, PitchSlide>` annotation on purpose: it type-checks
  // every entry AND keeps the key set literal, so `SlideId` below is the real list of numbers.
  // That turns "a page pulls a slide the bank does not hold" from a runtime throw into a
  // compile error — the check belongs in the type system, not in the renderer.
} satisfies Record<string, PitchSlide>;

/** Every library number the bank actually holds. A page's pull is typed against this. */
export type SlideId = keyof typeof PITCH_SLIDES;

/**
 * ⚠ EVERY LIBRARY NUMBER THAT IS SPOKEN FOR BUT HOLDS NO SLIDE — one register, with a STATUS.
 *
 * A library number is never reused and never renumbered. That is the whole mechanism: a slide can
 * be re-shot, re-cropped and re-worded forever and still be the same slide. The cost is that the
 * number line has gaps, and a future session meeting a missing #08 must not have to take it on
 * trust that nothing was lost — so every gap says what it is and why.
 *
 * ⚠ THIS WAS BRIEFLY TWO REGISTERS AND THAT WAS A MISTAKE (merged 2026-08-21, same day, during the
 * Deck Studio cleanup pass). `PLANNED_SLIDES` held "named by a deck, not built yet" and a separate
 * `RESERVED_SLIDE_NUMBERS` held "retired / held for a future deck" — two `Record<string, string>`
 * maps over the SAME key space, ten lines apart, both describing #18–#20, kept from overlapping
 * only by a test assertion reading "pick one register". Two same-shaped maps over one key space is
 * the shape that wants a status field, and the report screen wanted it too: with one register it
 * can tell a deck naming a HELD number ("that is the club deck's, P4") from one naming a number
 * that simply is not there, which two maps could only render as the same bare cross.
 *
 * Statuses:
 *  · `planned`  a deck names it and the bank does not hold it YET, so the running orders below can
 *               record the REAL approved order before the artwork exists.
 *  · `held`     reserved for a deck that does not exist yet. No deck may name one.
 *  · `retired`  spent. Never to be reused — reusing it would break the one promise the library
 *               makes, that a number identifies the same slide forever.
 *
 * ⚠⚠ THE RUNTIME DOES NOT KNOW THESE APART — ONLY THE GUARD TEST DOES. `deckSlides()` filters on
 * bank membership alone, so a `planned` id, a `held` one, a `retired` one and an id nobody has
 * ever defined are all dropped identically and silently. `PITCH_DECKS` is `string[]`, not
 * `SlideId[]`, so the compiler will not stop you either. **The only thing standing between a typo
 * and a slide quietly missing from a running order is tests/unit/pitch-slide-library.test.ts** —
 * do not delete those assertions believing the code still holds the line.
 *
 * `tests/unit/pitch-slide-library.test.ts` holds all of it: an id here is never also built, only a
 * `planned` id may be named by a deck, and every entry must say something.
 */
export type SlideNumberStatus = 'planned' | 'held' | 'retired';

export const SLIDE_NUMBERS_SPOKEN_FOR: Record<string, { status: SlideNumberStatus; note: string }> = {
  '#08': {
    status: 'retired',
    note: 'Retired 2026-08-20, before the library was built — the number stays spent so nothing can reuse it.',
  },
  // ⚠ NO `planned` ENTRIES SINCE 2026-08-21 (P2b): every id either deck names is now BUILT, so both
  // running orders below are real end to end and `deckSlides()` skips nothing. This is where the
  // next batch is declared — an empty status is the honest state, not a dead one.
  // ⚠ Still HELD, not planned, even though the club deck itself became creatable in the studio
  // (stage C). `held` means NO deck may name the number — the composer refuses it and the refusal
  // says whose it is. The flip to `planned` (nameable before built, so a running order can record
  // the approved position) is a one-line code change made WHEN the three club slides are actually
  // commissioned — flipping early would let any deck claim numbers whose artwork nobody has
  // agreed to draw.
  '#18': {
    status: 'held',
    note: 'Held for the club deck — a Club customer gets the tournament product AND every coach’s portal, plus three slides of its own. The deck is creatable in the studio; these numbers join it when their artwork is commissioned.',
  },
  '#19': { status: 'held', note: 'Held for the club deck — see #18.' },
  '#20': { status: 'held', note: 'Held for the club deck — see #18.' },
};

/**
 * THE DECKS — one audience each, in the approved running order.
 *
 * ⚠ Since stage C these are the CODE FALLBACKS: the live running order is the owner's saved row
 * (pitch_decks, read by lib/pitch-deck-store.ts), and this list renders only when no row is
 * saved or the store is unreachable — the same discipline as `fallbackPull`, and for the same
 * reason: it is what makes a marketing page unable to go blank. It is NOT kept in sync with the
 * owner's saves; it is the known-good composition of record, not a cache.
 *
 * The tournament deck runs as a weekend runs. The coach deck runs as a coach's YEAR runs,
 * along the same five phases the demo world is built around — which is not tidiness: it means
 * every slide has a demo team sitting in the right state to be photographed on. (The
 * settlement sheet shot mid-season shows every family in debt and argues the opposite of what
 * it means to. The phase IS the picture.)
 *
 * Ids the bank does not hold yet are skipped by `deckSlides()` — see `SLIDE_NUMBERS_SPOKEN_FOR`,
 * which holds no `planned` entry as of P2b: both orders below are real end to end.
 *
 * ⚠ THE OVERVIEW SLIDE SITS SECOND IN EACH DECK, NOT FIRST (owner call 2026-08-21). Open on the
 * visceral moment the deck already opened on — Saturday 2:14 PM, or tryout day — and only then
 * show the wheel: "here is the whole shape of it". Opening cold on a diagram is opening on
 * abstraction, and the moment a reader recognizes themselves is worth more than the map.
 */
// ⚠ The persona key set here is THE authority the save route validates against — and migration
// 257's pitch_page_pulls CHECK constraint carries an independent copy of it ('tournament',
// 'coach'), as does migration 258's pitch_decks.persona CHECK. Adding a persona without
// widening BOTH CHECKs ships a passing typecheck and then 500s at the database on the first
// save. Same-unit-of-work rule: new persona ⇒ new migration.
export const PITCH_DECKS: Record<'tournament' | 'coach', string[]> = {
  tournament: [
    /* The moment        */ '#11',
    /* The whole shape   */ '#27',
    /* The weekend       */ '#12', '#13', '#14', '#16', '#15',
    /* Next year         */ '#17',
  ],
  coach: [
    /* Tryout day        */ '#10',
    /* The whole shape   */ '#26',
    /* The team forms    */ '#05',
    /* Mid-season: team  */ '#25', '#06', '#24', '#07',
    /* Mid-season: kids  */ '#22', '#21', '#23',
    /* Mid-season: money */ '#02', '#01', '#04',
    /* Off-season books  */ '#03',
    /* Season’s end      */ '#09',
  ],
};

/** What a standing deck is called on screen — one home; the studio, its report and the deck
 *  save API all render it, and a row's stored copy is written FROM this rather than typed. */
export const AUDIENCE_LABEL: Record<WalkthroughPersona, string> = {
  coach: 'Coach deck',
  tournament: 'Tournament deck',
};

/** What counts as a valid persona on a write surface — one home (both studio API routes parse
 *  request input through this rather than each re-deriving membership in PITCH_DECKS). */
export function asWalkthroughPersona(value: unknown): WalkthroughPersona | null {
  return typeof value === 'string' && value in PITCH_DECKS ? (value as WalkthroughPersona) : null;
}

/** The slides a running order actually renders — built ids only, in the order given. */
export function builtSlides(ids: readonly string[]): PitchSlide[] {
  const bank: Record<string, PitchSlide> = PITCH_SLIDES;
  return ids.map(id => bank[id]).filter(Boolean);
}

/** The CODE deck's slides, in order, skipping unbuilt ids. ⚠ Since stage C the live running
 *  order is the owner's saved row — render paths should use `builtSlides` over a RESOLVED deck
 *  (lib/pitch-deck-store.ts); this stays for the guard test and anything code-deck-specific. */
export function deckSlides(audience: 'tournament' | 'coach'): PitchSlide[] {
  return builtSlides(PITCH_DECKS[audience]);
}

/**
 * ⚠⚠ `WalkthroughPanel` LIVED HERE AND IS GONE (stage B, 2026-08-21). A page panel used to be a
 * slide id plus a hand-written per-page `answer`; the answer now travels ON THE SLIDE
 * (`pageAnswer`), because the pull is owner-composable and any deck slide must be page-ready
 * (ruling 4 / finding F4). A page's pull is just an ordered list of slide ids — the saved row
 * in pitch_page_pulls, or `fallbackPull` below when no row is usable.
 *
 * ⚠⚠ `planTag` WAS ALSO HERE AND IS GONE (owner ruling 2026-08-21). Do not add it back, and do
 * not reintroduce a plan, tier, price or "what's included" line by any other name.
 *
 * The 2026-08-20 ruling was a SPLIT: a slide is plan-free (that is what makes it portable
 * between decks) but the unattended PAGE carries a plan line, "because nobody is standing there
 * to answer *is that included?*". **The owner overturned the page half:** *"we don't need to
 * mention any subscriptions here… we don't want to compartmentalize features at this stage, we
 * want to show people all we have to offer and how we will improve their lives, period."*
 *
 * The division of labour is now by SURFACE, not by sentence: **the walkthrough creates desire,
 * the pricing page qualifies, and a human answers in the room.** A gate named next to a feature
 * on a page whose whole job is "here is what stops being your problem" argues against itself.
 */

export interface Walkthrough {
  /** Also the manifest persona, the asset folder, and this page's deck. */
  persona: 'tournament' | 'coach';
  /** This page's own route — its canonical URL, and the address printed on the leave-behind. */
  path: string;
  /**
   * ⚠ `description` IS GONE FROM HERE — it named each panel in order, and once the pull is
   * owner-editable a hand-written list rots silently (finding F3). It is now DERIVED from the
   * slides actually shown (`derivedSeoDescription`), assembled from each slide's `seoPhrase`
   * around this page's `subject` clause. Same fate for the hero's `meta` line — it counted the
   * panels by hand and a test held it to the count; the test cannot see an owner's reorder, so
   * `derivedMeta()` counts what is rendered.
   */
  seo: {
    title: string;
    /** The clause the derived description hangs its phrase list on: "…the day {subject} — …". */
    subject: string;
  };
  eyebrow: string;
  title: string;
  sub: string;
  /**
   * The demo door. Each sandbox keeps its OWN door constant (lib/sandbox-door.ts) rather than a
   * parameterized one — "which account does this sign in" stays a compile-time constant — so the
   * walkthrough names its world's door here rather than deriving one from `persona`.
   *
   * ⚠ The LABEL is the walkthrough's own, from the approved mockup, and deliberately does NOT
   * match the persona page's button for the same door (`/for-coaches` says "See it live →"; the
   * coach walkthrough says "See a coach's season →"). By the time a reader reaches this page they
   * have been shown particular screens, and the door promises the season those screens came from.
   * If that inconsistency is ever ruled against, the fix belongs on BOTH pages — the tournament
   * pair drifts the same way and always has.
   */
  door: { path: string; label: string };
  /**
   * The way back into the full persona page, for a reader who wants everything else. Href only —
   * the LABEL is the same sentence for every persona ("everything else *it* does" is deliberately
   * persona-agnostic), so it lives with the walkthrough's other invariant copy in the renderer
   * rather than being re-typed, and silently re-worded, once per persona.
   */
  back: { href: string };
  /**
   * THE CODE FALLBACK PULL — a subset of this persona's deck, in deck order (`pullProblems`
   * enforces both, at build time for this list and at save time for the owner's).
   *
   * ⚠ Since stage B the LIVE pull is the owner's saved row (pitch_page_pulls, read by
   * lib/pitch-pull-store.ts). This list renders only when no row is saved or the store is
   * unreachable — it is the reason a marketing page can never be empty, so it must never be
   * deleted or emptied. It is NOT kept in sync with the owner's saves, deliberately: it is the
   * known-good composition of record, not a cache.
   */
  fallbackPull: SlideId[];
  closing: { eyebrow: string; title: string; body: string };
}

/**
 * The page's <head>, derived from the same object and the same PULL the body renders — the
 * caller resolves the pull (saved row or fallback) once and hands it to both.
 */
export function walkthroughMetadata(w: Walkthrough, pull: readonly SlideId[]): Metadata {
  return {
    title: w.seo.title,
    description: derivedSeoDescription(w, pull),
    alternates: { canonical: w.path },
  };
}

export const TOURNAMENT_WALKTHROUGH: Walkthrough = {
  persona: 'tournament',
  path: '/for-tournament-organizers/walkthrough',
  seo: {
    title: 'The 90-Second Walkthrough for Tournament Organizers — FieldLogicHQ',
    // ⚠ The description is DERIVED from the slides the page actually shows — see
    // `derivedSeoDescription`, which hangs its phrase list on this clause. It carries no "real
    // screens, not a brochure" claim (see the note on `closing.body` below): every one of the
    // ten places that claim appeared came out on 2026-08-21, and what replaces it points at the
    // demo instead — an invitation is stronger than a denial, and it stays true whatever the
    // pictures are.
    subject: 'the tournament runs on FieldLogicHQ',
  },
  eyebrow: 'For tournament organizers · a 90-second walkthrough',
  title: 'The weekend the phone stayed in your pocket.',
  sub: 'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — and a live demo you can walk when you are done.',
  door: { path: SEE_IT_LIVE_PATH, label: 'See it live — no sign-up →' },
  back: { href: '/for-tournament-organizers' },
  fallbackPull: [
    '#11',
    // ⚠ The map, second — same reasoning as the coach page's #26. Added 2026-08-21 (owner).
    '#27',
    '#12',
    '#13',
    '#14',
    '#15',
  ],
  closing: {
    eyebrow: 'That was the pitch. Here’s the proof.',
    title: 'Walk the real thing — it’s running right now.',
    /**
     * ⚠⚠ THE "NOT A MOCKUP" SENTENCE IS GONE, AND IT IS NOT COMING BACK (owner ruling
     * 2026-08-21). It used to open this paragraph: "Every picture above is the real FieldLogicHQ
     * software, photographed on a live demo tournament we operate ourselves — not a mockup."
     *
     * It was true when every picture was a photograph, and the moment a hand-drawn explainer
     * joins a deck it is false — with nothing in the build able to see it, because no check can
     * read a sentence. Rather than deriving a version that describes whatever is in frame, the
     * owner's call was to REMOVE the claim entirely: we owe a prospect functionality that matches
     * the picture, never a screen that looks identical to it.
     *
     * What is left is the stronger half anyway — an invitation rather than a denial, and one that
     * stays true no matter what the pictures are. ⚠ It is also now the ONLY thing distinguishing
     * this page from /demos' own claim ("not recordings or screenshots"), which vouches for the
     * DEMO being live and is untouched because it is still true.
     */
    body: 'The demo is running right now: walk into the same tournament, nothing to sign up for, nothing you can break.',
  },
};

export const COACH_WALKTHROUGH: Walkthrough = {
  persona: 'coach',
  path: '/for-coaches/walkthrough',
  seo: {
    title: 'The 90-Second Walkthrough for Head Coaches — FieldLogicHQ',
    // ⚠ The description is DERIVED from the panels that EXIST — each slide's `seoPhrase`, in the
    // order the page shows them, hung on this clause. It used to be hand-written and was widened
    // by hand every time the pull grew; an owner-editable pull would have let it rot silently
    // (finding F3), which is why it now assembles itself.
    subject: 'your team runs on FieldLogicHQ',
  },
  eyebrow: 'For head coaches · a 90-second walkthrough',
  title: 'Run the team. Keep your evenings.',
  sub: 'The jobs the Coaches Portal takes off your plate — and a whole demo season you can walk when you are done.',
  door: { path: SEE_IT_LIVE_COACHES_PATH, label: 'See a coach’s season →' },
  back: { href: '/for-coaches' },
  /**
   * ⚠ SEVEN PANELS AS THE CODE DEFAULT — the pull walks the same year the deck does: tryout day
   * → the shape of the year → the practice → Saturday's opponent → the money → the off-season
   * books → a season already closed.
   *
   * What it deliberately leaves in the deck: playing time, awards, player development, the
   * fundraising credit, the lineup board and the money explainers. All are page-ready (every
   * slide carries its own `pageAnswer` since stage B) — none of them is the thing a coach is
   * buying in the first ninety seconds, and a page with fourteen panels is a page nobody reaches
   * the bottom of. ⚠ Since stage B this is the FALLBACK: what the page shows is the owner's
   * saved pull, and nothing about this particular selection is settled (ruling 4) — it is the
   * current setting of a dial.
   *
   * ⚠ A COMMENT HERE USED TO SAY "present mode and the printed leave-behind both render every
   * built slide already", AND IT WAS FALSE — both rendered this pull. **Present mode renders the
   * whole deck as of 2026-08-21** (see the long note in WalkthroughPage.tsx). The PRINTED
   * leave-behind still follows the scroll page, because print is the page on paper; composing a
   * deck to print is the Deck Studio's job, not a fourth hard-coded rendering.
   */
  fallbackPull: [
    '#10',
    // ⚠ THE MAP, AND IT SITS SECOND ON PURPOSE — the same call the deck makes. Open on the
    // visceral moment (tryout day), then show the shape of the year. Added to this pull
    // 2026-08-21 (owner): a scrolling reader was getting six problems solved without ever
    // being told what the product IS, because the only slide that answers that lived behind
    // the present-mode button.
    '#26',
    '#25',
    '#24',
    '#01',
    '#03',
    '#09',
  ],
  closing: {
    eyebrow: 'That was the pitch. Here’s the proof.',
    title: 'Sit in a coach’s seat — the season is running right now.',
    // ⚠ The "not a mockup" sentence that opened this paragraph is GONE — the full reasoning is on
    // the tournament closing above, and it applies identically here. "A season" not "a team": the
    // sandbox runs five teams, one per phase of the year, and each picture is taken on the phase
    // its screen belongs to.
    body: 'The demo is running right now, and it is a whole year you can walk: tryout day, mid-season, the off-season books, and a season already closed.',
  },
};

export const WALKTHROUGHS: Walkthrough[] = [TOURNAMENT_WALKTHROUGH, COACH_WALKTHROUGH];

/* ── The pull: derivation and the save path's rulebook (stage B) ──────────────── */

export type WalkthroughPersona = keyof typeof PITCH_DECKS;

/**
 * The pure string assembly lives in lib/walkthrough-derive.ts — a data-free module, so the
 * studio's client-side preview can import it without dragging this whole library into the
 * browser bundle. Re-exported here so server code keeps a single import for walkthrough things.
 */
export { derivedMeta, derivedSeoDescriptionFrom } from './walkthrough-derive';

/** The SEO description for a pull of THIS library's slides — ids resolved to their phrases. */
export function derivedSeoDescription(w: Walkthrough, pull: readonly SlideId[]): string {
  return derivedSeoDescriptionFrom(w.seo.subject, pull.map(id => PITCH_SLIDES[id].seoPhrase));
}

/**
 * ⚠⚠ NO PLAN, TIER, PRICE OR SUBSCRIPTION ANYWHERE IN THE PITCH MATERIAL (owner ruling
 * 2026-08-21). The pattern deliberately does NOT ban the bare product name ("the Coaches
 * Portal") — that is what the thing is called, and the hero says it. What it bans is the tier,
 * the gate and the comparison: "Premium Coaches Portal", "Tournament Plus", "free portal",
 * "is part of …". ONE home for the pattern: the build test reads it over every slide's copy,
 * and `pullProblems` reads it again over an assembled page at save time.
 */
export const PLAN_WORDS =
  /Premium Coaches Portal|Tournament Plus|\bLeague plan\b|\bClub plan\b|free portal|free tier|subscription|is part of the [A-Z]/i;

/**
 * ⚠⚠ THE SAVE PATH'S WHOLE RULEBOOK — every invariant the build used to hold over the
 * hand-written pulls, as refusal sentences (finding F3: the tool refuses an invalid pull and
 * says why; it does not save one and hope a test catches it later). ONE implementation, same
 * pattern as lib/shot-health.ts: the guard test runs it over each `fallbackPull`, and the
 * studio's save API runs it over the owner's submission — they cannot diverge.
 *
 * ⚠ `deck` is a PARAMETER since stage C, because "its deck" stopped being a code constant: the
 * live running order is the owner's saved row. The save API passes the RESOLVED deck (row or
 * fallback); the guard test passes `PITCH_DECKS[persona]`, which is the deck the fallback pulls
 * are the composition of record against. It is required rather than defaulted so a caller
 * cannot silently validate against yesterday's deck.
 */
export function pullProblems(
  persona: WalkthroughPersona,
  ids: readonly string[],
  deck: readonly string[],
): string[] {
  const problems: string[] = [];
  if (ids.length === 0) {
    problems.push('the page would show no panels at all — a pull needs at least one slide');
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      problems.push(`${id} appears twice — a page never repeats a slide`);
      continue;
    }
    seen.add(id);
    if (!(id in PITCH_SLIDES)) {
      // F5 made real: once a deck is a row, naming a spent number is a runtime hole rather than
      // a compile error — so the refusal says WHOSE the number is, not just that it is missing.
      const spoken = SLIDE_NUMBERS_SPOKEN_FOR[id];
      problems.push(
        spoken
          ? `${id} holds no slide — it is ${spoken.status} (${spoken.note})`
          : `${id} holds no slide and is not spoken for — it would vanish silently from the page`,
      );
    } else if (!deck.includes(id)) {
      problems.push(`${id} is not in the ${persona} deck — a page pulls from its own deck only`);
    }
  }
  // Deck order, checked over first occurrences that survived the checks above, so one mistake
  // is not reported twice.
  const positions = [...seen].filter(id => deck.includes(id)).map(id => deck.indexOf(id));
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[i - 1]) {
      problems.push(
        'the pull is out of the deck’s running order — the page shows its slides in the order the deck runs',
      );
      break;
    }
  }
  problems.push(...slideCopyPlanProblems(ids));
  return problems;
}

/**
 * ⚠ Defense in depth, not the primary gate: slide copy is code and the build test already holds
 * it plan-free. But copy and composition can change in the same release, and this is the last
 * check with a human on the other side of it to read the refusal. ONE implementation shared by
 * `pullProblems` and `deckProblems` — which fields get read is exactly the kind of rule that
 * would drift as two hand-copies.
 */
function slideCopyPlanProblems(ids: readonly string[]): string[] {
  const problems: string[] = [];
  for (const id of ids) {
    if (!(id in PITCH_SLIDES)) continue;
    const s: PitchSlide = PITCH_SLIDES[id as SlideId];
    if ([s.pain, s.claim, s.pageAnswer, s.seoPhrase].some(text => PLAN_WORDS.test(text))) {
      problems.push(`${id}’s copy names a plan, tier or price — pitch material never does`);
    }
  }
  return problems;
}

/**
 * How a page READS a pull — lenient where the save path is strict. A saved row may have been
 * valid when written and rot afterwards (a slide retires, a deck drops a number); a marketing
 * page must render THROUGH that, so unusable ids are dropped rather than fatal, order is
 * normalised to deck order, and a row with nothing usable left falls back to the code pull —
 * a missing or broken row can NEVER produce an empty page. `dropped` is returned so the studio
 * can show the rot as a problem: the page hides it, the studio must not.
 *
 * ⚠ `deck` is the LIVE running order (resolved row or code fallback) since stage C, and passing
 * it is what makes plan ruling 4's decision 1 true mechanically: a saved pull is a SET, render
 * normalises to deck order, so reordering a deck re-orders the public page by itself. The code
 * fallback pull is normalised against the live deck too — a slide the owner removed from the
 * deck leaves the fallback rendering of the page as well — EXCEPT when that would empty it,
 * where the raw code pull wins, because "never blank" outranks "always a subset".
 */
export function resolvePullIds(
  persona: WalkthroughPersona,
  stored: unknown,
  deck: readonly string[],
): { ids: SlideId[]; source: 'saved' | 'code'; dropped: string[] } {
  const w = WALKTHROUGHS.find(x => x.persona === persona)!;
  const fallback = (): SlideId[] => {
    const kept = w.fallbackPull.filter(id => deck.includes(id));
    if (kept.length === 0) return [...w.fallbackPull];
    return kept.sort((a, b) => deck.indexOf(a) - deck.indexOf(b));
  };
  if (!Array.isArray(stored)) return { ids: fallback(), source: 'code', dropped: [] };
  const kept: SlideId[] = [];
  // A Set, so a rotten id repeated in the row makes ONE problem sentence in the studio (and one
  // React key) rather than two. ⚠ Non-strings land here too — the contract above says the studio
  // shows the rot, ALL of it, so `continue`-ing past them would hide exactly the malformed rows
  // this function exists to survive.
  const dropped = new Set<string>();
  for (const id of stored) {
    if (typeof id !== 'string') {
      dropped.add(String(id));
    } else if (id in PITCH_SLIDES && deck.includes(id)) {
      if (!kept.includes(id as SlideId)) kept.push(id as SlideId);
    } else {
      dropped.add(id);
    }
  }
  kept.sort((a, b) => deck.indexOf(a) - deck.indexOf(b));
  if (kept.length === 0) return { ids: fallback(), source: 'code', dropped: [...dropped] };
  return { ids: kept, source: 'saved', dropped: [...dropped] };
}

/* ── The deck as a row: rulebook and lenient read (stage C) ───────────────────── */

/**
 * ⚠⚠ THE DECK SAVE PATH'S WHOLE RULEBOOK — `pullProblems`' sibling, built the same way and for
 * the same reason (ONE function, shared by the save API and the guard test — the shot-health
 * pattern; they cannot diverge). Refusal sentences, written for a human deciding what to fix.
 *
 * What a deck may name (plan decision 2): a BUILT number, or a `planned` one — recorded in a
 * running order before its artwork exists, rendered as nothing until it is. A `held` number is
 * refused BY NAME (the refusal says whose it is), a `retired` one stays spent forever, and an
 * unknown number would vanish silently from the order — the F5 hole, closed at the moment of
 * saving rather than found by a test later.
 *
 * ⚠ A deck is deliberately NOT held to one audience. The club deck is the standing counter-
 * example (a Club customer gets the tournament product AND every coach's portal), and ruling 4
 * says placement is a dial, not an editorial ruling — so mixing audiences in a running order is
 * the owner's call, and any order of true slides is true.
 *
 * ⚠ NAME AND PURPOSE ARE CHECKED FOR PLAN WORDS even though they are internal-only text (the
 * public prospect rendering prints neither — owner ruling 2). A deck named "Tournament Plus
 * pitch" leaking into any future heading is exactly the class of accident the plan warns about,
 * and the cheap time to refuse it is before the row exists.
 */
export function deckProblems(
  ids: readonly string[],
  meta: { name: string; purpose: string },
): string[] {
  const problems: string[] = [];
  if (!meta.name.trim()) {
    problems.push('the deck needs a name — it is how the studio (and the audit log) refer to it');
  }
  if (ids.length === 0) {
    problems.push('the deck would hold no slides at all — a running order needs at least one');
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      problems.push(`${id} appears twice — a deck never repeats a slide`);
      continue;
    }
    seen.add(id);
    if (id in PITCH_SLIDES) continue;
    const spoken = SLIDE_NUMBERS_SPOKEN_FOR[id];
    if (spoken?.status === 'planned') continue; // recordable before built, renders nothing until then
    problems.push(
      spoken
        ? `${id} holds no slide — it is ${spoken.status} (${spoken.note})`
        : `${id} holds no slide and is not spoken for — it would vanish silently from the running order`,
    );
  }
  for (const [field, text] of [['name', meta.name], ['purpose', meta.purpose]] as const) {
    if (PLAN_WORDS.test(text)) {
      problems.push(`the deck’s ${field} names a plan, tier or price — pitch material never does, even internally`);
    }
  }
  // Same defense-in-depth as pullProblems, via the same single implementation: a deck is
  // rendered publicly too (present mode, the prospect link).
  problems.push(...slideCopyPlanProblems(ids));
  return problems;
}

/**
 * How a DECK row is read — lenient where the save is strict, `resolvePullIds`' sibling. Kept ids
 * are the ones that still mean something (built, or `planned` — a slot with artwork on the way);
 * everything else is dropped and reported. ⚠ Unlike a pull, a deck's ORDER IS the data, so the
 * stored order is preserved rather than normalised against anything.
 *
 * The fallback split is the stage C stop line: a STANDING deck (persona given) falls back to
 * `PITCH_DECKS` when no built slide survives, because a public marketing page reads it and can
 * never blank. An owner-created deck (persona `null`) has no fallback — it resolves to whatever
 * survived, possibly nothing, and the caller decides what "does not render" looks like (the
 * prospect route 404s; the studio says why).
 */
export function resolveDeckIds(
  persona: WalkthroughPersona | null,
  stored: unknown,
): { ids: string[]; source: 'saved' | 'code'; dropped: string[] } {
  const code = () =>
    persona
      ? { ids: [...PITCH_DECKS[persona]], source: 'code' as const, dropped: [] as string[] }
      : { ids: [] as string[], source: 'saved' as const, dropped: [] as string[] };
  if (!Array.isArray(stored)) return code();
  const kept: string[] = [];
  const dropped = new Set<string>();
  for (const id of stored) {
    if (typeof id !== 'string') {
      dropped.add(String(id));
    } else if (id in PITCH_SLIDES || SLIDE_NUMBERS_SPOKEN_FOR[id]?.status === 'planned') {
      if (!kept.includes(id)) kept.push(id);
    } else {
      dropped.add(id);
    }
  }
  // "Usable" for a standing deck means A SLIDE ACTUALLY RENDERS: a row of only planned numbers
  // would present an empty deck on a public page, which is the blank the fallback exists to stop.
  if (persona && !kept.some(id => id in PITCH_SLIDES)) {
    return { ids: [...PITCH_DECKS[persona]], source: 'code', dropped: [...dropped] };
  }
  return { ids: kept, source: 'saved', dropped: [...dropped] };
}
