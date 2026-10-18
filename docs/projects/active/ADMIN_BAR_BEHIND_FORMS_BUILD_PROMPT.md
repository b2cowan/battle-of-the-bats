# The admin phone bar steps aside for an open form (the coaches portal's rule, brought to the admin)

> Paste into a fresh session on `dev`. Written 2026-10-18. **Owner call 2026-10-17** (Nav Consistency build start): the
> admin phone bar hiding behind an open form is **its own unit of work** — this prompt. The rule itself is not new: it is
> the coaches portal's, ruled 2026-09-23 (memory `decision_drawer_layers_form_vs_menu`: *a FORM covers the nav, a MENU
> sits on top of it* — covering a nav is not taking it away). This session brings the admin to it; it rules nothing new.
> If the work turns up a choice the rule doesn't answer, stop and ask.

## What the owner sees today, and after

- **Today:** on a phone, an admin opens a form window (new team, record a payment, edit a division…) and the bottom bar
  stays live underneath it. A tap that misses the window's foot lands on a tab and leaves the form, and the page behind
  the window still scrolls with a swipe.
- **After:** while a form window is open, the admin's bottom bar steps out of reach (hidden, no layout shift) and the
  page behind stops scrolling, exactly as in the coaches portal. A menu (the More sheet, a strip menu) still sits on top
  of the bar and keeps it. Closing the last window brings the bar back.

## What the code says (read 2026-10-17 at the nav build; re-read before you build)

- **The mechanism exists and is the coaches portal's:** `lib/coaches-overlay.tsx`. `CoachesOverlayProvider` keeps a
  COUNT of open windows (they stack) and locks the body's scroll while it is above zero; a window registers with
  `useOverlayOpen(open)` or, where the provider may be absent, `useOverlayOpenIfAvailable(open)`; a bar reads
  `useAnyOverlayOpen()` and adds its `navHidden` class (`components/coaches/CoachesBottomNav.module.css` — visibility,
  not display, so nothing reflows). Read the file's header before touching it.
- **The admin shell does not mount the provider** (`app/[orgSlug]/admin/layout.tsx`; the coaches layouts do), and
  `AdminKitBottomNav` never reads the signal.
- **The admin's windows don't register.** The shared one is `components/admin/kit/club/KitDialog.tsx` (~77 files use
  it). About 14 admin files draw their own window (a portal or a `modal-overlay`) instead. `FeedbackWidget` already
  registers with `useOverlayOpenIfAvailable` (Nav Consistency `/review`, 2026-10-17), so the bar's own Send feedback is
  covered once the provider is mounted.
- **The cheap route, and the one to start from:** mount the provider in the admin shell, make `AdminKitBottomNav` read
  the signal, and teach `KitDialog` to register (`useOverlayOpenIfAvailable(open)`). That covers most screens in three
  edits. Then census the windows that are not `KitDialog` and register each, or record why one is a MENU and stays.
- **Watch for:** a window that is mounted closed and toggles `open` (register on `open`, not on mount); windows that
  stack (a confirm over a form — the count handles it, but check the bar returns only after the last closes); a page that
  already locks scroll its own way (two locks fighting); the tournament context strip that rides the admin bar
  (`AdminContextStrip` — it should step aside with the bar); the demo sandbox (no difference expected — confirm).
- **A MENU is not a form.** The More sheet, the sidebar strip's menus, a picker's dropdown, the tournament picker: none
  of them register. If a window is truly a menu (it navigates and closes, no input), it stays out — say which and why.

## Read first

- `AGENTS.md` (this Next.js is not the one you know) and `AGENCY_RULES.md`.
- `lib/coaches-overlay.tsx` (header), `components/admin/kit/club/KitDialog.tsx`, `components/admin/kit/AdminKitBottomNav.tsx`,
  `app/[orgSlug]/admin/layout.tsx`, the admin shell component it mounts.
- Memory: `decision_drawer_layers_form_vs_menu`, `project_nav_consistency_review`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
  `reference_partial_commit_shared_tree`.

## Preconditions

1. On `dev`, `git status` read fresh. If another session holds uncommitted changes in a file this touches, wait or ask;
   never stage its hunks.
2. **The UX summary for the owner comes first** (AGENCY_RULES): two or three sentences from "What the owner sees" above.
3. A short plan + PM brief pair (`docs/projects/active/ADMIN_BAR_BEHIND_FORMS_PLAN.md` + `_PM_BRIEF.md`) with the census
   of windows, and a TODO line linking them.
4. Ask before any browser capture, probe or dev-server restart. A restart is owed before the walk (new provider in a
   shared shell).

## Build

1. The cheap route above (provider, bar, `KitDialog`).
2. The census: every admin window that is not `KitDialog` — a table in the plan: file, form or menu, registered or why
   not. Register the forms.
3. A guard, `tests/unit/admin-overlay-guard.test.ts`: the admin shell mounts the provider; `AdminKitBottomNav` hides on
   the signal; `KitDialog` registers; every admin file that portals a window either registers or is on a named
   exceptions list with its reason (the way `coach-…-guard` tests list theirs).

## Gates

- `npm run verify:changed`, `npm run typecheck` (a shared shell changes), the nav guards (`nav-standard-guard`,
  `admin-kit-nav`, `club-stage1-screens-guard`).
- `check:layout --changed` only if it scopes to a few screens; a shared shell sweeps every screen, which never runs on
  the dev server (AGENTS.md) — say so and leave it to the release's staging sweep.
- `/review` at the standard tier (a shared shell and a shared window component).

## Walk and hand-off

- One Owner QA ledger section (take the number when you write it; grep before and after appending), published as a
  checkable walk: one purpose — *"on a phone, an open form hides the admin bar and stops the page scrolling; a menu
  doesn't"* — a handful of forms across the club and a tournament (a `KitDialog` one, a census one, a confirm stacked
  on a form), the More sheet (stays on top), and the sandbox. Name the account and the page in every step (UAT Rep Club
  owner; the UAT_ORG owner for a tournament).
- Records: the plan's as-built note, the PM brief's status, the TODO line, memory `project_nav_consistency_review`'s
  "Owed" line.
- **Commit only when the owner says**, from explicit paths.
