# One control height — plan

**On production 2026-10-07** — Amplify job 277 (prod HEAD `17e069b8`, tag `release/2026-10-07`); the release record holds the detail.

Hub (mockup, brief, plan, decisions): https://claude.ai/artifact/GFfHZkFRiXAxxybnAiGrWd
(source `docs/projects/active/ADMIN_CONTROL_HEIGHT_HUB.html`). PM brief: `ADMIN_CONTROL_HEIGHT_PM_BRIEF.md`.

**Ruled 2026-10-03 (owner: "looks good, go for it. I agree with your recommendations"):**
1. The admin comes down to the portal's button height: every admin button and toolbar field is
   **34px** on a computer.
2. The portal's buttons get a **34px floor**, so its lime and white buttons match.
3. Filter pills (30) and status/lens chips (32) **keep their own heights**.

## Problem

The 2026-10-01 ruling ("one admin button size, the portal's") set `--admin-control-h` to 38px on the
stated grounds that the portal's buttons are ~38. Measured at 1440 (`.probe/ctl-height-measure.mjs`):

| Where | Control | Height |
|---|---|---|
| Portal | `.btnSecondary`, `CoachToolbarMenu` trigger | 33.4 |
| Portal | `.btnPrimary`, `.triggerPrimary` (no border) | 31.4 |
| Portal | filter pill (`FilterGroup` summary) | 30.1 |
| Admin | every `.btn`, tournament toolbar fields | 38 |
| Admin | club Ledger's borrowed Tools (`CoachToolbarMenu`) | 33.4 |
| Admin | club kit toolbar select (Rep Teams) | 40 |

The portal has no desktop height floor: a button is as tall as its text (the browser's `normal`
line height for a `<button>`). So (F01) the 38 was never the portal's, (F02) every portal component
borrowed into an admin toolbar sits short, and (F03) the portal itself has a 2px lime/white seam.
(F04) About a dozen tournament controls hard-code 38 instead of reading the token, and (F05) the
club kit's select is 40 in a toolbar.

## Scope

- `--admin-control-h` = **34px on a computer in compact density** (`min-width: 769px`, not
  `[data-density="comfortable"]`). It stays 38 below 769px and in comfortable density, so phones,
  tablets and touch devices are unchanged by construction.
- Hard-coded 38s that are toolbar controls or buttons move onto the token (Teams/registrations,
  Results, Communication, Settings access). Left alone, with reasons: icon boxes (Data tools,
  Archives), a list row (registration health issue), phone-only rules (Branding segment, Bracket
  builder), and the Results lens pill (a chip — ruling 3).
- The Rep Teams toolbar select takes the control height; the club kit's FORM fields stay 40 (the
  portal's form fields are 40–42 too; a form field is not a toolbar control).
- Portal: `.btnPrimary`, `.btnSecondary` (not `.compactAction`, the 18px in-row size), and
  `CoachToolbarMenu`'s worded triggers (not the chip or glyph variants) get `min-height: 34px` at
  `min-width: 769px`, written inside `:where()` so it carries NO weight — any variant or caller
  `triggerClassName` that sizes itself (the 44px inning-inspector rows, the lineup builder's 40px
  Tools, the groups door's `min-height: 0`) still wins whatever the bundle order.
- `club-stage3a-screens-guard.test.ts` pins the new heights and the no-hard-coded-38 rule.

**Out of scope:** phones (unchanged); pills and chips (ruling 3); the club's form fields (40); the
old Budget year picker (32, redrawn in Stage 3b).

## Verification

- `.probe/ctl-snapshot.mjs before|after` — every control's height on every coach and admin screen in
  the layout sweep's list (unique paths) at 1440, plus a third of them at 390 and 768; diffed.
  Expected: at 1440 every admin 38 → 34, portal 31.4/33.4 → 34, nothing else moves; at 390/768
  nothing moves.
- `npm run verify:changed`; the guard test.

## Build record (2026-10-03, on dev)

- **The measurement.** `.probe/ctl-snapshot.mjs before|after` over 175 unique coach + admin screens
  (1440) and 58 + 58 sampled at 390 / 768 — 292 screen-widths each side. `ctl-diff.mjs`: at 1440 only
  the intended moves (admin `.btn*` / toolbar fields 38 → 34, portal 31.4 / 33.4 → 34, the Rep Teams
  `ck.select` 40 → 34, three `btnGhost` stretched to 34 by their row's buttons); **at 390 and 768, zero
  changes.** The before run needed two resumes: the memory guard tripped on cold-compile spikes (the
  probe now waits for memory to come back instead of quitting), and the dev server was restarted after
  the first abort, per the restart rule.
- **The measurement found three hand-written 38s my first grep missed** (the grep was truncated, and
  `components/volunteer` was outside it): `RepKit .rowAction` (Check-in's Check in / Undo, Results'
  Finalize), `CheckInBoard .select/.search`, and `DayOfShell .filterBarInline .barBtn` — Check-in's
  bucket bar, which would have sat 4px over the dropdown beside it. Plus `ScreenParts .plainButton` and
  `.recordSection .btn`. All now read `--admin-control-h`.
- **Left on purpose:** `teams-admin .regHealthIssue` (a list row), `results-admin .lensPill` (a chip,
  ruling 3 — and already beaten to 32 by the filter-chip rule), phone-only rules (`branding
  .segmentButton`, `BracketBuilder`, `TournamentAdminUI` ≤760), the onboarding and setup-wizard
  division grids (form fields), icon tiles (data-tools, archives), `KitDialog .step` (a two-line step),
  the old house-league screens, and the platform console (`founding-season`, its own K-18 note).
- **Guard:** `club-stage3a-screens-guard.test.ts` pins the token (38 default + comfortable, 34 at
  ≥769 compact), the two portal floors, and no hand-written 38 in the converted tournament modules
  (two named exceptions).
- **Checks:** `verify:changed` clean (5,558 tests). `check:layout --width=1440` on 15 changed screens:
  14 clean; one NEW finding unrelated to this change — `coach-schedule` in the coach session's Dark:
  the *Game day* link (`ScheduleCalendarViews` `gdEntryBtn`) is rgba(16,19,10) on rgb(17,24,39),
  1.06:1. Time-dependent (shows only near a game). Reported, not fixed.
- **Owner QA:** ledger §262, walk on the hub's QA Walk tab.
- **Committed `d9302f6f` 2026-10-05** (at the owner's ask, so Sheet Frame step 1 could build on the shared Tools stylesheet).
