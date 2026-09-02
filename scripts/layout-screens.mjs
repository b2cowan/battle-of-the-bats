/**
 * THE SCREEN LIST for the layout-invariant sweep.
 *
 * ⚠ THIS IS THE FILE YOU EDIT. Adding a screen to the sweep is ONE entry here — not a new spec
 * file. That is the whole point: the house rules in `scripts/check-layout-invariants.mjs` are
 * product-wide, so a new surface should inherit them by being listed, not by someone remembering
 * to re-derive them after a bug.
 *
 * Entry shape:
 *   id       stable slug — it keys the baseline, so RENAMING AN ID ORPHANS ITS BASELINE ENTRIES
 *   session  which signed-in role opens it ('coach' | 'orgOwner' | 'orgAdmin' | 'platformAdmin' | 'anon')
 *   path     (ctx) => url path; ctx = { orgSlug, teamId, practiceEventId, ... }
 *   ready    playwright selector that proves the screen actually RESOLVED (not an error state)
 *   scope    optional CSS selector to confine element rules to this screen's own content;
 *            defaults to the whole document
 *   skip     optional array of rule ids this screen is genuinely exempt from — each needs a reason
 *   widths   optional names of `optIn` WIDTHS this screen is ALSO swept at, on top of the
 *            universal ones — never a replacement for them. See WIDTHS at the foot of this file.
 *   note     why anything unusual above is true
 *
 * ⚠ SESSION MATTERS. The coach portal resolves org context before coaching assignments, so opening
 * a coach screen with the org-owner session lands on "Not assigned to any teams" — a page that
 * renders fine and measures fine and is telling you nothing. The sweep treats that as a hard
 * failure rather than a pass; see LANDING_FAILURES in the runner.
 */

/**
 * @typedef {{orgSlug:string, teamId:string, practiceEventId:string, gameEventId:string,
 *            fundraiserId:string, sponsorId:string, finishedTeamId:string,
 *            receiptPlayerId:string, planTemplateId:string, lineupTemplateId:string,
 *            evalSessionId:string, opponentKey:string,
 *            finishedYearId:string}} Ctx
 *
 * ⚠ Keep this in step with what `scripts/uat-fixture-context.mjs` actually returns. It had drifted
 * three fields behind before `finishedTeamId` joined it — nothing enforces a JSDoc typedef in plain
 * JS, so a screen can reference a context field that no longer exists and simply build a URL with
 * `undefined` in it, which renders as a 404 the sweep reports as a layout failure.
 */

const team = (c) => `/${c.orgSlug}/coaches/teams/${c.teamId}`;
/** The team whose WORKING season has finished — see the block above `coach-season-end`. */
const finished = (c) => `/${c.orgSlug}/coaches/teams/${c.finishedTeamId}`;

export const SCREENS = [
  // ── The portal's own front doors ────────────────────────────────────────────
  {
    id: 'coach-overview',
    session: 'coach',
    path: (c) => `/${c.orgSlug}/coaches`,
    ready: 'h1',
  },
  {
    id: 'coach-team-hub',
    session: 'coach',
    path: team,
    ready: 'h1',
  },
  {
    id: 'coach-notifications',
    session: 'coach',
    path: (c) => `/${c.orgSlug}/coaches/notifications`,
    ready: 'h1',
  },
  {
    id: 'coach-help',
    session: 'coach',
    path: (c) => `/${c.orgSlug}/coaches/help`,
    ready: 'h1',
  },

  // ── The week ────────────────────────────────────────────────────────────────
  { id: 'coach-schedule',    session: 'coach', path: (c) => `${team(c)}/schedule`,    ready: 'h1' },
  /* ⚠ ATTENDANCE MOVED INTO THE INSIGHTS PORTAL (P1, 2026-08-18) — `/attendance` is now a permanent
     redirect, and this entry addresses the TAB. It stays here rather than moving down to the
     Insights block because what it measures is unchanged: the densest table in the week's work, at
     361px. Its id is deliberately unchanged too, so the baseline it already owns still applies. */
  { id: 'coach-attendance',  session: 'coach', path: (c) => `${team(c)}/history?section=attendance`, ready: 'h1' },
  /**
   * ⚠⚠ **THE SAME TAB WITH A ROW OPEN — and it needs its own entry because a drill-in that arrives
   * CLOSED is invisible to this sweep.** The runner opens a URL and measures what renders; it cannot
   * click. The receipts list, its date/kind lines and the "every one of these falls on a …" note
   * would never be measured at any width without this, which is the trap OWNER_QA_LEDGER §58
   * records against this exact portal.
   *
   * ⚠ `receiptPlayerId` resolves to the ONE fixture player the seeder gives absences to — across a
   * practice run AND a game, all on the same weekday. Pointed at anyone else this would open onto
   * "nothing missed", measure the empty state, and report it as coverage.
   */
  { id: 'coach-attendance-receipts', session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/history?section=attendance&player=${c.receiptPlayerId}` },
  { id: 'coach-roster',      session: 'coach', path: (c) => `${team(c)}/roster`,      ready: 'h1' },
  { id: 'coach-lineups',     session: 'coach', path: (c) => `${team(c)}/lineups`,     ready: 'h1' },
  { id: 'coach-depth-chart', session: 'coach', path: (c) => `${team(c)}/depth-chart`, ready: 'h1' },

  /**
   * ⚠⚠ SIX DRILL-INS JOINED THE SWEEP ON 2026-08-26 (back-in-header spread), and the reason is
   * the durable part: they were not skipped-with-a-reason, they were ABSENT — a player's profile,
   * the lineup builder, a lineup template, a plan template, an evaluation session and an
   * opponent's page had NEVER been rendered by this check. Three of them had no fixture row to
   * open at all until that pass seeded one. An absent screen reads as coverage from every
   * direction: nothing in the list says it is missing, and the run reports green.
   *
   * **The pass that found them put a NEW CONTROL on every one of them.** Its own build prompt
   * asserted "every one of these is a page or a sub-view, so the sweep CAN see all of them" —
   * true of the mechanism, false of the list, which is exactly the gap this comment exists to
   * stop reopening. ⚠ Before claiming a sweep covers a family of screens, LIST them.
   */
  { id: 'coach-player',          session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/roster/${c.receiptPlayerId}` },
  { id: 'coach-lineup-builder',  session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/lineups/${c.gameEventId}` },
  { id: 'coach-lineup-template', session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/lineups/templates/${c.lineupTemplateId}` },

  // ── Player development (restructured 2026-07-31, QA pending) ────────────────
  { id: 'coach-development',           session: 'coach', path: (c) => `${team(c)}/development`,           ready: 'h1' },
  { id: 'coach-development-drills',    session: 'coach', path: (c) => `${team(c)}/development/drills`,    ready: 'h1' },
  { id: 'coach-development-board',     session: 'coach', path: (c) => `${team(c)}/development/board`,     ready: 'h1' },
  { id: 'coach-development-templates', session: 'coach', path: (c) => `${team(c)}/development/templates`, ready: 'h1' },
  // Two more of the six — see the block above `coach-player`.
  { id: 'coach-development-template', session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/development/templates/${c.planTemplateId}` },
  { id: 'coach-development-session',  session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/development/sessions/${c.evalSessionId}` },

  // ── Practice plans (Phase 4 slice 1a/1b/2, QA pending) ──────────────────────
  // The hub (2026-08-15) — the list of practices and what still needs a plan. Added with the
  // screen itself: a new coach page that no rendered check addresses is a page whose sideways
  // scroll and tap floors nobody has ever looked at.
  { id: 'coach-practice-plans', session: 'coach', path: (c) => `${team(c)}/practice`, ready: 'h1' },
  {
    id: 'coach-practice-plan',
    session: 'coach',
    path: (c) => `${team(c)}/practice/${c.practiceEventId}`,
    // The builder loads its world in one fetch; a block title existing proves the plan resolved.
    ready: 'textarea, input[aria-label*="Block 1 title"], h1',
  },
  {
    id: 'coach-practice-run',
    session: 'coach',
    path: (c) => `${team(c)}/practice/${c.practiceEventId}/run`,
    ready: 'h1',
    skip: ['tap-floor'],
    note: 'The field screen sets its OWN, HIGHER floor (56px) and is held to it by practice-run-layout.spec.ts. Re-checking the 44px floor here would be weaker, not stronger.',
  },

  // ── Game day (P1–P3) ────────────────────────────────────────────────────────
  {
    id: 'coach-game-console',
    session: 'coach',
    path: (c) => `${team(c)}/game/${c.gameEventId}`,
    // The console has NO <h1> — it is a phone-first instrument, not a document. This sticky header
    // strip is rendered ONLY in live mode, so it proves two things at once: the screen resolved,
    // and it resolved as the console rather than the read-only recap the same URL serves outside a
    // live window. `resolveUatContext()` keeps the probe game live so that stays true.
    ready: '[data-sticky="head"]',
    note: 'The portal\'s only genuinely phone-first screen — a coach holding a phone one-handed at a fence in daylight. Tap floor and contrast matter here more than anywhere, and P1/P2/P3 all shipped before it could be rendered at all.',
  },

  // ── Money ───────────────────────────────────────────────────────────────────
  /* ⚠ Every Money tab needs its OWN screen entry, addressed as `?section=…`. The hub keeps every
     visited panel MOUNTED but `display: none` while inactive, so a hidden panel has zero geometry
     and the sweep measures nothing in it — the bare `/accounting` screen proves only the Overview.
     Addressing a section makes THAT tab the visible one, which is the only way its tables can be
     rendered and measured (2026-08-13: the standalone /accounting/<tab> routes are permanent
     redirects into these URLs now — never point a screen at one, or every Money screen silently
     measures the redirect target's default state instead). */
  { id: 'coach-accounting',        session: 'coach', path: (c) => `${team(c)}/accounting`,                              ready: 'h1' },
  { id: 'coach-budget',            session: 'coach', path: (c) => `${team(c)}/accounting?section=budget`,           ready: 'h1' },
  { id: 'coach-budget-vs-actual',  session: 'coach', path: (c) => `${team(c)}/accounting?section=budget-vs-actual`, ready: 'h1' },
  /* ⚠ ONE SCREEN BECAME TWO (Money split P1, 2026-08-16) — a DELIBERATE baseline edit, not drift.
     `coach-expenses` measured a screen holding four sub-tabs; Transactions and Payables are now
     separate tabs with two sub-views each, and each has to be addressed on its own or half of what
     the old entry covered goes unmeasured.

     ⚠⚠ AND TWO BECAME THREE (Payables Rebuild P3, 2026-08-20) — for the reason the settlement sheet
     and the collapsed team-settings groups already taught this file: THE SWEEP ONLY MEASURES WHAT
     IS ACTUALLY DRAWN. Payables is now ONE list with a `Group by` arrangement, and the two
     arrangements deliberately default differently:

       · `coach-payables` (no param) opens grouped by COMMITMENT and **folded** — so it measures the
         bill headers, the fold controls and the toolbar, and measures NO installment rows at all.
         On its own it is a green check over a collapsed list, which is exactly the blind spot that
         has bitten twice before.
       · `coach-payables-schedule` addresses `?tab=schedule`, the dated arrangement, which defaults
         **open** — so the installment rows, the period bands and their totals are drawn and
         measured. It is also the live URL contract the Money hub and the Scheduled drill-in send,
         so this entry proves that link lands on something real as well.

     Both are needed. Dropping either leaves half the screen unmeasured.

     ⚖⚖ AND THE TABS BECAME ONE LEDGER WITH THREE VIEWS (Payables→Ledger fold, 2026-08-28) — the
     ADDRESSES moved; the three entries stay, because each still measures a shape the others cannot:
     the Timeline (register, sticky toolbar), By bill FOLDED (headers + fold controls, no rows),
     and By due date OPEN (rows, bands, totals). ⚠ The IDS deliberately keep their pre-fold names —
     the accepted-findings baseline is keyed on them, and renaming an id silently discards its
     accepted entries (this file's own lesson). Every path states `?view=` explicitly so the
     panel's per-device view memory can never re-aim a sweep entry. */
  { id: 'coach-transactions',      session: 'coach', path: (c) => `${team(c)}/accounting?section=ledger&view=timeline`, ready: 'h1' },
  { id: 'coach-payables',          session: 'coach', path: (c) => `${team(c)}/accounting?section=ledger&view=bills`,    ready: 'h1' },
  { id: 'coach-payables-schedule', session: 'coach', path: (c) => `${team(c)}/accounting?section=ledger&view=due`,      ready: 'h1' },
  /* ⚠⚠ ONE COMMITMENT — AND IT HAD NEVER BEEN SWEPT AT ALL (Payables Rebuild Part B, 2026-08-26).
     Part A shipped this screen as a sub-view of Payables and no entry was added with it, so a whole
     page — a header, a standing figure, a fields block, an unbounded schedule and a payments list —
     went unmeasured at every width. It is a `?bill=` URL, not a modal, so nothing here excuses it;
     the two entries above prove the LIST, and a list is not its drill-in.

     Part B makes the omission expensive rather than merely untidy: the page now draws six live
     controls (two of them comboboxes) and a docked save strip, all in slots that inherit NO tap
     floor from anything — which is precisely how a relocated control landed at 30px once before.

     ⚠ WHAT THIS CANNOT SEE: the sweep renders and measures, it does not TYPE. The editing states —
     a combobox open over the schedule, "Saving…", a refused rename — are owner-QA coverage only and
     are walked in the ledger section, not here. A green run on this entry is a claim about the page
     at REST.

     ⚠ `ready` IS NOT `h1` HERE, unlike every other Money entry. The hub's own `<h1>` is on screen
     before this page's data arrives, so waiting on it would unblock the sweep over "Loading payment
     details…" and report a green check for a page that had not drawn. The attribute below hangs off
     the branch that needs the STANDING — the schedule, the payments, the figure — so it cannot be
     satisfied by a half-loaded screen. */
  { id: 'coach-commitment',        session: 'coach', path: (c) => `${team(c)}/accounting?section=ledger&bill=${c.commitmentId}`, ready: '[data-commitment="loaded"]' },
  { id: 'coach-dues',              session: 'coach', path: (c) => `${team(c)}/accounting?section=dues`,             ready: 'h1' },
  /* ⚠ THE SETTLEMENT SHEET IS A DISCLOSURE, so `coach-dues` above measures it CLOSED — a pot
     card, a five-column table, two honesty strips and a payout sheet, all with zero geometry.
     That is precisely the "green sweep over an empty screen proves nothing" trap this project
     has hit twice. `?settlement=open` is the same URL a coach gets when they open it, so this
     entry sweeps the real thing rather than a fixture-only mode. */
  { id: 'coach-dues-settlement',   session: 'coach', path: (c) => `${team(c)}/accounting?section=dues&settlement=open`, ready: 'h1' },
  { id: 'coach-fundraisers',       session: 'coach', path: (c) => `${team(c)}/accounting?section=fundraisers`,      ready: 'h1' },
  /* ⚠ AN OPEN DRIVE IS ITS OWN SHAPE — since 2026-08-31 the drill-in is gone and `?fundraiser=`
     expands the drive's ROW in place: a facts meta line, sibling entry rows sharing the parent
     table's six columns, and a doors row, none of which the at-rest list draws. The 361px
     sideways-overflow defect of 2026-08-14 lived on exactly this surface's ancestor, so the
     open state stays swept — `coach-fundraisers` above would stay green through anything that
     happened inside the expansion. */
  { id: 'coach-fundraiser',        session: 'coach', path: (c) => `${team(c)}/accounting?section=fundraisers&fundraiser=${c.fundraiserId}`, ready: 'h1' },
  /* ⚠ A SPONSOR IS NOT THE SAME SCREEN, and until 2026-08-15 nothing automated had opened one. The
     entry above draws a drive: a six-column leaderboard with an inline edit form. A sponsor
     replaces it with a THREE-column single-row record, a kind chip beside a pledged/received chip
     in the title row, and a status sentence under it — none of which the drive can render, so a
     green `coach-fundraiser` proved nothing about any of them. Same lesson as the settlement sheet
     and the collapsed team-settings groups: the sweep only measures what is actually drawn. */
  { id: 'coach-sponsor',           session: 'coach', path: (c) => `${team(c)}/accounting?section=fundraisers&fundraiser=${c.sponsorId}`, ready: 'h1' },
  /* The kind-filtered list — the view the Money overview's two rows now land on (2026-08-15). It
     is the same table with a different row count, so it is cheap; what it proves is that the
     filter chips, the split summary cards and the "no sponsors this season" fallback all compose
     at every width, which the unfiltered `coach-fundraisers` entry above never shows. */
  { id: 'coach-sponsors-list',     session: 'coach', path: (c) => `${team(c)}/accounting?section=fundraisers&kind=sponsor`, ready: 'h1' },
  /* ⚠ TWO SCREENS BECAME ONE (money redesign P4, 2026-08-17) — a deliberate baseline edit, the
     mirror of the one P1 made when `coach-expenses` became `coach-transactions` +
     `coach-payables`. `coach-payment-requests` and `coach-allocations` named two tabs that no
     longer exist; the merged Club tab carries both, and it is the harder measurement of the two it
     replaced: a standing band of three figures, two titled blocks with their own toolbars, a
     collapsible bill with an instalment table inside it, and a request table with a filing column.
     The old ids' saved addresses still resolve here, but the SCREEN under test is the merged one. */
  { id: 'coach-club',              session: 'coach', path: (c) => `${team(c)}/accounting?section=club`,             ready: 'h1' },

  // ── A team BETWEEN SEASONS — its working season has finished ────────────────
  /**
   * ⚠⚠ **THE GAP THESE CLOSE HID THREE ROUNDS OF DEFECTS** (added 2026-08-16, P2). This world had no
   * completed season anywhere in it, so Season's End, the compare list and every "this season has
   * finished" state were invisible to the sweep — the guard tests said so in as many words, and
   * every defect on that rail was found by reading source or by owner QA instead.
   *
   * They point at a DIFFERENT team (`finishedTeamId`), because the state worth rendering is a team
   * with no live year at all. Season's End is where such a team lands, the Insights hub is the
   * read-only scoreboard, and the results report carries the compare list — the whole look-back
   * layer, in three screens.
   */
  { id: 'coach-season-end',        session: 'coach', path: (c) => `${finished(c)}/season-end`,      ready: 'h1' },
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * ⚠⚠ **FOUR SCREENS WERE DELETED HERE ON 2026-08-18, AND THEY WERE REPORTING GREEN WHILE
   * MEASURING THE WRONG PAGE.**
   *
   * `coach-finished-insights` (`/history`), `coach-finished-results` (`/history/results`),
   * `coach-finished-roster` (`/roster`) and `coach-finished-money` (`/accounting`) all addressed a
   * FINISHED team. Since the closed-season ruling, a team with no live season has one destination:
   * `CoachTeamSeasonGate` redirects every other in-team route to `/season-end`. So all four were
   * being served Season's End — which has an `<h1>`, so `ready` was satisfied, findings were
   * collected, and the sweep reported on four screens it never opened.
   *
   * That is the exact failure mode this file's own notes keep warning about: **a check reporting on
   * a screen it did not see.** It is worse than a gap, because the count made the coverage look
   * larger than it was.
   *
   * ⚠ Nothing is lost by deleting them. Those four surfaces are live-season-only now, and the LIVE
   * team already sweeps every one of them (`coach-history`, `coach-history-results`, `coach-roster`,
   * `coach-accounting`). What a finished season actually draws is the shelves below.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  /**
   * ⚠⚠ **A COLLAPSED SECTION IS INVISIBLE TO THIS SWEEP** — the same trap `coach-settings-money`
   * below documents, arriving on a second page. The practices shelf (P3 C3) is closed by default
   * BY RULING, so `coach-season-end` above measures its 44px summary row and nothing inside it: a
   * green sweep there would prove only that Season's End still has an <h1>.
   *
   * `?section=` is a REAL arrival URL — `CoachCollapseSection` opens, scrolls to and flashes the
   * named section — so this sweeps the genuine open state rather than a fixture-only mode.
   */
  { id: 'coach-finished-practices', session: 'coach', path: (c) => `${finished(c)}/season-end?section=season-practices`, ready: 'h1' },
  /**
   * ⚠ **THE TWO SHELVES ADDED ON 2026-08-18 HAD NO RENDERED COVERAGE AT ALL** until these entries,
   * for exactly the reason the note above gives: they arrive SHUT, so `coach-season-end` measured
   * their 44px summary rows and nothing inside them. They are also the two shelves that carry the
   * new month layer, the competition split and the event-type marks — i.e. every pixel this change
   * actually added.
   *
   * ⚠ A month row inside them is shut too, so what these sweep is the shelf's OPEN state: the
   * answer strip, the month rows and their 44px targets. The rows nested one level further down
   * are still unmeasured, and that is a real, stated limit rather than an oversight — addressing a
   * month would need its own URL contract, which `CoachCollapseSection` provides and the month
   * rows deliberately do not.
   */
  { id: 'coach-finished-results-shelf', session: 'coach', ready: 'h1',
    path: (c) => `${finished(c)}/season-end?section=season-results` },
  { id: 'coach-finished-roster-shelf',  session: 'coach', ready: 'h1',
    path: (c) => `${finished(c)}/season-end?section=season-roster` },
  /**
   * ⚠ The BOTTOM of the whole look-back layer, and it had no rendered coverage at all until P3 C3
   * gave it a second caller and a year. It is one level DOWN from a door, which is precisely where
   * Chunk F's expensive defects all lived.
   */
  { id: 'coach-finished-plan',      session: 'coach', ready: 'h1',
    path: (c) => `${finished(c)}/history/development/practices/${c.finishedPracticeEventId}`
      + `?from=season-end&year=${c.finishedYearId}` },
  /**
   * ⚠ The closed money book, OPEN (P4). Same reason as the practices shelf above it — collapsed by
   * ruling, so the default Season's End sweep measures a 44px summary row and nothing inside. This
   * one carries a TABLE, which is the shape most likely to overflow a 361px phone, so measuring it
   * shut would miss the only thing worth measuring.
   */
  { id: 'coach-finished-money-book', session: 'coach', ready: 'h1',
    path: (c) => `${finished(c)}/season-end?section=season-statement` },

  // ── The season around it ────────────────────────────────────────────────────
  { id: 'coach-announcements', session: 'coach', path: (c) => `${team(c)}/announcements`, ready: 'h1' },
  { id: 'coach-documents',     session: 'coach', path: (c) => `${team(c)}/documents`,     ready: 'h1' },
  { id: 'coach-staff',         session: 'coach', path: (c) => `${team(c)}/staff`,         ready: 'h1' },
  { id: 'coach-settings',      session: 'coach', path: (c) => `${team(c)}/settings`,      ready: 'h1' },
  /* ⚠ TEAM SETTINGS IS SIX CLOSED GROUPS, so the entry above measures the page chrome and
     nothing else — every control lives inside a shut <details> with zero geometry, and the
     sweep skips zero-size elements rather than flagging them. A green `coach-settings` would
     therefore prove only that the page still has an <h1>: the same "green sweep over an empty
     screen" trap the settlement sheet above documents, arriving here the day the page learned
     to collapse. `?section=` is the real arrival URL a coach gets from the dues page and the
     depth chart, so these sweep the genuine open state, not a fixture-only mode.
     Two entries, not six: `money` carries the new row grammar and `lineup-rules` the numeric
     inputs and the save row — between them every widget shape on the page is measured. */
  { id: 'coach-settings-money',   session: 'coach', path: (c) => `${team(c)}/settings?section=money`,        ready: 'h1' },
  { id: 'coach-settings-lineups', session: 'coach', path: (c) => `${team(c)}/settings?section=lineup-rules`, ready: 'h1' },
  /* One Tag Idiom P4 (2026-09-01): the Tags shelf is a third widget shape on this page — library
     rows expanding into the manager list — and collapsed it is invisible per the rule above. */
  { id: 'coach-settings-tags',    session: 'coach', path: (c) => `${team(c)}/settings?section=tags`,         ready: 'h1' },
  { id: 'coach-tryouts',       session: 'coach', path: (c) => `${team(c)}/tryouts`,       ready: 'h1' },

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * ⚠⚠ **THE INSIGHTS REPORTS PORTAL — EVERY TAB IS ADDRESSED, AND THAT IS NOT OPTIONAL**
   * (reports portal P1, 2026-08-18).
   *
   * The six reports stopped being routes and became PANELS the hub keeps mounted with
   * `display:none` while inactive. A hidden panel has zero geometry, and this sweep skips
   * zero-size elements rather than flagging them — so `coach-history` alone would measure the
   * Dashboard and report green over six unmeasured screens. That is the exact "green sweep over a
   * screen it did not see" trap the four deleted finished-season entries above document, and the
   * Money hub paid for it first.
   *
   * `?section=` is a REAL arrival URL — a coach lands on it from a bookmark, a tile, the game
   * console — so these sweep the genuine open state, not a fixture-only mode.
   *
   * ⚠ `attendance` is NOT here and that is deliberate: it keeps its long-standing id up in "The
   * week" (same screen, new address, so its existing baseline still applies).
   *
   * ⚠ **STATED GAP, NOT SILENT:** the per-opponent BOOK (`history/opponents/[opponentKey]`) is
   * still its own route and has NO entry in this file — it had none before this project either.
   * It is the deepest drill-in in the portal and one level down from a door, which is precisely
   * where Chunk F's expensive defects all lived. Adding it needs a fixture opponent key the sweep
   * can address; that is a real piece of work, so it is written down here rather than left to look
   * like coverage.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  { id: 'coach-history',             session: 'coach', path: (c) => `${team(c)}/history`,             ready: 'h1' },
  { id: 'coach-history-development', session: 'coach', path: (c) => `${team(c)}/history?section=development`, ready: 'h1' },
  { id: 'coach-history-results',     session: 'coach', path: (c) => `${team(c)}/history?section=results`,     ready: 'h1' },
  /**
   * ⚠ ADDED 2026-08-16 (archive rail Phase 2) — it was the one Insights door with NO rendered
   * coverage at all, and it had just gained a read-only mode, a season chip and a season-aware
   * certificate link. Its own `/review` had to record "not covered" for a screen this project
   * changed substantially, which is the gap worth closing rather than noting again next time.
   */
  { id: 'coach-history-awards',      session: 'coach', path: (c) => `${team(c)}/history?section=awards`,      ready: 'h1' },
  /**
   * ⚠ THE TWO REPORTS THAT HAVE NEVER BEEN SWEPT AT ALL. Playing Time carries the portal's widest
   * table (six columns, one per player, with an inline bar in a cell) and the Scouting Book carries
   * a search field above a list of rows each holding two badges and a record chip — between them
   * the two shapes most likely to overflow a 361px phone. They had no rendered coverage as routes
   * either; becoming tabs is simply when it became cheap to add them.
   */
  { id: 'coach-history-playing-time', session: 'coach', path: (c) => `${team(c)}/history?section=playing-time`, ready: 'h1' },
  { id: 'coach-history-scouting',     session: 'coach', path: (c) => `${team(c)}/history?section=scouting`,     ready: 'h1' },
  // The last of the six — see the block above `coach-player`. The book is keyed by the opponent's
  // NAME, so the context reads one off a played game rather than hard-coding it.
  { id: 'coach-opponent',             session: 'coach', ready: 'h1',
    path: (c) => `${team(c)}/history/opponents/${encodeURIComponent(c.opponentKey)}` },

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════════
   * THE MARKETING SITE — added 2026-08-21, Owner QA §68.
   *
   * ⚠ THIS WAS THE ONLY PUBLIC SURFACE WITH NO RENDERED GATE AT ALL, and it cost exactly what
   * you would expect: the shared top bar clipped "Get Started" off the right edge of every one
   * of these nine pages, on every phone narrower than 390px, from launch until an owner walk
   * found it by hand. Nothing below the coach portal's door had ever been rendered by a check.
   *
   * ⚠⚠ AND LISTING THEM WOULD NOT HAVE BEEN ENOUGH. Under the six rules that existed on the day
   * §68 was found, all nine of these entries would have swept GREEN — the bar is `position:
   * fixed`, so its overflow never reaches the document and the sideways-scroll rule stayed
   * silent. The rule that catches it (`control-offscreen`) was written in the same unit of work
   * and is the reason these entries are worth having. Adding a surface to this list is only
   * coverage if a rule can see the way that surface breaks.
   *
   * `session: 'anon'` throughout, deliberately — a marketing page read while signed IN is a
   * different bar (Account / Open app →), and it is measured by the header's own unit
   * measurements rather than here, because a signed-in session on a billboard is the rare case.
   *
   * These nine are the whole public marketing surface: the homepage, the four persona pages,
   * pricing, the demos door and both pre-sales walkthroughs.
   * ══════════════════════════════════════════════════════════════════════════════════════════
   */
  { id: 'mkt-home',              session: 'anon', path: () => '/',                                   ready: 'h1', widths: ['320'] },
  { id: 'mkt-pricing',           session: 'anon', path: () => '/pricing',                            ready: 'h1', widths: ['320'] },
  { id: 'mkt-for-coaches',       session: 'anon', path: () => '/for-coaches',                        ready: 'h1', widths: ['320'] },
  { id: 'mkt-for-clubs',         session: 'anon', path: () => '/for-clubs',                          ready: 'h1', widths: ['320'] },
  { id: 'mkt-for-leagues',       session: 'anon', path: () => '/for-leagues',                        ready: 'h1', widths: ['320'] },
  { id: 'mkt-for-tournaments',   session: 'anon', path: () => '/for-tournament-organizers',          ready: 'h1', widths: ['320'] },
  { id: 'mkt-demos',             session: 'anon', path: () => '/demos',                              ready: 'h1', widths: ['320'] },
  { id: 'mkt-walkthrough-coach', session: 'anon', path: () => '/for-coaches/walkthrough',            ready: 'h1', widths: ['320'] },
  { id: 'mkt-walkthrough-tourn', session: 'anon', path: () => '/for-tournament-organizers/walkthrough', ready: 'h1', widths: ['320'] },
];

/**
 * Widths under test. 361 is the narrowest phone the portal supports; 900/640 are its breakpoints.
 *
 * `optIn: true` marks a width swept ONLY on the screens that name it in their own `widths` field.
 * The flag lives on the width entry because that is what it is a fact about — a second exported
 * array would file "is this width universal?" somewhere other than the width.
 *
 * ⚠ 320 IS NOT A UNIVERSAL WIDTH, AND THAT IS THE WHOLE POINT (§68, 2026-08-21). The coach portal
 * declares 361 as the narrowest phone it supports — a coach opens it on their own phone, and that
 * is a supportable line to draw. The public marketing site is read on every phone ever sold,
 * including the 320px iPhone SE 1st gen, so it is held to a stricter floor than the portal is.
 *
 * Sweeping 320 everywhere would have been the easy edit and the wrong one: it drops every coach
 * screen into a width nobody has designed them for, and every finding it produced would land in
 * the baseline as accepted debt on the same day it was invented. That is precisely the "gate that
 * is red everywhere is a gate nobody runs" failure the runner's own header warns about — except
 * worse, because it would arrive pre-silenced.
 */
export const WIDTHS = [
  { name: '320', width: 320, height: 780, optIn: true },
  { name: '361', width: 361, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];
