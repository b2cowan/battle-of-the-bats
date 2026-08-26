/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **WHAT A COACH PAGE HEADER MAY HOLD IS A DECISION** (page-level action consistency, Phase 4a;
 * plan `COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` §6, house rules at §0).
 *
 * Three phases shipped sixteen rules and nothing enforced any of them. This file is the half of
 * that contract a source scan can actually see. It follows the idiom of
 * `coach-history-endpoint-guard.test.ts` — read the files, enumerate the legal set, fail when the
 * code and the list disagree — and it inherits that file's first commandment: **a guard that
 * cannot read something FAILS on it rather than passing vacuously.**
 *
 * ⚠⚠ **THE CONTRACT IS SPLIT BY WHAT EACH MECHANISM CAN SEE, AND THAT SPLIT IS DELIBERATE.**
 * §6 of the plan asked for "a unit test that pins the number and kind of header actions". That
 * sentence is easier to write than to build: eleven screens pass header actions and **six of them
 * pass a variable**, so a scan that tried to COUNT BUTTONS would have to follow references. Half
 * the portal would be invisible to it, and it would report green over the blind half. So:
 *
 *   · **This file pins the ENUMERATION** — which screens render a page header at all, which of
 *     them pass `actions`, which phone flags they pass, and what the slot means on each. All
 *     literals, all readable, all reliable.
 *   · **`npm run check:layout` keeps owning COUNT and GEOMETRY.** It renders the real pages and
 *     reads real controls by accessible name at seven widths. It is the only thing that sees the
 *     truth, and it caught two header defects that every file-reading gate passed (24px of desktop
 *     sideways scroll; a 30px tap target on a brand-new export).
 *
 * ── WHAT IS ENFORCED HERE ──
 *   1. **The enumeration.** Every `<CoachPageHeader>` call site under `app/[orgSlug]/coaches` is
 *      listed below. A new one, a deleted one, or one that gains or loses `actions` fails until
 *      the list is edited — which is the decision point the whole guard exists for.
 *   2. **Each site's declared phone behaviour** (`actionsPhoneHidden` / `actionsPhoneInTitleRow`),
 *      pinned as the literal expression. Changing how a header behaves on a phone stops being
 *      something that can happen quietly.
 *   3. **House rule 2 — no export control inside a page header.** The load-bearing one, and the
 *      reason §0 exists at all. Export lives in the toolbar above what it exports, at every width.
 *   4. **House rule 4 — the create goes FIRST.** Checked only where the resolved source contains
 *      both a create and a secondary, which is the only case the rule has an opinion about.
 *   5. **The Overview carve-out**, enumerated with its reason rather than branched around.
 *   6. **Rule 7, "nothing hides"** — an actions expression may not be gated on a view/tab/mode.
 *      Roster's whole action group was gated on `view === 'list'` and vanished in the depth chart;
 *      it survived to Phase 2. See its scope limit below — this one is the weakest assertion here.
 *   7. **The two legal header shapes still have their mechanism.** Inside the team layout the
 *      masthead hosts the help "?" and the page header renders none; outside it the page draws its
 *      own. A guard that pinned one shape would fail the other.
 *   8. **Non-blindness.** An `actions` expression naming an identifier this file cannot resolve in
 *      the same module fails here. So does a call site whose props do not parse cleanly.
 *
 * ── WHAT IS *NOT* ENFORCED, STATED SO THE SILENCE IS NOT MISTAKEN FOR COVERAGE ──
 * Most of the sixteen rules are judgement and no machine will ever check them. **These stay human
 * review, and this file makes no claim about them:**
 *   · Rule 1 (verbs only) · rule 2 (nearest label wins) · rule 5 (one name, one weight) ·
 *     rule 6 (one verb, one button) · rule 10 (icons only for words already met) ·
 *     rule 12 (a contextual export stays with its context).
 *   · **Rule 9's cap of two controls plus the create.** Counting buttons needs the rendered sweep,
 *     for the reason at the top of this comment.
 *   · **Rule 11's phone condition** — "every empty state keeps its import offer at 390px" — needs
 *     a rendered EMPTY fixture, and the seeded one is not empty. Nothing here can see it.
 *   · **House rule 4's phone shape** (title · symbol, and nothing else) is geometry.
 *   · Rule 6 checks are scoped to what the resolved expression says, and rule 7's gate check reads
 *     only the CONDITION in front of the JSX. A gate written with a variable this file's pattern
 *     does not recognise (`depthChart`, `showingCards`) passes. That is a known false-negative and
 *     the reason rule 7 is described above as the weakest assertion here, not a solved problem.
 *   · **Panels outside the hub.** Six money panels render `variant={embedded ? 'embedded' :
 *     'standard'}` — two shapes from one call site. The enumeration records both; nothing here can
 *     tell which one a given route renders.
 *
 * ⚠ **`npm test` IS NOT WIRED INTO THE AMPLIFY BUILD.** It is run by `npm run verify:changed`
 * (added with this file, 2026-08-25) and by hand. Before that it ran nowhere automatically, which
 * means every guard of this family — this one, the history guard, the season-scoped-lookup guard —
 * described itself as failing "the build" while failing nothing at all unless someone typed
 * `npm test`. Promoting it to the deploy build is an owner call, not a tidy-up.
 *
 * If an assertion here fails, the change is not necessarily wrong — it just isn't approved yet.
 * Take it to the owner, then edit the list and the plan's §10 log in the same commit.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const COACH_PAGES_ROOT = join(process.cwd(), 'app', '[orgSlug]', 'coaches');
const HEADER_COMPONENT = join(process.cwd(), 'components', 'coaches', 'CoachPageHeader.tsx');
const HELP_SLOT_COMPONENT = join(process.cwd(), 'components', 'coaches', 'CoachPageHelpSlot.tsx');
const TEAM_MASTHEAD = join(process.cwd(), 'components', 'coaches', 'CoachTeamHeader.tsx');
const TEAM_LAYOUT = join(COACH_PAGES_ROOT, 'teams', '[teamId]', 'layout.tsx');

const TAG = '<CoachPageHeader';

/** Every prop `CoachPageHeader` accepts. A parse that yields anything else has desynchronised. */
const KNOWN_PROPS = new Set([
  'icon', 'title', 'titleChips', 'actions', 'actionsPhoneHidden', 'actionsPhoneInTitleRow',
  'help', 'helpLabel', 'variant',
  /* ⚠ PILOT, owner 2026-08-26 — the way UP, in the header's leading corner, mirroring the help "?"
     at the trailing one. ONE call site may use it (the commitment sub-view); every other drill-in
     still wears `CoachBackLink` on its own row until the owner rules on the real thing. If a
     second site appears here without that ruling, it is drift. */
  'backTo',
]);

type Slot =
  /** The slot's ordinary meaning on 29 screens: a thing this page DOES. */
  | 'action'
  /** Overview only. See `OVERVIEW_CARVE_OUT` below — an enumerated exception, not a branch. */
  | 'status-door';

type Site = {
  /** Repo-relative path, forward slashes. */
  file: string;
  /** Which `<CoachPageHeader>` in that file, in source order (0-based). Two files render two. */
  occurrence: number;
  /** What a coach is looking at. Not asserted — it is how a human finds the row. */
  screen: string;
  /** Every `variant` literal the call site can render, sorted and joined. */
  variant: 'standard' | 'nested' | 'embedded|standard';
  /**
   * Who draws this page's help "?" — the settled TWO legal shapes (2026-08-25).
   * `masthead` inside the team layout (the page publishes, `CoachTeamHeader` renders);
   * `own` outside it, where there is no host and the header renders its own fallback.
   * Derived from the path and asserted against this declaration, so a page moving in or out of
   * the team layout is a decision rather than a surprise.
   */
  helpHost: 'masthead' | 'own';
  /** `null` = this screen has NO page-level action. 24 of 38 call sites. */
  actions: null | {
    /** `inline` = JSX written at the call site; otherwise the file-local name it passes. */
    from: 'inline' | string;
    slot: Slot;
    /** What the coach sees there, in words. Not asserted — it is the row's reason. */
    holds: string;
    /** The literal expression, or `null` when the prop is absent. Pinned exactly. */
    phoneHidden: string | null;
    /** The literal expression, or `null` when the prop is absent. Pinned exactly. */
    phoneInTitleRow: string | null;
  };
};

/**
 * ⚠⚠ **THE ENUMERATION.** Adding a row means a coach page header gained an action — the thing this
 * whole plan exists to make deliberate. Before adding one, three questions:
 *   1. **Is it a verb?** A page header holds what this page DOES. Not navigation, not a view
 *      switch, not a status readout. (The one exception is enumerated below, and it is ruled.)
 *   2. **Is it an export?** Then it does not go here at all — house rule 2 sends it to the toolbar
 *      above the thing it exports, at every width. This file will fail you if you try.
 *   3. **What happens to it on a phone?** Every row states that explicitly. "I hadn't thought
 *      about it" is not one of the answers, which is the point of pinning the flags.
 */
const SITES: Site[] = [
  // ── Outside the team layout: the page draws its own "?" ──────────────────────────────────────
  {
    file: 'app/[orgSlug]/coaches/link-org/page.tsx', occurrence: 0,
    screen: 'Link Organization — the "already inside an org" early return',
    variant: 'standard', helpHost: 'own', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/link-org/page.tsx', occurrence: 1,
    screen: 'Link Organization',
    variant: 'standard', helpHost: 'own',
    actions: {
      from: 'inline', slot: 'action', holds: 'Refresh (re-reads the link list)',
      phoneHidden: null, phoneInTitleRow: null,
    },
  },

  // ── The Money hub and its seven panels ───────────────────────────────────────────────────────
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx', occurrence: 0,
    screen: 'Money (the hub)',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      from: 'inline', slot: 'action', holds: 'Record (the one create), then Import',
      // Read-only money has no Record to show, so the row would be empty — drop it rather than
      // leave a dead 12px band under the title. Import alone hides per-action (house rule 1).
      phoneHidden: '!canWrite', phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx', occurrence: 0,
    screen: 'Money → Budget Plan',
    variant: 'embedded|standard', helpHost: 'masthead',
    actions: {
      // Only on the STANDALONE route (`!embedded`): inside the hub the header's own Import menu is
      // already on screen one line up. Plan §10, build decision 1 (2026-08-13).
      from: 'headerActions', slot: 'action', holds: 'Import — standalone route only',
      phoneHidden: null, phoneInTitleRow: null,
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx', occurrence: 0,
    screen: 'Money → Budget vs. Actual', variant: 'embedded|standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx', occurrence: 0,
    screen: 'Money → Club', variant: 'embedded|standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx', occurrence: 0,
    screen: 'Money → Player Dues', variant: 'embedded|standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx', occurrence: 0,
    screen: 'Money → Transactions / Payables (two faces, one module)',
    variant: 'embedded|standard', helpHost: 'masthead',
    actions: {
      from: 'expenseHeaderActions', slot: 'action', holds: 'Import — standalone route only',
      phoneHidden: null, phoneInTitleRow: null,
    },
  },
  {
    /* ⚖ ONE COMMITMENT — a SUB-VIEW of the Payables tab (`?bill=`), not a page beside the hub,
       matching what `?fundraiser=` already does one tab away. Nested, so the hub's header keeps
       naming the screen and there is no second "?". Its actions are the bill's own write doors,
       which moved here out of a modal footer when the drawer became a sub-view. */
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx', occurrence: 1,
    screen: 'Money → Payables → one commitment',
    variant: 'nested', helpHost: 'masthead',
    actions: {
      from: 'inline', slot: 'action',
      holds: 'Record · Edit (wide only) · Add an installment (wide only)',
      phoneHidden: null, phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/panel.tsx', occurrence: 0,
    screen: 'Money → Fundraising', variant: 'embedded|standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/detail.tsx', occurrence: 0,
    screen: 'Money → Fundraising → one drive',
    // `nested` — a hub tab drilled into ONE record. Its "?" is the hub's, one line up.
    variant: 'nested', helpHost: 'masthead',
    actions: {
      from: 'inline', slot: 'action', holds: 'Edit / archive controls for this one drive',
      phoneHidden: null, phoneInTitleRow: null,
    },
  },

  // ── The team hub ─────────────────────────────────────────────────────────────────────────────
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/page.tsx', occurrence: 0,
    screen: 'Overview',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      from: 'renderSetupChip', slot: 'status-door', holds: 'the season-setup ring — see OVERVIEW_CARVE_OUT',
      // Ring-only on a phone (house rule 3), so it keeps the title line's corner. That is the
      // whole of Overview's 116px → 60px band.
      phoneHidden: null, phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx', occurrence: 0,
    screen: 'Roster',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      from: 'rosterHeaderActions', slot: 'action', holds: 'Add Player (the create), then Import',
      // Export is NOT here — it is in the list toolbar, which is also what stopped it vanishing
      // in the depth chart. House rule 2 plus rule 7, fixed together in Phase 2.
      phoneHidden: '!canWriteRoster', phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx', occurrence: 0,
    screen: 'Roster → one player', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx', occurrence: 0,
    screen: 'Schedule',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      from: 'scheduleHeaderActions', slot: 'action', holds: 'Add Event (the create, with a choice inside), then Import',
      phoneHidden: '!canAddEvents', phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/announcements/page.tsx', occurrence: 0,
    screen: 'Email families — the no-access early return', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/announcements/page.tsx', occurrence: 1,
    screen: 'Email families', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/documents/page.tsx', occurrence: 0,
    screen: 'Documents', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx', occurrence: 0,
    screen: 'Team settings', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/staff/page.tsx', occurrence: 0,
    screen: 'Coaching staff', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx', occurrence: 0,
    screen: 'Tournaments', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx', occurrence: 0,
    screen: 'Tryouts (one room)', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/tryouts/history/page.tsx', occurrence: 0,
    screen: 'Tryout history', variant: 'standard', helpHost: 'masthead', actions: null,
  },

  // ── Development ──────────────────────────────────────────────────────────────────────────────
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx', occurrence: 0,
    screen: 'Skills & Goals', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/development/board/page.tsx', occurrence: 0,
    screen: 'Team board', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/development/sessions/[sessionId]/page.tsx', occurrence: 0,
    screen: 'Evaluation session', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/development/drills/page.tsx', occurrence: 0,
    screen: 'Your drills',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      from: 'inline', slot: 'action', holds: 'New drill — one create with two ways inside it (Phase 3)',
      phoneHidden: '!canWrite', phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/development/templates/page.tsx', occurrence: 0,
    screen: 'Plan templates',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      from: 'headerCreate', slot: 'action', holds: 'New template — one create with two ways inside it (Phase 3)',
      phoneHidden: '!canWrite', phoneInTitleRow: 'true',
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/development/templates/[templateId]/page.tsx', occurrence: 0,
    screen: 'Plan templates → one template', variant: 'standard', helpHost: 'masthead', actions: null,
  },

  // ── Practice, lineups, insights, season's end ────────────────────────────────────────────────
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/practice/page.tsx', occurrence: 0,
    screen: 'Practice plans', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx', occurrence: 0,
    screen: 'Practice plans → one practice', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx', occurrence: 0,
    screen: 'Lineups', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx', occurrence: 0,
    screen: 'Lineups → one game', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/lineups/templates/[templateId]/page.tsx', occurrence: 0,
    screen: 'Lineups → one template',
    variant: 'standard', helpHost: 'masthead',
    actions: {
      // ⚠ A SAVE, NOT A CREATE — this is an editor, and the header is where its one commit lives.
      // It still hand-writes its sizing (`btn btn-lime btn-sm` + inline flex), which is plan §2.6's
      // drift vector; the sweep of the last two such buttons rides Phase 4b with the screens it
      // touches. Recorded here so it is a known debt rather than a discovery.
      from: 'inline', slot: 'action', holds: 'Save template',
      phoneHidden: null, phoneInTitleRow: null,
    },
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx', occurrence: 0,
    screen: 'Insights', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/history/opponents/[opponentKey]/page.tsx', occurrence: 0,
    screen: 'Insights → one opponent', variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/history/development/practices/[eventId]/page.tsx', occurrence: 0,
    screen: "Season's End → one past practice", variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/season-end/page.tsx', occurrence: 0,
    screen: "Season's End — the no-closed-season state", variant: 'standard', helpHost: 'masthead', actions: null,
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/season-end/page.tsx', occurrence: 1,
    screen: "Season's End", variant: 'standard', helpHost: 'masthead', actions: null,
  },
];

/**
 * ⚠⚠ **THE ONE NAMED EXCEPTION, WITH ITS REASON — written down rather than branched around.**
 *
 * The actions slot means a CREATE on every screen but one. On Overview it holds the season-setup
 * ring: a `<button aria-expanded>` that is both a status readout and a door onto a checklist. By
 * rule 1 that fails twice over — a page header holds what the page DOES, not navigation and not
 * status — and Phase 3's first reconciliation duly recommended moving it out.
 *
 * **That recommendation was withdrawn.** `COACH_PAGE_TITLE_BAND_PLAN.md` §2 had already ruled the
 * opposite and the owner approved it: the chip STAYS in the slot and goes ring-only on a phone,
 * which is what took Overview's band from 116px to ~60px. A body bar would not have.
 *
 * So the slot deliberately means two things portal-wide. **Exactly one screen may be the second
 * one**, and this is it. A second `status-door` is not a smaller version of this decision; it is
 * the drift this plan exists to end.
 */
const OVERVIEW_CARVE_OUT = 'app/[orgSlug]/coaches/teams/[teamId]/page.tsx';

/**
 * House rule 2, by MODULE — not by the name a file happens to give it.
 *
 * ⚠⚠ **THIS USED TO BE A LIST OF COMPONENT NAMES, AND A `/review` LENS BROKE IT IN ONE LINE**
 * (2026-08-25, Critical, reproduced end to end against this very file). A page was added with
 * `import Dl from '@/components/coaches/CoachExportButton'` and `<Dl />` inside its header actions
 * — an ordinary rename, no obfuscation — and **all ten assertions passed with a live export control
 * sitting in a page header**, which is the one thing §0 exists to prevent. A textual name match
 * checks the spelling of a variable, not what the screen renders.
 *
 * Now the modules are the identity: the scan reads each file's imports, learns whatever LOCAL name
 * each export module was bound to, and looks for that name used as a JSX tag. Rename the import and
 * the guard follows it, because the import statement is what cannot be renamed away.
 *
 * `CoachScheduleCalendarButton` is on the list because it IS Schedule's export wearing its phone
 * face — the `.ics` a coach syncs into the phone in their hand.
 */
const EXPORT_MODULES = [
  'components/coaches/CoachExportButton',
  'components/coaches/MoneyExportButton',
  'components/coaches/CoachScheduleCalendarButton',
  'components/admin/tournament/TournamentAdminUI', // the admin `ExportMenu` these screens dropped
];

/**
 * ⚠ **AND THE NAMES ARE KEPT AS WELL, BECAUSE THE TWO MISS DIFFERENT THINGS.** Module-matching is
 * what survives a rename; name-matching is what still fires when the import is missing, indirect,
 * `dynamic()`-loaded, or re-exported through a barrel. Replacing one with the other lost a case
 * that the first version caught — proven by re-running the violation set after the "fix". They are
 * cheap, so the check is the UNION and neither is trusted alone.
 */
const EXPORT_NAMES = [
  'CoachExportButton', 'MoneyExportButton', 'ExportMenu', 'CoachScheduleCalendarButton',
];

/** House rule 4 — the create goes FIRST, at every width. */
const CREATE_MARKERS = ['btnPrimary', 'headerPrimaryBtn', 'recordMoneyBtn', 'btn-lime', "variant=\"primary\""];
const SECONDARY_MARKERS = ['btnSecondary', 'btn-ghost', 'btn-secondary', 'MoneyImportMenu'];

/**
 * Rule 7, "nothing hides" — header actions survive the empty state and every view mode.
 *
 * ⚠ **SCOPE, because this is the weakest assertion in the file.** It reads the CONDITION in front
 * of the JSX and fails a comparison against a string literal on a view/tab/mode-shaped name. It
 * would have caught Roster's `view === 'list'`, which is the real defect this exists for. It will
 * NOT catch a gate written with a name the pattern does not recognise. Treat a pass as "no obvious
 * view gate", never as "nothing hides".
 *
 * `embedded` is deliberately not matched: it is a SHAPE gate (hub vs standalone route), not a view
 * mode, and it is how the money panels avoid drawing an Import a coach can already see one line up.
 */
const VIEW_GATE = /\b(\w*(?:view|tab|mode|lens|face)\w*)\s*[!=]==?\s*['"]/i;

// ── the scanner ────────────────────────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const repoPath = (full: string) => relative(process.cwd(), full).split(sep).join('/');

/**
 * Every LOCAL name a file binds to one of `EXPORT_MODULES` — default, named, aliased or namespace.
 * This is what makes house rule 2 survive a rename: the module path is the identity.
 */
function exportLocalNames(fileSource: string): string[] {
  const names: string[] = [];
  const importRe = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (let m = importRe.exec(fileSource); m; m = importRe.exec(fileSource)) {
    const spec = m[2].replace(/^@\//, '').replace(/^\.\//, '');
    if (!EXPORT_MODULES.some(mod => spec.endsWith(mod) || spec.endsWith(mod.split('/').pop() as string))) continue;
    const clause = m[1];
    // `X`, `* as X`, and everything inside `{ a, b as c }` — all of them bind a usable local name.
    const braces = /\{([\s\S]*?)\}/.exec(clause);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const alias = part.split(/\s+as\s+/).pop()?.trim();
        if (alias) names.push(alias);
      }
    }
    const bare = clause.replace(/\{[\s\S]*?\}/, '').replace(/\*\s+as\s+/, '').split(',')[0]?.trim();
    if (bare && /^[A-Za-z_$][\w$]*$/.test(bare)) names.push(bare);
  }
  return [...new Set(names)];
}

/**
 * ⚠⚠ **COMMENTS ARE BLANKED BEFORE ANYTHING ELSE READS THE SOURCE, AND THAT IS LOAD-BEARING.**
 * The first draft of this scanner tracked strings but not comments, and desynchronised on the
 * Money hub — whose header carries a comment containing `a bare "+"`. One unmatched quote inside
 * prose and the brace counter walked off the end of the file, silently, reporting that Money's
 * header had no phone flags. Blanking preserves offsets and string contents, so everything
 * downstream (prop parsing, the export check, the create-first check) reads code and never prose.
 */
function blankComments(src: string): { text: string; desynced: boolean } {
  const out = src.split('');
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (let k = i; k < stop; k++) if (out[k] !== '\n') out[k] = ' ';
      i = stop;
      continue;
    }
    if (c === '/' && next === '/') {
      let stop = src.indexOf('\n', i);
      if (stop < 0) stop = src.length;
      for (let k = i; k < stop; k++) out[k] = ' ';
      i = stop;
      continue;
    }
    i++;
  }
  /**
   * ⚠⚠ **AND IT REPORTS WHEN IT HAS LOST ITS PLACE** (/review 2026-08-25, Medium-High). This tracker
   * treats every `'` as a string delimiter, which is right for code and wrong for JSX TEXT — one
   * `<p>The coach's own view</p>` before a header call leaves the scanner inside a string for the
   * rest of the file, so later comments are never blanked and a `>` or a stray brace inside prose
   * can truncate a real tag. The repo's lint forbids unescaped entities in JSX today, so this is a
   * latent shape rather than a live one; the point is that **a scanner which has lost its place must
   * say so** rather than hand back plausible-looking text. A file that ends mid-string fails.
   */
  return { text: out.join(''), desynced: quote !== null };
}

/** Every `<CoachPageHeader ...>` opening tag in a comment-blanked source, in order. */
function openingTags(src: string): string[] {
  const tags: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = src.indexOf(TAG, cursor);
    if (start < 0) break;
    let depth = 0;
    let quote: string | null = null;
    let i = start + TAG.length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') { i++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(src.slice(start, i + 1));
    cursor = i + 1;
  }
  return tags;
}

/** Top-level props of one opening tag. `null` value = a bare boolean prop. */
function parseProps(tag: string): Map<string, string | null> {
  const body = tag.slice(TAG.length, tag.length - 1);
  const out = new Map<string, string | null>();
  let i = 0;
  while (i < body.length) {
    const m = /[A-Za-z][A-Za-z0-9]*/.exec(body.slice(i));
    if (!m) break;
    const name = m[0];
    let j = i + m.index + name.length;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] !== '=') { out.set(name, null); i = j; continue; }
    j++;
    while (j < body.length && /\s/.test(body[j])) j++;
    if (body[j] === '{') {
      let depth = 0;
      let quote: string | null = null;
      let k = j;
      for (; k < body.length; k++) {
        const c = body[k];
        if (quote) { if (c === '\\') { k++; continue; } if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) break; }
      }
      out.set(name, body.slice(j + 1, k));
      i = k + 1;
    } else if (body[j] === '"' || body[j] === "'") {
      const q = body[j];
      const k = body.indexOf(q, j + 1);
      out.set(name, body.slice(j + 1, k));
      i = k + 1;
    } else {
      const rest = body.slice(j);
      const k = j + (/\s|$/.exec(rest) as RegExpExecArray).index;
      out.set(name, body.slice(j, k));
      i = k;
    }
  }
  return out;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Resolve what an `actions` expression actually renders.
 *
 * ⚠ **THIS IS WHERE THE GUARD REFUSES TO GO BLIND.** If the expression names something this file
 * cannot find in the same module, it returns `null` and the caller FAILS the test. It does not
 * skip. Nine tag routes lost their coverage in 2026-08 to a scan that skipped what it could not
 * follow, and that lesson is written into the history guard's header for the same reason.
 */
/** Every file-local declaration of `name`, as source text. More than one = ambiguous, see below. */
function declarationsOf(name: string, fileSource: string): string[] {
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=|function\\s+${name}\\s*\\(`, 'g');
  const found: string[] = [];
  for (let m = re.exec(fileSource); m; m = re.exec(fileSource)) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < fileSource.length; i++) {
      const c = fileSource[i];
      if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      else if (c === ';' && depth === 0) break;
    }
    found.push(fileSource.slice(m.index, i));
  }
  return found;
}

/** JS keywords and literals that turn up in an actions expression and are never a declaration. */
const NOT_A_REFERENCE = new Set(['true', 'false', 'null', 'undefined', 'void', 'typeof', 'new', 'as']);

/**
 * Resolve what an `actions` expression actually renders, into ONE blob of source that the house
 * rules below can be checked against.
 *
 * ⚠⚠ **THIS IS WHERE THE GUARD REFUSES TO GO BLIND, AND A `/review` LENS PROVED THE FIRST VERSION
 * DID** (2026-08-25, Critical + High). That version only followed a BARE identifier, so:
 *   · `actions={canWrite ? scheduleHeaderActions : null}` was classified "inline" and the const's
 *     real JSX was never read — **three rules at once** (export placement, create-first, view gate)
 *     silently checking four words of a ternary. Only the exact spelling `x || undefined` was
 *     rescued; the equally natural `x ?? null` was not.
 *   · A name declared TWICE in one file resolved to whichever came first in the text, which in a
 *     4,700-line screen with local helpers is a coin toss.
 *
 * So: take the expression, find every identifier in it that has a file-local declaration, and
 * splice those declarations in. Over-capturing is the safe direction for a guard — a false failure
 * is a decision point someone reads, a false pass is the thing this file exists to prevent.
 *
 * Returns `null` when the expression names something with no `<` anywhere and nothing local to
 * follow — the caller FAILS on that rather than skipping it.
 */
function resolveActions(expr: string, fileSource: string): { source: string; from: string; ambiguous: string[] } | null {
  const trimmed = collapse(expr).replace(/\s*\|\|\s*undefined$/, '').trim();
  const bare = /^([A-Za-z_$][\w$]*)(\(\))?$/.exec(trimmed);

  // ⚠ Follow references ONLY when the call site has no JSX of its own. An inline expression names
  // dozens of ordinary locals (`openImport`, `emptyDraft`, every icon), and splicing all of their
  // bodies in would fail the build on text that has nothing to do with the header. When the JSX is
  // written at the call site, the JSX is what we read.
  const hasInlineJsx = trimmed.includes('<');
  const ambiguous: string[] = [];
  const pulled: string[] = [];
  const followed: string[] = [];
  if (!hasInlineJsx) {
    const referenced = [...new Set(trimmed.match(/[A-Za-z_$][\w$]*/g) ?? [])]
      .filter(n => !NOT_A_REFERENCE.has(n));
    for (const name of referenced) {
      const decls = declarationsOf(name, fileSource);
      if (!decls.length) continue;
      if (decls.length > 1) ambiguous.push(name);
      pulled.push(...decls);
      followed.push(name);
    }
    if (!pulled.length) return null;
  }

  return {
    // Both halves: the call site (which carries the GATE that rule 7 reads) and everything it names.
    source: hasInlineJsx ? expr : `${expr}\n${pulled.join('\n')}`,
    from: bare ? bare[1] : (hasInlineJsx ? 'inline' : followed.join('+')),
    ambiguous,
  };
}

type Scanned = {
  file: string;
  occurrence: number;
  variant: string;
  props: Map<string, string | null>;
  fileSource: string;
};

/**
 * ⚠ **BOTH TREES, because a page header does not have to live in a route file** (/review
 * 2026-08-25, Low — the test was called "every page header in the coach portal" while walking only
 * the routes). All 38 call sites are under `app/[orgSlug]/coaches` today; a shared component that
 * grew one tomorrow would have been invisible, which is the quiet kind of gap this file exists to
 * refuse.
 */
const SCAN_ROOTS = [COACH_PAGES_ROOT, join(process.cwd(), 'components', 'coaches')];
const DESYNCED_FILES: string[] = [];

const occurrencesOfTag = (src: string) => src.split(TAG).length - 1;

const SCANNED: Scanned[] = SCAN_ROOTS.flatMap(root => walk(root)).flatMap(full => {
  const raw = readFileSync(full, 'utf8');
  const blanked = blankComments(raw);
  const fileSource = blanked.text;
  const tags = openingTags(fileSource);
  /**
   * ⚠⚠ **THE COUNT IS THE DESYNC ALARM, AND IT IS STRONGER THAN THE STRING TRACKER** (/review
   * 2026-08-25). If the scanner loses its place — an apostrophe in JSX text, an unbalanced brace
   * inside prose it failed to blank — the classic symptom is that one "tag" swallows the rest of
   * the file and the later real tags vanish. Comparing how many times `<CoachPageHeader` appears in
   * the RAW bytes against how many opening tags came out catches exactly that, without needing to
   * understand why. `desynced` (ending mid-string) catches a different, narrower shape; both are
   * kept because neither subsumes the other.
   */
  if (blanked.desynced || tags.length !== occurrencesOfTag(raw)) DESYNCED_FILES.push(repoPath(full));
  return tags.map((tag, occurrence) => {
    const props = parseProps(tag);
    const raw = props.has('variant') ? (props.get('variant') ?? 'standard') : "'standard'";
    const literals = raw.match(/'(\w+)'|"(\w+)"/g) ?? [`'${raw}'`];
    const variant = [...new Set(literals.map(v => v.replace(/['"]/g, '')))].sort().join('|');
    return { file: repoPath(full), occurrence, variant, props, fileSource };
  });
});

const key = (file: string, occurrence: number) => `${file}#${occurrence}`;
const flag = (props: Map<string, string | null>, name: string) =>
  props.has(name) ? (props.get(name) === null ? 'true' : collapse(props.get(name) as string)) : null;

// ── the assertions ─────────────────────────────────────────────────────────────────────────────

describe('coach page headers — what the actions slot may hold', () => {
  it('parses every call site cleanly (a desynchronised scan fails, it does not skip)', () => {
    assert.ok(SCANNED.length > 0, 'no CoachPageHeader call sites found — the scanner is broken, not the portal');
    assert.deepEqual(
      DESYNCED_FILES, [],
      'The comment/string scanner ran off the end of these files, so everything read from them is ' +
      'unreliable:\n  ' + DESYNCED_FILES.join('\n  ') +
      '\nUsually an unescaped apostrophe in JSX text (write &apos;). Fix the file, or teach ' +
      'blankComments about the shape — do NOT relax this: a scanner that has lost its place still ' +
      'returns plausible-looking text, which is how a guard reports green over nothing.',
    );
    for (const site of SCANNED) {
      const unknown = [...site.props.keys()].filter(p => !KNOWN_PROPS.has(p));
      assert.deepEqual(
        unknown, [],
        `${key(site.file, site.occurrence)} parsed prop(s) CoachPageHeader does not accept: ${unknown.join(', ')}. ` +
        'That is a scanner desync, not a real prop — every assertion below this one is unreliable until it is fixed.',
      );
    }
  });

  it('enumerates every page header in the coach portal — a new one is a decision', () => {
    const found = new Set(SCANNED.map(s => key(s.file, s.occurrence)));
    const listed = new Set(SITES.map(s => key(s.file, s.occurrence)));

    const unlisted = [...found].filter(k => !listed.has(k));
    assert.deepEqual(
      unlisted, [],
      'A coach page header appeared that this guard does not know about:\n  ' + unlisted.join('\n  ') +
      '\nAdd it to SITES with its phone behaviour stated, and log the decision in ' +
      'docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md §10.',
    );

    const missing = [...listed].filter(k => !found.has(k));
    assert.deepEqual(
      missing, [],
      'SITES lists a page header that no longer exists:\n  ' + missing.join('\n  ') +
      '\nRemove the row in the same commit — a stale allow-list is a guard checking nothing.',
    );
  });

  it('pins each screen\'s variant and who draws its help "?"', () => {
    for (const listed of SITES) {
      const site = SCANNED.find(s => key(s.file, s.occurrence) === key(listed.file, listed.occurrence));
      assert.ok(site, `${listed.file}#${listed.occurrence} not found`);
      assert.equal(
        site.variant, listed.variant,
        `${listed.screen} changed page-header shape (${listed.variant} → ${site.variant}).`,
      );
      // The two legal shapes, derived rather than trusted: inside the team layout the masthead
      // hosts the "?" (CoachPageHelpProvider is mounted there); outside it the page draws its own.
      const derived = listed.file.startsWith('app/[orgSlug]/coaches/teams/[teamId]/') ? 'masthead' : 'own';
      assert.equal(
        derived, listed.helpHost,
        `${listed.screen} moved in or out of the team layout, which changes who draws its help "?". ` +
        'Both shapes are legal (2026-08-25); which one a screen uses is not incidental.',
      );
    }
  });

  it('pins which screens hold header actions, and what happens to them on a phone', () => {
    for (const listed of SITES) {
      const site = SCANNED.find(s => key(s.file, s.occurrence) === key(listed.file, listed.occurrence))!;
      const hasActions = site.props.has('actions');
      assert.equal(
        hasActions, listed.actions !== null,
        listed.actions === null
          ? `${listed.screen} gained a header action. Rule 1: a page header holds what this page DOES — ` +
            'not navigation, not a view switch, not a status readout. If it is right, add it to SITES.'
          : `${listed.screen} lost its header action (${listed.actions.holds}). Rule 7 says nothing hides.`,
      );
      if (!listed.actions) continue;
      assert.equal(
        flag(site.props, 'actionsPhoneHidden'), listed.actions.phoneHidden,
        `${listed.screen}: the phone header changed. \`actionsPhoneHidden\` drops the whole row at 640px — ` +
        'only legal where the actions are genuinely absent there AND remain reachable by another route.',
      );
      assert.equal(
        flag(site.props, 'actionsPhoneInTitleRow'), listed.actions.phoneInTitleRow,
        `${listed.screen}: the phone header changed. \`actionsPhoneInTitleRow\` keeps the title line's ` +
        'corner — only for an action set that is genuinely ONE compact control on a phone.',
      );
    }
  });

  it('resolves every actions expression — an unreadable one fails rather than passing quietly', () => {
    for (const listed of SITES) {
      if (!listed.actions) continue;
      const site = SCANNED.find(s => key(s.file, s.occurrence) === key(listed.file, listed.occurrence))!;
      const resolved = resolveActions(site.props.get('actions') as string, site.fileSource);
      assert.ok(
        resolved,
        `${listed.screen} passes an \`actions\` expression this guard cannot follow. Every header action ` +
        'set is either inline JSX or a file-local const; if that stopped being true, extend the resolver ' +
        'in the same change rather than letting this screen go unchecked.',
      );
      assert.equal(
        resolved.from, listed.actions.from,
        `${listed.screen}: header actions now come from \`${resolved.from}\`, not \`${listed.actions.from}\`.`,
      );
      // ⚠ A name declared twice in one file makes "which declaration is this?" a coin toss, and a
      // guard that guesses is a guard that can read the wrong code and pass (/review 2026-08-25).
      assert.deepEqual(
        resolved.ambiguous, [],
        `${listed.screen}: \`${resolved.ambiguous.join(', ')}\` is declared more than once in this file, ` +
        'so this guard cannot tell which declaration the header renders. Rename one of them — these ' +
        'screens run to thousands of lines and a shadowed local is exactly how a scan reads the wrong code.',
      );
    }
  });

  it('house rule 2 — no export control lives inside a page header', () => {
    for (const listed of SITES) {
      if (!listed.actions) continue;
      const site = SCANNED.find(s => key(s.file, s.occurrence) === key(listed.file, listed.occurrence))!;
      // An unresolvable expression is owned by the test above, which fails on it. Skipping here
      // keeps each failure naming ONE rule instead of three at once.
      const resolved = resolveActions(site.props.get('actions') as string, site.fileSource);
      if (!resolved) continue;
      const { source } = resolved;
      // The union: by MODULE (survives a rename) and by NAME (survives a missing/indirect import).
      const hit = [...new Set([...exportLocalNames(site.fileSource), ...EXPORT_NAMES])]
        .find(local => new RegExp(`<\\s*${local}[\\s/>]`).test(source) || source.includes(local))
        ?? (/\bExport\b/.test(source) ? 'the word "Export"' : undefined);
      assert.equal(
        hit, undefined,
        `${listed.screen} put an export in its page header (${hit}). House rule 2, owner ruling ` +
        '2026-08-23: export lives in the toolbar above what it exports, pinned right, at EVERY width. ' +
        'This is a placement rule — it holds even for an export whose contents never vary with the view.',
      );
    }
  });

  it('house rule 4 — the create goes first', () => {
    for (const listed of SITES) {
      if (!listed.actions) continue;
      const site = SCANNED.find(s => key(s.file, s.occurrence) === key(listed.file, listed.occurrence))!;
      const resolved = resolveActions(site.props.get('actions') as string, site.fileSource);
      if (!resolved) continue; // owned by the resolver test above
      const { source } = resolved;
      const at = (markers: string[]) => markers
        .map(m => source.indexOf(m))
        .filter(i => i >= 0)
        .sort((a, b) => a - b)[0];
      const create = at(CREATE_MARKERS);
      const secondary = at(SECONDARY_MARKERS);
      // The rule only has an opinion where a header holds both. One button orders itself.
      if (create === undefined || secondary === undefined) continue;
      assert.ok(
        create < secondary,
        `${listed.screen} draws a secondary before its create. House rule 4: the create goes FIRST, ` +
        'at every width — matching the shipped Money screen, which is what the owner ruled from.',
      );
    }
  });

  it('rule 7 — a header action is not gated on which view a coach is in', () => {
    for (const listed of SITES) {
      if (!listed.actions) continue;
      const site = SCANNED.find(s => key(s.file, s.occurrence) === key(listed.file, listed.occurrence))!;
      const resolved = resolveActions(site.props.get('actions') as string, site.fileSource);
      if (!resolved) continue; // owned by the resolver test above
      const { source } = resolved;
      const jsx = source.indexOf('<');
      const gate = jsx < 0 ? source : source.slice(0, jsx);
      const hit = VIEW_GATE.exec(gate);
      assert.equal(
        hit?.[1], undefined,
        `${listed.screen} gates its header actions on \`${hit?.[1]}\`. Rule 7: header actions survive ` +
        'the empty state and every view mode. Roster\'s whole group — export included — used to vanish ' +
        'in the depth chart exactly this way, and it survived two phases before anyone noticed.',
      );
    }
  });

  it('the actions slot means ONE thing, with exactly one enumerated exception', () => {
    const doors = SITES.filter(s => s.actions?.slot === 'status-door');
    assert.deepEqual(
      doors.map(d => d.file), [OVERVIEW_CARVE_OUT],
      'The actions slot holds a create on every screen but Overview, where the season-setup ring is ' +
      'ruled to stay (COACH_PAGE_TITLE_BAND_PLAN.md §2, owner-approved 2026-08-25). A SECOND status ' +
      'door is not a smaller version of that decision — it is the drift this plan exists to end. ' +
      'See OVERVIEW_CARVE_OUT above.',
    );
    const overview = SITES.find(s => s.file === OVERVIEW_CARVE_OUT && s.occurrence === 0);
    assert.equal(overview?.actions?.slot, 'status-door', 'Overview lost its carve-out row');
  });

  it('both legal header shapes still have their mechanism', () => {
    // One host, mounted once, inside the team layout's authenticated branch.
    const layout = readFileSync(TEAM_LAYOUT, 'utf8');
    assert.ok(
      layout.includes('<CoachPageHelpProvider>'),
      'The team layout stopped hosting the page help "?". Every team screen would draw its own again, ' +
      'which is the two-homes drift the 2026-08-25 ruling closed.',
    );
    const masthead = readFileSync(TEAM_MASTHEAD, 'utf8');
    assert.ok(
      masthead.includes('<CoachPageHelpSlot />'),
      'The masthead stopped rendering the published "?". A page publishing to a host that draws nothing ' +
      'has no help at all.',
    );
    // And the fallback for everything outside it, which is what makes the second shape legal.
    const header = blankComments(readFileSync(HEADER_COMPONENT, 'utf8')).text;
    assert.ok(
      header.includes('!helpHosted'),
      'CoachPageHeader lost its own-"?" fallback. Pages outside the team layout (Link Organization, and ' +
      'the layout\'s own no-auth early return) would silently lose their help button.',
    );
    const slot = blankComments(readFileSync(HELP_SLOT_COMPONENT, 'utf8')).text;
    assert.ok(
      slot.includes('hosted: false'),
      'CoachPageHelpSlot\'s default context stopped defaulting to unhosted. The fallback is the DEFAULT ' +
      'value, not a branch anyone has to remember — that is what makes a missing provider safe.',
    );
  });
});
