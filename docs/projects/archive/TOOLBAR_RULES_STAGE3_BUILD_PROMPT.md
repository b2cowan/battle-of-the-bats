# Toolbar Rules — Stage 3 (placement) build prompt, with Stage 4 (records) at its end

> Paste into a fresh session on `dev`. Written 2026-10-19, the day Stage 2's walk passed. **Precondition (true at writing):**
> Stage 1 (the one search field) is committed `56bfa9f9`, walk §330 passed 9 of 9; Stage 2 (the shapes) is committed
> `a6b0c483`, walk §334 passed 13 of 13. No migration, no API. ⚠ **A production release is being promoted from `dev` right
> now: commit locally and DO NOT push** (a push puts a new build on staging in the middle of the release's sweep) until the
> owner says the release's staging sweep is done. Also `git status` on the files in the table below before you edit — One
> Window Stage 2 (coach windows) may be in flight on some of them.

**Read first:** `docs/projects/active/TOOLBAR_RULES_PLAN.md` — §1 the rules, §2 the call list, **§9 the Stage 0 census
rulings (C1–C9, owner "as recommended")**, §10 the departures of Stages 1 and 2. **Where this prompt and the older
`TOOLBAR_RULES_BUILD_PROMPT.md` (written 2026-10-17) disagree, this one wins** — that prompt predates the census; its stale
Stage 3 lines are corrected in "What the old prompt got wrong" below. The hub (spec, census, walks):
https://claude.ai/artifact/SPjRTAB6kVqd9vJ8x1vuza — read it with the Artifact tool, every line, before publishing to it
(version 10 at Stage 2's close; its header still says "walk W2 open" — fix that). Its Practice plans and Calendar frames are
Stage 3's drawings; the census tables are the spec for every other screen below. The ruling whole: `memory/design_decisions.md`,
the 2026-10-17 "EVERY LIST'S TOOLBAR" entry and its census addendum. Then `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`
(broad reading goes to a helper; **open a helper's cited lines before relying on them** — two helper claims were wrong in
Stage 1). Every screen below was re-read in code on 2026-10-19; line numbers drift, so grep the symbol.

## What the owner will see
Narrowing filters (the plain, quiet pills) move from the left of a toolbar to the right, after the gap and before Export
(Export · Tools · lime stay in their order on the money screens). The left keeps only what picks which list — or the list's
count. Practice plans gains "24 drills" on the left and its search and Tags on the right. Coach Club money's and
Notifications' state buttons become the one view pill, on the left. Insights › Results' row of tag chips becomes one Tag pill on
the right. The Calendar's and Schedule detail's filters sit right; Schedule detail's five-view switch moves down from its
section head into the toolbar. **Phones keep what each side has** (Ask 5) — see the mechanism section.

## The mechanism (decide first, say it in the PM summary)
`components/coaches/kit/CoachListToolbar.tsx` + `CoachKit.module.css` (`.toolbar` ~274–330) has a left (`lede`, `children`)
and a right (`actions`, `margin-left: auto`). It has no place for a narrowing, so every screen below keeps its pill in
`children`. Two ways: put the pill first in `actions` (nothing shared changes), or add a `filters` slot. **Recommended: the
slot** — on a desk it renders as the right group's first half, then `actions` (the first of the two takes the auto margin,
the second none); at ≤640 it dissolves to `display: contents`, so each pill sits exactly where it does today. Per-screen
copies would each have to re-state that phone rule. Constraints either way:
- The lede is capped at 64ch, so a right-hand thing must be in `actions` or the slot, never a bare child (auto margins
  split free space — two of them strand the filters mid-row).
- `FilterGroup` (`components/coaches/FilterGroup.tsx`) draws the desk pills as `display: contents` and, at ≤640, one Filter
  button; both forms must work inside the slot. Allocations' Due takes its own line at ≤640 (`Money.module.css`
  `.filterLine`, order 3); the Calendar's Filter button sits left of the Export icon on a phone (hub phone frame).
- `CoachListToolbar` has 33 mounts in 29 files, both Ledgers among them: the new rules apply only when `filters` is passed.
- `SingleSelectDropdown restQuiet` / `MultiSelectDropdown restQuiet` are the narrowing face already; a narrowing is never
  `lead`.

## What Stage 3 builds

### Club admin
1. **Allocations** — `app/[orgSlug]/admin/accounting/allocations/page.tsx` ~215–250. `Due` (`restQuiet restValue="soon"`, Coming
   due only, inside `FilterGroup` inside `moneyKit.filterLine`) is a child beside the olive View. → right, before Send
   reminders · Export · New allocation. View stays left.
2. **Budget** — `.../accounting/budget/page.tsx` ~295–338. `When` (List view, only when a line has no date) → right, before
   Export · Tools · Add line. Year · View · Columns · Collapse all stay left (C3). Check where `When` sits at 361/390 today and keep it.
3. **Payment requests** — `.../accounting/payment-requests/page.tsx` ~148–152. `Team` (shown from two teams) → right, before
   Export; **a count on the left** ("7 payment requests", "3 of 7 payment requests" while narrowed — Practice plans' wording).
   The header comment says "No count line" — superseded by the census; update the comment.
4. **Accounting · Teams** — `.../accounting/teams/page.tsx` ~93–99. `Group` → right, before Export. Year stays left.
5. **Calendar** — `app/[orgSlug]/admin/calendar/page.tsx` ~214–240, `components/admin/kit/club/ClubCalendar.module.css` ~8–21.
   Venue · Program · Team (`FilterGroup`) and the clash pill → right, before Export. The time-zone note
   (`cal.timesOnLine`, today in `actions` above 900) → beside the dates, at every desk width, as drawn; at ≤900 the dates and
   the note already take their own row (`dateRow`) — unchanged. The view switch rounded in Stage 2. **The coach Schedule does
   not move** — it has no filters (census correction 1; verified).
6. **Schedule detail** — `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx` ~575–596. The five-view `ViewSwitch` comes
   down from `scheduleWorkspaceHead` into the toolbar's left, before the week arrows; Facility · Group · Team + the clash
   pill (grid view only) → right, before Tools · Export · Send (that order stays — Rule 3). If the line wraps at 1,200 with
   the sidebar open, the filters wrap, not the switch. The head keeps its title and sentence. The phone's `lensLine` is
   unchanged. No hub frame exists for this one: show a before/after pair in the walk.
7. **Families — nothing to build.** Committed `05eaa588`; Stage 1 already put its search right of the Show pill
   (`FamiliesBook.tsx` ~222–227: Show, spacer, search; a phone gets its own row). Glance at it in the walk.
8. **Not touched:** Ledger (Rule 7), Budget vs. Actual (nothing narrows — C3), Team statement, Overview, Venue library,
   Rep team schedule, Tryouts, Communication, the tournament admin (all placed already).

### Coaches portal
9. **Practice plans › Drills / Circuits / Templates** — `components/coaches/LibraryRow.tsx` `LibraryFilterBar` ~262–297 and
   its hosts `_DrillsView.tsx` ~322, `_CircuitsView.tsx` ~222, `_PlanTemplatesView.tsx` ~274 (under
   `app/[orgSlug]/coaches/teams/[teamId]/practice/`); CSS `.ppDrillFilters` in `coaches.module.css` ~11624. Today it is a row:
   search (left, 16rem), Tags, Sort (phone). → a **count left** ("24 drills"; "2 of 24 drills" while a search or tag
   narrows — each host has `active` and `shown`), **search then Tags right**, Sort beside Tags. **Not** the drill picker or
   the 320px docked library (`_PracticePlanEditor.tsx` ~1823, `fill`): full-width search row, no count, unchanged.
   Stage 1's /simplify already removed the Tags menu's page right-anchor; so the job is to **verify the shared pill's "opens
   where it fits" serves a Tags pill that now ends the row** (desk, 768, 390), not to build an anchor. ⚠ **The phone order
   changes** per the hub's Phone 390 frame (count, then Tags · Sort, then search on its own full-width row; today search is
   first) — read that frame and say so in the PM summary.
10. **Dues** — `.../accounting/dues/panel.tsx` `duesToolbar` ~2446–2548. `Showing` (All / Behind / Owing / Clear, today the
    plain grey face, in `duesToolbarLeft`) → right, **narrowing face** (`restQuiet restValue="all"`: quiet at rest, tinted when
    it hides someone), before Export · Send due reminders (C4). View and the installment pager stay left. It is NOT
    desktop-only (the phone cards are a long list) — keep it on the phone.
11. **Budget** — `.../accounting/budget/panel.tsx` ~2788–2900. `When` → right, before Export · Add line. View · Columns ·
    Collapse all stay left. At ≤640 the `deskActions` live in the ⋯ drawer and the lenses are View and When — keep that.
    ⚠ **Not yours:** `Manage categories` sits after the lime Add line (Rule 3 would end on lime). The census left it to the
    Categories & Items project, which has since committed (`4f091f9a`) without moving it. It needs its own call; do not move
    it here, and name it in the walk summary.
12. **Awards** — `.../history/awards/panel.tsx` ~313–330. `Award` → right, before "Give an award". **Do not add a count**: the
    "N awards given" line was removed by owner ruling 2026-09-25 (comment ~308). A rosterless team keeps its sentence as a child.
13. **Club money** — `.../accounting/club/panel.tsx`. The state row (`CLUB_FILTERS` ~468: All · Needs attention · Not filed ·
    Settled, in `clubFilterRow` ~1746, shown only from `CLUB_FILTER_FLOOR` = 12 records) → `ViewPills` (`components/shared/ViewPills`),
    in the toolbar's empty left (~1709), counts as `count`. The "Showing n of m — $x hidden" note under it stays. Delete `.clubFilterRow`
    / `.clubChip*` in `coaches.module.css` ~14369–14400 once nothing wears them (C5).
14. **Notifications** — `components/coaches/CoachNotificationsPage.tsx` ~121–139 and the shared
    `components/notifications/NotificationFeedBody.tsx` (`NotificationZoneChips` ~54, the admin's default row ~218–240; CSS
    `notifications-page.module.css` ~89–130). The zone chips (All · Needs attention [count] · Activity) → `ViewPills`, left;
    Unread · All → right, before Mark all read (C5); the chips stay hidden on a phone (owner 2026-09-06). ⚠ **Reach the census
    did not list:** `NotificationZoneChips` is one component, so the admin's Notifications page
    (`NotificationsPageContent`) takes the pill too — its placement was already right (chips left, toggle right). Recommended:
    let it (a second recipe is the alternative), record it in plan §10, put it in the walk. Also decide with `/design`: Unread ·
    All narrows, so it should read square, yet the shared `.segToggle` rounds at ≤768 (`notifications-page.module.css` ~486).
15. **Insights › Results** — `.../history/results/panel.tsx` ~275–297. The tag chips (`lineupFilterBar`, All + each tag with
    its count and a check) → **one Tag pill, right** (`SingleSelectDropdown restQuiet`, All at rest, each tag's count as
    `detail`; self-hides with no tags), in a toolbar row where the chips sit (C6). The "vs tag" summary line above stays.
    `.lineupFilterBar` / `.lineupFilterChip` are still worn by Practices' "Needs a plan" and Lineups' "Needs lineup" — leave them.
16. **Tryouts check-in** — `components/rep-teams/TryoutCheckIn.tsx` ~481–508, `.searchRow` in its module CSS ~34. The count
    ("14 / 30 checked in") stays left; the shared field moves right on a desk (C8); a phone keeps its own full-width row. The
    Add player / Print sheet row below is not ruled — if `/design` wants it on the field's row, say so in the summary.
17. **Not touched:** the coach Ledger (Rule 7), Fundraising, Roster, the coach Schedule, Sessions and the Opponents book (both
    done in Stage 1), Budget vs. Actual, the amber "Needs a plan" / "Needs lineup" toggles (C2: rounded, already right).

## Rulings not to reopen
C1–C9 as recorded (plan §9). Rule 7: leave the two Ledgers' filter row and Balance exactly alone. Ledger Parity D6: do not
reorder Export · Tools · lime on money screens. Columns, Compare, Showing (BvA) and Collapse all stay on the left (C3). Amber
attention toggles stay rounded (C2). Phones keep their patterns (Ask 5). House league's toolbars are deferred. Rule 4's
shapes are Stage 2's; a pill that moves keeps its face and corners. If you think any of this is wrong, say so BEFORE building.

## What the old prompt got wrong (do not follow it on these)
- "The Calendar **and the coach schedule together**": the coach schedule has no filters; only the Calendar moves.
- "The time-zone note stays with the dates": in code it is on the right above 900 px; it moves beside the dates (census correction 2).
- "Families — coordinate, don't collide": Families is committed (`05eaa588`) and already placed (Stage 1). Nothing remains.
- "Tags panel right-anchors": that anchor was removed in Stage 1 (/simplify); verify, don't build.
- It names `ScheduleCalendarViews.tsx` ~733–800 for the Calendar toolbar: the Calendar's toolbar is `admin/calendar/page.tsx`; the view switch moved to `components/coaches/kit/ViewSwitch` in Stage 2.
- It lacks the census adds: coach Dues' Showing (C4), Club money and Notifications as view pills + Unread · All right (C5),
  Insights › Results' Tag pill (C6), Tryouts check-in's field (C8), Accounting Teams' Group, Awards' Award.
- It leaves Budget's When / Columns / Collapse all and BvA's Compare / Showing "to classify": ruled — only `When` moves (C3).
- "Extend `tournament-stage3-part7-guard`": the guard is `tests/unit/toolbar-rules-guard.test.ts` now.
- Opponents' count and placement (C8) landed in Stage 1; `/docs` belongs to Stage 4 (below), not Stage 3.

## Files Stage 3 touches (check parallel safety here)
| Area | Files | Overlap risk |
|---|---|---|
| Shared toolbar | `components/coaches/kit/CoachListToolbar.tsx`, `CoachKit.module.css`, `components/coaches/FilterGroup.module.css` (maybe) | none known (One Window works on `QuestionShell` / `KitDialog`) |
| Club screens | `admin/accounting/{allocations,budget,payment-requests,teams}/page.tsx`, `admin/calendar/page.tsx`, `admin/schedules/[scheduleId]/page.tsx`, `components/admin/kit/club/ClubCalendar.module.css`, `.../money/Money.module.css`, `.../schedules/Schedules.module.css` | low |
| Coach money | `.../accounting/dues/panel.tsx` (toolbar ~2446), `.../accounting/club/panel.tsx` (~1709–1760), `.../accounting/budget/panel.tsx` (~2788) | **One Window Stage 2 — real overlap, different regions** (its windows in `dues` ~1507–5013 and `club` ~546 / 798 / 2203; `budget` carries its Budget line form and Delete confirm). Its own prompt (`ONE_WINDOW_STAGE2_BUILD_PROMPT.md`, "Overlap") says the same |
| Coach history | `.../history/{awards,results}/panel.tsx` | low (the award window is `components/coaches/GiveAwardModal.tsx`, not the panel) |
| Practice plans | `components/coaches/LibraryRow.tsx`, `practice/_{Drills,Circuits,PlanTemplates}View.tsx` (the `LibraryFilterBar` call lines) | none (One Window names them "not shared") |
| Notifications | `components/coaches/CoachNotificationsPage.tsx`, `components/notifications/NotificationFeedBody.tsx`, `notifications-page.module.css` | low |
| Tryouts check-in | `components/rep-teams/TryoutCheckIn.tsx` + module CSS | **One Window Stage 2, if its owner question C puts the tryout windows in Stage 2** (its walk-up "Add player" window is hand-built, in the same file) |
| Shared sheet | `app/[orgSlug]/coaches/coaches.module.css` (`.ppDrillFilters` ~11624, `.club*` ~14369) | **One Window Stage 2 — real** (its `.modalOverlay` family ~4571–6675 and the pill ~9931–9986) |
| Guard + records | `tests/unit/toolbar-rules-guard.test.ts`, plan, TODO, QA ledger, register | other sessions' uncommitted lines |
Safe rule for the shared files (One Window's own): small unique `Edit` hunks only, no codemod or rewrite across `coaches.module.css`,
`dues/panel.tsx` or `club/panel.tsx`; `git diff --stat <file>` before editing one; if the other session holds uncommitted edits in
it, do the other files first and that file after their commit. Both gates run the whole `npm test`, so a red that is not yours may
be their half-done edit — say so before blaming your change. Account-first sign-up (Parts 2–3) works under `app/auth`,
`app/(consumer)/start`, `app/team`, `components/auth`, `app/api/auth` — no shared file with Stage 3. No demo tour anchor sits on
any toolbar above (grep `data-tour`); the build still fails if one disappears.

## Guards
Extend `tests/unit/toolbar-rules-guard.test.ts` with a Stage 3 `describe` (readers: `readCode`): the `filters` slot (or the
`actions` placement) on every screen above; **no `restQuiet` pill left among the toolbar's children outside the two Ledgers**
(the full list today: Allocations Due, Budget When ×2, Payment requests Team, Accounting Teams Group, Calendar ×3, Schedule detail
×3, Awards Award; the Practice library's Tags sits right too) — parse the toolbar's JSX span if you can do it precisely, else pin
each host with its own assertion; Payment requests and Practice plans render a count; Club money and Notifications import
`ViewPills` (add them to `PILL_HOSTS`) and the old `clubChip` / `NotificationZoneChips` recipes are gone; the Tag pill replaces
the chips; the picker and docked library pass `fill` and no count. **Mutation-check each assertion** (move a pill back into
`children`, drop a count, restore) and see it go red. A guard that cannot be made precise is a finding, not a reason to skip.

## Each step (as Stages 1–2 did)
- PM UX summary in the chat before code (AGENCY_RULES), including the mechanism choice, the Practice plans phone order, the
  admin Notifications reach and the Unread · All shape.
- `npm run verify:changed -- <files>`; `npm run typecheck` (shared kit + shared notifications module); restart the dev server
  once near handoff (shared modules; `npm run dev` only). **`npm run check:admin-type` must stay green** (commit `59632e43`): it
  scans `app/[orgSlug]/admin`, `components/admin`, `components/shared` and `components/notifications` and may only go DOWN —
  a count you lower is locked in with `node scripts/check-admin-type.mjs --init`; new lettering is the body face, or carries a
  `type-ok: <role>` comment. Stage 2's known failures that are not yours (re-measure before you start): `club-stage6c-screens-guard`,
  `coach-semantic-ink`, `check:css-selectors` (a `GuidanceRail` `.context` clash), `check:admin-old-look` house-league 130 → 131; if
  your change lowers an old-look count, lower its baseline by hand. Run `check:spelling` (new words: "Search…", "Tag").
- `node scripts/check-layout-invariants.mjs --workers=1 --only=<ids>` on the running dev server for the touched screens only
  (ids: `--list`); never a whole-product sweep on dev. Still owed from Stage 2, not yours: `check:layout` on Check-in, the gate,
  the Scorekeeper and Communication (runs on staging at the promote).
- `/simplify` (the slot is a new abstraction) → `/review` → `/design` on the result (run it, don't offer it) → the owner's walk
  → commit **only after the owner confirms**.

## Walk W3 (one purpose: placement)
Next free § in `docs/projects/active/OWNER_QA_LEDGER.md` (last at writing **§340**; check — others are added daily) and the hub as
its own group `#qa3`: checkboxes + Copy results; add a `wire({ walk: 'walk3', … })` call and `#pasteOut3` to the page's CSS
id selector (`#pasteOut, #pasteOut2`) — parse every page script before publishing. Accounts as in W2: UAT Rep Club's owner
`uat-club-owner@uat-rep-club.local`; the coach `uat-coach@uat-test-org.local` › UAT Test Team; every test password is the same.
Steps: (1) club Allocations, Budget, Payment requests, Accounting › Teams on a computer; (2) the same at 390; (3) Calendar on a
computer, then narrowed to 1,100 / 900 / 768 (dates and note on their own row ≤900); (4) Calendar and the coach Schedule at 390;
(5) Schedule detail on a computer (switch in the toolbar; filters wrap, not the switch, at 1,200 with the sidebar open) and at 390;
(6) Families; (7) Practice plans on a computer, all three tabs, narrowed ("2 of 24 drills"), Tags menu fully visible, the drill
picker and docked library unchanged; (8) Practice plans at 390; (9) coach Dues; (10) coach Budget and Awards; (11) coach Club money
(needs 12 or more records for the row to show — seed if the fixture is short); (12) Notifications, coach and admin; (13) Insights ›
Results (needs a team with tagged games — confirm the fixture); (14) Tryouts check-in; (15) **the two Ledgers did not move**
(only the rounded Book/View — the plan's old W4, folded in); (16) Dark. Confirm fixtures BEFORE publishing; never let a step pass by default.

## Records, then Stage 4 (no code; after the walk passes)
Records with the build: plan §10 "Stage 3" (every departure, with its reason — at least the mechanism, the admin Notifications
reach, the Unread · All call, the Practice plans phone order); the plan's status line; the TODO line (`TODO.md` ~661); the QA
ledger entry; `memory/design_decisions.md` only if a rule changes; the hub header (Stage 2 walk passed 13/13; Stage 3 built);
auto-memory `project_toolbar_rules`. **Stage 4 is small — records only:** (a) a K-31 entry in
`docs/agents/design/TABLE_EXCEPTION_REGISTER.md` for Rule 7 (the two Ledgers' filter row; K-30 was the last) with a changelog
line, and a check that standard §3.9 (`TABLE_AND_LIST_STANDARD.md` ~355–367) still describes what shipped; (b) offer `/docs` for
help text that names a toolbar position (`lib/help-content/*.tsx` — grep "search box", "toolbar", "filter row"); (c) close the plan
and move this stage's TODO items to Completed once the walk passes.

## Commit
Code + guard in ONE commit, the records in a second `docs(records)` commit, explicit pathspecs, **both local only — no push**.
TODO.md, the QA ledger and `memory/design_decisions.md` carry other sessions' uncommitted edits: commit only your lines — HEAD
+ your exact block in a temporary index, `commit-tree`, a compare-and-swap `update-ref`, and re-point the main index only inside
`if git update-ref …` (auto-memory `reference_partial_commit_shared_tree`; scripts: `.probe/tb1/commit.sh`, `.probe/tb2/commit.sh`).
Then `git show --stat HEAD` and confirm only your paths. Re-check the branch is `dev` first.
