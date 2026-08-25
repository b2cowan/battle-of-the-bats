# Coach Portal — Page-Level Action Consistency

**Status:** approved design · **Phase 1 (Money hub) BUILT on dev 2026-08-13** · **Phase 2
(Roster + Schedule) BUILT on dev 2026-08-23** — owner QA pending for both (`OWNER_QA_LEDGER.md`);
Phases 3–4 not started · owner-approved 2026-08-13, extended by the four house rules below
2026-08-23

---

## 0. THE FOUR HOUSE RULES (owner ruling 2026-08-23, binding, portal-wide)

Three of these were Money-only rulings that the owner generalised on sight of the Money hub's own
phone header. The fourth is new. **They take precedence over §3's twelve rules where they overlap**
— specifically they replace rule 3's ordering and settle where Export lives for every screen.

1. **Import lives in the page header, and never on a phone.** One right answer per screen wherever
   you are standing; it hides below 640px because picking a file is desktop work.
   ⚠ **Condition, not a nicety:** every empty state must keep offering its paste-a-block path at
   390px. Both importers carry that mode *because phones have no file picker*; hiding the header
   button without it deletes the path rather than tidying it.
2. **Export lives in the toolbar above what it exports, pinned right, at every width — never in a
   page header.** This is a PLACEMENT rule, not a contents one, and that distinction is the whole
   point. Schedule's export takes the whole season in every view, so the older "does its content
   vary with the view?" test said *header* while this rule says *toolbar*. One place to look wins:
   a coach should never have to work out which kind of export a screen has.
   ⚠ **Cut a phone's exports by FILE TYPE, not by width.** A spreadsheet lands in a downloads
   folder nobody opens; a roster PDF is held up to a parent and an `.ics` syncs a season into the
   phone in their hand. Deleting exports wholesale on phones was considered and rejected — it
   would remove the single most useful control on Schedule at 390px.
3. **On a phone, words become symbols — header and toolbar alike.** "+ Add Event" → "+"; Export →
   a download arrow. The words survive as the accessible name. **The symbol changes when the
   ACTION changes**: Schedule's phone control writes into a calendar rather than downloading a
   file, so it wears a calendar mark. Same rule, truthful icon.
   *(Considered and overruled: keeping one word on the toolbar control. Money already ships the
   bare glyph on all seven tabs, and two conventions for one control is the worse outcome.)*
4. **The create sits in the page header beside the "?", and it goes FIRST.** At every width. On a
   phone it keeps the title line's corner rather than taking a row of its own, so the band above a
   coach's first line of content stays one line tall. Net phone header, every screen:
   **title · symbol · "?"** and nothing else.

**Why create-first rather than §3 rule 3's "in, out, then primary":** that sequence existed to keep
import and export paired. House rule 2 moved export out of the header, so the header holds two
things, not three, and there is no pair left to sequence. Matching the shipped Money screen is worth
more than preserving a rule whose reason has gone.
**Binding visual spec:** `claude.ai/code/artifact/44162825-32ef-4744-90dc-7939ee635e9e`
(source: `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_MOCKUP.html`)
**PM brief:** `COACH_HEADER_ACTIONS_CONSISTENCY_PM_BRIEF.md`
**Extends (does not reopen):** the 2026-08-11 page-header ruling in `memory/design_decisions.md`

---

## 1. Trigger and scope

Owner, looking at the Money hub's Budget Plan tab: *"can we move all import/export buttons next to
the help button in the coaches portal headers for consistency? it seems to be there sometimes and
not other times… perhaps an overall review of all pages should be taken first, inventory the
buttons and their types."*

The literal request could not be granted — the help "?" is chrome and owns the top-right corner
alone (2026-08-11, rule 3) — but the observation behind it was correct. This plan is the inventory,
the rules that came out of it, and the work.

**Scope: all 40 team-hub screens under `/{org}/coaches/teams/{teamId}/`.** Owner chose the full
consistency pass over an Import/Export-only fix.

---

## 2. What the inventory found

All 40 screens rendering `CoachPageHeader` were read. **Ten carry header actions.** The rest either
have no page-level action, or have one living in the body.

### 2.1 Import — four screens, four treatments

| Screen | Label | Drawn as | Lives |
|---|---|---|---|
| Schedule | "Import" | `.btnSecondary` | page header |
| Budget Plan | "Import" | `.btnGhost` | embedded actions band |
| Expenses & Payables | "Import payables" | `.btnGhost` | embedded actions band |
| Roster | "Paste your roster" | empty-state secondary + a door inside the Add Player modal | **nowhere in the header** |

**Roster is a real defect, not just drift.** Once one player exists the empty state is gone and
bulk-add survives only inside the Add Player modal. A coach adding fifteen players after tryouts
cannot find it.

### 2.2 Export — four have it, nine comparable screens don't

Has `ExportMenu`: Roster · Schedule · Player Dues · Budget vs. Actual.
Has none: Budget Plan · Expenses & Payables · Fundraisers · Allocations · Payments · Playing time ·
Results · Attendance · Awards.

**Roster's group is gated on `view === 'list'`** — the whole action set, Export included, vanishes
in Depth-chart view although the export itself is view-independent.

### 2.3 The same role, two weights — inside one hub

| Money tab | Create | Class | Import | Export |
|---|---|---|---|---|
| Budget Plan | Add Line | `.btnSecondary` (outlined) | `.btnGhost` | — |
| Fundraisers | New Fundraiser | `.btnPrimary` (lime fill) | — | — |
| Expenses & Payables | Add Expense · Add Payable | `.btnSecondary` ×2 | `.btnGhost` "Import payables" | — |
| Payments | + New Request | `.btnPrimary` (lime fill) | — | — |
| Player Dues | — | — | — | `ExportMenu` |
| Budget vs. Actual | — | — | — | `ExportMenu` |
| Allocations | — | — | — | — |

In the warm portal `.btnPrimary` and `btn btn-lime` both resolve to the lime fill, so the visible
split is **lime fill vs white outline for the identical job, one tab apart**.

### 2.4 Actions that never reached a header

- **Plan templates** — Your tags · Add from a past season · New template, in the filter row beside
  the search box; all three absent from the empty state.
- **Drills** — Add from a past season · New drill, same shape.
- **Awards** — Give an award · Manage award types · Print N certificates, loose in the body.
- **Overview** uses the actions slot for the setup progress ring — a state display, not an action.

### 2.5 Needs no change (confirmed, not assumed)

- **Lineups** — "New template" already sits in the templates card, which names templates; "Build
  lineup" is a per-game row action. The nearest-label rule is already satisfied.
- **Documents · Staff · Announcements · Tournaments · Attendance · Tryouts** — no page-level
  buttons; their actions live inside inline forms and per-row controls.

### 2.6 Mechanical drift

Nearly every header button hand-writes inline sizing (`fontSize: '0.8rem'`,
`padding: '0.34rem 0.8rem'`) because `.btnSecondary` does not carry the header's compact geometry.
That is the vector by which the next one drifts.

---

## 3. The rules

Twelve rules. They **extend** the 2026-08-11 ruling; nothing in that ruling is reopened.

1. **Verbs only.** A page header holds things this page *does*. Not navigation, not view switches,
   not status displays.
2. **Nearest label wins.** A button belongs to the nearest chrome that names what it acts on. A
   page header naming the page holds that page's actions; a **hub** header names the container, so
   a tab's actions live in that tab's own toolbar.
3. **One order.** Left to right: data in, data out, then the single primary. Help "?" stays outside
   the group, unchanged.
4. **In and out travel together.** If a screen exports a table and the same rows can be created in
   bulk, both live in the header.
5. **One name, one weight.** "Import payables" → "Import". Import and Export are always the same
   button weight. Every page's main create is the **filled lime** button.
6. **One verb, one button.** Two ways to create the same thing is one button with a choice inside
   it, not two buttons competing.
7. **Nothing hides.** Header actions survive the empty state and every view mode.
8. **Hubs get menus.** A hub holding several datasets puts them behind `Import ▾ / Export ▾` in the
   page header, constant across every tab. Single-dataset screens keep plain buttons. **Tab bars
   stay pure navigation** — no verbs hang off them.
9. **Two, then a menu.** Two buttons plus help is the working cap for a page header. Beyond that a
   button either folds into the primary as a choice or goes down to the list it acts on.
10. **Icons only for words already met.** A secondary may collapse to an icon on a phone only where
    a coach would have met its label on a wider screen (Import, Export, Attendance). A button that
    exists *only* as an icon goes to the list toolbar with its words on.
11. **Phones get outputs, not files.** The phone header offers only exports a coach can read, show
    or send — PDF and add-to-calendar. Spreadsheet exports and all imports drop out. **Empty states
    keep their import offer at every width.**
12. **A contextual export stays with its context.** An export whose content depends on a selection
    lives beside that selection, not in the header — Awards' "Print N certificates" depends on the
    chosen award type and belongs with the type filter.

### 3.1 Two rules with teeth, stated plainly

- **Rule 11 retires a deliberate accommodation.** Both importers carry a paste-a-block mode built
  *because phones have no file picker* (documented in the sheet headers). Hiding Import in the
  phone header makes that path unreachable — which is why rule 11's second sentence is not
  optional. Every empty state that offers an import must keep offering it at 390px.
- **Rule 9 lowered the cap from three to two** after the Plan templates render was drawn and
  rejected on sight. Three buttons plus a long title plus help is jumbled at any width below ~900px
  and unreadable on a phone.

---

## 4. Screen-by-screen worklist

### 4.1 Money hub (7 tabs + Overview)

**Page header, constant on every tab:** `[Import ▾]` then the "?".

⚠ **EXPORT LEFT THE HEADER on 2026-08-13** (mockup artifact `96675523`), after Budget vs. Actual
grew a SECOND Export button. Import is genuinely hub-wide — one right answer per dataset wherever
you stand. Export never is: every tab carries view state the header cannot see. **Export now sits
in each tab's own control row**, exports what is on screen, and is not write-gated (reading is not
writing). Overview is the only tab without one — it is a dashboard, not a dataset. The paragraphs
below describe the menu as first built and are kept for the reasoning; the file-type dialog they
end in survives unchanged.

- **Import ▾** — Budget lines · Expenses & payables · separator · **Recent imports**.
- **Export ▾** — Budget lines · Player dues · Expenses & payables · Fundraisers · Budget vs. actual.
  ⚠ **AMENDED TWICE ON 2026-08-13, both times after seeing it rendered** (mockup artifact
  `6dfb7890`). Final shape: **five dataset names and nothing else** — no heading, no format tags,
  no overflow control. **Picking one opens a Save-As dialog** asking which file type, where each
  option also says what it is for. Two in-menu attempts were rejected on sight first: format chips
  on every row (12 buttons for 3 file types), then a muted default label plus a "···".
  ⚠ **The lesson, worth carrying anywhere: anything drawn beside every item in a list is drawn as
  many times as the list is long.** Both failed attempts varied *what* went on the row; the fix was
  to put nothing there. Accepted costs: two clicks per export, and "which datasets can I print?"
  is no longer answerable from the menu (the in-app guide names them instead).
- Rows appear only where the coach has access to that data. PDF respects `pdf_exports`
  plan-gating — **absent, not locked**, when the plan lacks it.

**Tab bar becomes pure navigation.** No actions. Full labels retained at all widths.

**Each tab's actions move into that tab's own toolbar**, joining the control row it already has:

| Tab | Existing row it joins | What lands in it |
|---|---|---|
| Budget Plan | `List / By period` (`.viewToggleRow`) | + Add Line |
| Expenses & Payables | the category filter | + Add Expense · + Add Payable · Manage tags |
| Player Dues | the status filter | Set dues for all players · Send reminders |
| Budget vs. Actual | the lens picker | *(nothing to add)* |
| Fundraisers | none — gains a thin right-pinned row | + New Fundraiser |
| Payments | none — gains a thin right-pinned row | + New Request |
| Allocations | none — read-only | *(none)* |

Five of seven already have a row, so this **removes** a band on net.

**Creates unify to the lime fill** (rule 5): Add Line, Add Expense and Add Payable stop being
outlined.

**Budget Plan's toolbar only renders when the plan is non-empty today** (`allLines.length > 0`);
the empty plan shows the first-run card with its three doors. That card is already rule-7 and
rule-11 compliant and stays as-is — but its import door must be verified present at 390px.

**Three new exports** (Budget lines, Expenses & payables, Fundraisers) are in scope. Without them
the Export menu is a two-item list whose gaps are now visible in one place, which makes rule 4
false on the screen that motivated the whole pass.

### 4.2 Roster

- **Gains Import** in the header — the existing bulk-add sheet, relabelled from "Paste your roster"
  to "Import" (the sheet's own paste/file choice is unchanged).
- **Header group ungated from `view === 'list'`** (rule 7).
- **"Attendance" leaves the header** (rule 1) and becomes a link in the roster count line.
- Header reads `[Import] [Export ▾] [+ Add Player]` — two secondaries plus one primary, at the cap.
- **Phone:** Export collapses to PDF-only, so it renders as a plain button rather than a menu;
  Import drops out. Empty state keeps its import offer.

### 4.3 Schedule

- Already correct in placement. Aligns to rule 5 weights and the shared header button geometry.
- **Phone:** Import drops out; Export becomes **"Add to calendar"** — the single most useful button
  on that screen at 390px.

### 4.4 Plan templates

- **`+ New template ▾`** folds "Start from blank" and "Bring one forward from a past season" into
  one header primary (rule 6).
- **"Your tags" goes down** to the search/filter row (rule 2) — matching Expenses' "Manage tags".
- Header reads `[+ New template ▾]` and the "?" — one button.

### 4.5 Drills

Identical shape to Plan templates; identical fold. `+ New drill ▾` (blank / from a past season);
the tag control stays with the search row.

### 4.6 Awards — ⚠⚠ STRUCK 2026-08-24. DO NOT BUILD THIS.

**Awards was rebuilt as a PANEL on 2026-08-18 (reports portal P1) and is already correct.** It has
no page header at all: the Reports hub owns the `<h1>` and the "?", and its tab row is what tells a
coach where they are. Its three controls already sit in the panel's own toolbar, which already
carries the 44px tap floor (added when the rendered sweep caught "Give an award" at 33px and
"Manage award types" at 15px on a 361px phone).

**Building the instruction below would move a working button to the wrong place** and contradict
house rule 2 — a tab-scoped action belongs beside the thing it names, exactly as Money's seven tabs
do. The panel's own note reached that conclusion independently before the house rules existed.

One low-stakes question survives: the certificate print sits inline after the other two controls,
where house rule 2 would pin an export to the right of its row. Owner to say; it reads as a third
instrument rather than an export, so leaving it is defensible.

*Superseded text, kept only so nobody re-derives it:*

### 4.6-OLD Awards (WRONG — see above)

- **"Give an award" → header** (rule 1), as the lime primary.
- **"Manage award types" → the list toolbar** (rule 2) — a library that outlives this page.
- **"Print N certificates" stays in the body beside the award-type filter** (rule 12) — its content
  depends on the selection. As a PDF output it survives on a phone.

### 4.7 Overview — ⚠ RIGHT CONCLUSION, FALSE PREMISE (corrected 2026-08-24)

The line below calls the season-setup ring "a state display, not an action". **It is not a display.**
It is a `<button>` with `aria-expanded` that opens a checklist of setup steps — a status readout
**and** a door.

That makes it fail rule 1 twice over rather than once (a header holds what this page *does* — not
navigation, not status), so the conclusion stands. But "stops being passed through the actions slot"
is not a complete instruction, because **Overview has no create to put there instead** — the slot
would simply empty. Where the chip goes is a real design decision, drawn three ways for the owner:
`claude.ai/code/artifact/72d79e12-22fe-4b93-b121-d7ea038cc44d`.

Recommendation on record: **A — move it into the body as a slim bar directly above the one-thing
card.** Setup is temporary and empties out; body content that comes and goes is ordinary, whereas a
header slot meaning one thing on 29 screens and something else on the 30th is the exact drift this
project exists to end. (B — make it the one-thing card when setup is unfinished — is cleaner
conceptually and a much bigger change, since it means teaching the card resolver about setup.
C — document it as a named exception — is cheapest and would need a carve-out in the Phase 4 guard.)

*Superseded text:*

The setup progress ring is a state display, not an action. It keeps its position but stops being
passed through the actions slot, so the slot means one thing portal-wide.

### 4.8 Everything else

Confirmed compliant in §2.5. No change.

---

## 5. Shared pieces to build

1. **A coach-portal action menu.** The tournament admin's `ToolbarMenu` / `ToolbarMenuItem` /
   `ToolbarMenuSeparator` (`components/admin/tournament/TournamentAdminUI.tsx`) is the existing
   primitive and the same pattern Data Tools already ships. Bring it across rather than inventing a
   second one; it must satisfy the coach portal's 44px phone tap floor, which the admin's export
   trigger currently pins at 32px with `!important` (a known conflict flagged in
   `COACH_PAGE_HEADER_CONSISTENCY_PLAN.md` — **this pass resolves it for the coach portal only**).
2. **Header button geometry as classes**, not inline styles — removing the drift vector in §2.6.
3. **A panel-toolbar class** for the tab content rows, so the two tabs that gain one match the five
   that already have one.
4. **A format-capability helper** so a screen declares what its export *produces* and the phone
   rule (11) follows from that declaration rather than from a per-screen hand-check.

---

## 6. The guard

Rules are re-litigated by the next contributor unless a build fails. Following the established
idiom (`APPROVED_ARCHIVE_DOORS` in `tests/unit/coach-season-write-guard.test.ts`):

**A unit test pins, per screen, the number and kind of header actions.** Adding a third button to
any page header, or passing a non-action into the actions slot, fails the build until the list is
edited — which is the decision point. Paired with the existing rendered-layout sweep, which is what
caught the last two header defects that every file-reading gate passed.

---

## 7. Phasing

| Phase | Outcome | Screens |
|---|---|---|
| **1** | Money hub: hub menus, creates down to tab toolbars, three new exports | Money (8 surfaces) |
| **2** | Import/Export pair completed and phone output rules applied | Roster, Schedule |
| **3** | Folds and drops | Plan templates, Drills, Awards, Overview |
| **4** | Shared classes, the guard, and the rendered sweep across all 40 | all |

Phase 1 is the screen that triggered the review and carries the largest single change. Phases are
sequential; each is independently shippable.

---

## 8. Risks and open items

- **A free-plan coach on a phone sees no export at all** on Roster, Dues and Budget vs. Actual,
  because PDF is plan-gated and the spreadsheet formats drop out. Judged correct — nothing to offer
  is better than a locked button — but it is a visible behaviour change on those screens.
- **Rule 11 is a deliberate feature removal on phones.** Disclosed in §3.1; the empty-state
  survival route is the mitigation and must be verified, not assumed.
- **Three new exports** mean three new column contracts to agree; they are the largest slice of
  Phase 1 and the natural cut line if it runs long.
- **In-app help** describes today's placements in the Money and Roster guides. Same unit of work.
- **The coach demo sandbox** (`riverdale-ridge`) has tour steps that point at money screens. Both
  demo questions apply — check whether any narration names a button that moves.

---

## 9. Verification

- `npm run verify:changed` on every phase; `npm run typecheck` where shared modules move.
- **Rendered sweep, not screenshots** — `npm run check:layout`. The last two header defects (24px
  of desktop sideways scroll, a 21px tap target) were invisible to every file-reading gate. An
  aborted sweep is a failure, not a pass.
- **Measured at 390 / 640 / 834 / 900 / 1024 / 1280 / 1440**, reading computed geometry. The
  container-width lesson from 2026-08-12 applies: the portal's sidebar makes card width
  non-monotonic in viewport width, so one width proves nothing.
- Tap-target baseline must not gain sub-44px entries.
- Owner QA rides `OWNER_QA_LEDGER.md`.

---

## 10. Log

- **2026-08-12** — inventory taken across 40 screens; three options drawn for the Money hub.
- **2026-08-13** — owner chose the full pass. Hub menus adopted; creates sent down to tab content;
  cap lowered from three to two after the Plan templates render was rejected on sight; phone output
  rule adopted. Mockup is the binding spec.
- **2026-08-13** — **Phase 1 built on dev.** Delivered in full: the hub's constant
  `Import ▾ / Export ▾`; the tab bar reduced to navigation; all seven tabs' actions moved into
  their own toolbars (Fundraisers and Payments gained a thin row, the other five joined a row they
  already had); creates unified to the lime fill; "Import payables" renamed to "Import"; Player
  Dues' two bulk actions brought down; the three missing exports written (budget lines, expenses &
  payables, fundraisers); `Recent imports` backed by a new receipt record (**migration 231 —
  applied to dev, prod apply rides the next release**). New shared pieces: a coach-portal action
  menu at the portal's 44px tap floor (§5.1), a `.panelToolbar` pair of classes (§5.3), and a
  per-dataset `formats` declaration that the phone rule keys off (§5.4). Header button geometry
  (§5.2) is folded into the new menu's classes; sweeping the remaining inline sizing off the other
  screens' buttons stays with Phase 4, where those screens are touched anyway.

  **Four decisions taken during the build that this plan did not specify:**
  1. **Standalone `/accounting/{tab}` routes keep their own Import/Export button**, since the hub
     header's menus are not on screen there. Creates live in the tab toolbar in both modes. Without
     this, the importer and the dues export would have become unreachable outside the hub.
  2. **Budget vs. Actual's MONTH-GRID export did not fold into the hub menu** — its contents depend
     on the view and lens the coach chose, which a hub-wide menu cannot see. The hub row exports
     the canonical category table; the grid's export moved beside the lens picker (rule 12). The
     §4.1 table's "*(nothing to add)*" for this tab is amended accordingly.
  3. **The empty payables list gained an import door.** It had none, so rule 11's mandatory
     mitigation was false there before this pass — the phone rule could not have shipped honestly
     without it.
  4. **Panels re-read rather than remount** after a header-fired import, so a half-filled form on
     another tab survives it.

  **Not built here (correctly deferred):** the §6 guard test pins header actions per screen and
  belongs with Phase 4, once every screen is in its final shape — pinning half a portal would
  encode the state Phases 2–3 are about to change.

- **2026-08-23** — **the four house rules taken** (§0), from the owner reading Money's own phone
  header back to it. Export leaving the page header is the load-bearing change: §4.3's "Schedule is
  already correct in placement" is **superseded**, and so is the narrower contents-vary test that
  sentence rested on.

- **2026-08-23** — **Phase 2 built on dev (Roster + Schedule).** Delivered in full:

  **A shared control, not a third one.** `CoachExportButton` is now the portal's one export
  control — the coach trigger at the 44px tap floor, the icon-only phone label, the per-choice
  phone FILE rule, plan-gating, the Save-As dialog and the busy/error path. **`MoneyExportButton`
  became a thin wrapper over it**, so the Money hub's seven tabs kept their money-shaped props and
  **no Money call site moved** — the money-specific part that survives there is the format
  vocabulary, the shape of a money download and the team-resolved PDF branding fetch. Both screens
  dropped the tournament-admin `ExportMenu`, which is why they looked like a different product:
  it is a different component, and it pins its trigger to 32px with `!important` at ≤760px. §5.1's
  known conflict is now **resolved for the coach portal**.

  **Roster** — gained Import in the header (the bulk-add sheet that existed only in the empty state
  and behind a door inside Add Player; a coach entering fifteen tryout graduates in September could
  not find it). **Header ungated from `view === 'list'`** — the whole group used to vanish in the
  depth chart, including an export whose contents are identical in both views. Export moved to the
  list toolbar, which is what makes that fix free: the row renders in both views.

  **Schedule** — Export moved to the List/Week/Month row. On a phone it becomes a **calendar mark**
  and the `.ics` is the only survivor; the two spreadsheets and Import drop out.

  **Two shared pieces:** `.headerPrimaryBtn` (renamed from `.recordMoneyBtn` — named for the slot,
  not the screen it was first built for; §5.2's header geometry, now carried by every page's
  create) and `.listToolbarEnd` (§5.3's row-end slot, holding a view toggle and that list's export
  together).

  **⚠ The rendered sweep earned its keep again.** The new export landed at **30px at 390** —
  the portal enforces its tap floor through the SURFACE a control sits on (`.pageHeaderActions`,
  `.panelToolbarActions`), and a list toolbar was neither, so nothing reached it. Invisible to
  typecheck, lint and every file-reading gate. Fixed on `.listToolbarEnd` so the slot carries the
  floor for whatever lands in it. **Net baseline movement: 18 phone tap-floor entries removed, 0
  added** (the admin split button's two controls became one, and stale toggle entries pruned).

  **Not built here:** the §6 guard test still rides Phase 4. `check:layout`'s baseline gained 13
  entries at 768 that are **fixture drift, not this change** — the sweep's signature includes a
  schedule row's date text, and the seeded season re-anchors.

- **2026-08-24** — **`/review` run** (high-risk tier, 4 lenses: correctness · security/PII ·
  blast-radius · concurrency). **One High confirmed and fixed; no Criticals.**

  **The High, and why it only appeared once Export moved:** the export dialog closed itself on a
  URL change, a guard written for Money — where every tab lives at ONE path and moves by
  `?section=`. Roster and Schedule move by **path** (`/teams/A/roster` → `/teams/B/roster`), where
  the query string is identical, so the guard never fired. These pages **do not remount on a team
  switch** (the roster page's own sequence-token comment says so, and that guard covers response
  ordering, not this). The dialog covers the screen and names no team, so a coach could not see the
  switch happen behind it: left open across a back-navigation, **"Roster with contacts" would have
  run against the PREVIOUS team's players — still in state until the new fetch lands — into a file
  already titled for the team just moved to.** A cross-team document of children's birthdates and
  guardian emails, two ordinary taps. Fixed by watching pathname as well as query string, which is
  correct on every surface. ⚠ The old anchored dropdown had the same blind spot; the full-screen
  dialog is what made it both reachable and undetectable.

  **Refuted (1):** that the new `.listToolbarEnd` tap floor "unreviewedly" grew Roster's
  List / Depth-chart pills. It grew them **on purpose** — those were recorded sub-44px violations
  and the rendered baseline lost them on this run. `.segChoice` was the instance missed by the
  2026-08-15 ruling whose own comment claimed "every view toggle in the portal gains it". The
  comment was rewritten to say so, since it had justified the rule only in terms of the export.

  **Raised, not defects:** (1) Roster's plan-gated PDF rows changed from **shown-and-locked with an
  upgrade tooltip** (the admin control's behaviour) to **absent** — this is the portal's own
  "absent, not locked" ruling arriving on Roster, and it removes an in-context upgrade nudge.
  Flagged for the owner rather than decided here. (2) Schedule's events fetch has **no
  sequence-token guard** where Roster has one — **pre-existing**, unchanged by this work, and worth
  its own unit of work.

  **Gate:** typecheck ✓ · focused lint ✓ (0 errors; warnings all pre-existing) · `check:layout`
  ✓ on both screens · CSS purity, token, contrast, dictionary, org-context, demos ✓ ·
  schema parity ✗ **pre-existing** (other sessions' dev-only migrations; this change adds none).

- **2026-08-24** — **`/docs` run.** Three guides named things that had moved: Roster's bulk-add
  article called its door **"Add players"** (it is **Import**, and the article never said where it
  was); Schedule's import article said **"tap Import (beside Export)"**, which stopped being true
  the moment Export left the header; and Money's imports article opened by claiming Import *and*
  Export "sit at the top of Money" before correcting itself two sentences later — now rewritten to
  state the portal rule once. Search keywords added for the questions the move creates ("where did
  export go", "paste your roster gone", "no import on my phone"). The roster article crossed the
  350-word standard when it gained the phone paragraph and was tightened back under.
  **Demo sandbox checked and clean:** the coach tour anchors nowhere near these rows and no dock
  copy names a moved button — verified, not assumed.

- **2026-08-24** — **Phase 3 reconciled against the four house rules, from the live code.** Decision
  sheet: `claude.ai/code/artifact/72d79e12-22fe-4b93-b121-d7ea038cc44d`. Phase 3 is smaller and
  differently shaped than §4.4–§4.7 describe, and two of those four sections were wrong:

  | Screen | Verdict |
  |---|---|
  | Plan templates | **Build** — §4.4 holds unchanged. Header carries title + "?" only today; two creates ("New template", "Add from a past season") fold into one header primary, "Your tags" stays with the search row. |
  | Drills | **Build** — §4.5 holds. Identical shape and identical fold. |
  | Awards | **Already done** (2026-08-18). §4.6 **struck** — building it would move a correct button to the wrong place. |
  | Overview | **Owner decision owed.** §4.7's conclusion survives, its premise does not — the ring is a button that opens a checklist, and Overview has no create to take the slot it vacates. |

  **The lesson worth carrying:** both wrong sections were wrong because the screens moved after the
  plan was written — Awards was rebuilt as a hub panel six days later, and Overview's chip gained a
  popover. A plan section that names a control's destination goes stale the moment that control's
  screen is rebuilt, and neither staleness was visible from the plan itself. **Read the screen
  before building the section** (AGENCY_RULES: argue from what the code does).

  Two open items before a build prompt is written: Overview's chip (three options drawn), and a
  low-stakes call on whether Awards' certificate print pins right in its toolbar.

- **2026-08-24** — ⚠⚠ **PHASES 3 AND 4 ARE BLOCKED ON `COACH_PAGE_TITLE_BAND_PLAN.md`** (owner call,
  on being told Phase 3 was ready to build). That plan is **ruled and unbuilt**, and it changes the
  page header itself — so building against today's shape would encode a shape that is about to move.

  **What it changes underneath this plan:**
  1. **The help "?" leaves the page header entirely** (its option 3, approved **at every width**,
     rendered last in the masthead corner). **House rule 4 is worded around the "?"** — *"the create
     sits in the page header beside the '?'"*, and *"net phone header: title · symbol · '?'"*. Both
     sentences stop being true. The phone header becomes **title · symbol**, and
     `actionsPhoneInTitleRow`'s whole justification — *"the corner has room for one button next to
     the ?"* — is about a neighbour that will not be there.
  2. **The band's margin moves 16px → 12px portal-wide** (its option 1).
  3. **Phase 2's shipped screens are in scope too.** Roster and Schedule render the "?" in the fixed
     corner slot; when it moves, they move. Parts of QA §88's phone checks go stale with it.

  **⚠ PHASE 4 IS THE ONE THAT MUST NOT JUMP THE QUEUE.** Its entire job is a guard test pinning what
  each page header may hold. Writing it now would pin a header that is one approved-and-unbuilt plan
  away from losing its "?" and changing its margin — the guard would fail the build on the very
  change it was meant to protect. Sequence: title band → re-reconcile → Phase 3 → Phase 4.

- **2026-08-24** — ⚠ **§4.7 IS SUPERSEDED AGAIN, AND THE OTHER WAY.** Yesterday's reconciliation
  recommended moving Overview's setup chip **out** of the actions slot (option A, a slim bar above
  the one-thing card). **That is withdrawn: `COACH_PAGE_TITLE_BAND_PLAN.md` §2 already ruled the
  opposite and the owner approved it** — the chip **stays in the actions slot** and becomes
  **ring-only on a phone** with its words in the accessible name, sitting in the title-line corner.
  That is house rule 3 applied to the chip, and it takes Overview's band from 116px to ~56px, which
  the body-bar option would not have.

  **What that ruling does NOT settle, and Phase 4 will trip on:** rule 1 says a page header holds
  what the page *does* — not navigation, not status. The chip is a status readout that opens a
  checklist, and it is now staying. **The actions slot therefore means two things portal-wide, on
  purpose.** The Phase 4 guard must carve Overview out knowingly rather than discover it, and that
  carve-out should be written down as an exception the way Money's Record ordering is — not left as
  a silent `if`.

- **2026-08-25** — **RE-RECONCILED after the help "?" moved. Phase 3 is UNBLOCKED and is now two
  screens with no open decisions.** Read from the live code, not from either plan.

  **What actually landed:**
  | Piece | State |
  |---|---|
  | Help "?" → masthead right slot, every width, rendered last | ✅ built |
  | Overview's setup chip → ring-only on a phone, corner slot | ✅ built (its band was the 116px outlier) |
  | Page-title band margin 16px → 12px portal-wide | ❌ **NOT built** — `.pageHeader` is still `margin-bottom: 1rem` |

  **Phase 3 after the move — two screens, one fold each, nothing to decide:**
  - **Plan templates** — two creates ("New template", "Add from a past season") fold into one header
    create with the choice inside; "Your tags" stays with the search row. Unaffected by the help
    move: the create still goes in the header, and on a phone it is the bare `+` in the title-line
    corner — now *alone* there rather than beside a "?".
  - **Drills** — identical in every respect.
  - **Awards** — no change (§4.6 struck; it is a hub panel and was already correct).
  - **Overview** — done (§4.7 closed by the title-band build, not by this plan).

  **Two rule texts are now stale and must be corrected before Phase 4 pins anything:**
  1. **House rule 4 is worded around a neighbour that has gone.** *"The create sits in the page
     header beside the '?'"* and *"net phone header: title · symbol · '?'"* — inside the team layout
     the "?" is not in the page header at all. The phone header is now **title · symbol**.
  2. **"One findable home" is true at the top of the page, not while scrolled.** The masthead's right
     slot folds with `.teamHeaderCollapsed` at ≤900px, so a scrolled phone loses the "?" exactly as
     it loses the flip and the season. That is ruled and accepted — but house rule 4 promised a
     findable corner, and this is the caveat on it.

  **Two things Phase 4's guard must handle, both knowingly:**
  - **The header has TWO legal shapes now.** Inside the team layout the masthead hosts the "?" and
    the page header has none; outside it (team-picker hub, notifications, the portal shells, and the
    team layout's own no-auth early return) the page still draws its own as the default fallback.
    A guard that pins one shape fails the other.
  - **The actions slot deliberately means two things** — a create on 29 screens, a status door on
    Overview. Write that as a named exception, not a silent branch.

  ⚠ **One thing to look at, low confidence, found by reading not measuring:** the phone grids still
  declare a column for the help slot that is now usually empty — `.pageHeaderActionsCorner` is
  `1fr auto auto` with a `0.5rem` column-gap, and the third track has no item once the masthead hosts
  the "?". An empty track is 0-wide but its gap is still drawn, so the create may sit ~8px off the
  right edge on every corner-variant screen (Money's Record, Roster's Add Player, Schedule's Add
  Event, Overview's chip). Harmless if so, but it is unintended and worth a measured look rather
  than a guess.

  **Open question for the owner:** the 12px margin trim is unbuilt. If it is still coming, it should
  land *before* Phase 3 rather than after — otherwise Phase 3's two screens get touched twice.

- **2026-08-25** — **PHASE 3 BUILT on dev.** Two screens, one fold each. No migration.

  **Plan templates** and **Drills** each had two creates competing in the filter row — *New
  template/drill* and *Add from a past season* — while the page header sat empty above them. Both
  now carry **one create in the page header** with the two ways inside it (house rules 4 and 6), and
  on a phone it collapses to the bare `+` in the title-line corner (house rule 3). Plan templates
  keeps **Your tags** in the list row (rule 2 — it manages a vocabulary that outlives the page).

  **⚠ A third stale detail in this plan, found by reading the screen:** §4.5 said Drills' "tag
  control stays with the search row". **Drills has never had a tag control.** Its filter row is now
  the search box alone. That is three sections of §4.4–§4.7 wrong on contact — the pattern is always
  the same, a plan describing a screen it was written before.

  **Shared piece:** `CoachToolbarMenu` gained `variant="primary"` (the lime create geometry, for the
  one create that has a choice inside it) and `collapseOnPhone` (house rule 3, with the label
  surviving as the accessible name). Extended rather than hand-rolled — Schedule's Add Event still
  carries its own copy of this pattern, and folding that into the shared menu is a **Phase 4**
  migration candidate, deliberately not done here on a screen already walked at §88.

  **Rendered sweep:** ✓ no new findings. **Phone tap-floor entries 38 → 38** — the new create clears
  the floor at 361 and 390, and the fold is a net reduction of one control per screen. Two entries
  added at 768 (grandfathered desktop height, reasons written). Two more at 768 are a back-link
  rename from another session (`Development` → `Skills & Goals`), not this change.

  **Checked and clean:** the in-app guides for both screens describe what these controls do but
  never say *where* they are, so nothing was falsified. Empty states keep their own create doors
  untouched (rule 7).

  **Still open before Phase 4:** the two stale house-rule texts (rule 4's "beside the '?'", and the
  scrolled-phone caveat), the guard's two legal header shapes, the Overview exception, and the
  unbuilt 12px margin trim from the title-band plan.

- **2026-08-25** — **`/review` run on Phase 3** (standard tier, 3 lenses: correctness · blast-radius ·
  accessibility/interaction). **No Criticals, no Highs.** Two Lows fixed, one Advisory accepted, one
  pre-existing Medium recorded.

  **⚠ THE FINDING NO LENS WAS LOOKING FOR, AND THE ONE THAT MATTERED MOST: the change broke its own
  UAT probes, and nothing in the deterministic gate could have said so.** Typecheck, lint and the
  rendered sweep were all green while two Playwright specs asserted against buttons that no longer
  exist. Three separate breaks:
  1. `drill-library-layout` clicked *New drill* and expected the drill sheet — it now opens a menu.
  2. `plan-templates-layout`'s `ensureTemplate` helper did the same and expected the editor. That
     helper exists precisely so two rules-holding tests never silently skip, so it failing would
     have taken those with it.
  3. Its empty-state test asserted `/New template/i` **unscoped** — the header now carries a create
     too, so that matches TWO buttons and Playwright's strict mode fails on the ambiguity. Scoped
     to the empty state, which is what that test was always about.
  Both specs gained a shared `openHeaderCreate(page, create, choice)` helper. **A behaviour change
  owns its tests** — and a UI change that folds two controls into one should always be checked
  against name-based selectors before it is called done.

  **Fixed (2 Lows):** the busy guard moved from the menu TRIGGER to the "Start from blank" ITEM —
  disabling the whole menu while a blank template was being created also locked the import route,
  which the two separate buttons never did; **folding two controls into one must not fold their
  disabled states together with them.** And the trigger's label is static again: it used to flip to
  "Starting…", putting a shape-shifting accessible name on something announced as a menu.

  **Accepted (Advisory):** "Start from blank" is now one level deeper for a keyboard user. That is
  the explicit intent of house rule 6, remains fully keyboard-operable, and is the trade the fold
  was approved for.

  **Recorded, PRE-EXISTING, inherited not caused (Medium):** `CoachToolbarMenu` declares
  `role="menu"` / `role="menuitem"` but implements no ARIA menu keyboard pattern — no arrow-key
  roving focus, no Home/End, and Tab can leave an open panel while it stays on screen. Escape and
  outside-click are handled. **This applies equally to the Money hub's Import and Export menus**, so
  it is a portal-wide item rather than a Phase 3 one — a good candidate for Phase 4, which is
  already touching this component.

  **Verified clean:** the two new props are additive — `MoneyImportMenu` is the only pre-existing
  caller and renders byte-identically; the new `.triggerPrimary` is declared AFTER `.trigger` so it
  actually wins (the same cascade-order trap this stylesheet was bitten by twice this week); the
  warm-skin lime block matches `.btnPrimary`'s convention exactly; the empty states' own doors are
  untouched.
