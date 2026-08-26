# Build prompt — Page-level action consistency, PHASE 4

**Plan:** `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` — read **§0 (the four
house rules)** and the **2026-08-24/25 log entries** before anything else. Phases 1–3 are built and
committed; this is the last phase.

**Read this whole file before writing code.** It exists because §4.4–§4.7 of that plan were wrong
about three of their four screens, and the reason was always the same: the plan described a screen
someone had rebuilt since.

---

## ⚠⚠ THE ONE RULE THIS PHASE IS BUILT ON

**Argue from what the code does, never from what the plan says it does.** In this project that is
not a platitude — it has a scoreboard:

| Plan said | Screen actually was |
|---|---|
| §4.6 "Give an award moves to the page header" | Awards is a hub PANEL with no page header, already correct — building it would have moved a working button to the wrong place |
| §4.7 "the setup ring is a state display, not an action" | It is a button that opens a checklist, and a *different* plan had already ruled it stays |
| §4.5 "the tag control stays with the search row" | Drills has never had a tag control |

**Open every screen you are about to touch. If this prompt and the screen disagree, the screen
wins, and you say so in the plan log.**

---

## Why Phase 4 exists

Three phases have shipped and **nothing enforces any of them.** The twelve rules and the four house
rules are conventions, and this repo's own history says conventions drift: the inventory that
started this project found the same header drawn four different ways across ten screens, Import
under four names at three weights, and one create drawn lime on two tabs and outlined on two others
— all inside one hub.

Phase 4's job is to make the rules **fail a build** instead of relying on the next contributor
having read a document.

---

## Scope — and a recommendation to split it

Phase 4 has accumulated six things. They are not one unit of work, and shipping them as one would
make a large diff across ~40 screens whose failures are hard to attribute.

**Recommended split:**

### 4a — Make the rules enforceable and true *(do this first)*
1. **The guard** (see the design question below).
2. **The two carve-outs**, written down as named exceptions rather than silent branches.
3. **Correct the two stale house-rule texts** (below).
4. **Remove the transitional `.recordMoneyBtn` alias** — but ONLY once the Money hub's in-flight
   work has landed; check before touching it, and leave it if that file is still modified.

### 4b — One menu, properly operable *(separate unit)*
5. **Migrate Schedule's Add Event** to the shared `CoachToolbarMenu` — it hand-rolls the same
   "create with a choice inside" pattern Phase 3 put in the shared component.
6. **Give the shared menu a real ARIA menu keyboard pattern** — arrow keys, Home/End, and focus
   containment. It declares `role="menu"`/`role="menuitem"` today but only wires Escape and
   outside-click. ⚠ **This is portal-wide, not a Phase 3 leftover** — the Money hub's Import and
   Export menus inherit the same gap, so this change touches money screens and needs their QA.

### Rides with whichever unit touches a given screen
7. **Sweep the remaining hand-written header button sizing** (plan §2.6 — the drift vector: inline
   `fontSize` / `padding` on header buttons instead of the shared geometry classes).

---

## ⚠ THE GUARD'S DESIGN QUESTION — decide this before writing it

Plan §6 says: *"A unit test pins, per screen, the number and kind of header actions."* **That
sentence is easier to write than to build, and the difficulty is not incidental.**

The idiom it points at (`tests/unit/coach-history-endpoint-guard.test.ts`) is a **filesystem source
scan** — read the files, regex for a pattern, assert against an enumerated allow-list. That works
beautifully for `searchParams.get('year')`, which is a literal. It works badly for header actions,
because almost every screen passes them as a **variable** (`actions={rosterHeaderActions}`), so a
scan that tried to count buttons would have to follow the reference — and that guard file's own
header carries the warning about exactly this failure mode: *"a delegated handler it cannot follow
fails here rather than passing vacuously"* (the lesson that cost nine tag routes their coverage).

**Recommendation — split the contract by what each mechanism can actually see:**

- **Source scan pins the ENUMERATION**, which is all literals and therefore reliable: which screens
  render a page header at all, which of them pass `actions`, and which phone flags they pass
  (`actionsPhoneInTitleRow`, `actionsPhoneHidden`). Adding a header action to a screen that had
  none, or changing a screen's phone behaviour, then fails the build — which is the decision point
  the plan actually wants.
- **The rendered sweep keeps owning GEOMETRY and COUNT.** `check:layout` already reads real controls
  by accessible name at each width — it is the only thing that sees the truth, and it caught two
  header defects that every file-reading gate passed.

⚠ **If you build the count-by-regex version anyway, prove it cannot go blind** — add a deliberate
violation, watch it fail, then remove it. A guard that passes vacuously is worse than no guard,
because it reports green while checking nothing.

**The measurement behind that recommendation (2026-08-25):** 35 screens render a page header;
**11 pass `actions`**. Of those 11, **6 pass a reference** — five a file-local const
(`rosterHeaderActions`, `scheduleHeaderActions`, `headerActions`, `expenseHeaderActions`,
`headerCreate`) and one a function call (`renderSetupChip()`) — and 5 pass inline conditional JSX.
**A regex that counted buttons would go blind on more than half the screens that have any.** The
consts are all file-local, so a scan CAN resolve them within one file; a scan that does not must say
so out loud rather than reporting green.

---

## ⚠ EXACTLY WHICH RULES BECOME ENFORCEABLE — say this plainly, do not oversell it

There are sixteen rules (§3's twelve plus §0's four). **Most are judgement and no machine will ever
check them.** Do not write a guard that implies otherwise, and do not let the plan keep claiming it
"pins the number and kind of header actions" — that sentence is why this section exists.

**A — Enforceable by source scan (all literals; build this):**
1. **The enumeration** — which of the 35 screens may pass header actions at all. 11 today. A 12th
   fails the build until someone edits the list. *This is the decision point the whole guard is for.*
2. **Each screen's declared phone behaviour** — `actionsPhoneInTitleRow` / `actionsPhoneHidden`.
   Changing how a header behaves on a phone stops being something that can happen quietly.
3. **House rule 2 — no export control inside a page header.** The load-bearing one, and the reason
   this project has a §0 at all. Every actions const is file-local, so this resolves reliably.
4. **The Overview carve-out** — enumerated as the one screen passing a non-create, with its reason.

**B — Enforceable only by the rendered check (`check:layout`), which already reads real controls:**
5. §3 rule 9's cap of **two controls plus the create** per header.
6. House rule 4's phone shape — **title · symbol** and nothing else.
7. The 44px tap floor (already enforced; keep it).

**C — CANDIDATE, and it would have caught a real shipped defect:** §3 rule 7, *"nothing hides"*.
Roster's entire action group was gated on `view === 'list'` and vanished in the depth chart — a
defect that survived until Phase 2. A scan could flag an `actions` expression gated on a view/tab/
mode variable. Fuzzier than A1–A4, so treat it as a stretch goal and drop it rather than ship
something that half-works.

**D — NOT enforceable by anything, and the guard must not pretend otherwise:** verbs only (rule 1),
nearest label wins (rule 2), one name one weight (rule 5), one verb one button (rule 6), phones get
outputs not files (rule 11 — its empty-state condition needs a rendered EMPTY fixture, which the
seeded one is not), a contextual export stays with its context (rule 12). **These stay human
review.** Say so in the guard's own header comment, the way the history guard states its scope
limits — an unstated limit reads as coverage.

---

## The two carve-outs the guard MUST handle knowingly

1. **Two legal header shapes.** Since 2026-08-25 the team masthead hosts the help "?" for pages
   inside the team layout, and those page headers render none. Pages **outside** it — the
   team-picker hub, notifications, the portal-level shells, and the team layout's own no-auth early
   return — still draw their own as the default fallback. **A guard that pins one shape fails the
   other.** See `components/coaches/CoachPageHelpSlot.tsx`.
2. **Overview's actions slot holds a status door, on purpose.** The season-setup chip is a button
   that opens a checklist, it lives in the actions slot, and it is **ruled** (`COACH_PAGE_TITLE_BAND_PLAN.md`
   §2, owner-approved). So the slot deliberately means a create on 29 screens and a status door on
   one. ⚠ Write it as a **named exception with its reason**, the way the Money hub's button ordering
   is — never a silent `if`.

---

## The two stale rule texts to correct (plan §0)

Both are worded around a "?" that is no longer in the page header:

1. House rule 4 says *"the create sits in the page header beside the '?'"* and *"net phone header:
   title · symbol · '?'"*. Inside a team it is now **title · symbol**.
2. *"One findable home"* is true at the top of the page but **not while scrolled** — the masthead's
   right slot folds with `.teamHeaderCollapsed` at ≤900px, so a scrolled phone loses the "?" as it
   loses the flip and the season. That is ruled and accepted; it is the caveat on a rule that
   promised a findable corner, and it belongs in the text rather than in someone's memory.

---

## Hazards, stated so they are not discovered

- **This working copy is shared and other sessions are active in coach files.** Before committing,
  check whether a file you touched carries someone else's in-flight work — `app/[orgSlug]/coaches/
  coaches.module.css` and `OWNER_QA_LEDGER.md` are common ground, and the Money hub page, the PDF
  export module and the schedule page were all mid-edit on 2026-08-25. Stage explicit pathspecs;
  bracket directories need `:(literal)` or they match nothing. Verify with `git show --stat HEAD`.
- **The 12px title-band margin trim is approved and UNBUILT** (`COACH_PAGE_TITLE_BAND_PLAN.md`
  option 1, the half that did not ship with the help move). It changes a margin, not header
  contents, so it does not invalidate the guard — but if it lands mid-phase, re-run the sweep.
- **Cascade order decides same-specificity CSS in this stylesheet, and it has bitten three times
  this week.** A modifier written near the feature it serves instead of beside the class it
  overrides is a silent no-op. Put modifiers **after** their base and say why in a comment.
- **Collapsing a surface blinds the rendered sweep.** It cannot measure inside a closed `<details>`.
  If this phase folds anything, fix what is inside first and verify by forcing it open for one
  sweep.

---

## Verification — non-negotiable

- `npm run verify:changed`; `npm run typecheck` (shared modules move here).
- **`npm run check:layout` — and for a shared-chrome diff that means the WHOLE list, not `--changed`.**
  Budget 3–5 minutes. An aborted sweep is a failure, not a pass.
- **Tap-target baseline must not gain sub-44px entries.** Report the before/after count in the plan
  log — Phases 2 and 3 removed 26 and added none, and that number is the project's honest scorecard.
- **⚠ CHECK THE UAT SPECS.** Phase 3's real finding was that the change broke its own probes while
  typecheck, lint and the sweep all stayed green — two specs clicked a button that had become a
  menu, and an assertion went ambiguous once a header gained a create. `tests/uat/scenarios/` finds
  things **by accessible name**; any change that renames, folds or relocates a control can break
  them invisibly. **A behaviour change owns its tests.**
- **Help + demos:** `/docs` if a named control moves (three guides named moved buttons in Phase 2),
  and check the coach demo's tour narration.
- **Then `/review`** — the guard is a shared-module change with portal-wide reach.

---

## Definition of done

- Adding a third button to any coach page header, or putting a non-action in the actions slot, fails
  the build with a message naming the rule and where to record the decision.
- The two carve-outs are enumerated with their reasons, not branched around.
- §0's rule texts are true of the product as it now is.
- The plan log records what the screens actually turned out to be, including anywhere this prompt
  was wrong.
- A QA section in `OWNER_QA_LEDGER.md` written for a coach walking screens, not for an engineer.
