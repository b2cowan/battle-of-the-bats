# Build prompt — Navigation, Phase 1: the sidebar's foot, Help in the account menu, the portal word, on the club

> One session, pasted into a fresh chat (`/clear` first), after Phase 0 has landed. Written 2026-11-09 from the owner's
> rulings (asks E1–E16 all as recommended). Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` (§0, §0b,
> the strip-word ruling, §4, §5). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. If the session runs deep, stop after
> **Part A** (the foot, Help, the portal word, Tournaments leaving Programs), write the hand-off, and do Part B
> (the cell and tile, the back link) in a second session.
>
> **Refreshed 2026-11-09 from what Phase 0 shipped** (committed `fd857b765`; plan Phase 0 section). Read the section
> below before the rest; nothing in the rulings changed.

## ✅ Hand-off after session 1 (2026-11-09): Part A is BUILT — the next session does Part B only
- **Done:** the gate (tab 12 drawn, /design applied, owner ruled it as drawn; /marketing confirmed "Events"; the menu's
  legal-line removal is wanted), all of Part A, its measurements, /docs, /design on the built screens, /simplify and
  /review (applied: Help hidden for a cancelled account; the Overview keeps its Tournaments card — `programs` is what
  the club runs, `navPrograms` what the sidebar and phone list; the doors are one rule, `kitPortalDoors`). Everything is
  recorded in the plan's Phase 1 section; **committed `664f9113d` 2026-11-09**; the walk is §504 (https://claude.ai/artifact/SErpWiVT4vx3UHzgRbwvrn).
- **Part B, next session** (read the plan's Phase 1 section first): the club cell on two lines, the one 40px collapsed tile
  with the logo for all three portals, the back link's look (E12 (1)). Then measure, `/design`, `/simplify`, `/review`,
  `/docs`, its own walk.
- **Open for the owner (asked at the end of session 1):** (1) the club page's sidebar moves when the club's brief arrives
  (pre-existing; Phase 1 adds the Tournaments door to what moves) — seed the club's shape on the server, in Part B or
  Phase 2?; (2) the N10 census ran on dev only — read prod (read-only) before shipping?; (3) the coach rail's foot is not
  pinned (Phase 4 rebuilds that rail).
- **Leftovers noted, not done:** the drawings' phone foot is drawn as one column (the shipped foot is a 2 × 2 grid);
  two stale comments say the coach sidebar carries Help (`CoachesChrome.tsx` ~L23, `CoachPageHelpSlot.tsx` ~L34).

## What Phase 0 shipped that this phase stands on
- **A tournament page knows its event on the server's first paint.** The admin layout seeds the tournament provider
  (the list this person may open + the chosen event, from a per-organization cookie and the address) on tournament
  pages' full loads. Anything this phase adds that names or depends on the event — the tournament rail's foot "Club"
  door, the tournament More sheet, "Events" in the strip — reads the provider's current event, never a fetch of its
  own, so it is right on the first paint too. **A new swap on first paint is a regression of Phase 0**, not polish.
- **"Club" / "Events" is decided from the address, on the server.** The strip word must be right in the server's HTML,
  the way the event name now is; a word picked after mount recreates the flash Phase 0 removed.
- **The tab title is re-asserted on tournament pages** (the admin title manager watches the head there, because Next's
  metadata title lands after hydration). If this phase touches any title or the strip label feeds one, measure the
  final tab title on a club page and a tournament page; club pages still title themselves.
- **The measuring tool exists:** `.probe/nav-phase0/firstpaint.mjs` reads the server's paint (scripts off) and every
  change after load (scripts on), at any width, for both org kinds. Reuse it for step 3 (refresh saved sign-ins first):
  the foot, the strip word and the cell on the first paint, and that nothing swaps after load.

---

Product code. The club admin takes the new shape first, plus every piece shared by the three portals that must move at
the same moment (a Help row cannot be in the sidebar and the account menu at once).

## Read first, in this order
1. The plan: §0b (round 3), the strip-word ruling, §0 (round 2), §4 (the asks as ruled), §5. The design log entries of
   2026-11-09 (top of `memory/design_decisions.md`). `docs/agents/design/NAV_STANDARD.md` (N2, N4, N5, N6, N7, N8, N10 —
   this phase rewrites N4, N6's strip word and N7's You group; the rest in Phase 6).
2. The drawings (artifact https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4, v6): tab **4 · The standard** (the three
   foots, the club before/after, the account menu), tab **10 · Logo**, tab **5** (the 1366 × 768 frame), tab **11 · Asks**
   (E4, E9, E10, E12, E15, E16 as ruled — option A each).
3. Code: `components/admin/kit/AdminKitRail.tsx` (club cell, foot, `TournamentRail`), `components/admin/kit/useAdminKitNav.ts`
   (`helpHref`, `coachDoor`, `billingLink`), `components/admin/kit/AdminKitFrame.module.css`, `components/admin/kit/AdminKitBottomNav.tsx`
   (the More sheet: "Club overview", the You group), `components/coaches/CoachesSidebar.tsx` (foot: Help, Plan & billing,
   "Tournaments you run", "Admin"), `components/coaches/CoachesBottomNav.tsx` (You group), `components/coaches/MoreSheetFoot.tsx`,
   `components/shared/AccountMenu.tsx` (`settingRows`, `showWhatsNew`), `components/admin/AdminTopStrip.tsx` +
   `components/coaches/CoachTopStrip.tsx` (who mounts the menu, the sandbox gate), `lib/workspace-labels.ts`
   (`ADMIN_STRIP_LABEL`), `lib/admin-kit-nav.ts` (`LEAD_ORDER`, `clubPlaceGroups`, `personClubShape`, `ClubShape.hostsTournaments`),
   `lib/nav-tiles.ts` (`clubPhoneNav`), `components/shared/SidebarStrip.tsx` (tiles), the guard tests that pin these
   (`tests/unit/nav-standard-guard.test.ts` and any that grep the rail/menu; a helper finds them).

Broad reading goes to a helper (CLAUDE.md); check its claims against the code.

## Gate (blocking, before any code)
1. **Mockups first, published, ruled.** Three states the drawings do not show yet — add them as a new tab of the same
   drawings file and republish to the same artifact, then `/design` on them, then my ruling:
   - a **tournament director** (a person whose only program is tournaments, E15): Tournaments leads their club sidebar
     as a row; their foot;
   - a **club that has not run a tournament** yet: today's quiet "Also on your plan · Tournaments" row stays, and no foot
     door;
   - the **club's phone More sheet** with the Tournaments door in You, and the tournament sheet without "Club overview"
     at its top (its "Club" door in You).
2. **/marketing confirms "Events"** as the strip word inside a tournament (owner ruled the three words "Club", "Events",
   "Coach" on 2026-11-09 and asked for this check). If /marketing objects, bring it to me; do not pick another word.
3. Present the **product-manager UX summary** and the task list.

## What this session changes
**Part A**
- **The sidebar foot, one order** (admin rail — club and tournament — and the Premium coach rail): Plan & billing (the
  owner, with its bill pill), a hairline, the doors to the other portals the person holds, Collapse sidebar. Admin: Club
  (inside a tournament) · Tournaments (in the club, once the club hosts one) · Coaches Portal (`users-round`). Coach:
  Club (was "Admin"; Shield) · Tournaments you run. Help leaves every rail.
- **"Club overview" leaves the tournament rail** (its row) and the tournament More sheet's top; the club door sits in
  the foot and in More → You. **Tournaments leaves the club's Programs group**; E15: a person whose only program is
  tournaments (decided by what they can open, as `personClubShape` decides house league) keeps it as a leading row.
  N10: decide with a census whether `tournaments` stays in the phone bar / tile fill order; the ruling is that the door
  is in You, so it leaves the fill — report which clubs' bars or tiles change before changing them.
- **Help in the account menu** (E16): the second settings row, under What's new, `HelpCircle` 15, opening the portal's
  help in a new tab (admin: the section's `helpHref`; Premium coach: `/{org}/coaches/help`). **Opt-in, desktop only**
  (like `showWhatsNew`): never on public, family, marketing or platform menus, never in the phone Account sheet. The
  phone keeps Help at the More sheet's foot. **The demo sandbox hides the account menu, so its rail foot keeps Help.**
- **The strip's portal word**: "Club" on the club's screens, "Events" on tournament screens (and a tournament-only
  organization's), from one place beside `WORKSPACE_KIND_LABEL`. "Admin Area" stays in Workspaces, Home and the account
  pages' way back. ("Coach" waits for Phase 4, when the coach strip splits.)

**Part B**
- **The club cell**: the name on up to two lines (14px bold, 16px leading, clamped; the whole name on hover); still
  opens Overview; still the tab band's height (45px, the rules meet).
- **The collapsed tile, one 40px tile** (E10) showing the organization's logo (`organizations.logo_url`, uploaded or a
  made stock logo) on a white ground with a hairline ring; initials when there is none or when it is wider than 2 : 1.
  The tournament's tile follows in Phase 2, the team's in Phase 4 — build the tile once, here, for all three.
- **The back link's look** (E12 (1)): one hover and one divider in the phone bar and the desktop strip.

**Not this session:** the event in the cell, page names in the strip, folding, widths, anything in the coach strip or
team bar. Coach changes here are the foot and Help only.

## Gotchas
- One Help door per screen: the rail rows, the account menu and the sandbox exception must agree on every surface;
  write the guard that pins it.
- The account menu is shared by the admin, coach, public and family strips: the Help row is off unless a strip opts in.
- A guard pins the coaches portal "pixel-identical" from the header-bar project: this phase changes its foot on
  purpose — update that guard's expectation deliberately, in the open, and say so.
- The foot grows for an owner who holds all three portals: measure at 1366 × 768 that the foot stays pinned and the
  rows scroll (drawing tab 5).
- The More sheet order is N7's; rewrite N7 in `NAV_STANDARD.md` in this phase (its You group and item 1), and N4.
- Spelling gate: "Club", "Events", "Tournaments you run", "Coaches Portal" — `npm run check:spelling`.
- **Other sessions' uncommitted edits sit in this phase's files (seen 2026-11-09).** Check `git diff` on each file
  before editing, build on top, and commit only your own hunks (private index, exact hunks):
  - the rail, the More sheet and the club nav model carry a 2026-11-09 owner ruling — every More-sheet group with a row
    wears its heading, a one-row group too. Build the You group to that rule;
  - the account menu and its stylesheet show the legal line under Sign out (GST/HST Stage 6 step 6.2, committed) as
    **removed** in the working copy. Find out from the owner whether that is wanted before adding Help to the same
    menu; do not restore it or discard it yourself.
- `nav-standard-guard` pins the strip word as "Admin": change that expectation deliberately, in the open, with the
  "Club" / "Events" rule.

## Steps
1. Gate items 1–3.
2. Build Part A, then Part B (or hand off after A). Then `npm run verify:changed`, `npm run typecheck`,
   `npm run check:spelling`, `npm run check:demos`, `npm run check:layout --changed` on Overview, Rep teams, a club
   tournament page, Accounting and a coach page at 1440, 1366 × 768 and 390 (dev server; never a whole-product sweep).
3. **Measure and report:** each foot (club owner, club admin who is not the owner, tournament page, coach) against the
   drawing; the account menu with Help in the admin and coach strips and its absence on a public page and the phone
   Account sheet; the strip word on a club page and a tournament page; the club cell's rule against the tab band, open
   and collapsed; the collapsed tile with a logo, a wide logo, none.
4. `/design` on the built screens against the drawings; `/simplify` (a new shared tile and foot); `/review`.
5. `/docs`: help articles that say "Help, at the bottom of the sidebar", "Club overview", or where Tournaments sits.
6. Write the owner walk (checkable Artifact, one purpose: the foot, Help and the portal word), the ledger §, the plan's
   Phase 1 section with the measurements, the TODO line and project memory (positive facts, "built 2026-MM-DD").
7. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD.

## Done when
- Every admin and Premium coach sidebar foot reads Plan & billing (owner), a hairline, the other portals, Collapse; no
  sidebar carries Help except the demo's.
- The desktop account menu shows Help under What's new in the admin and the Coaches Portal, and nowhere else.
- The strip says "Club" on club screens and "Events" on tournament screens; Workspaces still says "Admin Area".
- Tournaments is a foot door for a club that hosts one, a leading row for a tournaments-only person, and the quiet "Also
  on your plan" row for a club that hosts none.
- The club cell's name takes two lines when it needs them; the collapsed tile is 40px with the logo or initials.
- The tournament More sheet opens on Notifications; its Club door is in You.
- Guards, typecheck, spelling, demos and the changed-screen layout check pass; `/design`, `/simplify` and `/review`
  findings applied or recorded.
