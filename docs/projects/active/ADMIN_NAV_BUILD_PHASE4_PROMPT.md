# Build prompt — Navigation, Phase 4: the Coaches Portal on a computer (team cell, split strip, no team bar)

> **⚖ GATE DONE 2026-11-11 — skip "Gate" and Step 1; start at Step 0 (the shared switcher).** Drawings: tab 17 "Phase 4 gate"
> (artifact version 15, /design applied). Owner ruled **C1–C9 all A**; the rulings, the measurements (240 breaks no page) and
> what each call means for the build are in `ADMIN_NAV_EVALUATION_PLAN.md` §5 Phase 4. Where they differ from this prompt they
> win: drill-ins keep the record's title in the page (C4), the scouting reminder sits under the page's top row (C3), the game-day
> chip + "Open the bench ›" never give way (C2), the crest is built now (C7), the club's name leads the facts (C9).
> Also logged: an owner review of the page's top row (the "?" and buttons) in both portals, AFTER this phase — build C1 as ruled.

> One session, pasted into a fresh chat (`/clear` first), after Phase 3 has landed (walk §512 passed 26/26 2026-11-11).
> Written 2026-11-11 from the owner's rulings (asks E1–E16 all as recommended; **E6, E7, E9, E10 (team), E11, E14 are this
> phase's asks**), from what Phases 1–3 actually shipped, and from a code survey of the coach chrome the same day (a helper's
> report; the anchors below were spot-checked against the code). Plan of record:
> `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` (§0, §2, §3, §4, §5 Phase 4 and the Phase 2 Part A/B records, §6).
> Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. **Model: Opus for this session** (many pinned guards, a sticky-offset
> variable read in five places, first-paint judgement). Helpers read on Sonnet.

## What Phases 1–3 shipped that this phase stands on
- **The tournament admin is the pattern.** Its sidebar is headed by `EventCell` (`components/admin/kit/AdminKitRail.tsx` ~L127–172): a
  `<button>` whose whole cell opens a list, `SidebarLogoTile` + `CellName` (two-line clamp, a title only when cut) + a chevron (`strip.fullOnly`),
  open state reset on a path change. The list is `EventSwitchMenu` (`components/admin/kit/EventSwitchMenu.tsx`, a 320 px `role="menu"`, fixed,
  anchored under the cell or beside the folded tile), rows built only while open from `eventSwitchRows` / `EventSwitchItems`.
- **The strip names the page.** `DeskTitleProvider` / `useDeskTitle` (`components/admin/DeskNamedPage.tsx`) over the pure `deskTitleAt`
  (`components/admin/kit/kit-tournament-groups.ts` ~L91–106: the sidebar's own lit row → its label; null where the page keeps its own title).
  `AdminTopStrip` (`StripPlace` ~L64–111) renders `<h1 class="name pageName">` plus a `.facts` span at the right end; `split` renders `.lcell` (the
  `--admin-rail-w`-wide cell with the wordmark and the portal word) and `.rcell`, opted in with `styles.stripSplit` from `CoachTopStrip.module.css`.
  `AdminPageHeader` sets `data-desk-named='actions'|'empty'` and CSS hides the title block; the actions keep the row, the "?" last (E11).
- **No folding in the tournament sidebar** (E14, Phase 2 Part A): headings are labels, the list scrolls between the pinned cell and the foot;
  `fl_nav_groups` and `defaultOpenFor` are gone. **One width: `--admin-rail-w: 240px`** (`app/[orgSlug]/admin/admin.module.css` L12; 64 folded).
- **The foot is one order** (Phase 1 Part A) — Plan & billing · hairline · the other portals · Collapse sidebar — already on the Premium coach rail
  (Help lives in the account menu via `helpHref`; the demo sandboxes keep Help in the sidebar foot).
- **The logo tile** is one component, `SidebarLogoTile` (24 open / 40 folded; props source, aspect, name, size). Phase 2 noted "team crest passes its own in
  Phase 4, not wired". E10 for a team: **team crest, else team colour, initials when none**; white ground + hairline ring. Check what a team actually has
  (`teamColor` is on every assignment; verify whether any crest/logo exists before drawing one).
- **The phone breakpoint is 900 px and below** (`@media (max-width: 900px)`; the desktop is `min-width: 901px`). **Phase 5 is the coach phone** — this phase
  must leave the phone exactly as it is (see Gotchas: the team header is also the phone's bar).

## The coach chrome today (verified 2026-11-11)
- `app/[orgSlug]/coaches/layout.tsx` (server) → `OrgProvider > CoachesProvider > HelpDrawerProvider > CoachesOverlayProvider > ConfirmProvider > CoachesChrome`.
  Its wall branches (~L102, 165, 236, 296) render `<CoachTopStrip />` / `<CoachTopStrip wall />` with **no sidebar** — the split must be opt-in.
- `components/coaches/CoachesChrome.tsx`: desktop = `.coachesShell > CoachTopStrip + CoachesSidebar + <main.coachesMain>`; `CoachesBottomNav` is a sibling.
- `components/coaches/CoachTopStrip.tsx` (~L64–135, fixed, hidden ≤ 900): `BrandLockup`, divider, the literal **`Coaches Portal`** (~L95), then `NotificationBell`,
  `AccountMenu` (with `helpHref`), `WorkspacesPill`. Props `wall` and `free` (**the free portal mounts it at `CoachPortalShell.tsx` ~L476 — out of scope, E13; keep it
  byte-for-byte as it is**). It has an opt-in `.stripSplit` (CSS ~L135) that only `AdminTopStrip` uses.
- `components/coaches/CoachesSidebar.tsx` (~L176–497): team `<select id="coach-team-select">` (~L318–355, only when 2+ teams; closed teams in an `<optgroup label="No live season">`,
  `onChange` pushes `…/teams/{id}` or `…/season-end`), `TEAM_NAV_GROUPS` (~L80–151, a non-exported local const), **folding groups** (`flhq-coach-nav-groups` ~L163; `Team` closed by default via
  `COACH_NAV_DEFAULT_CLOSED_GROUPS` in `lib/coach-nav-visibility.ts`; chevron `<button>` headings ~L409–430; closed groups drawn inside `strip.foldedGroup` ~L432), the foot (~L443–477),
  `SidebarStripTile` (initials) + `SidebarStripMenu` "Your teams" for the folded 64 px rail (~L319–325, 480–496). **Width is `--coach-sidebar-w: 220px`**
  (`app/[orgSlug]/coaches/coaches.module.css` L495; 64 folded at L1184).
- `app/[orgSlug]/coaches/teams/[teamId]/layout.tsx` (server): `CoachPageHelpProvider > CoachTeamHeader (~L120–134) > CoachTeamSeasonGate (~L145–155) > CoachSeasonRefusalNotice + children`.
  The header **must stay a direct child of `.coachesMain`** (the docblock at ~L28–30: its sticky pin and negative margins depend on it). The layout already resolves live/closed seasons and the
  masthead feed (`records`, `status`, `scoutingNudge`, `gameDayConsole`) — the strip's right-end facts can reuse it.
- `components/coaches/CoachTeamHeader.tsx` (~L72–394, `role="banner"`, the 56 px team bar): team name, meta (club · season label · record), right slot "Complete / Final record" · "Game day" ·
  "Next <day time word>", **the page-help "?" (`CoachPageHelpSlot` ~L320)**, a scouting-nudge row (~L330–354), an Overview-only unpinned page line (~L386–391), and it publishes **`--coach-header-h`**.
  ⚠ **It is also the phone's bar**: the team name is the phone switcher button (`canSwitch = isPhoneNav && …` ~L159) opening `CoachTeamSwitchSheet`.
- `components/coaches/CoachPageHeader.tsx` (~L56–227; props `icon, title, titleChips, actions, actionsPhoneHidden, actionsPhoneInTitleRow, help, helpLabel, variant, backTo`):
  back arrow, icon tile, `<h1>`/`<h2>`, actions, and the "?" only when no host exists. **45 call sites in 35 files** (42 under `app/[orgSlug]/coaches/…`, 3 in `components/coaches/`).
  Shapes: A icon+title+help only (~20); B +actions (2); C +actions+`actionsPhoneInTitleRow` (Skills & goals, Notifications, Overview); D +`actionsPhoneHidden` (Money main, Schedule, Roster main, the Lineups and Practice-plan hub views);
  E `backTo` drill-ins (lineup/practice template + circuit editors, roster player, opponent detail, practice/lineups event, development session, tournament record, handout preview); F the
  closed-season page's `title={seasonTitle}` (`season-end/page.tsx` ~L607 — `wrapped?.seasonName ?? closed?.programYearName ?? "Season's End"`).
- **There is no coach "place" hook and no `deskTitleAt` equivalent.** The nav lists are module-local consts that guards read as source text.
- **Readers of `--coach-header-h`** (all shift when the team bar goes): `coaches.module.css` (~L1268, 11004, 11006, 16078), `components/coaches/LineupInningList.module.css:17`,
  `components/shared/HubTabBar.module.css:49`, `accounting/expenses/panel.tsx:1176`, `chat/chat.module.css:13`.
- **Closed seasons:** `CoachTeamSeasonGate` (server-decided) sends a team with no live season to `/season-end`; the desktop sidebar, phone bar and More sheet collapse to that one entry
  (`withClosedSeasonNav`, `lib/coach-nav-visibility.ts`). **Do not touch the gate or add a finished-season branch** (CLAUDE.md, binding). The new cell and strip must honour it, not re-decide it.
Broad reading goes to a helper (CLAUDE.md); check its claims against the code before building on them.

## Read first, in this order
1. The plan: §0 (round 2: the width, the word "Coach", no folding, facts to the strip's right end), §2, §3 (the standard), §4 (E6, E7, E9, E10, E11, E14), §5 Phase 4 and the Phase 2 Part A/B records —
   **especially the "⚠ First step of Phase 4" note (~L486): lift `EventSwitchMenu`'s keyboard contract and placement into ONE shared sidebar switcher in `components/shared/` that
   `SidebarStripMenu`, the event cell and the coach team cell all use, and fold the `.rail:has(.switchMenu)` layer rule into it. Do this BEFORE the team cell, or the contract is copied a third time.**
   `memory/design_decisions.md` 2026-11-09 entries; `docs/agents/design/NAV_STANDARD.md` (N2, N3, N4, N7, N9, the width exception — yours to rewrite where this phase changes them; the full rewrite is Phase 6).
2. The drawings: https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 — **tab 7 "The Coaches Portal on desktop"** (before / after, the split strip, the cell) and the logo tab's coach frames (team cell open, collapsed, a wide and a very light logo).
   Whole screen, 1440 × 900 and 1280 × 800, plus the 1000 px frame.
3. Phase 2/3 records in the plan (what actually shipped and what the reviewers recorded as Low) and `components/admin/AdminTopStrip.tsx` + `AdminTopStrip.module.css` (the pattern to mirror).

## Gate (blocking, before any code)
**The drawings mostly exist (tab 7); draw only what they do not show,** then `/design` it, republish to the same artifact (version bump, a new tab "Phase 4 gate") and bring me the rulings:
1. **The team bar's other jobs.** It carries more than the name and record. Draw where each goes on a computer: the **"?"** (E11: the right end of the page's top row, always last — and a page with no actions and no title row?),
   the **scouting nudge** row, the **Overview-only page line**, **"Game day" / "Complete / Final record" / "Next …"** (E7: the strip's right end), and what happens at 900–1100 px when the facts do not fit
   (the admin strip's rule: they give way first; the page's name never truncates).
2. **What the strip names on a page that has no sidebar row and on a drill-in.** The strip names the sidebar's lit row (`startsWith` on the row href today, so `roster/[playerId]`, `lineups/[eventId]`,
   `practice/[eventId]`, `history/*` all resolve to their parent). Drill-ins carry **data titles** (an opponent's name, a player's name, an event, "Edit template") and a `backTo`. Recommended: on a drill-in the
   strip carries the **back arrow and the parent section's name**, and the page keeps its **own title** (it is the record's name, not the section's); every other page loses its paper title (E6). Say if you disagree, and
   draw one drill-in of each kind (opponent, player, template editor, tournament record).
3. **The closed-season page.** CLAUDE.md's ruling: that page is titled with the season's NAME ("2025 Season"). The strip is mounted above the page and the name is page-fetched (`wrapped?.seasonName`); `closed.programYearName`
   is in `useCoaches()` already. Draw the strip, the cell (a closed team — "No live season" — is a row in the list with its season in the trailing meta) and the sidebar's single entry. Say where the name comes from so the
   strip never flashes "Season's End" then a year.
4. **The cell.** A team crest or colour tile + the team's name (up to two lines) + a chevron **only when there is more than one team** (the plan's rule: a chevron means "switch"); a single-team coach's cell
   is a plain name that opens the Overview. The list: live teams, then the "No live season" group, a status word per row if any, the current one marked. Draw the **worst case**: a long team name at 240 px,
   a team on game day, a coach with 6+ teams, a coach with live and closed teams.
5. **The width change 220 → 240** (E9): measure the busiest coach pages at 1280 and 1366 first (the Roster table, the Schedule, the Lineups board, Money). Report anything that no longer fits **before** building;
   the call on a page that breaks is mine.
6. **Sticky offsets.** The team bar is a 56 px band under the strip. Removing it shortens `--coach-header-h` on a computer and moves every sticky toolbar/tab bar that sits under it (the five readers above).
   Say what the variable becomes on a computer (the strip alone? a toolbar row?) and how the **phone**, where the header stays until Phase 5, keeps its value untouched.
7. Present the **product-manager UX summary** and the task list before any code. **No commit without my yes.**

## What this session changes
- **Step 0 — the shared switcher.** Lift `EventSwitchMenu`'s placement + keyboard contract into one shared component; the event cell, `SidebarStripMenu` and the new team cell use it. A refactor with no visible change; prove it
  with the existing event-menu guards and the Phase 2 probe captures before you start on the coach side.
- **The team cell** replaces the `<select>` at the top of the coach sidebar (E6, E10): tile + name + chevron (only with 2+ teams), the whole cell opens the list (single team: opens the Overview); the folded 64 px
  rail keeps one 40 px tile that opens the same list beside it (replace `SidebarStripTile`/`SidebarStripMenu`'s initials tile with the shared `SidebarLogoTile`). Closed teams keep the "No live season" group and go to `/season-end`.
- **240 and unfolded** (E9, E14): `--coach-sidebar-w: 240px` (64 folded), group headings become plain labels, no chevrons, no `flhq-coach-nav-groups`, no `COACH_NAV_DEFAULT_CLOSED_GROUPS`, no `strip.foldedGroup`
  special case — the list scrolls between the pinned cell and the foot (**check the last rows at 1440 × 900, 1366 × 768 and a 1000 px window**). Delete what dies with the folding (storage reads, `toggleGroup`, the
  closed-group unread badge logic if only folding needed it — **check the Notifications/Chat badges still show on every row**).
- **The split strip** (E6, E7): `CoachTopStrip` opts into `stripSplit` **only for the team screens' desktop strip** (never `wall`, never `free`): `.lcell` carries the wordmark and the word **"Coach"** (not "Coaches Portal" — E9;
  "Coaches Portal" stays on every other surface), `.rcell` carries the page's name (`<h1>`, the one per width) and, at its right end before View site, the team's facts: season label · record · the "Next …" / "Game day" /
  "Complete" chip, in quiet ink behind a hairline, giving way first below ~1100 px. Add the coach equivalent of the place rule: a **pure** `coachDeskTitleAt` over the same list the sidebar draws (move
  `TEAM_NAV_GROUPS` / `OVERVIEW_ITEM` / the season-end item into a `lib` module the sidebar, the bottom nav's More sheet and the tests all import — the guards currently read them as source text and must be updated deliberately).
- **The team bar goes on a computer** (E6): `CoachTeamHeader` stops rendering above 900 px and stays exactly as is at 900 and below (Phase 5 retires it). Mind the `--coach-header-h` rule from gate 6.
- **The page's top row** (E6, E11): where the strip names the page, `CoachPageHeader` drops its icon tile and title (CSS `data-desk-named`, as `AdminPageHeader`), keeps its actions as a toolbar row with the **"?" last**,
  and draws nothing when there are no actions and no help. Back arrows of nested pages move into the strip (drill-ins as ruled at gate 2). The 45 call sites change by **mechanism, not by editing each file**; if a site
  needs an edit (a data title it must keep), list it.
- **The closed-season page** is titled with the season's name in the strip (gate 3); the gate is untouched.

**Not this phase:** the Coaches Portal phone (Phase 5), the free portal (E13 — `CoachTopStrip`'s `free` path, `--coach-rail-w: 248px`, `CoachPortalShell`), the gate and the closed-season page's content, any new shelf,
NAV_STANDARD's full rewrite and the help articles beyond the sentences this changes (Phase 6), a page's own content.

## Gotchas
- **First paint is a gate.** The cell's name and tile, the strip's page name and the right-end facts must be right in the server's HTML (scripts off) for a coach with one team, many teams, a closed team, and the
  demo coach — and must not change after load. The team layout is a server component and already has the team and masthead feed; thread the facts down rather than fetching them in an effect. The sheet/list is a client mount (fine).
- **Guards that pin today's coach chrome — update each expectation deliberately, in the open, and say so.** (No test contains the phrase "pixel-identical"; `ADMIN_HEADER_BAR_PLAN.md` L184/289/448/548 does — retire those lines on purpose.)
  - `tests/unit/admin-header-bar-guard.test.ts` L231–232: `doesNotMatch(readCode('components/coaches/CoachTopStrip.tsx'), /stripSplit/)` — flip it to "only the team strip opts in; wall and free never do".
  - `sidebar-strip-guard.test.ts`: L114–118 (exactly one `--coach-sidebar-w: 220px`), L204–215 (`strip.foldedGroup`; the comment says "until Phase 4"), L223, L239–244 (`<SidebarStripTile`, `<StripMenuGroup label="No live season">`). L112–126 also pin the **free** portal's 248 — leave it.
  - `coach-nav-groups.test.ts`: L97–110 (reads `const OVERVIEW_ITEM` / `const TEAM_NAV_GROUPS` out of the sidebar source), L148, L189–193 (the More sheet = the sidebar minus the phone primaries, heading order), L250–257, **L297–374 (the folding rules — most of these die with the folding; delete, do not weaken)**.
  - `nav-standard-guard.test.ts`: L35/81/103/112 (icons), L177 (sheet order), L251–257 (`helpHref`, the sandbox-only Help), **L442 (11 px capital headings — they stay labels, confirm the type)**.
  - `coach-first-screen-guard.test.ts` L46–75 (pins `canSwitch = isPhoneNav …`, `aria-haspopup="menu"`, `<CoachTeamSwitchSheet` in the masthead) and `sheet-frame-guard.test.ts` L195–224, 560 — these hold **only if the phone keeps the header**; they are your proof that the phone did not change.
  - `coach-page-actions-guard.test.ts` L152+ (the `SITES` enumeration of every `<CoachPageHeader>`; L87 reads `CoachTeamHeader.tsx`; L1044 pins the header's own-"?" fallback) — a changed site fails until the list is edited.
  - Also read: `plan-billing-coach-host.test.ts` L290–326 (rail id order — unchanged), `coaches-admin-door-guard.test.ts`, `coach-both-programs-guard.test.ts`, `workspace-flip-guard.test.ts` L539, `whats-new-home-guard.test.ts`, `chat-pause-guard.test.ts` L100, `coach-finished-season-surfaces.test.ts` L909 (reads the gate — must keep passing untouched).
  - **New guards:** one shared switcher (three users, one contract); the team strip is the only caller of `stripSplit` on the coach side; no folding state in the coach rail; the strip's page name and the sidebar's lit row come from one list; exactly one `<h1>` per width; `CoachTeamHeader` renders nothing above 900; the closed-season strip title is the season name; the free portal's strip unchanged.
- **UAT specs** use `#coaches-billing`, `#coaches-tournaments` and `#coaches-mob-*` (`premium-to-club-path.spec.ts`, `coach-findability-smoke.spec.ts`); the `<select id="coach-team-select">` is referenced by no test or script (grep found only its definition). Keep the rail ids.
- **Tab titles:** coach pages title the tab; if the strip's label feeds it, measure the final tab title (the admin side used the sidebar's words).
- **Season label & prefix:** `mastheadSeasonLabel` / `stripTeamNamePrefix` in `lib/coach-season-label.ts` strips the team prefix; the strip's season fact and the closed-season name must use the same helper — one spelling of a season.
- **The demo sandboxes** run this chrome (the coach demo is `riverdale-ridge`): the build fails if a tour destination or anchor vanishes. Do not add re-read notes; run `npm run check:demos`. Coach tour anchors may name the team bar or the select — check `CoachPortalTour.tsx`.
- **Spelling gate** (`npm run check:spelling`); the clock is "8:00 a.m." via `formatTime()`; dates via `formatStoredDate`; "Coach" in the strip, "Coaches Portal" everywhere else.
- **Shared working copy:** other sessions' hunks sit in the sidebar, the strip and the CSS. `git diff` each file before editing; commit only your own hunks (private index, exact hunks). **No commit without my yes.**
- Many repo files are CRLF — edit scripts must match `\r\n`; use the Edit tool for anything with a backslash. `npm run typecheck` needs `NODE_OPTIONS=--max-old-space-size=8192` or it can exit 0 silently.
- **Probes** (copy, don't invent): `.probe/nav-phase0/coach.mjs` (1440 × 900, `coach.json`, dumps every `<header>` box), `.probe/nav-phase1/coachfoot.mjs` (the coach foot), `.probe/nav-phase3/desk.mjs` / `phone.mjs` (the admin cell/menu captures — the template for a team-cell probe),
  `.probe/nav-phase2b/firstpaint.mjs` and `.probe/nav-phase0/firstpaint.mjs` (JS off vs on; catches swaps). Saved sign-ins: `tests/uat/.auth/coach.json`, `rep-club-coach.json` (refresh with `.probe/nav-phase3/signin.mjs` — add a coach pair); fixture ids from `scripts/uat-fixture-context.mjs`
  (`clubClosedTeamId` = a rep team between seasons; repair with `node scripts/seed-uat-coach-fixture.mjs`).
- Dev server: do not restart for routine edits; this phase adds a file and deletes CSS, so restart once near hand-off (`npm run dev` only; stop before clearing `.next`).

## Steps
1. Gate items 1–7.
2. Step 0 (the shared switcher) alone, proven unchanged; then the coach build in this order: lib module + `coachDeskTitleAt` → the cell and 240 / unfolded rail → the split strip and facts → the team bar's desktop retirement + `--coach-header-h` → the page header's top row → the closed-season title.
3. `npm run verify:changed`, `npm run typecheck`, `npm run check:spelling`, `npm run check:demos`, and `npm run check:layout --changed` on the Overview, Roster, Schedule, Lineups, Money and the closed-season page at **1440 and 1366** (dev server; never a whole-product sweep), and at **390** to prove the phone did not move.
4. **Measure and report:** the strip and sidebar at 1440 / 1366 / 1280 / 1000; the first paint (scripts off) vs after load for one team, many teams, a closed team and the demo coach; `--coach-header-h` before and after on desktop and phone; every sticky toolbar/tab bar under the strip (HubTabBar, the lineup board, the chat, expenses); the last sidebar rows at 1366 × 768; the list's keyboard / Escape / focus-return on the new shared switcher (all three users); one `<h1>` per width; the tab title.
5. `/design` on the built screens against the drawings; `/simplify` (a shared switcher, a lib module and a new rule); `/review` (high-risk: five lenses incl. first paint, sticky offsets, the phone untouched, the gate untouched).
6. `/docs`: help articles that describe the team picker, the team bar or the folding groups.
7. Write the owner walk (a checkable Artifact; one purpose per walk — the cell and its list; the strip names the page and carries the facts; the page's top row and the "?"; a drill-in and the back arrow; a closed season; a single-team coach; the folded rail; the demo; the phone unchanged), the ledger §, the plan's Phase 4 section with the measurements, the TODO line, the prompts index row and project memory (positive facts, "built 2026-MM-DD").
8. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD.

## Done when
- On a computer the Coaches Portal sidebar is 240 px, headed by a team cell (a chevron only with more than one team) whose list holds live teams and a "No live season" group; no headings fold; the foot is unchanged.
- The strip is split: "Coach" over the sidebar, the page's name over the page, the team's season · record · "Next …"/"Game day"/"Complete" at its right end; the team bar is gone; no page repeats its name; the "?" is last in the page's top row; a header with nothing to show draws nothing.
- A drill-in carries its back arrow in the strip and its own record title; a closed team lands on one page titled with the season's name, the gate untouched.
- First paint is right for every case above with nothing swapping after load; the sticky bars sit correctly under the strip; the phone, the free portal and the wall screens look and behave exactly as before.
- Guards, typecheck, spelling, demos and the changed-screen layout checks pass; `/design`, `/simplify` and `/review` findings applied or recorded.
