# What's New Gets a Home — Plan

**Status:** drawings approved, all eight asks as recommended (owner, 2026-11-07). Stages A, B and C built 2026-11-07 (typecheck, focused lint, `tests/unit/whats-new-home-guard.test.ts` and the sidebar/billing guards pass; help sentences about the dot corrected); browser walk owed, commit owed. Stage D (coaches Overview note) not started. No announced entry exists yet, so nothing lights for customers until the first yes at a release.
**Drawings:** https://claude.ai/artifact/45KhvG8ngZeMsy1Pwq26D7 (`docs/projects/active/WHATS_NEW_HOME_DRAWINGS.html`)
**PM brief:** `WHATS_NEW_HOME_PM_BRIEF.md`

## Why

The "new release" dot sits on Help in the desktop rails and clears only when someone opens the public What's new page.
Help is where you go when stuck; release news is something the product tells you. Mixing them made a dot that is on
nearly all the time, so it carries no information. The owner agreed (2026-11-07) to separate them and to make the owner
the one who decides which releases are worth announcing.

## Rulings (the eight asks, all as recommended)

1. The Help center keeps its "What's new" link, **without** the dot.
2. The row sits at the top of the account menu's settings group (desktop); on phones it goes in the More sheet's
   **"You" group next to Account**, NOT in the bottom group (Help, Send feedback, Download app, Sign out), whose order
   was ruled 2026-10-17 (nav standard N7) and is not touched.
3. **No dot on the avatar.** The Overview note is the signal; the menu row's "New" tag only helps once someone opens it.
4. The row opens the **public What's new page in a new tab** (nothing new to build). An in-app release page is a
   separate decision, not part of this work.
5. The Overview note sits **under the title** (about 55px push-down while an announced release is unread).
6. The note goes on the **club admin Overview first**; the coaches Overview gets it in a second step after the club side
   has been seen working. The menu row and phone tile cover coaches from day one.
7. The release agent proposes announce yes/no with a reason; the rules on tab 4 of the drawings are the starting set;
   at most one line per release; "don't announce" is a normal answer.
8. Past releases count as already read: nobody sees a "New" tag on day one.

## What changes for people

- Help is a plain row everywhere (club admin, tournament admin, paid and free coach rails).
- "What's new" is a row in the account menu (desktop, admin and coach portals) and a tile in the phone More sheet.
  The row shows a small **New** tag only while an announced release is unread on this device.
- An announced release shows one dismissible line under "Overview" on the club admin home. Dismissing it, or opening
  What's new, clears the note and the tag on this device.

## Build scope (technical)

Stage A — remove the dot:
- Drop `<ReleaseDot>` from `AdminKitRail.tsx`, `CoachesSidebar.tsx`, `CoachPortalShell.tsx`; remove it from
  `WhatsNewHelpLink`. Update `tests/unit/sidebar-strip-guard.test.ts` (ReleaseDot assertion) and the stub in
  `tests/unit/plan-billing-coach-host.test.ts`. `strip.cornerDot` CSS goes if nothing else uses it.
- Amend the notes that say Help carries the ReleaseDot: `memory/design_decisions.md` (the 2026-09-01 "HELP STAYS OUT OF
  THE MENU" clause stays true; only its ReleaseDot mention changes), `COACH_ACCOUNT_MENU_PLAN.md`,
  `FREE_COACH_HEADER_PARITY_PLAN.md`, `FREE_COACH_HEADER_PARITY_BUILD_PROMPT.md`.

Stage B — the announcement data and the row:
- `lib/release-announcements.ts` (new, a few lines): `ANNOUNCEMENTS`, newest first, each `{ date, line }`. Kept apart from
  `RELEASE_ENTRIES` so the account menu on every public page does not carry the whole changelog in its bundle (found in
  `/review`). The unread test is "the newest announcement is newer than this device's seen date AND within 30 days of its
  date" (same `fl_whats_new_seen` key). The 30-day window is a build decision, not one of the eight rulings: it stops a
  brand-new or cleared device from being shown an old announcement as new. No announcements exist yet, so nothing lights
  on day one (ruling 8). `/changelog` clears it by storing the announcement's date.
- `components/shared/AccountMenu.tsx`: a What's new row at the top of the settings group, behind a new prop set by the
  admin and coach strips (off for the support console and public hosts). Opens `/changelog` in a new tab and clears
  unread.
- Phone: one row in the "You" group of `AdminKitBottomNav`, `CoachesBottomNav` and `CoachFreeBottomNav`.
  `MoreSheetFoot` is not touched. Sandbox decision: show in the demo sandboxes (read-only, opens a public page).
- The "New" tag: soft olive tint chip. Not in the design system today, so this is a flagged extension to log.

Stage C — the Overview note:
- A one-line dismissible notice built from the shipped `ClubKit` notice look, placed directly after the page header in
  `ClubHubKit.tsx`; the X is new and needs a 44px tap area at phone widths. The fee-overdue banner stays above it.

Stage D — coaches Overview note (after A–C are seen working).

Release agent (`.claude/commands/release.md`, step 1d-3): propose announce yes/no with the rule used and a one-line text,
asked at the same approval as the notes; a yes adds the announcement to `lib/release-announcements.ts`. Edited 2026-11-07 at the owner's request, in
its own commit.

## Checks owed with the build

`npm run verify:changed`; `/docs` (help articles mention What's new); `/review` and `/simplify` per the usual offer;
`check:layout --changed` on the club admin Overview (note present and absent) and the phone More sheet; owner walk.
