# Free coach tap targets — draw, rule, then build — prompt

> Paste into a fresh session on `dev`. Written 2026-10-19 against `7dc48b31` (file:line references verified then;
> re-grep if they moved). This is a DRAW-FIRST job: no product code until the owner has ruled on the drawings.

## Why this exists
The layout upkeep session (`db628a34`, 2026-10-19) put the FREE coaches portal into the layout sweep: 12 screens
(`free-coach-*` in `scripts/layout-screens.mjs`), signed in as the UAT free coach, on a fixture with every tool on and a
season of rows (`scripts/seed-free-coach-fixture.mjs`). The free bar and its More sheet measure clean, and nothing
overflows, clips or fails contrast. But the pages report **334 tap targets under the 44px floor** at 361/390/768 (none at
1440) — about **12 distinct defects**, multiplied by the fixture's rows (237 of the 334 keys carry a player, event or fee
name). They are **not** in the baseline, so every release sweep lists them as NEW until they are fixed or the owner
accepts them. A free coach on a phone hits every one of them.

The last run's findings are in `.probe/layout-upkeep/proof-free-2.json` (local, gitignored). If it is gone, regenerate
it (Stage 0).

## Read first
`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading → a helper; open a helper's cited lines before relying on
them). The owner's standing rulings this job turns on (auto-memory): `decision_record_reads_first_edits_whole`,
`decision_reorder_is_hold_and_drag`, `decision_edit_autosaves_create_asks`, `project_coach_row_list_recipe`,
`feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`, `feedback_project_hub_single_artifact`,
`feedback_qa_walkthroughs_as_checkable_artifacts`, `feedback_build_to_approved_mockups`,
`reference_seed_password_reset_kills_sessions`. Docs: `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §3.10 (row lists),
`docs/projects/active/COACH_TOUCH_TARGET_DEBT_PLAN.md` (the help "?" and F-21), `docs/agents/design/TABLE_EXCEPTION_REGISTER.md`
F-21, `docs/projects/active/FREE_COACH_HEADER_PARITY_PLAN.md` §9.5 (B4).

## The census (verified 2026-10-19 — the starting point, not the answer)
| # | Control · measured | Where it is drawn | Reach | What the PAID portal does |
|---|---|---|---|---|
| 1 | Row **Edit / Remove** icon buttons · 38×38 | `components/coaches/RosterEditor.tsx` :273, `ScheduleEditor.tsx` :226, `FeeEditor.tsx` :494; `.iconBtn` in each editor's module (:124 / :211 / :393) | free only | **No row buttons at all**: the roster's name opens the player; schedule rows are whole-row doors (`CoachRowList`, §3.10); Remove lives inside the record |
| 2 | Roster **Drag to reorder** · 30×38 | `RosterEditor.tsx` :257, `.handle` :56 | free only | Grip 44×44 at ≤768 and **hidden at ≤640** — a phone does not reorder the roster (`app/[orgSlug]/coaches/coaches.module.css` :4333, :4542) |
| 3 | **Add player / Add event / Add fee** · 37 tall | each editor's `.addBtn` | free only | A page-header primary, 44 tall at ≤768 (`.pageHeaderStd .pageHeaderActions button`) |
| 4 | Page help **"?"** ("Help: Roster"…) · 32–34 | `components/help/HelpButton` (app-wide) inside the free wrapper `.sectionHeadEnd` (`app/coaches/team/[basicTeamId]/team.module.css` :114), which adds no floor. Notifications uses the paid `CoachPageHeader` (34 wide at 641–768 — paid F-21, already baselined) | shared component, free wrapper | Wrapped to 44×44: `.teamHeaderHelp` (≤768), `.pageHeaderHelp` (≤640) |
| 5 | **"Upgrade to Premium — free →"** · ~40 | `ScopeShelf` `.footerLink`, `CoachExploreCatalog` `.premiumCta` | free only | — |
| 6 | **"⇄ Fan view — public schedule & live scores"** · 23 | `components/shared/FanViewLink` (module :4–17: 0.15rem padding, 0.7rem type) | **shared** — the paid Overview's live-event card and paid Tournaments draw the same 23px link (unflagged there only because the paid fixture never shows it) | the same 23px |
| 7 | **"See all →"** 24 (`TeamHQ` `.hqTileLink`; stylesheet shared with the paid tournament record, the link free-only) · **"Open →"** 32 (`CoachExploreCatalog` `.openBtn`) · **"Express interest"** 36 (`app/coaches/teams/page.tsx`, the GLOBAL `btn btn-ghost btn-sm`) | | mixed | — |
| 8 | Fees **"Mark … paid"** 32 (`.markPaidBtn`) and its undo **"Mark … unpaid"** ~**15** (`.undoBtn`: no padding, no height — an underlined word) | `FeeEditor.tsx` :483 / :472 | free only | Dues "Record as paid" 44 at ≤768; **no undo** — a payment is removed from the receipt book |
| 9 | Announcements: subject field 40, **Refresh** 42, **Send announcement** 42 (and "Refresh contacts" 32 when shown) | `AnnouncementEditor.module.css` | **shared** — the paid team announcements import it; paid's identical entries are in the baseline with no reason | the same sizes |
| 10 | Help's **"What's New"** · 19 | `HelpPageLayout` → `WhatsNewHelpLink` | **shared** with every help page, the admin help hub included; the paid one is baselined with no reason | the same |

## Questions to put to the owner (draw each at TRUE SIZE; recommend on merit; do not decide)
1. **Row actions — the big one.** (A) keep the free editors' inline Edit / Remove and make them 44 on a phone — quick,
   and the free editor stays a lighter tool; or (B) the house standard — a row is a door to its record ("a record reads
   first, edits whole"; Remove inside the record), as the paid portal does — consistent, but it changes how a free coach
   edits a player, an event and a fee (help articles change: `/docs`). Or A now and B as its own job. Draw Roster both
   ways at 390, and say what B costs.
2. **Roster reorder on a phone:** hide the grip at ≤640 as the paid roster does, or a 44px handle (the reorder ruling:
   hold and drag, the number is the handle)?
3. **Fees paid / unpaid:** a 44 "Mark paid" — and what replaces the 15px underlined undo: a 44 control, or the paid
   model (the undo lives inside the fee's record — which depends on Q1)?
4. **Add buttons:** 44 where they stand, or the paid page-header primary?
5. **The shared ones:** fix Fan view in its shared component (the paid Overview and Tournaments change too), the free
   "?" in the free wrapper only (match the paid wrappers; the app-wide button untouched), Announcements in its shared
   stylesheet (the paid entries go stale). Say for each exactly what changes on a paid screen.
6. **What's New (19px):** out of scope here by default — it is every help page's, including the admin's, and belongs to
   the touch-target debt plan. Ask whether to accept it on the free help page with a reason pointing there.

## Stage 0 — census, drawings, rulings (one hub; no product code)
- Re-measure first (Proof, below) and diff against the table: what moved since `7dc48b31`.
- **PM UX summary in the chat first** (AGENCY_RULES).
- **One project hub artifact** (`feedback_project_hub_single_artifact`): the census; the end state DRAWN at true size,
  whole screen, before / after, at 390 and 768, for Overview, Roster, Schedule, Fees, Announcements and the help "?"
  (every highlight clickable — `feedback_clickable_design_annotations`); Q1–Q6 with recommendations and a paste-back; the
  PM brief; the plan. **Run `/design` on the drawings before the hand-off**, not after.
- Files: `FREE_COACH_TAP_TARGETS_PLAN.md` + `_PM_BRIEF.md` in `docs/projects/active/`, one TODO line linking them.
- **Stop for the owner's rulings.**

## Stage 1 — build to the ruled drawings
- Fix in the free editors' own stylesheets; a shared component only where Q5 says so; never the global `.btn-sm`.
- **Proof.** Product changes are not on staging until pushed, so prove them on the local dev server: `--only=<the free
  ids>`, `--workers=1`, all four widths — and only after asking whether another session is using that server (AGENTS.md
  memory rule; a whole sweep never runs on the dev server). For every SHARED change also run the paid screens it reaches
  (find their ids with `node scripts/check-layout-invariants.mjs --list`). Zero unmeasured, and evidence the state was
  reached (a probe or the dump's rows), not just a green run.
- `/simplify`, then `/review`; `/docs` if Q1 is B or any flow a coach follows changes. A ledger § walk as a checkable
  artifact on the hub (next free § — check it at commit time; another session took §343 on 2026-10-19).

## Baseline policy (binding — same as the layout upkeep)
Never `--init` to make a run pass. Re-key only an identical finding under a new key. Anything left after the build is
reported (screen, width, rule, numbers, a recommended fix) and accepted only **on the owner's word, each with a written
reason**. `--prune` only on the owner's word, from a complete warm run on staging, never a dark run. Every baseline change
is listed in the hand-off. ⚠ Accepting a finding keyed on a fixture name (a player, an event) bakes that name into the
key — a fixture change re-keys it; say so when proposing one.

## Hazards (learned 2026-10-19)
- **Check every saved sign-in right before a sweep** (`/api/me/role-summary` with its cookies → 200). A UAT seed that
  re-asserts a password signs that account out everywhere; never run a seed while a sweep runs. Re-sign one account at a
  time (`npx playwright test --config playwright.config.ts --project=auth-setup --grep "authenticate: <name>$"`), on the
  owner's word; never the whole auth-setup project.
- The free fixture's schedule runs out after 2027-04-24 (its script says how to move it).
- Until this lands, the next promote's sweep shows the 334 as NEW: accept them at that promote as known, **not** into the
  baseline.
- A Playwright run empties the shared `test-results/` folder; probes live in `.probe/`.

## Commit
Only on the owner's word; branch `dev`; explicit pathspecs; files other sessions also edit are committed as HEAD + your
exact edits (auto-memory `reference_partial_commit_shared_tree`). The product change in its own commit, the records in
another. Do not push.

## Hand-off (product-owner voice)
What a free coach now gets on a phone, screen by screen; what changed on PAID screens through shared parts; the sweep
result (free ids at four widths, unmeasured = 0); every baseline change with its reason; what is still owed.

## Do not
Build before the rulings. Touch the global `.btn-sm` or the app-wide help button's own size. Fix What's New here unless
the owner says so. Change a sweep rule, a gate, `memory-guard.mjs`, a hook or `.claude/settings*`. Run a whole sweep on
the dev server. Release, push or merge.
