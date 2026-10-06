# Sheet Frame — plan

**Status:** D1–D6 accepted 2026-10-05 (owner: "I agree with all of your recommendations"). Hub (Mockup · Decisions ·
PM Brief · Plan notes): https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc, source `docs/projects/active/SHEET_FRAME_HUB.html`,
frames and measured facts in `sheet-frame/` (`facts.json`). PM brief `SHEET_FRAME_PM_BRIEF.md`. Build prompt
`SHEET_FRAME_BUILD_PROMPT.md` (one step per chat). Ruling recorded in `memory/design_decisions.md` (2026-10-05).
**Step 1 built 2026-10-05, committed `9ab32b23`; ✅ owner QA §264 PASSED 9/9 2026-10-05** (see *Build record*).
**Step 2 built 2026-10-05, committed `91986b7c`; ✅ owner QA §266 PASSED 17/17 2026-10-06** (see *Build record*).
**Step 3 built 2026-10-06, committed `5d036eeb`; ✅ owner QA §268 PASSED 19/19 2026-10-06** (see *Build record*).
**Step 4 built 2026-10-06; owner QA §273** (see *Build record*). Step 5 to build.

## The rulings

| # | Ruling |
|---|---|
| D1 | Two layers sorted by one test — **"would a stray tap on the bar lose something?"** No → MENU layer: on top of the bar, bar live, NOT modal (includes sheets that stay open but save each tap: Ledger Filter, game-day Who's here). Yes → FORM layer: covers the bar, bar out of reach of thumb + keyboard + screen reader (`useOverlayOpen`), a 44px × required, the keyboard stays inside (`useDialogFloor`), modal (the game-day Note joins). |
| D2 | Three heads: a small-capitals LABEL for a menu (the E1 `drawerTitle`); a sentence TITLE + 44px × for a form (`LineupDrawerHead`; a tall menu may keep a ×); a RECORD head (name + context line) for a sheet about one record. |
| D3 | Kept on purpose: the two layers; record heads (position, RSVP, player row); More's tiles and colour; Copy from filling the screen ≤640 (2026-10-02 D7); RSVP stacked over the event window; the Award sheet switching layer while editing; no Done on the Ledger Filter sheet. Everything else in the inventory is drift and moves. |
| D4 | The club admin's `BottomSheet` stays its own component; when its screens are next touched it takes 18px corners and the portal dim. Done-or-not on a filter sheet is its own ruling (the tournament Teams filter has Done; the Ledger's was ruled without). |
| D5 | The Schedule's view menu and Add event become drawers on a phone. |
| D6 | Five steps, each its own build and walk; the lineup builder last. |

## Shared by every sheet in the frame

Full width; 18px top corners; the grab line (38×4); the portal dim (warm `rgba(36,30,21,.28)` / dark
`rgba(13,17,26,.45)`, the scrim rendered INSIDE the dismiss boundary); the card surface; a height cap (menu: up to the
bar − 12px; form: screen − 12px); the sheet scrolls with `overscroll-behavior: contain`; Escape and a tap on the dim
close it; focus returns to what opened it (or the nearest surviving opener, e.g. Tools for Copy from). Rendered
in-tree so it inherits `--coach-foot-clear` — never hand-copy the bar's height. z: menu 260 under the bar's 300;
form 390 over the bar, under `.modalOverlay` 400.

## The steps

1. **Promote the frame from the Tools drawer.** One shared frame (component + class) from
   `CoachToolbarMenu.module.css` `.drawer` / `.drawerTitle` and `LineupSheetScrim`; every `drawerOnPhone` caller
   (Ledger, Budget, practice, the club Ledger, tournament Teams) and `FilterGroup`'s sheet move onto it. The Filter
   sheet drops `aria-modal` (menu layer). **Nothing visible changes** — verify with before/after captures.
2. **The small menus.** Team and player switchers: their mono section label becomes the menu label (in dark their
   surface is the bar's colour, inherited from the More sheet — take the card surface). Print: the label "Print" and a
   role. The Schedule's view menu and Add event: `drawerOnPhone` with titles "View" / "Add event" (D5). Drawn on the hub.
3. **Game day.** `.gdSheet` at ≤900: Note becomes a FORM (covers the bar, `useOverlayOpen`, the keyboard inside);
   Who's here stays a MENU; both take the portal dim (warm remap), the frame's height cap (Who's here grows from 72dvh;
   the owner may ask to keep 72%), contained scrolling, and `--coach-foot-clear` instead of the hand-copied
   `calc(var(--bottom-nav-height, 72px) + env(safe-area-inset-bottom))`. The Score, Scouting and End-game sheets are
   sorted by the same test in the step's plan. The substitution confirm stays a card. Its own owner walk.
4. **The record sheets.** Position picker, RSVP, player row menu, notification reader, Award sheet onto the frame,
   looking unchanged; the position picker drops `aria-modal` (menu layer); the Award sheet keeps switching layer.
   **Built 2026-10-06** — with what the code said that this line did not: RSVP is a FORM over its window (the frame's
   third place, `overWindow`); the frame owns a record sheet's keys in the menu layer, without the trap (owner
   ruling 2026-10-06); the frame took its own dim; the profile's and the depth chart's row menus came too; the Schedule
   day list is not a phone sheet (below).
5. **The lineup builder's drawers — last.** Setup, Save as template, Call up, Copy from, Print's geometry: one frame
   with the rest. Call up takes the shared form head (`LineupDrawerHead`) instead of its own `<h3>`; the three forms
   keep the keyboard inside (`useDialogFloor` — it also calls `useBackStep`, so the §219 back-step guard moves with it;
   the open half recorded with the 2026-09-23 ruling); Copy from returns focus to Tools (**done in step 2** for Escape —
   the three Tools panels share one Escape line; step 5 checks Copy from's own × and pick).

**Out of the frame:** full-screen windows (`RoomShell` rooms, `ScheduleEventSheet`, `TagManagerDrawer`,
`HelpDrawer`); the More sheet's own container; the club admin's `BottomSheet` (D4). **The Schedule day list**
(`.daySheetOverlay`, a month cell's "+N more") **is not a phone sheet**: since 2026-09-21 the phone's month view is
dots plus the chosen day's rows, with no "+N more", so the list opens only at 641px and wider, as a centred card
(found opening it in step 4 with four probe events on one day; its ≤640 rules are dead code). Its tablet defects are
reported in step 4's build record, with a recommendation.

## Guards that pin today's sheets (keep them green or move their assertions with the step)

`tests/unit/coach-lineup-phone-guard.test.ts` (the two drawer layers both ways, scrim call-site counts per file, the
Tools `drawerOnPhone drawerTitle="Tools"` signature), `ledger-parity-screens-guard` (Tools drawers on every Ledger
screen), `coach-practice-week-phone-guard` + `practice-vocabulary-guard` (the practice "⋯" is a drawer, not a card),
`ledger-phone-filter-guard`, `coach-first-screen-guard` + `coach-people-phone-guard` (reference `sheetScrim`).
A new `tests/unit/sheet-frame-guard.test.ts` grows with each step: the layer each sheet is in, one dim, one height
rule, no hand-copied bar height, `aria-modal` only on the form layer.

## Defects found while drawing (2026-10-03) and where they close

| Defect | Step |
|---|---|
| Game-day Note is a form above a live bar | 3 (built) |
| Game-day dim is the dark one on warm; the bar height copied by hand | 3 (built) |
| Game-day dim OUTSIDE the dismiss boundary: under touch a tap on it closed Note, Scouting or End game AND pressed what it covered — over the console's ← it left the game (4–5 of 6 sheets at 390) — found capturing step 3 | 3 (built) |
| End game holds a corrected score above a live bar; Scouting's observation box likewise — sorted by D1 in step 3, owner 2026-10-06 | 3 (built) |
| Filter sheet and position picker `aria-modal` while the bar is live | 1 (Filter: built), 4 (built — the Award sheet while read and the reader too) |
| A tap on More with the position picker or the Award sheet open opened More on top, the sheet still open beneath (the reader's 09-25 /review fix had reached only the reader) — found capturing step 4 | 4 (built — the frame closes a record sheet on a tap on the bar) |
| The Schedule day list on a tablet: no Escape, Back leaves the Schedule, focus never enters, a tap on its dim falls through (over the team name it opened the switcher) — found in step 4 | reported — not a phone sheet; a follow-up (owner's call) |
| Tools, Filter and the two switchers stand no back step: Back with one open on a phone leaves the page (by the code) — found in step 4 | 5 |
| Print has no title and no role | 2 (built) |
| Three builder forms let the keyboard out (2026-09-23 open half) | 5 |
| Escape leaves focus nowhere: Copy from, tag manager, admin sheet | 2 (Copy from, built — one Escape line serves the three Tools panels); the other two are out of the frame — report |
| Switchers and Print: a tap on the dim leaves focus nowhere — found capturing step 2 | 2 (built) |
| A menu of choices (Schedule view menu, practice library Sort) answers no arrow key and leaves focus on its trigger — found capturing step 2 | 2 (built) |
| Help's × is 30px on a phone | out of the frame — report to Help's owner |
| Club Ledger Tools + Filter and Allocations Filter hang under their toolbar, no dim (the admin never declared `--coach-foot-clear`) — found capturing step 1 | 1 (built) |
| Filter sheet: a tap on the dim leaves focus nowhere — found capturing step 1 | 1 (built) |
| Game-day button row (Who's here · Note · Scouting · End game) is 358px of 390 (the shell's 16px gutters) and, scrolled to the end, sits 32px off the nav (it is `.stickyActionBar` in the page column, so it falls back into flow above `main`'s 32px bottom padding); same 32px at 768 — found by the owner in the §268 walk 2026-10-06, not step 3's change | follow-up — drawn 2026-10-06 (hub Mockup › 7), ruled as drawn the same day (D7 docked on a phone and tablet, D8 a computer unchanged) and built; owner QA §269 ✅ PASSED 6/6 2026-10-06 (Build record → *Follow-up*) |

## Verification per step

Capture every sheet the step touches at 390 (touch), warm and dark, before and after (`.probe/fc/sheets.mjs` measures
corners, layer, dim, height, role, `aria-modal`, Escape and focus); focused lint; `npm run typecheck` (shared
components); the guards above; `npm run verify:changed`; an owner QA walk per visible step.

## Build record

### Step 1 — the frame promoted (built on dev 2026-10-05; owner QA §264)

**Before building.** The build prompt said step 1 waits for One control height (uncommitted edits in
`CoachToolbarMenu.module.css`). The owner chose to commit it first: committed `d9302f6f` (its 22 files only; the
call-ups session's three files left alone), hash recorded `0f927de5`. The dev server's render workers had died
mid-session ("Jest worker encountered 2 child process exceptions"); stopped, `.next` cleared, restarted.

**Found while capturing, fixed in the step (owner: "Fix it in step 1").** On the club's Ledger (Tools, Filter) and
Allocations (Coming due → Filter) the sheets hung under their toolbar with no dim — live since 2026-10-02. Cause: the
frame places itself at `--coach-foot-clear`, which `.coachesShell` declares and tournament Teams declares for itself
(`teams-admin.module.css`), but no club page did; the declaration was invalid, so `bottom` fell back to `auto` (the
sheet's static position) and the scrim's height to zero. Fix: `.adminShell` declares the token at ≤900 — the admin
bar (it wears the coach bar's stylesheet, so `--bottom-nav-height`), the context strip, the home indicator. Teams'
own declaration is now redundant (same value); left for whoever next edits that file.

**Built.**
- `components/coaches/SheetFrame.tsx` + `SheetFrame.module.css`: the portal dim (`LineupSheetScrim`) and the sheet,
  rendered together; the props omit `aria-modal`, `className` and `style`. `.sheet` carries the whole surface
  (geometry + `.panel`'s background, border, `overflow-wrap`) because a sheet wearing `.panel` + a class from a second
  module would be decided by bundle order. Belted at ≤900 (the bar's breakpoint); callers decide when (both
  consumers: ≤640, `useIsPhone`). `.label` is the menu head (D2). Menu layer only — the form layer joins in step 3.
- `CoachToolbarMenu`: drawer mode renders `<SheetFrame ref={panelRef} label={drawerTitle} …>`; the popover keeps
  `.panel` + its measured style; one `pickCloses` handler for both. The `.drawer` / `.drawer::before` /
  `.drawerTitle` block left `CoachToolbarMenu.module.css` (a pointer comment stays). No caller changed.
- `FilterGroup`: `<SheetFrame ref={sheetRef} label={FILTER} role="dialog" …>`, no `aria-modal` (this reverses the
  2026-10-02 /review fix, whose premise "every dimmed sheet in the portal is modal" the inventory measured false —
  and the sheet has no close button to leave a modal by); a tap on the dim now calls `rescueFocusTo(triggerRef)`
  (focus went to `<body>`).
- Not moved, on purpose: `LineupSheetScrim` keeps its name and its home in `coaches.module.css` (`.lineupSheetScrim`
  and `.lineupDrawerOverNav` are compounded with builder selectors and counted per file by
  `coach-lineup-phone-guard`) — renaming/moving it is step 5's, with the builder.

**Proved.** `.probe/sf1/capture.mjs` + `diff.mjs`, ten sheets at 390 touch, warm and dark (coach Ledger Tools +
Filter, lineup Tools, Budget ⋯, practice ⋯, practice Groups, club Ledger Tools + Filter, Allocations Filter,
tournament Teams Tools): the seven coach and tournament sheets **pixel-identical, every node's computed style
identical**; the only differences the Filter sheet's `aria-modal` (gone) and its dim tap's focus (nothing → Filter).
The club's three moved as one block onto the bar (every row by the same offset), the height cap now applies, the dim
appears; nothing restyled (the leftover pixel differences are text anti-aliasing at the new sub-pixel offset). Groups
opens inside the block editor (a form over the bar), so it sits at the bar's height above the editor's pager —
unchanged, and correct for a menu.

**Checks.** `tests/unit/sheet-frame-guard.test.ts` (new: one place for the frame, the dim inside the dismiss boundary,
the frame worn alone, focus back on a dim tap, no `aria-modal` in the menu layer, both shells declare the bar);
`ledger-phone-filter-guard` and `coach-practice-week-phone-guard` moved their assertions; every guard in *Guards that
pin today's sheets* green (260 tests). `npm run typecheck` clean; focused lint clean; `npm run verify:changed`
exit 0 (5,598 tests).

**Owner QA §264 ✅ PASSED 2026-10-05, 9/9** — hub tab QA Walk: W1 the club's sheets rise from the bar (6/6) · W2 the
coach's sheets did not change (3/3). Writes nothing.

**/simplify (four lenses) and /review (standard tier; correctness + blast-radius lenses), 2026-10-05.** Applied:
- Teams' own `--coach-foot-clear` declaration deleted (the shell's is the one home; its comment had become false) and
  its `.bulkDock` reads the token instead of hand-writing the same sum.
- `CoachToolbarMenu`: one `dismiss` (close + focus net) for the dim, `useDismissable` and an item pick; one
  `open && (asDrawer ? frame : popover)` branch; `useAnchoredMenu(open && !asDrawer)` — the sheet no longer re-measures
  a popover place on every scroll (pre-existing waste, one line).
- /review **Low:** the sheet and the popover are different elements, so a width crossing 640 while open (a phone turned
  on its side) remounted the panel and dropped focus to `<body>` — the arrow keys died. The focus-on-open effect now
  also runs on `asDrawer`; `.probe/sf1/cross.mjs` proves focus stays on an item at 390 → 900 → 390 and ArrowDown roves.
- /review **Low:** `Omit<…, 'aria-modal'>` does not stop a hyphenated attribute (TypeScript does not check one a props
  type leaves out) — the frame now sets `aria-modal={undefined}` after the spread.
- /review **Low:** the ledger guard's Reset focus assertion matched the frame's dim line first — pinned on Reset's own
  line; the popover's "never above the nav" z check (dropped with the trimmed practice-week test) re-pinned.
- Guards: the practice-week and ledger guards keep their own decisions and point at `sheet-frame-guard` for the frame
  (no duplicated assertions); `cssRule` promoted to `tests/unit/_source-code.ts` (brace-depth aware, throws on an
  unclosed rule) — the older guards' `rule`/`block` copies predate it.
- Not applied (advisory): the ≤900 belt leaves 641–900 to `useIsPhone` alone (intended, documented); focused admin
  shells declare the token with no bar (nothing reads it there). Follow-ups noted: RepKit `.savePill`,
  `TournamentAdminUI` (76px) and chat-admin (70px) still hand-compute the admin bar — they could read the token.

Re-proved after both passes: all ten sheets re-captured — the seven coach/tournament sheets still pixel-identical;
260 guard tests; typecheck, focused lint, `verify:changed` (5,598 tests) clean. `check:layout --changed` widened to
247 screens (the admin shell stylesheet) and aborted on the memory floor; re-run scoped to the twelve touched screens
plus three admin samples after a restart: the coach screens' findings were all DARK-theme ones (the UAT coach session
was re-signed in Dark at 08:09, before this session) and re-ran clean in warm ("No new layout findings"); the house
league Teams page's tap-floor findings (player rows 32px, Export 38px at 768) are on elements nothing in this diff
reaches — pre-existing, reported.

### Step 2 — the small menus (built 2026-10-05, committed `91986b7c`; owner QA §266 ✅ PASSED 17/17 2026-10-06)

**Before building.** Parallel work checked: no commit since step 1 on this step's files; the call-ups session's
uncommitted edits are in `lib/export/pdf.ts` and its guard (not the builder page); a notifications session is editing
`CoachNotificationReader` (a step-4 sheet, untouched here). The dev server's render workers had died again
("Jest worker encountered 2 child process exceptions"); stopped, `.next` cleared, restarted. Before-captures
(`.probe/sf2/capture.mjs`, copied from step 1's with focus-on-open recorded) found three things the plan did not list:
a tap on the dim left focus on `<body>` on both switchers and on Print; Print never took focus when it opened; and the
Schedule's view menu answered no arrow key and left focus on its trigger.

**Disagreement raised, and the call made.** The plan says the switchers take "the menu label" and "the card surface";
the hub's drawing restyled the label in place, inside the More sheet's container (and its dark drawing kept the bar's
colour). No step names moving the switchers' container, so restyling in place would have left them the last menus on a
recipe that hand-copies the bar's height. Built: the switchers move ONTO the frame. Cost, not drawn on the hub and shown
true size on the QA tab: the frame's 8px inset (the More sheet's is 14px) moves the label and rows ~6px nearer the edge
(the tint 6px wider each side), the grab line sits 4px higher, and the More sheet's slide-up and scroll fades go (the
Tools sheets have neither). The owner can still choose restyle-in-place on the walk.

**Built.**
- `SheetFrame.tsx` exports `SheetLabel` — the menu head (D2) on its own, which the frame now renders too. One home for
  the small capitals; Print wears it until step 5 moves Print's container.
- `CoachTeamSwitchSheet` / `CoachPlayerSwitchSheet`: `<SheetFrame label="Your teams" | "Players" role="menu" aria-label=…>`
  with the More sheet's rows (`.dropItem` / `.dropActive` / `.dropItemMeta`, one row density with More). Gone:
  `.sheetAnchor` (the hand-copied `--bottom-nav-height` sum), `.sheetScrim`, `.dropdown`, `.sheetGrab`,
  `.dropSectionLabel`. A new `opener` prop: the dim closes and calls `rescueFocusTo(opener)`; the hosts pass
  `switchButtonRef` / `nameButtonRef` and keep their dismiss boundaries unchanged (the frame renders inside them).
  `.sheetAnchor` stays for the four step-4 sheets; its comments no longer name the team switcher.
- Print (lineup builder): `role="dialog" aria-label="Print"` and `<SheetLabel>Print</SheetLabel>` at every width (on a
  computer Copy from and Save as template beside it already carry heads). Focus lands on Dugout poster when it opens
  (`printRef` effect — a dialog that never takes focus is never announced). `closePrint` (the dim) and
  `escapeToolPanels` (the three Tools panels' Escape, via `useDismissable`'s `onEscape`) hand focus back to Tools
  through `rescueFocusTo`. The hook's own Escape restored `<body>`: the Tools menu item that opened the panel had
  unmounted in the same commit. **Copy from's Escape is fixed by the same line** (step 5's item, closed early).
- Schedule (D5): the view menu `drawerOnPhone drawerTitle="View"`, Add event `drawerOnPhone drawerTitle="Add event"`.
  The view trigger renders only at ≤640, so on a phone it is always the drawer; Add event keeps its card at ≥641, and
  the empty state's door opens the same drawer.
- `CoachToolbarMenu`: `items()` roves `menuitem` AND `menuitemradio` (a `checked` row is a radio item, so the view menu
  and the practice library's Sort had no stops), and a menu of choices opens on the ticked row.

**Proved.** `.probe/sf2/capture.mjs` + `diff.mjs`, at 390 touch, warm and dark: the coach Ledger's and the lineup
builder's Tools sheets **pixel-identical, every computed style identical** (the shared menu change moved nothing);
Add event and View land exactly where the hub drew them (top 498 / height 274; 586 / 186); team 614/158 and Print
523/249 (drawn 616/156 and 519/253); focus on open — team: first row, player: Devon Test, Print: Dugout poster, View:
List (it stayed on the trigger), Add event: Tournament; a dim tap hands focus back to the opener on all five (it went to
`<body>` on three). `.probe/sf2/desk-print.mjs` (1280): PRINT heads the popover, Escape → Tools.
`.probe/sf2/keys.mjs` walked W3: Tab inside Print reaches the orientation switch; Escape on Print and on Copy from →
Tools; the view menu at 600px opens on List, ↓ → Week, Escape → the view symbol.

**Checks.** `sheet-frame-guard` grew step 2 (one label home; both switchers through the frame with focus back to the
opener and no More-container part; the hosts' boundaries; D5's two drawers; Print's role, label, focus and Escape; the
radio roving). Moved with the step: `coach-first-screen-guard` and `coach-people-phone-guard` (the switchers' container
is the frame, rows the More sheet's), `coach-lineup-phone-guard` (Print's dim is `closePrint`; Escape is
`escapeToolPanels`; "no Print square" now looks for a BUTTON named Print), `coach-schedule-phone-guard` (the view
menu's drawer). Nine sheet guards 236/236. `npm run typecheck` clean; focused lint 0 errors (4 warnings on untouched
lines); `npm run verify:changed` exit 0 (5,628 tests). `check:layout --only=` the four schedule entries, both switchers,
the player page and the lineup builder, `--theme=warm`: no new findings; 8 baseline entries on the player page at 768
(position-reorder buttons, not this step) no longer reproduce — not pruned.

**Owner QA §266 ✅ PASSED 2026-10-06, 17/17** — hub tab QA Walk: W1 the Schedule's two menus rise from the bar (6/6) · W2 the
switchers and Print say what they are (6/6) · W3 the keyboard lands where it should (5/5). Writes nothing. No notes —
the switchers on the frame (the undrawn ~6px inset change, named in W2 step 1) accepted as built.

**Not done, reported.** The Schedule day list (`.daySheetOverlay`) could not be opened on the UAT data (no day with two
events) — left for step 4. Help's 30px × and the tag manager's / admin sheet's lost Escape focus stay out of the frame.

**/simplify (four lenses: reuse, simplification, efficiency, altitude), 2026-10-05.** Applied:
- **The frame owns the dim's hand-back** (altitude + simplification, independently): `SheetFrame` takes a REQUIRED
  `opener` and its dim runs `onClose(); rescueFocusTo(opener)`. Every consumer drops the hand-written tail — the Tools
  menu (`onClose={() => setOpen(false)} opener={triggerRef}`; `dismiss` still serves `useDismissable` and a pick),
  `FilterGroup` (`onClose={close} opener={triggerRef}`), both switchers. Required, because three of five step-2 sheets
  had written the close and forgotten the hand-back; step 4 adds five more consumers.
- **The Tools menu lends its button** (reuse + altitude): `CoachToolbarMenu` takes an optional `triggerRef`
  (`triggerRefProp ?? ownTriggerRef`); the lineup builder passes `toolsTriggerRef` and drops the
  `querySelector('button[aria-haspopup="menu"]')` that read the menu's markup.
- **One owner per assertion** (simplification): the switchers' frame, missing More-container parts, hosts' boundaries
  and opener live in `sheet-frame-guard` alone; `coach-first-screen-guard` and `coach-people-phone-guard` keep their
  own rulings (the rows are the More sheet's) and point there — the step-1 pattern.
- Skipped: a shared "focus the first control on open" helper (reuse) — the four copies pick different targets (first
  row, the current player, the first button), so a helper would add a layer for one line each. Efficiency: nothing
  material (`useDismissable` holds its callbacks in refs; `items()` runs on an open menu only).

Re-proved after the pass: all eight sheets (the five step-2 sheets, the Ledger Filter, two Tools sheets) re-captured
against the build — **pixel-identical, every computed style, focus-on-open, Escape and dim-tap result identical**;
the Filter sheet's dim still hands focus to Filter through the frame; `.probe/sf2/keys.mjs` W3 unchanged. Guards
236/236, typecheck clean, focused lint clean.

**/review (standard tier; correctness, state/timing and blast-radius lenses), 2026-10-05.** Gate: `verify:changed`
exit 0 (5,628 tests), typecheck and focused lint clean; `check:layout` ran on the build (no new findings) and the
simplify pass was proved pixel-identical, so it was not re-run. **No finding in the step's change set confirmed.**
Blast radius: all four `SheetFrame` consumers pass `opener`; the two `checked` menus (Schedule view, the practice
library's Sort) sit in no focus-trapped host; the switcher rows read no `.dropdown`/`.sheetAnchor` variable; the layout
sweep's `#coach-team-sheet` / `#coach-player-sheet` / `menuitemradio` selectors, demo tours and help content are
unaffected. Reported, not fixed (all Low, all pre-existing in kind):
- A coach who opens Add event from the EMPTY schedule's own button and taps the dim gets focus on the header's +, not
  that button (Escape returns to it). The popover's click-away did the same before step 2.
- The view menu's trigger is hidden above 640: rotating a phone with the menu open hides it while it stays open, and
  rotating back shows it again — now with the dim. The popover did the same before.
- `CoachTeamHeader`: `switchOpen` is not gated by `canSwitch` (the player page's twin is), so crossing 900 with the team
  sheet open leaves its dismiss listeners armed until the next Escape, which they answer. Fix: fold `canSwitch` in.
- Copy from's × and dim, and Save as template's dim, still drop focus to `<body>` — step 5.
- Advisory: ↑ on a closed choice menu opens on the last row, not the ticked one (the menu-button pattern; kept).

### Step 3 — game day (built 2026-10-06, committed `5d036eeb`; owner QA §268 ✅ PASSED 19/19 2026-10-06)

**Before building.** Parallel work checked: no commit since step 2 on the console, the frame, the observation form or
the scouting panel; the call-ups session's uncommitted edits are in `lib/export/pdf.ts` and its guard. Before-captures
(`.probe/sf3/capture.mjs`, copied from step 2's; it adds a Tab count and puts the dim tap OVER the console's ← Back)
found what the plan did not list: **under touch, a tap on the game-day dim closed the sheet and pressed what it covered**
— over ←, it LEFT THE GAME for the Schedule on Note, Scouting (both states) and End game (4 of 6 sheets in warm, 5 in
dark, at 390). The console's dim was a sibling OUTSIDE `useDismissable`'s boundary (its comment called that the
point); `pointerdown` unmounted it before the `click`, which landed on the page — the 2026-09-22 trap the frame's header
names. The frame puts the dim inside, so moving the sheets onto it closes this. The dev server died twice mid-session
("Jest worker…"; once while another session's server held the port); stopped, `.next` cleared, restarted each time.

**The sort (the plan left Score, Scouting and End game to the step).** Drawn true size on the hub (Mockup › 4 · What
moves, "the three sheets this hub did not draw"; v10) and **ruled by the owner 2026-10-06, all as recommended**:
- **End game → the FORM layer.** It holds a corrected final score and the night's one family notification; a stray tap on
  the bar left the game with the correction dropped.
- **Scouting → menu while reading, FORM while an observation is typed** — the Award sheet's switch (D3).
- **Score → menu**: every +1 and digit autosaves. ⚠ Found sorting it, NOT a layer question: the running score saves
  **10 seconds** after the last tap and nothing flushes it when the coach leaves the page (the flush is on
  `visibilitychange` only), so a run tapped and then any tap that leaves the game within 10s is never saved — sheet
  open or not. End game's final score corrects it. **Owner: a separate small fix after step 3** (TODO).
- Who's here → menu (ruled). Note → form (ruled). The substitution confirm stays a card (plan).

**Built.**
- `SheetFrame` gains the FORM layer (`form`, `busy`): `.sheet.form` (bottom 0, the screen less 12px, z 390, the home
  indicator padded — the inset alone, never the bar's height); the dim with it (`LineupSheetScrim overNav`, 389);
  `useOverlayOpenIfAvailable(form)` (the nav `visibility: hidden` — tolerant, because the Tools menu's frame also renders
  on admin pages outside the provider); `useDialogFloor(form, …)` (Escape, Tab kept inside, Back, focus home), `tabIndex
  -1` and `aria-modal` from the layer. The `opener` contract holds in both layers; the dim waits for `busy`. The frame
  keeps its own panel ref and forwards the caller's. The layer may change while open.
- `useDialogFloor` takes an optional `opener`: a caller that KNOWS what opened it names it (iOS Safari does not focus a
  tapped button, so the floor's focus history never saw it). Every other floor unchanged.
- Game day: ONE `renderSheet` for the five sheets — at ≤900 (`useIsPhoneNav`, the bar's breakpoint) `<SheetFrame>`
  inside a `display: contents` wrapper on `sheetRef` (the dim inside the dismiss boundary), with `.gdSheetBody` making up
  the 6.4px the frame's 8px inset is short of the console's 0.9rem; above 900 the `.gdSheet` card as before.
  `sheetIsForm = isPhoneNav && (Note | End game | Scouting && bookLogging)`; the page's `useDismissable` and
  `useBackStep` stand down for a form (the floor stands its own entry; the layer switch hands the entry over in one
  commit). Every door passes its own button as the opener (`openSheet(kind, e.currentTarget)`); the ×, Keep coaching and
  the dim hand focus back to it. The recap's two book doors go through `openSheet` too.
- `ScoutObservationForm` reports `onOpenChange` IN ITS HANDLERS (door, close — Cancel, Done, Escape), passed through
  `OpponentScoutingPanel`'s `onLoggingChange`: from an effect, the switch would land a commit after the box's own focus
  move and the floor's hand-back would win. Other homes of the form (the schedule's Scouting tab, the opponent page) pass
  nothing and are unchanged.
- `coaches.module.css`: the console's drawer block (`.gdSheet:not([data-card])`, the hand-copied bar height, 72dvh),
  `.gdScrim` (the dark dim on warm) and `.gdGrab` deleted; the substitution card reads `calc(var(--coach-foot-clear) +
  0.5rem)`.

**Proved.** `.probe/sf3/capture.mjs` + `diff.mjs`, before and after, the seven surfaces at 390 touch (warm, dark), 768
touch and 1280:
- **Every line of content kept its horizontal place** (dx 0 on every node of every sheet) and sits 2.8px higher in its
  sheet (the frame's grab line, 38×4, and 6px top padding); the bottom padding is 14px (was 17.6).
- Note and End game: down over the bar (bottom 844), modal, the nav hidden, the warm dim to the foot at 389, focus on the
  sheet when it opens, **Tab ×12 never left** (was 9 and 7 out of 12), Escape and the dim hand focus back to the
  button. Scouting: a menu at rest; with the box open the form layer, Tab never left, Escape closes only the box (focus
  on its door). Score and Scouting-at-rest on the bar with the warm dim; Who's here grows to the cap (top 12, 760 high).
  **The dim tap stayed in the game on every sheet.** The substitution card **pixel-identical** at 390.
- 768 (touch): the same as 390 — dx 0, the forms down over the bar, the menus on it, every dim tap staying in the game.
  1280: **all seven surfaces pixel-identical** (the cards untouched). Dark keeps its dark dim (the frame's, the same value).
- `.probe/sf3/keys.mjs` at 800 with a keyboard, **16/16**: Note and End game open as modals with focus on the sheet and
  the bar hidden; Tab and Shift+Tab ×15 never leave either; Escape, Back and Keep coaching close them with focus back on
  the button and the game kept, Note's typed line still there on reopening; Scouting opens as a menu and its box is the
  form layer (Tab kept inside); Escape in the box closes only the box (focus on its door), Escape again closes the sheet
  (focus on Scouting); Back while logging closes the sheet, and one more Back leaves the game (no entry left behind).
  **The first run failed "Escape again" — focus went to `<body>`**: the page's dismiss hook re-arms when Scouting
  returns to the bar and recorded the box's door, inside the closing sheet. Fixed in the step: a sheet's Escape moves
  focus to `sheetOpenerRef` at once, before the sheet unmounts (`escapeSheet` — the hook's own Escape contract; a first
  version that only rescued focus from `<body>` left it wherever Tab had taken it, caught by the re-capture); the
  substitution confirm keeps the hook's own hand-back.
- The frame's menu layer, as a regression check: `.probe/sf3/menus.mjs` (step 2's capture, re-pointed) against step 2's
  final record — the eight sheets already on the frame (both Tools, Filter, both switchers, View, Add event, Print), warm
  and dark: **pixel-identical, every computed style, focus on open, Escape and dim tap identical**.

**Checks.** `sheet-frame-guard` grew step 3 (27 tests: the form layer's geometry, the bar taken away, the floor and its
named opener, one render path, the sort, every door's opener, Scouting's in-handler switch, the console's recipe gone);
step 1's assertions moved with it (the home-indicator padding and the 390 live in `.sheet.form` only; `aria-modal` from
the layer). Every guard that reads a touched file: 624/624 across 31 files. `npm run typecheck` clean; focused lint 0
errors (the one warning on a touched line — the floor's effect now reads its options ref — fixed; the rest are on
untouched lines). `npm run verify:changed` exit 0 (5,648 tests) on the build; after the last Escape fix guard files (653/653 — the count grew with a parallel session's tests), typecheck and
lint re-ran clean and the 390 captures and the keyboard walk were re-taken. `check:layout --only=coach-game-console,coach-team-hub-switcher,
coach-player-switcher --theme=warm`: no new findings (the same 8 player-page baseline entries at 768 as step 2 no longer
reproduce — not pruned).

**Not done, reported.**
- The running score's 10-second save (above) — owner: a separate fix after this step (TODO).
- A tap on the dim still CLOSES a form (the frame's rule, as drawn). Note's typed line survives it (page state); End
  game's corrected score does not (a reopen starts from the running score) and neither does a typed observation (it
  lives inside the panel) — the same as before this step, now with the bar no longer a second way to lose them.
  Keeping them is a small follow-up if wanted. Back while logging likewise closes the whole book, not just the box.
- ~~Help: the game-day article said Note's player is picked by tapping a name~~ — fixed by `/docs`, below.

**/simplify (four lenses: reuse, simplification, efficiency, altitude), 2026-10-06.** Reuse and efficiency: nothing
material (no shared ref-merge helper exists — the frame's is the third copy of a two-line idiom; the frame's hooks
register nothing in the menu layer and read no volatile context). Applied:
- **One close-and-hand-back** on the console: the ×, Keep coaching and a menu-layer sheet's Escape all call
  `closeSheetToOpener` (focus to the opener at once, before the sheet unmounts); the separate `closeSheet` and
  `escapeSheet` are gone, and the frame gets the plain `dismissOverlay` (it hands focus back itself).
- `sheetBusy` sits beside `sheetIsForm`; the frame's merged-ref comment names its real readers (the Tools menu roves its
  items, Filter and both switchers seat focus); the head's comment counts five sheets.
- Skipped, with reasons: an optional `restoreTo` on `useDismissable` (altitude) — with the three closes merged it would
  remove nothing from the page and would widen a 32-caller shared hook; it belongs with the next item. **The frame
  owning dismiss and the back step in BOTH layers** (altitude: the stand-down rule now lives in a comment every form
  consumer must follow) — one consumer today; build it in step 5, when the lineup builder's three forms make the second.
  `optsRef` stays in the floor's deps (the hooks lint asks for it; stable, no re-bind).

Re-proved after the pass: guard 27/27, typecheck clean, lint unchanged on touched lines, `keys.mjs` 16/16, the 390 warm
capture identical to the build (focus on open, Escape, dim tap, Tab, content dx 0).

**/review (standard tier; correctness, state/timing and blast-radius lenses), 2026-10-06.** Blast radius clean: the
frame's hooks register nothing in the menu layer and nothing throws on the admin pages outside the overlay provider
(`useOverlayOpenIfAvailable`); the 33 floors without `opener` keep their focus history; the observation form's other
homes pass nothing; no script, spec, demo tour or help anchor reads the removed classes; `--coach-foot-clear` is
declared wherever the console renders. The layer switch was traced both ways (cleanups before creates: the new step takes
the dead entry over, no entry gained or lost). Two confirmed, fixed:
- **Medium — crossing 900px with an observation box open** (found by two lenses): the sheet remounts as the desktop card,
  the box with it, but the page's "logging" flag stayed true — back at ≤900 the book covered the bar with no box in it.
  Fix: `ScoutObservationForm` reports an unmount with the box open as a close (cleanup, via `useLatestRef`), so the box is
  the flag's ONE owner; `openSheet` no longer resets it by hand. (The typed observation is still lost on the crossing — a
  tablet turned mid-sentence; Note and End game keep theirs.)
- **Low — the × and Keep coaching ignored `busy`**: End game could be closed under its own "Confirm & notify families",
  and a failure then landed on a closed sheet. Fix: `closeSheetToOpener` holds while `sheetBusy`; Keep coaching is
  disabled while End game sends.
Proved: `.probe/sf3/review-check.mjs` 6/6 (600 → 1000 → 600 with the box open comes back a menu; with End game's PATCH
held, Keep coaching disabled, the × holding, the failure shown on the open sheet, then Keep coaching closing it — the
PATCH intercepted, nothing written); `keys.mjs` 16/16 and the 390 capture unchanged.
Refuted (dropped): "Escape in the observation box closes the whole sheet at ≤900" — measured twice, it closes only the
box. Reported, not fixed (Low, as before this step): a tap on the dim or Back while an observation is SAVING closes the
book and drops a failure message (the box's saving state is its own; holding it would need a second report). Not traced:
`useBackStep`'s entry count across a 900px crossing with a FORM open (the same takeover path as the traced layer switch).

**/docs (Mode A), 2026-10-06** — `lib/help-content/coaches.tsx`, the game-day article (`#premium-game-day`), no anchor
changed: Note's player is picked under **About a player?** (it said "tap a player's name" — a dropdown since 2026-09-22);
the bench board's "matchup and score up top" is the matchup with the inning stepper (the score moved under the board
2026-09-22); Scouting opens from the **Scouting** button at the foot as well as the opponent's name (also since
2026-09-22); one sentence each on Note, End game and Scouting-while-logging covering the bottom bar on a phone. Search
fields gained "about a player", "log an observation", "bottom bar hidden / disappeared" and the matching phrases.
`measure:help`: the article stays inside the standard; focused lint clean.

**Owner QA §268 ✅ PASSED 2026-10-06, 19/19** — hub tab QA Walk: W1 Note and End game cover the bar (7/7) · W2 Who’s
here, Score and Scouting stay on the bar (7/7) · W3 the keyboard stays inside a form (5/5). Writes nothing. No notes on
the step; the walk found the game-day button row’s gap above the bar, built as its own follow-up (§269).

### Follow-up — the game-day button row docks on the nav (built and committed `62f76580` + `b06d8483` 2026-10-06; owner QA §269 ✅ PASSED 6/6 2026-10-06)

Found by the owner in the §268 walk: the row of Who's here · Note · Scouting · End game is `.stickyActionBar` inside
the page column, so on a phone it was 358px of 390 (the shell's 16px gutters) and, scrolled to the end, fell back into
the flow 32px off the nav (`.coachesMain`'s bottom padding); the same 32px at 768 (a 480px strip) and at 1280 (off the
window's foot). Not step 3's change: the row had looked like this since it was raised to clear the nav on 2026-09-22.
Drawn true size on the hub (Mockup › 7: the live console, captured, then captured with the change applied in place;
390 mid-scroll and end, 768 end; warm and dark) and **ruled as drawn 2026-10-06 — D7** docked on a phone and tablet,
**D8** a computer unchanged (no nav to sit on; a full-window band holding a 480px column of buttons would be empty
furniture).

- **Built (one stylesheet):** at ≤900 `.gdFooter.gdFooter` is `position: fixed; left: 0; right: 0; bottom:
  var(--coach-foot-clear); margin: 0` with `padding-inline: max(var(--coach-gutter), calc((100% - var(--gd-col-w)) /
  2))` — `100%` is the viewport for a fixed box, which excludes a desktop scrollbar where `100vw` would not — and
  `.gdPage:has(> .gdFooter)` pads by `--gd-foot-h`, only while the row is there (a read-only viewer has none). Still no
  z-index: the clearance stays geometric (the 2026-09-22 lesson). The shell names its phone gutter `--coach-gutter`
  (`.coachesMain` pads by it) and the console its column `--gd-col-w` (`.gdPage`'s max-width), so the row insets to
  both without a copied number. `.coachesMain`'s comment no longer claims `.stickyActionBar` has no consumers.
- **Proved:** `.probe/gdfoot/verify.mjs` at the top, middle and end of the page — 390 touch, 768 touch and 800 mouse:
  row 390/390, 768/768, 800/800, buttons 16–374, 144–624, 160–640 (the column to the pixel), gap to the nav 0 at
  every position, the last line 31px above the row at the end; 1280 unchanged (sticky, 510–990, the 32px lift as D8
  rules). `.probe/gdfoot/sheets.mjs` at 390, top and end: all four buttons answer their own tap; Who's here rises from
  the nav over the row; Note and End game come down over everything.
- **Gates:** `sheet-frame-guard` follow-up block (3 tests, 30/30); `coach-practice-plans-phone-guard` and
  `coach-schedule-sheet-guard` (both read the shell) 57/57; CSS purity, selectors, spelling clean; focused lint clean.
  `npm run verify:changed` red only on `budget-ladder-sign-guard`, `coach-budget-period-grid-doors-guard` and
  `month-grid-reconcile-guard` — they read the budget screens another session has uncommitted, not this change.
  `check:layout --only=coach-game-console`: no geometry findings; five contrast findings, none from this change — the
  red Out tag in dark (4.23:1 at 12px; the fixture has a player marked Out today) and the red 9+ badge at 1440
  (3.76:1). Reported, not fixed.
- **Noted for §268's walk, not this change:** another session's uncommitted work renames End game's confirm button
  from "Confirm & notify families" to "End game" (a final score notifies nobody, owner 2026-10-06); §268 W1 step 4
  names the old label.

### Follow-up — the bottom bar keeps its colour at the end of a page, in Warm (built and committed `62f76580` + `b06d8483` 2026-10-06; owner QA §270 ✅ PASSED 4/4 2026-10-06)

Owner, during the §269 walk: "why does the nav change its tint after scrolling down?" Measured (`.probe/gdfoot/navtint.mjs`,
`ground.mjs`): the bar is frosted on purpose (warm `rgba(var(--home-paper-rgb), 0.92)` + `blur(20px)`, the 2026-07-13
backdrop-filter ruling) and its own colour never changed; what changed was BEHIND it. The warm palette hangs off the
portal's marker (`[data-coach-warm-enabled]`), inside `<body>`, so `<body>` kept `--bg` (#0A0A0A) on every warm coach
AND club-admin page (the admin layout carries the same marker and borrows the same bar). At the end of a page the
bar sits over the outer `<main>`'s nav reservation, which shows `<body>`: 8% of near-black through the frost read as a
grey bar (229,225,218 vs 249,245,237 mid-page) — always, on a page too short to scroll; and an iPhone's overscroll
bounce shows the same canvas. Not caused by the docked row (D7); the strip was there before.

- **Built (owner: "go ahead", 2026-10-06):** one rule in `app/globals.css`, after the warm palette block —
  `html[data-user-theme="warm"]:has([data-coach-warm-enabled]) body { background: #F8F4ED; }`. A copy of
  `--home-paper` because `<body>` is outside the marker that declares it (the `--sandbox-warm-paper` precedent);
  `warm-palette-contrast.test.ts` grew a test that fails if the two drift (11/11). Rejected: an opaque bar — it would
  hide the symptom, keep the black canvas for the bounce, and break the platform's frosted chrome.
- **Proved:** `.probe/gdfoot/tint.mjs` + `tint-diff.mjs` (390 touch, the end of the page, warm and dark, before and
  after) and `tint2.mjs` (Roster, Schedule, Overview re-taken with the old base forced back on in the same load, after
  the first run's sign-in failed on two pages): in Warm the game, Overview, Roster, Lineups and the club admin home
  change ONLY in the strip under the bar (rows 772–843); the Schedule is identical (it scrolls in its own frame); the
  Dark captures of the game, Overview, Lineups and admin home are pixel-identical. Not checkable in the test browser:
  the iPhone bounce (QA §270 W5 step 3). The volunteer shells (`data-guest-kit`, warm palette fixed) are not covered by
  the rule and were not measured.

### Step 4 — the record sheets (built 2026-10-06; owner QA §273)

**Before building — the code disagreed with the plan in four places (raised before any change, owner answered the
one question that was his).**
- **The notification reader was mid-flight**, then wasn't. At the start it was being rewritten, uncommitted, by
  Notifications Open in Place step 3 — one reader for the coach's AND the admin's Notifications pages, kept off this
  frame on purpose because the frame's dim imported `coaches.module.css` (~945KB) into the admin. That project
  committed and closed mid-session (`157adb69`, `fc889b4b`); this step gave the frame its own dim (below), which
  removed the reason, so the reader joined as the plan intended.
- **RSVP is not a menu** (the build prompt said it was). It never sits on the bar: it opens over the event window,
  which has already taken the bar, and that window is MODAL — a sheet stacked on a modal window must be modal itself,
  or the keyboard walks out behind both. It stays exactly as a keyboard and a screen reader met it (held inside,
  modal), in the FORM layer. Neither of the frame's layers reached above a window (menu 260, form 390, the window 400),
  so the frame gained a third place: **over a window** (`overWindow`, 410).
- **"Looking unchanged" holds for what is inside, not for the sheet's skin.** These sheets wore the More sheet's
  container; on the frame every line of content keeps its place (each sheet's own inset moves into a body wrapper,
  the step-3 pattern), and the sheet takes the frame's surface — the change the switchers took in step 2, accepted
  on that walk: in Dark the background goes from the bar's near-black to the card surface, and in both themes the
  edge shadow, the grab line's ink and the slide-up animation follow the frame.
- **The Schedule day list cannot be opened on a phone.** Since 2026-09-21 (phone re-evaluation stage 2 · C2) the
  phone's month view is dots plus the chosen day's rows, with no "+N more"; the day list opens only at 641px and wider,
  where it is a centred card. It is not a phone sheet, so it stays out of the frame — the owner had ruled "draw it in
  this step" on the premise that it was one. Its phone styling (`.daySheet` at ≤640) is dead code. Reported, with a
  recommendation (below), not built.

**The decision the owner made (2026-10-06, as recommended).** Today the position picker and the Award sheet (read)
held the keyboard inside and claimed `aria-modal` with the bar live. A menu-layer record sheet keeps Escape, Back,
focus on the sheet when it opens and focus home to what opened it; it loses the keyboard hold and the modal claim —
Tab past its last control (Shift+Tab before its first) closes it, focus sent home first so the browser's Tab carries
on from there, as the Tools menu's Tab does.

**Who answers the keys — the deferred "frame owns dismiss and Back in both layers".** Lands now for the sheets with
no trigger of their own (the record sheets): `ownsKeys`. The trigger-owning consumers (Tools, Filter, the switchers,
game day, the row menus) keep their own dismiss hook until step 5. Found reading them: Tools, Filter and the two
switchers have **no back step** — on a phone, Back with one open leaves the page (by the code; step 5's).

**Built.**
- `SheetFrame`: its OWN dim (`.dim`, `.dim.form`, `.dim.overWindow` in `SheetFrame.module.css`, the portal's pair of
  colours and the warm remap — it no longer imports `LineupSheetScrim`, so nothing on the frame reaches
  `coaches.module.css`); `ownsKeys` — the floor in the menu layer WITHOUT its trap, and a pointer-down outside the dim
  and the sheet (a tap on the bar) closes the sheet first; `overWindow` (bottom 0, 410 / 409, no overlay of its own —
  the window holds the lock); `grabCloses` (the grab line as a 44px Close, `.grab`, in place of the drawn one); the
  dim's close waits for `busy` in either layer; `tabIndex -1` wherever the floor stands.
- `useDialogFloor`: `trap: false` — see the decision above. Read on every key, so a layer switch needs no re-bind.
- **Position picker** (builder and game day ≤640): `<SheetFrame ownsKeys grabCloses>`, menu layer, no `aria-modal`;
  both hosts name the pill as the opener (`e.currentTarget`).
- **Award sheet**: `<SheetFrame ownsKeys form={editing} busy={removing}>` — ONE floor in both layers, only its hold
  changing; its own `useOverlayOpen`, floor, anchor and form geometry deleted (the frame's).
- **RSVP**: ≤900 `<SheetFrame form overWindow grabCloses>`; above 900 the centred dialog it was, on its own floor, with
  the More container's inert classes dropped.
- **Notification reader** (both portals): ≤900 `<SheetFrame ownsKeys grabCloses>`; above 900 its dialog. Its own
  bar-tap listener (the 09-25 /review fix) is the frame's rule now. The list names the row it opened from
  (`onOpen(entry, from)`).
- **Player row menus**: the builder's (touch widths) and the player profile's Best positions list (≤900) on the frame's
  menu layer, their own dismiss hook and back step kept; the depth chart's player window passes `overWindow` (the
  menu inside a window — it was `.lineupDrawerOverNav`). Above 900 the profile's popover is unchanged. The frame's
  dim hands focus back to the handle (it went to `<body>`).
- `CoachesBottomNav.module.css`: `.sheetAnchor` retired — its last six users (the switchers in step 2, these four
  now) all stand on the frame. Comments that named it point at the frame.

**Proved.** `.probe/sf4/capture.mjs` + `diff.mjs` (copied from step 3's; it adds Back, and a tap on the bar's More with the sheet open), before and after, the record sheets at 390 touch in warm and dark, 768 touch and 1280:
- **Every line of content kept its place** in the picker (builder and game day), RSVP, the Award sheet (read and edited) and the reader (coach and treasurer): dx 0, dy 0 on every node but the grab-line Close button, which now spans the frame's width. The row menus (builder, profile, depth chart) moved 2.4px in and grew 9px at the foot — the frame's inset and foot, the Tools menu's (taken, not padded back).
- **What changed is the ruled behaviour and the frame's skin.** The picker, the Award sheet (read) and the reader: no `aria-modal`; Tab past the end closes them. **A tap on More with the picker or the Award sheet open now closes the sheet first** (before: More opened on top, the sheet still open beneath — every run, both themes, the builder and game day). The row menus: a tap on the dim hands focus back to the handle (it went to `<body>`). The skin: the frame's grab line (lighter), its shadow, and in Dark the card surface (`rgb(17, 24, 39)`, was the bar's `rgb(13, 17, 26)`); the slide-up animation is gone.
- RSVP at 390 and 768: still a form over its window (modal, the window's bar hidden, Tab never leaves, Escape and Back close RSVP alone), z 410 with the frame's dim at 409. 1280: RSVP, the profile's popover and the treasurer's reader **pixel-identical**; the coach's reader's dialog identical (the pixels that differ are the list behind it, through its corners).
- The frame's existing consumers, re-captured because the frame changed (`.probe/sf4/menus.mjs`, fresh before-captures — the UAT fixture was re-seeded today): the eight sheets (both Tools, Filter, both switchers, View, Add event, Print) warm and dark — **pixel-identical, every computed style, focus on open, Escape and dim tap identical**; game day's seven surfaces (`.probe/sf4/gameday.mjs`) warm and dark — **pixel-identical, content dx 0 dy 0**; the only difference is the dim element's class name.
- `.probe/sf4/keys.mjs` with a keyboard, **21/21**: the picker (600) and a read award open with focus on the sheet, not modal; Tab past the last control closes them and focus carries on from the opener (the next row's handle; the page after the award's chevron); Shift+Tab before the first closes them; Escape and Back hand focus to the pill / the chevron; one more Back leaves (no entry left behind). The Award sheet while edited: modal, the bar hidden, Tab ×15 / Shift+Tab ×15 never leave, Escape closes it (nothing typed) with focus on the chevron, and the read → edit switch leaves no history entry. RSVP (800): modal, Tab never leaves, Escape and Back close RSVP alone with the window still open.
- **Writes:** the reader probes answer every notification write themselves (opening marks a notice read); the award and the positions were opened, never edited. Fixtures, all removed or restored: four practices on one day (the day list), Devon's two positions swapped (restored to 2B, SS); ONE probe award stays for the walk.

**Checks.** `sheet-frame-guard` grew step 4 (9 tests: the frame's own dim and no borrowed stylesheet; over a window; the grab Close; the menu layer's keys; the picker; the Award sheet's one floor; RSVP's form over its window; the reader; the row menus); step 1–3 assertions moved with the frame (the dim, the close's busy gate, the layer classes, the floor's call, `.sheet:focus`). Moved with the step: `coach-lineup-phone-guard` (the row menu's scrim is the frame's; the picker on the frame; the openers), `coach-award-edit`, `coach-schedule-phone-guard` and `coach-schedule-sheet-guard` (RSVP and its row), `coach-reports-phone-guard` (the award row names its opener), `notification-open-in-place-guard` (the reader's opener; the admin page reaches `SheetFrame.module.css` and still never `coaches.module.css`). Every guard that reads a touched file: 388/388. `npm run typecheck` clean; focused lint 0 errors (the 10 warnings are on game-page lines this step did not touch). `npm run verify:changed`: the unit run 5,793/5,795 — both failures traced: one was this step's (`coach-reports-phone-guard`, moved), the other is `install-banner-layer-guard`, ANOTHER session's untracked guard, which reads the two rules this step retired (below); the remaining checks run one by one: all clean but three that read other sessions' uncommitted work (`check-public-tokens` and `check-admin-old-look` — the tournament admin redesign; `check-schema-parity` — Club Tier 3b's dev-only migration). `check:layout --only=` the nine touched screens (the builder and its position sheet, RSVP, both Notifications pages, Awards, the player edit, the depth chart, game day) `--theme=warm`: **no new findings** (34 baseline entries no longer reproduce — earlier changes; not pruned).

**Not done, reported.** - **The Schedule day list, on a tablet** (641–900, where it opens): a centred card that hides the bar, with **no Escape** (measured: nothing happens), **Back leaves the Schedule**, focus never enters it, and **a tap on its dim falls through** — over the team name it closed the card AND opened the team switcher (the step-3 game-day defect's family: it closes on the press). Its ≤640 bottom-sheet rules are dead code. Recommendation: give the card the dialog floor (Escape, Back, focus in and home) and close it on the tap, not the press, at 641+; delete the dead phone rules. A small follow-up; the owner's call.
- **Tools, Filter and the two switchers have no back step** (by the code): on a phone, Back with one open leaves the page. Step 5's, with the frame owning dismiss and Back for trigger-owning sheets.
- **The frame's grab line is faint** — warm `--border-2` on white, about 1.2:1 — and on a record sheet it is now a Close control (it was dark olive on those). The frame's ink since step 1 (the Tools menu, the switchers); a `/design` call, not changed here.
- ~~**`install-banner-layer-guard.test.ts`** reads `.sheetAnchor` and `.anchorForm.anchorForm`, both retired here~~ — that session committed the guard (`2ea62042`) during this step's /review, so this step would have broken a test in the history: its two rows now read the frame's `.sheet.overWindow` and `.dim` (below). RSVP's `.floor.floor` kept its spelling for it.

**/simplify (four lenses: reuse, simplification, efficiency, altitude), 2026-10-06.** Efficiency: nothing material.
Applied:
- **One "tap outside" test, shared** (reuse and altitude both raised it): the frame's own document listener was half of
  `useDismissable` written again. `lib/overlay-hooks.ts` now holds the boundary test once (`isOutside`) and exports its
  pointer half, `usePointerOutside` (no Escape claim — the floor owns Escape here); `useDismissable` and the frame both
  use it. The Notifications drawer's third copy is left alone (a closed project; it would widen the step).
- `ownsKeys` is documented as temporary: step 5, when the frame owns dismiss and Back for every consumer, deletes it.
Skipped, with reasons — all step 5's, recorded so they are not lost:
- **The frame working out its opener** (altitude): a tap on iOS does not focus the button, which is why every host now
  passes `opener` (`e.currentTarget`). A "last pointer target" kept beside the floor's focus history would make it
  optional. It touches every consumer, and this step's proof was built on explicit openers.
- **`overWindow` derived** from "a window already holds the bar when the sheet mounts" — needs a mount-time snapshot of
  the overlay count (a form sheet registers itself). Two callers today; a third would forget the prop.
- Inverting `trap` to `modal` (the menu layer is the common case); the dim's colours as tokens (a third copy of the
  pair — the lineup builder's scrim retires in step 5, leaving two); `grabCloses` kept as a prop (deriving it would
  hide a decision); the `display: contents` marker wrappers kept (the layout sweep selects through them); RSVP's and
  the reader's two branches kept (only a centred mode on the frame would remove them).
Re-proved after the pass: the eight sheets already on the frame pixel-identical and behaving the same (the shared
dismiss hook unchanged for its existing users); the picker and the Award sheet still close on a tap on the bar;
`keys.mjs` 17/17.

**/review (standard tier; correctness, focus/history timing and blast-radius lenses), 2026-10-06.** Security and data
lenses do not apply (no data, route or permission touched). Blast radius clean: every caller of a changed signature
passes the new opener; `trap: false` is reachable only from the frame; the only `busy` outside the form layer is game
day's, already gated; the layout sweep's markers kept; the admin page still never reaches `coaches.module.css`.
Timing traced clean: a close on the press followed by a navigating click (the press gate holds `exit`), a tap on More
taking the dead history entry over, the Award sheet's layer switch (one floor, one entry), the game page's own back
step standing down for the picker. Confirmed, fixed:
- **High — `install-banner-layer-guard`** (another session's, committed `2ea62042` during this review) read the two
  rules this step retired, so this commit would have broken a test in the history. Its rows now read the frame's
  `.sheet.overWindow` and `.dim` — both above the banner.
- **Medium — RSVP and the reader drew the phone frame for one moment on a computer.** `useIsPhoneNav` read the media
  query in an effect, so a sheet mounted by a tap rendered the ≤900 branch first and then swapped: a floor and a
  history step stood up and torn down, focus sent home and back. Fix: `useSyncExternalStore` (server snapshot `true`),
  so a later mount gets the real answer at once; the masthead's hydration is unchanged.
- **Low — a menu-layer sheet with nothing focusable still held Tab** (the no-focusables branch ran before the trap
  check). Fix: one `leave()` for both branches — with `trap: false`, Tab always closes the sheet, busy still holding.
- Low — a stale comment in `coach-lineup-phone-guard` named `.sheetAnchor`.
Reported, not fixed (Low or advisory, none reachable as a defect a coach meets today):
- Tab out of a sheet whose opener has left the page: focus restarts from the page top (no host does this).
- The reader's Done and Delete remove the row that opened it, so focus has no home (as before this step).
- The floor's focus-home has no `preventScroll` (as before; it now also runs on a tap on the bar) — the page may
  scroll to the opener.
- The Award sheet: with a save in flight, opening the type library and then the save finishing returns the sheet to
  the menu layer with the library open, where a tap in the library closes the sheet (low confidence; a slow save).
- The awards row hands its first button to the sheet as the opener; a row without one would pass nothing
  (unreachable — the row always renders it). The floor reads the opener once, at open (no host swaps it).
Re-proved after the fixes: `sheet-frame-guard` 39/39; at 1280, RSVP and both readers **pixel-identical** to the
before-captures (the desktop dialog, no frame in between); at 390, RSVP and the reader as built (RSVP modal over its
window, the bar hidden, Escape, a dim tap and Back closing RSVP alone; the reader closing on a tap on the bar);
`keys.mjs` RSVP and the Award sheet 15/15; game day's `keys.mjs` 16/16.

**/docs (Mode A), 2026-10-06** — no help article describes how these sheets close, the bottom bar under them, or the
keyboard in a way this step makes wrong; no edits.
