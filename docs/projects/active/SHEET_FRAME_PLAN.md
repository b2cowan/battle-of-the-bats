# Sheet Frame — plan

**Status:** D1–D6 accepted 2026-10-05 (owner: "I agree with all of your recommendations"). Hub (Mockup · Decisions ·
PM Brief · Plan notes): https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc, source `docs/projects/active/SHEET_FRAME_HUB.html`,
frames and measured facts in `sheet-frame/` (`facts.json`). PM brief `SHEET_FRAME_PM_BRIEF.md`. Build prompt
`SHEET_FRAME_BUILD_PROMPT.md` (one step per chat). Ruling recorded in `memory/design_decisions.md` (2026-10-05).
**Step 1 built 2026-10-05, committed `9ab32b23`; ✅ owner QA §264 PASSED 9/9 2026-10-05** (see *Build record*).
**Step 2 built 2026-10-05, committed `91986b7c`; ✅ owner QA §266 PASSED 17/17 2026-10-06** (see *Build record*).
**Step 3 built 2026-10-06, committed `5d036eeb`; ✅ owner QA §268 PASSED 19/19 2026-10-06** (see *Build record*). Steps 4–5 to build.

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
5. **The lineup builder's drawers — last.** Setup, Save as template, Call up, Copy from, Print's geometry: one frame
   with the rest. Call up takes the shared form head (`LineupDrawerHead`) instead of its own `<h3>`; the three forms
   keep the keyboard inside (`useDialogFloor` — it also calls `useBackStep`, so the §219 back-step guard moves with it;
   the open half recorded with the 2026-09-23 ruling); Copy from returns focus to Tools (**done in step 2** for Escape —
   the three Tools panels share one Escape line; step 5 checks Copy from's own × and pick).

**Out of the frame:** full-screen windows (`RoomShell` rooms, `ScheduleEventSheet`, `TagManagerDrawer`,
`HelpDrawer`); the More sheet's own container; the club admin's `BottomSheet` (D4). The Schedule day list
(`.daySheetOverlay`, several events on one day) is a menu that covers the bar — sort it in step 2 or 4 if it can be
opened on test data. (Step 2: the UAT team has no day with two events, so it could not be opened without writing one —
left for step 4.)

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
| Filter sheet and position picker `aria-modal` while the bar is live | 1 (Filter: built), 4 |
| Print has no title and no role | 2 (built) |
| Three builder forms let the keyboard out (2026-09-23 open half) | 5 |
| Escape leaves focus nowhere: Copy from, tag manager, admin sheet | 2 (Copy from, built — one Escape line serves the three Tools panels); the other two are out of the frame — report |
| Switchers and Print: a tap on the dim leaves focus nowhere — found capturing step 2 | 2 (built) |
| A menu of choices (Schedule view menu, practice library Sort) answers no arrow key and leaves focus on its trigger — found capturing step 2 | 2 (built) |
| Help's × is 30px on a phone | out of the frame — report to Help's owner |
| Club Ledger Tools + Filter and Allocations Filter hang under their toolbar, no dim (the admin never declared `--coach-foot-clear`) — found capturing step 1 | 1 (built) |
| Filter sheet: a tap on the dim leaves focus nowhere — found capturing step 1 | 1 (built) |

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
