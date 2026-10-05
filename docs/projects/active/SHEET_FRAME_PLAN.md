# Sheet Frame — plan

**Status:** D1–D6 accepted 2026-10-05 (owner: "I agree with all of your recommendations"). Hub (Mockup · Decisions ·
PM Brief · Plan notes): https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc, source `docs/projects/active/SHEET_FRAME_HUB.html`,
frames and measured facts in `sheet-frame/` (`facts.json`). PM brief `SHEET_FRAME_PM_BRIEF.md`. Build prompt
`SHEET_FRAME_BUILD_PROMPT.md` (one step per chat). Ruling recorded in `memory/design_decisions.md` (2026-10-05).

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
| Filter sheet and position picker `aria-modal` while the bar is live | 1, 4 |
| Print has no title and no role | 2 |
| Three builder forms let the keyboard out (2026-09-23 open half) | 5 |
| Escape leaves focus nowhere: Copy from, tag manager, admin sheet | 5 (Copy from); the other two are out of the frame — report |
| Help's × is 30px on a phone | out of the frame — report to Help's owner |

## Verification per step

Capture every sheet the step touches at 390 (touch), warm and dark, before and after (`.probe/fc/sheets.mjs` measures
corners, layer, dim, height, role, `aria-modal`, Escape and focus); focused lint; `npm run typecheck` (shared
components); the guards above; `npm run verify:changed`; an owner QA walk per visible step.

## Build record

(appended per step)
