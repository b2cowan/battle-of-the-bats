# Coach Portal — Page-Level Action Consistency

**Status:** approved design · **Phase 1 (Money hub) BUILT on dev 2026-08-13**, owner QA pending
(`OWNER_QA_LEDGER.md`); Phases 2–4 not started · owner-approved 2026-08-13
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

### 4.6 Awards

- **"Give an award" → header** (rule 1), as the lime primary.
- **"Manage award types" → the list toolbar** (rule 2) — a library that outlives this page.
- **"Print N certificates" stays in the body beside the award-type filter** (rule 12) — its content
  depends on the selection. As a PDF output it survives on a phone.

### 4.7 Overview

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
