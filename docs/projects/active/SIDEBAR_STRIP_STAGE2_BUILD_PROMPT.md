# Sidebar Strip & Grid Width, Stage 2: the sidebar collapses to a strip of icons (built to the ratified hub)

> Paste into a fresh session on `dev`. Written 2026-10-16 from the owner's task list (Wave 1, item 4). The drawings
> were **ratified 2026-10-12**: all seven asks as recommended, plus the `/design` pass's drawing changes (owner: *"I like
> fair shares B, other than that I agree with your recommendations"*). Stage 1 (Fair shares B) is built and walked
> (`40df0587`, §322 ✅). **This session builds Stage 2, the strip. Stage 3 (time grids that fill the screen) is not
> yours.**
>
> **The spec is the hub:** https://claude.ai/artifact/5s1QP7HHsctVso78u5tUjC (source
> `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_HUB.html`). Screen 2 is the strip at your width; screen 8 is the
> club and tournament sidebar at true size (hover an icon, open Rep Teams' and the tournament tile's menus); screen 9 is
> the Coaches Portal sidebar; screen 10 holds the rulings; screen 11 is the formatting check.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Where you must depart, say so at
>   build time and record why in a new plan section, "9. Stage 2 as built"; never silently.
> - **The plan is the call list:** `SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md` §3 ("Part 2 — the strip, as drawn", and
>   "Risks to check in the build"), §6 (the asks as ruled), §8 (rollout). The design log entry is
>   `memory/design_decisions.md` 2026-10-12, "THE SIDEBAR COLLAPSES TO AN ICON STRIP, BY CHOICE, PER DEVICE…".
>
> **Read first:** the plan whole; the PM brief; `AGENTS.md` (this Next.js is not the one you know — read
> `node_modules/next/dist/docs/` before touching a layout); memory `project_sidebar_strip_grid_width`,
> `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `decision_drawer_layers_form_vs_menu` (a form covers the nav, a menu sits on top of it),
> `decision_waiting_count_is_amber_pill`, `reference_root_hydration_wipes_html_attrs`,
> `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`, `reference_partial_commit_shared_tree`; and the binding Coaches Portal
> closed-season rule in `CLAUDE.md` (a team with no live season has ONE door, in every nav).

## ⚠ What the code says that the plan gets wrong (read 2026-10-16; re-read before you build)

- **There are THREE desktop sidebars, not two.** The plan names `AdminKitRail` (club + every tournament) and
  `CoachesSidebar` (the Premium portal). The **free Coaches Portal** has its own left rail, inside
  `components/coaches/CoachPortalShell.tsx` (`<aside className={styles.rail}>`). The free coach header project gave it
  the paid strip, Chat and Help on 2026-10-13 to 10-16, and the decisions log of 2026-10-15 says the free portal
  *"wears the paid portal's shell at every width"*. The owner's ask was "all portals". **Ask the owner at build start**:
  does the free portal's rail get the strip too? Recommend **yes**, with the same setting. Draw nothing new: its rail
  is a shorter list of the same kinds of rows, so the coach drawing (screen 9) is its spec. Record the answer.
- **The paid coach sidebar is 220 wide, not 248.** `CoachesSidebar` reads `--coach-sidebar-w: 220px`, declared once in
  `app/[orgSlug]/coaches/coaches.module.css` and read by `.sidebar`, the Save bar (`left:`), the lineup builder's docked
  bar and the floating save pill. **`--coach-rail-w: 248px` is the free shell's** (`CoachPortalShell.module.css`:
  `.rail` width, `.mhead` margin-left, `.content` padding-left). The plan's "Coach: `--coach-rail-w` in three places"
  sentence describes the free shell. Hub screen 9's "248 wide" is the same mix-up. **Make the strip a value of each
  shell's own variable**, so everything pinned to the sidebar's edge follows it: the docked bars, the save pill, the
  masthead. Grep for every reader before you change a value, and grep for hard-coded `220px` / `248px` / `240px`
  beside them.
- **Sign out is no longer in the coach sidebar** (retired into the account menu 2026-09-01). The coach sidebar ends with
  Help and, for an org admin, Admin. The admin rail still ends with Help and Sign out. "Collapse sidebar" is the last
  row under whatever each one ends with (Ask 2).
- **Club rows moved since the drawings:** Calendar sits under Overview (6b, 10-09), Schedules under Calendar (11a), and
  Accounting is one page with tabs (it keeps its count inside, Stage 3a Ask 2). Re-derive "a program with 2+ pages
  opens a menu; a one-page program navigates" (Ask 3) from today's `AdminKitRail` and its `ProgramRow` `hasPages`, not
  from the hub's list, and the tournament rail's Operations / Setup / Admin groups from `TournamentRail`.

## What this code already taught (carry it)

- **A per-device setting read in the browser must not cause a hydration mismatch.** On 2026-10-13 a root hydration
  failure wiped the `<html>` theme attributes product-wide (`NoFlashRestore` fixed it). The server always renders the
  full sidebar. Then either:
  - apply the strip in a layout effect (the house "measure before first paint" pattern the free shell's comment
    names: `OrgNavSync` / `ChatPanel`). That holds for client navigation, but a cold load paints the server's full
    sidebar first and then snaps; or
  - set a data attribute on `<html>` before paint, the way the theme's attribute is set, with the attribute restored
    after any rebuild as `NoFlashRestore` restores the theme's, and let CSS read it.

  Pick one, say why, and test a cold load with the strip set (a strip user must not watch the sidebar snap on every
  page load).
- **`localStorage` can be empty or throw** (private windows, blocked storage, thumbnail capture). Wrap every read and
  write in try/catch; unreadable means the full sidebar. One key, shared by every portal on the device (Ask: "one
  setting per device, shared by both portals"). Name it beside the existing `flhq-` keys (`flhq-coach-nav-groups`,
  `flhq-coach-last-team:*`).
- **The coach rail's order is a function of grants** ("position is a function of grants"): every page an icon, in
  today's order, the five groups as hairlines (Ask 6; 945 tall, it scrolls on a laptop: accepted).
- **Counts keep their own look on the icon's corner:** the amber waiting pill, the chat count's lime pill, `ReleaseDot`
  on Help (the `/design` pass's items 2 and 3). No count, dot or badge may be lost in the strip, in any portal or role.
  That is a success criterion.
- **Menus and layers:** the program menu is a menu (above the sidebar; Escape closes; focus returns to its icon;
  Enter / Space open it). Windows and forms cover the strip exactly as they cover the full sidebar.
- **The closed-season gate:** a coach team with no live season shows its one door in the strip, never the live tools
  (`CoachTeamSeasonGate`, decided server-side). Test it on a closed-season team.
- **Phones and portrait tablets are out of scope** (≤900px keeps the bottom bar, unchanged), as are the public site's
  `TournamentSideRail`, the volunteer shells, the help guide's contents rail and the tournament public preview.
- **Demos:** they open on the full sidebar and the strip keeps every door, so no tour anchor moves. Confirm with
  `check:demos`; never change a demo file.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. **Wait for "Needs attention clears itself" to commit** if
   it still holds uncommitted changes in `components/notifications/` (the bell's drawer sits under the top strip beside
   the rail) or the coach shells. Other sessions' hunks in shared files (TODO, the QA ledger, the design log) are theirs.
2. **No other frame change in flight.** This build changes every portal's frame. Nothing else that changes a sidebar,
   the top strip or a shell runs beside it, and it finishes before Club Tier Stage 8's nav review (Club plan §6 Stage 8).
3. **The UX summary for the owner comes first** (AGENCY_RULES):
   - what a club admin, a tournament director, a Premium coach and (if ruled) a free coach see;
   - the collapsed strip, getting back, the menus, the counts;
   - that nothing moves for anyone who never collapses it;
   - that phones are unchanged;
   - the free-rail question above.
4. **One browser tester at a time.** Ask before any capture, probe, `check:layout` run or `auth-setup`. Shared shell
   modules change, so a dev-server restart is owed before the walks: ask first.

## What to build, in this order

1. **The setting:** one small shared module (read / write / subscribe, try/catch), plus the hydration approach above.
2. **`AdminKitRail`** (club + tournament): the 64 strip, 40×40 targets, 18px icons; labels and group headings become
   hairlines; the name on hover **and** keyboard focus; each icon keeps its accessible name. Programs with 2+ pages
   open their menu (a rep team's or a house-league season's block inside it); one-page programs navigate. The
   tournament picker and the coach team picker become initials tiles that open their lists. The coach list keeps its
   "No live season" group. "Collapse sidebar" is the last row; in the strip it is the expand icon. The scroll on a
   tall tournament strip already exists (`railScroll`).
3. **`CoachesSidebar`** (Premium), then **the free rail** if the owner said yes. Same strip and same setting; the team
   picker as a tile.
4. **Everything pinned to the sidebar's edge follows it** (the variables above); measure a docked save bar and the
   floating save pill in both widths.
5. **Help (`/docs`):** one short "Collapse the sidebar" section in each portal's guide. "Sidebar" is the help's word
   (39 uses).

## Gates

- `npm run verify:changed`, `npm run typecheck`, the nav guards (`admin-kit-nav.test.ts`, `coach-nav-groups.test.ts`,
  the free shell's guards: grep `tests/unit` for `CoachPortalShell` and `CoachesSidebar`), `check:demos`,
  `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:spelling`.
- **A guard for this project** (`tests/unit/sidebar-strip-guard.test.ts`):
  - every portal reads the one setting module;
  - no sidebar width is hard-coded outside its variable;
  - every row in the strip keeps an accessible name;
  - every count/dot component the full rail renders, the strip renders.
- **`check:layout --changed`** on a handful of club, tournament and coach screens at 1280 and 1440, Warm and Dark, in
  **both** sidebar states. The sweep needs a way to set the strip before measuring (plan §3 risk: "baselines need a
  strip-mode pass"). Add it, baseline new entries with reasons, and **never run a whole-product sweep on the dev
  server** (AGENTS.md).
- Then `/simplify` (a new shared module and a new prop pattern across three shells), `/review` at the **high-risk**
  tier (shared shells, every portal), and a `/design` review of the built strip against the hub at 1280 / 1440, Warm and
  Dark.

## Walks and hand-off

- A new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger before and after
  appending), as checkable walks on the hub's QA tab, one purpose each:
  - collapse and expand in each portal;
  - a program's menu by mouse and by keyboard;
  - counts on the icons (a club with a waiting count, a coach with chat unread, Help's dot);
  - a window opened over the strip;
  - a closed-season coach team;
  - the setting surviving a reload and shared across portals on one browser;
  - Dark.

  Use the UAT fixtures (UAT Rep Club owner, a Tournament Plus owner, a Premium coach, a free coach if ruled), with
  passwords from `.env.local`.
- Republish the hub at the same address (read the live copy in full first; parse every script before publishing).
- An owner-voice summary, departures, and anything found and not fixed.
- Records: plan §7 (Stage 2 built) and a "Stage 2 as built" section, the PM brief's status, memory
  `project_sidebar_strip_grid_width`, the TODO line, and the design log only if a ruling was made during the build.
- **Commit only when the owner says**, from explicit paths (a private index when shared files hold other sessions'
  hunks); export and typecheck the staged tree first.
