# Admin bar behind forms — plan and as-built

> Owner call 2026-10-17 (Nav Consistency build start): the admin's phone bar and an open form are their own unit of
> work. Build prompt `ADMIN_BAR_BEHIND_FORMS_BUILD_PROMPT.md`. Built 2026-10-18; scope re-cut by the owner the same day
> (below). PM brief: `ADMIN_BAR_BEHIND_FORMS_PM_BRIEF.md`. The rule is the drawer-layers ruling of 2026-09-23 — *a FORM
> covers the nav, a MENU sits on top of it* — and nothing new was ruled.

## 1. What the code said, and why the prompt's route was not built

The prompt proposed the coaches portal's route: mount `CoachesOverlayProvider` in the admin shell, hide
`AdminKitBottomNav` on `useAnyOverlayOpen()`, register `KitDialog`. Read against the code on 2026-10-18:

- **Every admin form window already covered the bar, by layer**, bar three (§2). The bar is `z-index: 300`
  (`CoachesBottomNav.module.css`, phone block); `KitDialog` is 400/405/410 over the whole viewport; the house-league
  windows were lifted to 400 on 2026-10-08 under this same ruling; `.modal-overlay` is 1000; `BottomSheet` 600. A tap
  on the bar under any of them lands on the scrim.
- **The provider's scroll lock is inert in the admin.** On a phone the admin shell is an app shell (`.adminShell`
  locked to `100dvh`, `overflow: hidden`; `.adminMain` is the scroller), so `document.body.style.overflow` locks
  nothing. `KitDialog`'s own body lock has the same blind spot; `ChatRoomsPanel`'s header already records it.
- So the route would have hidden a bar that is already covered and added a lock that does nothing, and it would not
  have touched the three real gaps (none of them would register).

**Owner, 2026-10-18 — "fix the real gaps":** lift the windows that open under the bar, add a guard so a new one cannot,
and settle *does the page behind an open form scroll on a phone?* on a real phone before building any scroll fix.

## 2. Census — admin windows that are not `KitDialog` (2026-10-18)

Layer column = what clears the bar (300). Guard: `tests/unit/admin-overlay-guard.test.ts` (`LAYERS` + `WINDOWS`).

| Window(s) | Form / menu | Layer | Notes |
|---|---|---|---|
| House league: Create season; Edit season; Add / Edit / Delete division; registrations' Decline, Add, Message; schedule's Game, Generate, Practice, Cancel practice; teams' Create, Edit, Delete / Randomize / Clear confirms | Form | `.modalOverlay` 400 | lifted 2026-10-08 |
| House league teams: draft mode | Form | `.draftOverlay` 400 | |
| Tournament registrations: Add my team, Add team | Form | `.modal-overlay` 1000 | |
| Tournament schedule: Resolve facilities, Resolve locations | Form | `.modal-overlay` 1000 | |
| `BottomSheet` (registrations' view sheet, MoveSheet, check-in sheet) | Form / menu | 600 | portalled |
| League cap upgrade window | Form | 999 inline | |
| `FeedbackModal`, `FeedbackWidget` | Form | 1000 / 1100 | |
| Early access window | Form | 1000 | |
| Plan panel (billing, every upgrade link) | Form | 406 / 407 | |
| Help drawer | Reader | 700 | |
| Chat: Manage members | Form | 700 | |
| Chat: rooms drawer (phone) | Menu | 700 | closes on a pick |
| **Chat: New room** | Form | **70 → 400** | **gap 1** — and the drawer stood over it (§3) |
| **Budget vs. Actual: cell detail, plan** (`MoneyMonthGrid`) | Form | **coach `.modalOverlay` 200 at 641–900 → 400** | **gap 2** |
| **Shared library: award icon picker** | Form | same | **gap 3** |
| `SheetFrame` form sheets | Form | 390 / 410 | |
| Onboarding wizard + plan chooser | Form | 80 | no bar: a focused flow |
| Rep-team link popover (registrations) | Menu | anchored | picks and closes |
| More sheet, sidebar strip menus, Filter / Tools / reorder / division pickers, flip pill, export, account and workspace popovers, help tooltip | Menu | — | stay out, by the ruling |
| Chat: delete-message confirm | Form | inside the chat panel | the panel's own layer; not a page window |
| `PrintedPage`, MoneyKit's FormError portal, AllocationWindow's `closest('[role="dialog"]')` | not windows | — | |

## 3. As built (2026-10-18)

1. **New room** (`components/chat/NewRoomDialog.module.css`): the backdrop 70 → 400, the kit's form layer.
2. **The rooms drawer closes when New room opens** (`app/[orgSlug]/admin/tournaments/chat/page.tsx`). On a phone the
   drawer is the only door to New room, and at 700 it stood over the window: the window opened dimmed and untappable
   behind it. The drawer is a menu; a menu closes on a pick, as choosing a room already did. Focus: the drawer hands
   focus back, then the window's name field takes it (its own `setTimeout`).
3. **The coach window's bar clearance runs to 900, not 640** (`app/[orgSlug]/coaches/coaches.module.css`). The
   `.modalOverlay { z-index: 400 }` line moved from the @640 block to its own @900 block — the bar's own breakpoint.
   ⚠ **This reaches the coaches portal too**, on screens 641–900 wide only: every coach window now stands over the bar,
   sheets and the autosave word there, exactly as it already did at 640 and below. It also closes the same gap in the
   coaches portal's own Budget vs. Actual windows, which never registered. First tried as a `[data-admin-kit]`-scoped
   rule; `check:admin-old-look` refuses that scope (the admin is always on the kit), and the coach CSS's own header
   argues safety must be the default, not opt-in.
4. **The coach autosave word rises over a window at 641–900** (`/review` 2026-10-18, F1, confirmed). The pill is 250; with
   windows lifted from 200 to 400 at those widths it would have hidden under the window whose edits it reports — the
   practice plan's block sheet, station form and question windows — and "Couldn't save · Retry" with it, the §227
   defect at 640 again. A `@media (min-width: 641px) and (max-width: 900px)` rule lifts it to 410 over ANY
   `.modalOverlay` (what it was over while windows stood at 200) and leaves its place above the bar (a card leaves the
   foot free). The ≤640 rule (§227) is untouched.
5. **Guard** `tests/unit/admin-overlay-guard.test.ts`: reads the bar's layer from its stylesheet; every window layer
   the admin draws or borrows must sit above it; every admin file whose code draws a window is named with its layer or
   why it is not a form (a new one fails until answered); the save pill rises over a window at 641–900; the chat
   drawer closes on New room and then opens the window.

**Not built, by the owner's scope:** `CoachesOverlayProvider` in the admin shell, the bar reading the signal, `KitDialog`
registering. **Owed:** the phone check in the walk — if a swipe on an open form moves the page behind, the fix is a lock
on `.adminMain` (the admin's real scroller), not the body, and it is its own small change.

## 4. Gates (2026-10-18)

- New guard 17/17; `nav-standard-guard`, `admin-kit-nav`, `club-stage1-screens-guard`, `tournament-stage5-chat` 71/71;
  `npm run typecheck` clean.
- Full unit suite 7856/7858. The two failures are already on `dev` and are not this change's: `coach-semantic-ink`
  (`.occGroupPermit`, `1c8df8fb` 2026-10-11) and `club-stage6c-screens-guard` W11 (the admin rail's scrollbar). They
  stop `verify:changed` at its `npm test` step, so its later steps were run one by one: spelling, CSS purity, contrast
  ×2, root files clean; `check:admin-old-look` (house-league 130 → 131) and `check:css-selectors` (`GuidanceRail`
  `.context`) fail on files this change does not touch.
- `/review` standard (2026-10-18): two lenses (correctness; regression / blast radius). Confirmed and fixed: F1 (the
  save pill, item 4). Refuted: F2 (an admin save pill under a borrowed window — no admin page that borrows a coach
  window has a save pill, and `KitDialog` is unchanged). Applied advisory: the chat assertion now also requires the
  window to open. Left as advisory: the window-signal regex misses `alertdialog` / `<dialog`, and CSS comments are not
  stripped before a z-index is read (none mis-read today).
- `check:layout` not run: the coach CSS change reaches every coach window at tablet width — a product-wide sweep,
  which never runs on the dev server (AGENTS.md). It rides the release's staging sweep.
