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
 *   A DECK       one audience, in a running order. Tournament and coach today.
 *   THE PAGE     a SHORT PULL from a deck — the 90-second version, 2–5 slides, not the deck.
 * Conflating them is how a fourteen-slide coach deck ends up on a marketing page nobody
 * scrolls to the bottom of.
 *
 * ── COPY RULES (binding — docs/agents/brand/BRAND_STRATEGY.md) ────────────────
 * Brand voice: practical, direct, warm; the forbidden-word list applies. Never a competitor
 * name — the villain is "the old way". Never a price on this surface. Pain vocabulary stays
 * consistent with lib/plan-article-content.ts painItems — same voice, no parallel bank.
 *
 * ⚠ NO PLAN OR SUBSCRIPTION NAME EVER APPEARS ON A SLIDE. Functionality only — that is what
 * makes a slide portable between decks (the same slide serves the coach deck and, later, the
 * club deck untouched, where the plan line would be a different sentence and the coach one
 * would actively undersell Club). The PUBLIC PAGE still carries a plan line where a feature
 * is gated, because nobody is standing there to answer "is that included?" — so `planTag`
 * lives on the page's pull, never on the slide.
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
 * and hand-drawn explainers, mostly editorial work). They are named in `PLANNED_SLIDES` below
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
  },
  '#04': {
    id: '#04',
    imageClass: 'composed',
    shotId: 'coach-fundraiser-credit',
    pain: 'A family fundraised all season, and nobody can say what it took off their bill.',
    claim: 'Money a family raises lands on their own bill — or waits for season’s end, whichever way you run it.',
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
    alt: 'Four chat bubbles down one side, two of them reading “score?” and one holding only a question mark. Facing them, a two-box scoreboard with a broadcast symbol, and below a dividing rule a single envelope with one arrow leaving it.',
    caption: 'The same question all afternoon, answered once — by a scoreboard they can watch themselves, and one message when it is over.',
  },
  '#09': {
    id: '#09',
    imageClass: 'proof',
    shotId: 'coach-season-wrapped',
    pain: 'The season ends and nobody writes down what happened.',
    claim: 'A closed season becomes one page — the record, the roster, the practices, the money — and it stays that way for years.',
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
  },
  '#21': {
    id: '#21',
    imageClass: 'composed',
    shotId: 'coach-awards',
    pain: 'The awards list gets rebuilt from memory the week before the banquet.',
    claim: 'Invent your own awards, hand them out in the moment all season, and the list is already written when awards night comes — the certificates print themselves.',
  },
  '#22': {
    id: '#22',
    imageClass: 'composed',
    shotId: 'coach-development',
    pain: '“He’s improved” is the only progress report a parent ever gets.',
    claim: 'Set goals, run the same test again, and put this month’s number beside last month’s — so improvement is measured rather than remembered.',
  },
  '#23': {
    id: '#23',
    imageClass: 'composed',
    shotId: 'coach-playing-time',
    pain: 'Playing time is an argument you can’t settle from memory.',
    // ⚠ NEVER the word "fair" (standing owner ruling, `decision_playing_time_vocabulary`). The
    // screen measures; it does not judge, and the claim ends by saying so.
    claim: 'The season’s own record shows the innings each player has been on the field, who has sat back-to-back, and how attendance has moved — measured, in context.',
    // On field and Back-to-back sits — the two the claim names. ⚠ COLUMNS, not rows: the report is
    // ordered fewest-innings-first, so WHICH player leads it changes with the lineups. Geometry
    // measured against the crop rect in the browser, not read off the PNG.
    rings: [
      { left: 21.6, top: 0.8, width: 14, height: 98.4 },
      { left: 42.1, top: 0.8, width: 14.9, height: 98.4 },
    ],
  },
  '#24': {
    id: '#24',
    imageClass: 'composed',
    shotId: 'coach-scouting-book',
    pain: 'What you learned about that team last time is in your head — and you play them Saturday.',
    // ⚠ "opens on the bench while the game is running" is TRUE and is NOT what the picture shows:
    // the game console exists about seven hours a week in the demo world, so the book is
    // photographed where it is written instead. The plan carried this as an open question; the
    // report turned out to be the better picture anyway, because it shows the book AND how it
    // filled up. Verified against the product, not assumed.
    claim: 'Your book on an opponent — what they do, what worked, what to watch — opens on the bench while the game is running, and grows every time you meet them.',
  },
  '#25': {
    id: '#25',
    imageClass: 'composed',
    shotId: 'coach-practice-plan',
    pain: 'The practice plan is a text you send at 9 PM and re-explain at the field.',
    claim: 'A plan attaches to a real practice on your schedule — stations, timings, who runs what — and it is on your phone at the field.',
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
    alt: 'A ring of five stations — set up, entries, the weekend, playoffs and the wrap-up — joined by four faint arrows. The fifth arc, returning from the wrap-up to set up, is drawn bright and labelled “copied forward”.',
    caption: 'The whole event in one place — and copying it forward carries the divisions, the venues, the registration setup and the public site.',
  },
  '#11': {
    id: '#11',
    imageClass: 'proof',
    shotId: 'fan-live-score',
    pain: 'Saturday, 2:14 PM — eleven texts asking for the score.',
    claim: 'Families follow their team on the public site. You never answer that text again.',
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
  },
  /**
   * ⚠ THE CLAIM THE APPROVED LIBRARY MARKED "TO CONFIRM" — the only one of the five explainers
   * never checked against the product. Confirmed 2026-08-21 against the clone itself: copying a
   * tournament forward carries divisions (with their pools and slots), venues, the registration
   * fields and fee schedule, and the branding, public pages, welcome text and rules/resources.
   * All four nouns in the sentence are real, and each is an opt-out the organizer can clear.
   *
   * ⚠ It IS plan-gated (Tournament Plus) — so the page's pull carries a plan line for it, while
   * the slide stays plan-free like every other. The gate lives in the plan configuration; do not
   * restate the tier anywhere but the page panel.
   */
  '#17': {
    id: '#17',
    imageClass: 'explainer',
    drawingId: 'copied-forward',
    pain: 'Next year, you start from scratch.',
    claim: 'Last year’s tournament is this year’s starting point — divisions, venues, registration setup and your public site, copied forward.',
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
 * The library numbers a deck names but the bank does not hold yet — P2 and beyond. Keeping
 * them here rather than in a comment means the running orders below are the REAL approved
 * orders, and `tests/unit/pitch-slide-library.test.ts` fails on a typo'd or orphaned id.
 */
export const PLANNED_SLIDES: Record<string, string> = {
  // ✅ EMPTY SINCE 2026-08-21 (P2b) — every id either deck names is now BUILT. Both running
  // orders below are real for the first time, so `deckSlides()` no longer skips anything.
  //
  // Kept rather than deleted because it is the register the next batch is declared in: #18–#20
  // are held for the club deck (P4) and will appear here the moment that deck names them, and
  // the guard test fails on an id that is both built and listed here. An empty register is the
  // honest state, not a dead one.
};

/**
 * THE DECKS — one audience each, in the approved running order.
 *
 * The tournament deck runs as a weekend runs. The coach deck runs as a coach's YEAR runs,
 * along the same five phases the demo world is built around — which is not tidiness: it means
 * every slide has a demo team sitting in the right state to be photographed on. (The
 * settlement sheet shot mid-season shows every family in debt and argues the opposite of what
 * it means to. The phase IS the picture.)
 *
 * Ids the bank does not hold yet are skipped by `deckSlides()` — see `PLANNED_SLIDES`, which is
 * empty as of P2b: both orders below are real end to end.
 *
 * ⚠ THE OVERVIEW SLIDE SITS SECOND IN EACH DECK, NOT FIRST (owner call 2026-08-21). Open on the
 * visceral moment the deck already opened on — Saturday 2:14 PM, or tryout day — and only then
 * show the wheel: "here is the whole shape of it". Opening cold on a diagram is opening on
 * abstraction, and the moment a reader recognizes themselves is worth more than the map.
 */
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

/** A deck's slides, in order, skipping the ones P2 has not built yet. */
export function deckSlides(audience: 'tournament' | 'coach'): PitchSlide[] {
  const bank: Record<string, PitchSlide> = PITCH_SLIDES;
  return PITCH_DECKS[audience].map(id => bank[id]).filter(Boolean);
}

/**
 * A public page's pull — one slide plus the two things only an UNATTENDED surface needs.
 *
 * `answer` is not a second copy of the slide's claim: a deck has a human in the room and gets
 * two sentences, a web page has nobody and gets the qualifications, the fallbacks and the
 * "your call" clauses that keep a claim true for every team. Same division as `planTag`.
 */
export interface WalkthroughPanel {
  /** A library number the bank holds — the compiler rejects any other. */
  slideId: SlideId;
  /** What stops being their job, at page length. Present tense, specific mechanism. */
  answer: string;
  /** Set ONLY when the pictured feature is plan-gated — full canonical plan name, always. */
  planTag?: string;
}

export interface Walkthrough {
  /** Also the manifest persona, the asset folder, and this page's deck. */
  persona: 'tournament' | 'coach';
  /** This page's own route — its canonical URL, and the address printed on the leave-behind. */
  path: string;
  seo: { title: string; description: string };
  eyebrow: string;
  title: string;
  sub: string;
  /** The "n problems · 90 seconds · nothing to install" line under the hero CTAs. */
  meta: string;
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
  /** The short pull. A SUBSET of this persona's deck, in deck order — the test enforces both. */
  panels: WalkthroughPanel[];
  closing: { eyebrow: string; title: string; body: string };
}

/** The page's <head>, derived from the same object the body renders. */
export function walkthroughMetadata(w: Walkthrough): Metadata {
  return {
    title: w.seo.title,
    description: w.seo.description,
    alternates: { canonical: w.path },
  };
}

export const TOURNAMENT_WALKTHROUGH: Walkthrough = {
  persona: 'tournament',
  path: '/for-tournament-organizers/walkthrough',
  seo: {
    title: 'The 90-Second Walkthrough for Tournament Organizers — FieldLogicHQ',
    // ⚠ NO "REAL SCREENS, NOT A BROCHURE" — see the note on `closing.body` below. Every one of
    // the ten places that claim appeared came out on 2026-08-21, and what replaces it points at
    // the demo instead: an invitation is stronger than a denial, and it stays true whatever the
    // pictures are.
    description:
      'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — live scores families check themselves, volunteer score entry, one-action rain delays, self-building brackets, and registration health. Walk the live demo yourself — no sign-up.',
  },
  eyebrow: 'For tournament organizers · a 90-second walkthrough',
  title: 'The weekend the phone stayed in your pocket.',
  sub: 'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — and a live demo you can walk when you are done.',
  meta: '5 problems · 90 seconds · nothing to install',
  door: { path: SEE_IT_LIVE_PATH, label: 'See it live — no sign-up →' },
  back: { href: '/for-tournament-organizers' },
  panels: [
    {
      slideId: '#11',
      answer:
        'Families follow their team on the tournament’s public site — live scores, schedule, and standings, no account, no app store. You never answer that text again.',
    },
    {
      slideId: '#12',
      answer:
        'Any volunteer enters scores from the field through Scorekeeper View — a link and a QR code from the Staff Kit, no admin access, nothing they can break. You walk the diamonds.',
    },
    {
      slideId: '#13',
      answer:
        'Rain delay re-times the whole day and hands you one notice — pinned as a banner on the public schedule, pushed to followers’ phones, sent to every coach. One action, not forty calls.',
      planTag: 'Rain delay re-timing is part of Tournament Plus',
    },
    {
      slideId: '#14',
      answer:
        'The Playoff Wizard builds the bracket from live standings, and it fills itself in as games end. A big division splits into Gold and Silver tiers in one click. Every plan gets the inline bracket editor.',
      planTag: 'Playoff Wizard is part of Tournament Plus',
    },
    {
      slideId: '#15',
      answer:
        'Registration Health scores the whole field weeks out — who’s paid, whose email bounces, who still needs a decision — and every tile clicks through to the exact teams.',
      // The Payments tile shows a badge instead of numbers on the free plan
      // (lib/help-content/tournaments.tsx) — same disclosure rule as the other gated panels.
      planTag: 'Payment tracking is part of Tournament Plus',
    },
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
    // ⚠ Describes the panels that EXIST — the six this page pulls, in the order it shows them.
    // Widened 2026-08-20 when the pull grew from two to six; the old line promised only the money
    // and would have under-described the page rather than over-promising it, which is the
    // likelier direction for a description to rot and the harder one to notice.
    description:
      'Six jobs that stop being yours the day your team runs on FieldLogicHQ — tryout scoring on a phone, practice plans that reach the field, your book on Saturday’s opponent, every family’s dues on one page, the season squared up from the real ledger, and a closed season kept on one page for good. Walk the live demo yourself — no sign-up.',
  },
  eyebrow: 'For head coaches · a 90-second walkthrough',
  title: 'Run the team. Keep your evenings.',
  sub: 'The jobs the Coaches Portal takes off your plate — and a whole demo season you can walk when you are done.',
  meta: '6 problems · 90 seconds · nothing to install',
  door: { path: SEE_IT_LIVE_COACHES_PATH, label: 'See a coach’s season →' },
  back: { href: '/for-coaches' },
  /**
   * ⚠ SIX PANELS SINCE 2026-08-20 (owner call), up from the two money screens this page shipped
   * with. The pull is still a SUBSET of the coach deck in deck order — it walks the same year the
   * deck does: tryout day → the practice → Saturday's opponent → the money → the off-season books
   * → a season already closed.
   *
   * What it deliberately leaves in the deck: playing time, awards, player development, the
   * fundraising credit and the lineup board. All five have their picture taken; none of them is
   * the thing a coach is buying in the first ninety seconds, and a page with fourteen panels is a
   * page nobody reaches the bottom of.
   *
   * ⚠ THIS COMMENT USED TO SAY "present mode and the printed leave-behind both render every built
   * slide already", AND IT WAS FALSE — both rendered this pull, so those five slides could not be
   * seen anywhere in the product. **Present mode renders the whole deck as of 2026-08-21** (see
   * the long note in WalkthroughPage.tsx). The PRINTED leave-behind still follows the scroll page,
   * because print is the page on paper; composing a deck to print is the Deck Studio's job
   * (docs/projects/active/PITCH_DECK_STUDIO_PLAN.md), not a fourth hard-coded rendering.
   */
  panels: [
    {
      slideId: '#10',
      // ⚠ "the weighting you set" is real and is worth qualifying here rather than on the slide:
      // the ranking is a weighted composite of the coach's OWN categories, and blind mode is the
      // default rather than an option somebody has to find.
      answer:
        'Evaluators score on their phones — a link, no login, and one card per player. You choose the categories and how much each is worth, so the ranked list at the end means what you decided it means, not what a spreadsheet averaged. Names stay hidden while scoring, and you reveal them when you are ready to decide. Offer, waitlist or pass, and an accepted player lands on your roster with their fees already set up.',
      planTag: 'Running tryouts is part of the Premium Coaches Portal',
    },
    {
      slideId: '#25',
      answer:
        'A plan belongs to a real practice on your schedule, so it is never a text nobody can find. Blocks with their own minutes, stations with what you are watching for, and a rotation that works out which group is where in every round. At the field it opens on your phone one block at a time with the clock running — and it records nothing, because the one field-time job worth finishing is attendance.',
      planTag: 'Practice plans are part of the Premium Coaches Portal',
    },
    {
      slideId: '#24',
      // ⚠ "opens on the bench" is true — the game console shows the book. Said here rather than
      // left implied, because the picture is the report the book is WRITTEN in, not the bench.
      answer:
        'One page per team you play: your record against them, every meeting, and the lines you and your assistants logged — tagged for pitching, hitting, defense, baserunning or coaching. It opens on the bench during the game as well as here, and the week you play them again the portal tells you the book is there. Opposing players are referred to by number and position, never by name.',
      planTag: 'The opponent book is part of the Premium Coaches Portal',
    },
    {
      slideId: '#01',
      // ⚠ The mockup said "automatic overdue reminders". The scheduled sweep
      // (lib/dues-reminders.ts, ticked daily by pg_cron) runs two waves 30 and 7 days BEFORE an
      // installment is due — ahead of the date, not after it — and it is on for a new team
      // (rep_program_years.auto_reminders_enabled DEFAULT true). The never-paid nudge stays
      // deliberately manual because it has no sent-stamp, so it is NOT what "one button" means
      // here: that is the toolbar's **Send Due Reminders**, which chases everyone past due or
      // due within three days, partial payers included. Do not conflate the two buttons.
      //
      // ⚠ "or waits for season's end" is not hedging for its own sake. Credits meeting bills is
      // a per-team setting (rep_program_years.credit_application): two of its three modes reduce
      // the bill, and `keep_separate` deliberately does not ("Credits don't reduce bills —
      // settled at season's end"). Unqualified, this sentence would be false for any team on
      // that mode. The demo world pins the default, so the PICTURE stays true either way.
      answer:
        'Player Dues puts every family on one page — what they were charged, what they have paid, what is left, and who has fallen behind. Reminders go out on their own ahead of each installment’s due date, and one button chases whoever is still behind. Money a family raised fundraising comes off their own bill, or waits for season’s end — your call. (The free portal keeps its Fees tool: charge the team, mark who has paid.)',
      planTag: 'Player Dues is part of the Premium Coaches Portal',
    },
    {
      slideId: '#03',
      // ⚠⚠ THE MOCKUP'S CLAIM WAS FALSE AND IS NOT WRITTEN HERE. It read "won't let you close
      // the books until every family is made whole" — but closing a season WARNS and never
      // blocks (owner ruling 2026-08-18, CLAUDE.md; the PATCH handler does a bare status flip
      // with zero money checks, and CloseSeasonModal's primary button is never disabled by
      // money). What DOES refuse is the settlement sheet's bulk payout — disabled until
      // closeOutBlockers().canClose, i.e. dues collected, enough cash held, and nothing left
      // pending with the club. That is the honest, and better, version of the same promise.
      answer:
        'Season settlement works it out from the season’s real ledger — what the team is holding, each family’s even share, who is owed money back and who still owes. It names every reason the books are not ready to close, and keeps the pay-everyone button locked until they are.',
      planTag: 'Season settlement is part of the Premium Coaches Portal',
    },
    {
      slideId: '#09',
      // ⚠ "one page" is the owner's binding ruling (CLAUDE.md), not a simplification for copy:
      // a closed season is ONE page, the same page whether it closed yesterday or three years ago.
      // The four shelves named here are the four that exist — do not add a fifth to this sentence
      // without adding it to the page.
      answer:
        'Close the season and the whole team workspace becomes one page: Season Wrapped — the record, the longest run, the closest game, who was on the field most — above four shelves holding the results, the roster, the practices you ran and how the money came out. It reads the same in three years as it does the week you close it, and starting next season does not take it away.',
      planTag: 'Season history is part of the Premium Coaches Portal',
    },
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
