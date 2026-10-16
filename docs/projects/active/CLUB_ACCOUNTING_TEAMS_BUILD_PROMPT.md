# Club Accounting · Teams — a Teams tab, a team switcher inside it, and a team's account that says what to do (built to hub version 3)

> Paste into a fresh session on `dev`. Written 2026-10-16, the day the drawings were **ratified**: all eight asks as
> recommended (owner: *"I agree, go ahead and write the plan and build prompt"*). **One build session**: no migration,
> no write route changes.
>
> **The spec is the hub:** https://claude.ai/artifact/M3iNQq4N8cRWeZCdN6G8Ps (version 3) — screens 2–5 are the build;
> screen 6 (Checks) is your formatting checklist, every row, including the /design pass's changes.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every New / Restyled / Unchanged
>   tag note is a requirement; open each one. A green "fixes F…" chip names the finding a drawing answers.
> - **The plan is the call list:** `docs/projects/active/CLUB_ACCOUNTING_TEAMS_PLAN.md` §3 (screen by screen), §4 (the
>   server reads), §5 (words), §7 (gates), §8 (the walks). §2.2 holds two corrections to the drawing made while writing
>   the plan (C1: the Overview card counts every year, as its band does — 8 teams late on dev; C2: the earlier year's
>   line on the Teams table is red when that money is late). Hub version 3 draws both.
> - Where you must depart, say so at build time and record why in plan §11; never silently.
>
> **Read first:** the plan whole; `AGENTS.md` (this Next.js is not the one you know — read
> `node_modules/next/dist/docs/` before writing a route or a page); memory `project_club_accounting_teams_tab`,
> `project_club_tier_readiness` (only its first screen and the Stage 3a/3b/3c/3d paragraphs you need),
> `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_money_figures_one_joined_band`, `decision_one_toolbar_rare_tools_behind_tools`,
> `decision_waiting_count_is_amber_pill`, `decision_export_is_one_button`, `decision_rare_door_ends_body`,
> `feedback_shared_component_over_shared_class`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
> `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`, `reference_partial_commit_shared_tree`;
> `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §3.4–§3.9 and §3.5's "a column the screen reads but does not own";
> the in-repo `memory/design_decisions.md` entries 2026-09-30 (Accounting is one page with tabs), 2026-10-01 (one
> toolbar), 2026-10-08 (the joined band) and 2026-10-16 (a team's bill: one line under Outstanding).

## ⚠ What this code already taught

- **The frame's title effect runs after the page's** (`AccountingFrame` says so in its own comment). Once Teams lights
  on a team's address, the frame would overwrite "11U AA · …" with "Teams · Accounting". Decide by address.
- **`accountingTabFor` matches addresses exactly**; Teams needs its prefix (`teams` and `teams/{id}`) and nothing else
  may change: Budget must still not light on Budget vs. Actual (`admin-kit-nav.test.ts` holds it).
- **Two definitions of Outstanding exist on purpose** (plan F7): the year's on the Teams table, every year's everywhere
  else. Do not "fix" one into the other; Ask 8's line explains the gap. The Overview card's counts are **every year**,
  because its band is (C1).
- **`billOutstandingLine` is the one wording of late money** (committed `6952c544` today). Give it an option to leave out
  the next-due reason; never copy it.
- **`SingleSelectDropdown` is a coaches-portal component.** Option groups are opt-in; no default moves.
- **The React compiler** skips memos when a helper is handed an object it may mutate, and `money()` in render after a
  memo on the same figure warns — give helpers primitives or wrap the call in its own `useMemo`.
- **A walk of a screen another session is editing is not a walk.** Other sessions build club money screens beside you
  (today: a team's bill window). They share the dev server, the test club, the ledger and `lib/club-money-words.ts`.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. Other sessions' uncommitted hunks in shared files (TODO,
   the QA ledger, the design log, `lib/club-money-words.ts`, `lib/help-content/accounting.tsx`) are theirs.
2. **The UX summary for the owner comes first** (AGENCY_RULES), short: what a treasurer sees differently, what an owner
   and an admin see (the same, plus "In Rep Teams"), a group-limited member (their groups' teams only, in the table, the
   pill and Needs you), a head coach (**nothing changes**), a club without rep teams (no Teams tab). Any departure.
3. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` run or `auth-setup`.
   Read-only probes only (`.probe/`, never `test-results/`); never reset the test club (UAT Rep Club) without asking.
   New files and shared modules change in this build, so a dev-server restart is owed before the walks: ask first.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

`memory/design_decisions.md`, newest first (another session may hold uncommitted entries at its top: add yours as
HEAD + your hunk), and `memory/MEMORY.md`'s index line in the same change if it lists entries:
1. **A team's account is a view of Accounting › Teams**, as a book is a view of the Ledger: the tab row stays, a lead
   Team pill switches team, "All teams" returns to the table. The "page one level down" rule of 2026-09-30 retires in
   Accounting (its last page was the team's account).
2. **A team's account says why the team needs you**: the bill's one line under Outstanding (late, then sent; the account
   keeps its Next due figure, so no next-due reason), a Needs you list whose rows open the bill or the request, and the
   season line naming the head coach (or "No head coach").
3. **A figure from a closed year rides under the year's figure as its own line, never added in**: "+ $600.00 overdue
   from 2025–26" in the late red when any of it is late, quiet otherwise.
4. **Two pages about one team link both ways for whoever can open both** (Rep Teams' "With the club" ↔ Accounting's
   "In Rep Teams", the same shape); a treasurer gets the head coach's name instead of a door.

## What to build (plan §3 and §4 are the detail; this is the order)

1. **The server reads** (plan §4): `position.owedByTheTeams.lateTeams` + `waitingOnYou.teams` in `buildBoardSummary`;
   `groupName` on `teamsWithTheClub` rows; `season` + `headCoaches` + `needsYou` on `teamAccountRead` (export
   `owedRows` from `lib/club-fiscal-reads.ts` and reuse it; the closed fiscal year's name as `overviewYearReads` finds it).
   Unit-test each addition beside its module's existing tests (late vs sent vs received vs credited; a closed year's
   row; a request holding up a payout; B11 scope — a team outside the reader's groups is never named).
2. **The tab and the frame** (plan §3.1) + `admin-kit-nav.test.ts`.
3. **`SingleSelectDropdown` option groups** (plan §3.5) + its test; check the panel scrolls at 390 with 30 options.
4. **Accounting › Teams** (plan §3.2): `TeamsTable` moves out of the Overview into its own component file, used only by
   the new page; the earlier year's line (C2); Group filter; Export + its `lib/export/catalog.ts` entry.
5. **A team's account** (plan §3.3): no `AdminPageHeader`; Team pill; season line; the band's line; lock line; Needs
   you; "Statement" card; "In Rep Teams". Billed/received rows keep their door (the bill over the page) and the
   statement keeps its export. **Requests open over the account** (plan §3.3): lift Payment requests' request wiring
   (the window + Approve / Decline / Reverse) into one shared request flow both pages mount; Needs you's request rows
   and the statement's request rows both use it. If the lift is larger than this session, keep today's door
   (Payment requests at the request) for both and record the departure — never two doors for one kind on one page.
6. **The Overview's teams card** (plan §3.4), desk and phone; the held band leaves with the table.
7. **Words** (plan §5) in `lib/club-money-words.ts`, drafted as drawn, then a **/marketing words pass on exactly the new
   strings** before the commit.

## Help, words, walks

- **`/docs`:** the Accounting articles — the Overview (the teams card replaces "The teams" table term; keep the old
  words as search terms), a team's account (inside Teams; the pill; the line under Outstanding; Needs you; the season
  line; "In Rep Teams" for owners and admins), and a new short entry for the Teams tab.
- **Walks:** a new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger first and again
  after appending — another session may take one the same day), as checkable walks on the hub's QA tab, one purpose
  each, pinned to identities (team names, row kinds), never to figures the calendar moves, with the sign-in card (UAT Rep
  Club; the owner `uat-club-owner@uat-rep-club.local` and the treasurer `uat-club-treasurer@uat-rep-club.local`,
  passwords from `.env.local`). Plan §8 is the outline (W1–W8). Read the dev club's data before writing a step: the
  drawing's installment dates for 11U AA are illustrative.

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files, `check:club-money-arithmetic`,
  `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:export-catalog`, the
  one-definition guard, `money-summary-band-guard`, the guards that read the account page
  (`club-stage3b-screens-guard`, `ledger-parity-screens-guard`).
- **A screens guard for this project** (`tests/unit/club-accounting-teams-guard.test.ts`): Teams is second and lights on
  both addresses; the account renders no `AdminPageHeader` and reads `needsYou`/`season` from its read; the Team pill is
  `SingleSelectDropdown` with `lead`; the Overview renders no `TeamsTable` and reads `lateTeams`/`waitingOnYou.teams`;
  "In Rep Teams" is gated on `module_rep_teams`; Payment requests and the account mount the one shared request flow and
  the account holds no `payment-requests?request=` door (unless the departure is recorded). The lift earns its own walk
  (plan §8, W4b): Payment requests unchanged — open a request, Approve's question then cancel, a `?request=` arrival,
  phone Back.
- **`check:layout --changed`** (ask the owner first; never a whole-product sweep on the dev server): add
  `admin-accounting-teams` to `scripts/layout-screens.mjs` beside `admin-accounting-team`; 1440 and 390, Warm and Dark;
  also measure the Teams table at 1280 (a name over two lines is a finding for the owner). Baseline new entries with
  reasons.
- Then `/simplify` (a new opt-in prop on a shared control), `/review` at the **high-risk** tier (shared modules, money
  reads), and a `/design` review of the built screens against the hub at 1440 and 390.

## Hand-off

- An owner-voice summary, the walks to run, departures from the drawings, and anything found and not fixed (the plan
  already reports one: Rep Teams' board filter says "Ungrouped" and is a native select).
- Plan §11 "As built", the PM brief if anything moved, memory `project_club_accounting_teams_tab`, the TODO line, and
  the hub's QA tab republished at the same address (read the live copy first; parse every script before publishing).
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its own
  commit. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared
  index. Offer `/docs` if it wasn't run.
