# Sheet Frame — plan

**Status:** D1–D6 accepted 2026-10-05 (owner: "I agree with all of your recommendations"). Hub (Mockup · Decisions ·
PM Brief · Plan notes): https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc, source `docs/projects/active/SHEET_FRAME_HUB.html`,
frames and measured facts in `sheet-frame/` (`facts.json`). PM brief `SHEET_FRAME_PM_BRIEF.md`. Build prompt
`SHEET_FRAME_BUILD_PROMPT.md` (one step per chat). Ruling recorded in `memory/design_decisions.md` (2026-10-05).
**Step 1 built 2026-10-05, committed `9ab32b23`** (see *Build record*; owner QA §264). Steps 2–5 to build.

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
   the open half recorded with the 2026-09-23 ruling); Copy from returns focus to Tools.

**Out of the frame:** full-screen windows (`RoomShell` rooms, `ScheduleEventSheet`, `TagManagerDrawer`,
`HelpDrawer`); the More sheet's own container; the club admin's `BottomSheet` (D4). The Schedule day list
(`.daySheetOverlay`, several events on one day) is a menu that covers the bar — sort it in step 2 or 4 if it can be
opened on test data.

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
| Game-day Note is a form above a live bar | 3 |
| Game-day dim is the dark one on warm; the bar height copied by hand | 3 |
| Filter sheet and position picker `aria-modal` while the bar is live | 1 (Filter: built), 4 |
| Print has no title and no role | 2 |
| Three builder forms let the keyboard out (2026-09-23 open half) | 5 |
| Escape leaves focus nowhere: Copy from, tag manager, admin sheet | 5 (Copy from); the other two are out of the frame — report |
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

**Owner QA §264** — hub tab QA Walk: W1 the club's sheets rise from the bar (6) · W2 the coach's sheets did not
change (3). Writes nothing.

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
