# One Window — Stage 2d build prompt (the money windows that ask twice, the dues windows, the read windows, and the practice page last)

> Paste into a fresh session on `dev`. Written 2026-10-20 by the session that recorded walk B (✅ 30/30) and ran the 2d
> census. **Precondition:** Stage 2c is committed (`cb83e3b6` … `83278609`), walk B passed 2026-10-20 (QA ledger §349); no
> migration, no API. **This prompt continues `ONE_WINDOW_STAGE2C_BUILD_PROMPT.md` and
> `ONE_WINDOW_STAGE2C_PARTS3_7_BUILD_PROMPT.md` — read both first, whole**: what `QuestionShell` and `KitDialog` offer,
> "Learned in parts 1–2", "Parts 5–6 learned", the probe tooling, the commit helpers and the traps all still apply and are
> NOT repeated here.
> **Owner's working rule (unchanged): build part by part, stop after each for the owner's OK and a local commit; never
> push unless the owner says so.** Write to the owner as a product owner (what the coach sees), not in file names.

## Read first, in this order
1. `docs/projects/active/ONE_WINDOW_PLAN.md`: the status header, §3 (Q1–Q16), "Stage 2 gate" (A–D, B1–B9, the census and
   its corrections), "Stage 2a / 2b / 2c — as built". 2d is the "rest" of answer C; the practice page is last.
2. The two 2c prompts above (and `ONE_WINDOW_STAGE2_BUILD_PROMPT.md` for the guards, verify and hand-off sections).
3. `memory/design_decisions.md`, entry "2026-10-19 — ONE WINDOW STAGE 2".
4. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's claim is a lead — open the lines
   before you build on it or tell the owner). **Do not re-read the hub**: walk B went on its own page and the hub is left as
   it stands (owner 2026-10-20). Index-hub ruling 10-19: a walk is its own artifact.

## The list — the guard's ALLOWED map is the authority
`tests/unit/one-window-stage2-guard.test.ts` ALLOWED has 17 entries: **6 stay out** (RoomShell, ScheduleEventSheet,
PracticeGroupsRoom, DepthChartBoard, CoachStaffSheet, the schedule's day list) and **11 are tagged "moves in 2d"**. It
only shrinks. A census (helper, 2026-10-20; the lines below were spot-checked, but **open the lines before you build on
them** — all 17 files are CRLF in HEAD and in the working tree, so edit as CRLF). A = `app/[orgSlug]/coaches/teams/[teamId]`.

### Money, windows that ask twice today (`useDiscardGuard`'s second window → `dirty`, B1)
- **Record money / Add a bill** — `A/accounting/expenses/panel.tsx` (window ~8175, `useDiscardGuard` ~1685). 520, portaled
  into `[data-coach-warm-enabled]` with `createPortal`; two docked in-foot "Confirm delete" questions (~8674, ~8701) and a
  consequence line in the foot for bills; opens from the header Record button AND from a drive room's Record door (so it can
  stand over a room, which stays out); contains `BudgetItemPicker` and `RaisingForField`, so **Categories & items (z400)
  nests over it**. Typed = `touched(form, opened-with)` or the plan rows / payee / tags / branch answers moved. Its
  `UnsavedChangesGuard` route guard stays (like the roster's `leaveGuard`).
- **New club request / Club request / Edit club request** — `A/accounting/club/panel.tsx` (~2201, `useDiscardGuard` ~799).
  520, typed = any field off the opened-with baseline, false when read-only; docked "Confirm withdraw" in the foot (~2515);
  nests `ClubFilingControl` → `BudgetItemPicker` → Categories & items. Route guard stays.
- **Set dues for all players** — `A/accounting/GenerateInstallmentsModal.tsx` (~763, `useDiscardGuard` ~200). 620 today →
  the ladder (put the width to the owner if not obvious: it has a preview TABLE, likely 800). Four levels (form → preview →
  the replace question → success; the preview and the replace question are Back steps, foot "Back" ~1155 and ~924) plus a
  loading view; typed = no result yet and a row has a date or amount. Opens from Budget (`budget/panel.tsx` ~4367) and
  Player dues (`dues/panel.tsx` ~4850). ⚠ The hub keeps hidden tabs mounted — the success state's two `<Link>`s
  (~877, ~1056) do NOT close the window, so after the move a window could stay open over another tab: make each Link
  `onClick={onClose}` (the part-2 rule) and check the window is `open={… && tabActive}` as the budget line's is.
- **The club's "installment sent" window (`SentWindow`, club/panel.tsx ~547)** — asks nothing today (typed = date, how,
  reference); it opens OVER the bill's RoomShell (stays out), so at z400 it stands above the room. B3: it asks as it moves.

### Money, no ask today
- **Season settlement** — `A/accounting/dues/panel.tsx` (~3117, `.modalSettlement`, **900** wide today). B9 ruled: it MOVES
  as an **800 form** ("a statement and one decision, like the club's Close the year"). Summary beside the family-payouts
  table at 760px+ (`.settlementTop`), card-style payouts on a phone. Foot: "Not yet" / "Close" plus "Pay everyone and close
  the season". Its only typed thing is the inline "hold back" field (a settlement that asks? — see owner call 2). `busy` =
  `payAllBusy`. **Set refund opens over it.**
- **Set refund** — dues/panel ~4878 (480 today; three-way pick + optional amount; `busy` = `choiceSaving`). B9 ruled: a
  **question** (`kind="question"`, over the settlement).
- **Send due reminders?** — dues/panel ~5012 (460). Its body door "See what they'll receive" opens the preview OVER it.
  Not named by a B-call: it is a confirm with one door — **put its kind (question vs a small form) to the owner**.
- **Dues reminder emails / What families will receive** — `components/coaches/DuesReminderPreviewModal.tsx` (600 inline,
  read window, no foot, no ask; real-letter states loading / failed / refused; sanitised HTML in a white mock). Opens over the
  reminder confirm, over the dues drawer ("Remind this family" — the drawer stays out) AND from Team settings
  (`settings/page.tsx` ~1055). B5/B6: a read window that moves and fills a phone; **never `dirty`** (the guard already
  asserts a read window has no `dirty=`).
- **The dues player drawer stays out** (its own two `useDiscardGuard`s, dues/panel ~1507 and ~1513 — see owner call 1).

### Read windows
- **The month grid's two figure windows** — `components/coaches/MoneyMonthGrid.tsx` (cell detail ~1256, plan-figure ~1333;
  both 460, `centeredOnMobile`, read-only). B5 (the owner's D): they become **forms that fill a phone**. ⚠ **Also rendered
  by the ADMIN portal** (`app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx` ~359, club mode): the move must work in
  both — `QuestionShell` is coach-only, so check which wrapper serves the admin side (or use `KitDialog` directly there),
  and say so. Detail-foot `<Link>`s do not close the window (~1318) while plan-line Links do (~1409, ~1450): keep each's
  behaviour; do not "tidy" them. The admin copy is not reachable on the UAT team: report it as checked in code and guards.
- **Subscribe in your calendar app** — `components/coaches/CalendarSubscribeWindow.tsx`. The guard sees only the DESKTOP
  `DeskWindow` (~177, 520, `trap`, `centeredOnMobile`); the phone branch is a `SheetFrame` (~136), not a `.modalOverlay`.
  No foot, no ask, doors are `<a>` tags (external / `webcal://`, no router). "Reset the link" asks via `useConfirm` (z1000,
  stands over — leave it). It opens only from the Schedule page's Export button — the 2c part-3 probe already measured
  that hand-off (Export → this window, which stays open). B5: fills a phone — decide whether the `SheetFrame` branch goes
  too; measure the phone before deciding.

### The practice page — last (answer C)
- **Drill sheet** (`components/coaches/DrillSheet.tsx`, B4: moves as a form **and asks**; 640 `modalWide` +
  `ppStationModal`; the name is an input IN the head, so `CoachModalHeader`'s custom title needs an answer in the shell;
  foot = Retire / Restore (a write) + Cancel + Save, `saveNote`; a club drill opens read-only). Opens from the Drills tab
  (`_DrillsView.tsx` ~347, which already tracks `editing.touched`) AND from the docked "+ New drill" in the plan editor
  (`_PracticePlanEditor.tsx` ~5074 — **no dirty flag there: add one**). × and Cancel drop edits today.
- **Start this plan from…** (`practice/[eventId]/page.tsx` ~1595) and **Groups from another practice**
  (`_PracticePlanEditor.tsx` ~1650): list pickers, B9 ruled forms that fill a phone, **they never ask** (like part 5's).
  Groups from another practice opens over the Groups room (stays out).
- **Save as template** (`page.tsx` ~1737; name pre-filled; two views — the form and `SaveOverQuestion` "Replace X?", a real
  Back step via `useBackStep` ~1715) and **Save to my drills / circuits** (`PromoteDialog`, `_PracticePlanEditor.tsx` ~2132;
  name + tag picker + a Back-stepped "Update X?" question ~2104). No ask today: B3 — ask as they move, but only once a
  field is changed from its pre-fill (a pre-filled name alone is not typed words — say how you measured it).
- **Send to staff** (`_PracticeSendSheet.tsx` ~172; choices only: a radio, a checklist, "Also email"; foot "Send to N";
  <520). Typed = choices only, so it probably never asks — decide and say so.
- **The drill picker** (~1733: "Add a block" / "Add a station" / "Start from a drill" / "Swap this drill", with tabs) and
  **Choose players** (~4936, a pick list): list pickers that open OVER the station and block sheets, which STAY OUT (z200
  hand-built on a computer, 400 at ≤900px). A moved picker at 400 stands above them — **measure that, on a computer and a
  phone; it is the practice page's one real layering risk.**
- **Stay out (do not touch):** the station sheet (~843, with its Prev/Next walk and the drill-picker door), the block sheet
  (~2463), the docked `LibraryPanel` and the DragOverlay portals.
- **Reachability on the UAT team (judged from code gating — verify with a probe):** reachable now — Record money, New club
  request (the Club tab shows because the team is org-linked), Set dues for all players, the reminder confirm + preview
  (toolbar, and Team settings "See an example"), calendar subscribe, the Drills tab sheet + drill picker, Save as template,
  Choose players, the Season settlement door. **Needs data** — Set refund (a family must be owed money), the per-family
  preview (an unpaid installment), `SentWindow` (a club-allocated installment), Send to staff (more than one staff person),
  Groups from another practice (another practice with groups), Start this plan from… (the layout spec seeds a template), the
  month grid's cell windows (budget lines + actuals). **Make a dev-only fixture with a probe script and remove it after**
  (the part-6 pattern: `tryout-fixture.mjs` / `tryout-candidate.mjs`); otherwise report "checked in code".

## The build order (most dangerous first — a stray tap drops typed money work)
1. **Record money** alone (the heaviest: portal, two docked confirms, nested Categories & items, two openers, a route guard).
2. **New club request + the "installment sent" window** (same file; the second stands over a room).
3. **Set dues for all players** (four levels, a preview table, Back steps, hidden-tab Links).
4. **The dues windows:** Season settlement + Set refund together (one nests over the other), then Send due reminders and
   the reminder preview (it stands over three different openers).
5. **The read windows:** the month grid's two (both portals), calendar subscribe.
6. **The practice page, last:** Drill sheet, Save as template + Save to my drills, the list pickers (Start this plan from…,
   Groups from another practice, the drill picker, Choose players), Send to staff. Measure the layering over the sheets that
   stay out.

For each part: move onto `QuestionShell` (`kind="question"` for a question; `widest` for an 800; `raised` when it stands
over a window that stays; `footerStart` for a door or a sentence; submits via `<form id>` + `form=`; refusals →
`QuestionReason`); delete the window's `useDiscardGuard`, `useOverlayOpen`, `useDialogFloor` and its module-CSS window
shape; **take the file off ALLOWED and add a test to the guard's "2d" describe** (the list only shrinks — never loosen);
update every finder that found the window by `.modalOverlay` or the old words (below); measure before/after with
`.probe/ow2/measure.mjs` (extend `openers.mjs`; call `tagOldModal(p)` for the hand-built ones — they carry no
`role="dialog"`) at 390 and 1280; screenshots; write the part's `behave-2d<n>.mjs` (Tab stays in, Esc and the phone's Back
close only the top window, a tap outside does nothing, the ask appears in the foot only when something is typed, Back steps
keep working).

## Tests and copy that will break on the move (fix as each window leaves)
- `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` ~687: taps `[class*="modalOverlay"]` then expects "discard this
  expense" + "keep editing" on Record money. **A tap outside now does nothing** — rewrite it to press Esc or × and expect the
  one ask sentence ("Close without saving? What you typed won't be kept." · Keep writing · Discard). Also mentions Record
  money at ~542 and ~681 (comments).
- Role-dialog finders for "Record money": `coach-bill-room.spec.ts` ~269, `coach-fundraising-rooms.spec.ts` ~137 and ~279;
  `plan-templates-layout.spec.ts` ~241–247 (Start this plan from… by button name, tabs "A template" / "A previous practice").
- Unit guards that pin these windows' source (expect to update each): `coach-practice-plans-phone-guard` (~532 pins
  `<CoachModalHeader title="Send to staff"`, ~544 `:not(.modalOverlay)`), `coach-practice-week-phone-guard`,
  `practice-vocabulary-guard`, `practice-save-over-guard`, `bva-figure-doors-guard`, `month-grid-reconcile-guard`,
  `club-stage3a/3b/3c-screens-guard`, `dues-installment-view.test.ts`, `install-banner-layer-guard`, `admin-overlay-guard`.
  Not 2d's (key on windows that stay out): `coach-schedule-phone-guard` ~81/87/253, `coach-schedule-sheet-guard` ~72/94.
- `coach-fundraising-rooms.spec.ts` ~258–259 ("Discard this change to the credit split?" / "Keep editing") is a `useConfirm`
  on the fundraisers panel — Stage 3's, NOT 2d's. Leave it.

## ⚠ The words "Keep editing" outlive 2d — correction to the plan, and an owner call
The plan's /docs note says "five `useDiscardGuard` second windows remain … the two help answers change once, when 2d moves
them". **That count included the dues player drawer, which the guard's ALLOWED tags as staying out.** After 2d the old words
and the second window survive in: the dues drawer's two (`dues/panel.tsx` ~1507 and ~1513), `CoachStaffSheet` (~340),
`RepAnnouncementEditor` (~136) and `ScheduleEventSheet` (~445) (both `useConfirm`), the fundraisers credit-split confirm
(~436/439, Stage 3), and `useDiscardGuard`'s own default words (`useDiscardGuard.ts` ~41 "Discard this {noun}?", ~46 "Keep
editing"). Help quotes them in `lib/help-content/coaches.tsx` ~1866 (Money forms: "Every Money form asks before discarding"),
~2715–2716 and ~2719 (`answerText`). So **/docs after 2d cannot say "every Money form asks the new way"** unless the owner
rules the drawer and staff sheet in (owner call 1).

## Open owner calls (ask once, at a natural stop; do not block on them)
1. **The dues player drawer and the staff sheet stay out, but they keep the old "Keep editing" second window.** Give them
   the one in-foot ask (a small fix; the plan already offered it for the drawer's inline payment form, which `drawerFormDirty`
   does not count), or leave the old words there and write the help around it?
2. **Does the season settlement ask?** Its only typed thing is the "hold back" field. Ask on a typed hold-back only, or never?
3. **Send due reminders? — a question or a small form?** It is a confirm with a door to a preview.
4. **Widths off the ladder:** Set dues for all players 620, the settlement 900 (ruled 800), the reminder preview 600, the
   month grid's windows 460 — each takes 520 / 640 / 800; put any that is not obvious on the stage's walk.
5. Carried from 2c, still open and low: the For dropdown fix is done; an extra Back press after Start next season navigates
   the page (recorded, not fixed); the tryout fields 38–41 on a computer were folded into the 36 element rule (done); the
   scorecard's 24 under-44 body controls on a phone are reported, not fixed.

## Close-out after the last part (the 2c close-out is the pattern)
- `/simplify` then `/review`, each scoped to 2d's files (the working copy holds other sessions' edits). Offer them once, at
  the end, per CLAUDE.md.
- The plan's "Stage 2d — as built" (before/after table, calls, skips with reasons, the facts per part), the PM brief's line,
  the TODO line, the QA ledger's next free § (**§349 was the last at this prompt — re-check**), auto-memory
  `project_one_window.md` + its `MEMORY.md` line.
- **Walk C as its OWN page** (`ONE_WINDOW_STAGE2D_WALK.html`, a checkable Artifact with paste-back; one purpose per walk;
  Parts by area: money · dues · read windows · practice · phone · Dark · optional-with-setup). Name each window's opener
  path. The walk needs data several windows lack on the UAT team (Set refund, the per-family preview, the installment-sent
  window, Send to staff, Groups from another practice): say so in the setup line, or have the walk create it and remove it
  at paste-back (walk B's pattern — the Part D walk-up was removed from dev at paste-back).
- `/docs` once 2d is in (see the correction above); demo tours point at screens, the build's demo-anchor check covers them.
- Records (plan, ledger, TODO, memory) are committed on the owner's OK, never pushed.

## Verify
`npm run verify:changed`, `npm run typecheck` (shared components change), `check:layout --changed` on the touched screens (the
whole-product sweep runs on staging). **Known failures, not 2d's:** two (`coach-semantic-ink` `.occGroupPermit`;
`club-stage6c-screens-guard`'s admin-rail scrollbar) — re-check before blaming a change; `check-schema-parity` fails on mig
338 (dev only, due at the promote) and `check-css-selectors` on `GuidanceRail.module.css`. A memory-floor abort on
`check:layout` is a skip to report, never a floor to lower. Restart the dev server near hand-off (files added/deleted).
