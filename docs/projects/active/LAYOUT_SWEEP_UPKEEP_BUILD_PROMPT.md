# Layout sweep upkeep — the 2026-10-18 follow-ups, and the free coach joins the sweep (B4) — build prompt

> Paste into a fresh session on `dev`. Written 2026-10-19 (line numbers verified against `a673f321`; re-grep if they moved).
> **Precondition: the 2026-10-19 promote is finished** — the release record (auto-memory file
> `C:\Users\b2cow\.claude\projects\c--Users-b2cow-Documents-tournament-website\memory\reference_prod_release_history.md`)
> has a "PROMOTE 2026-10-19" entry with its Gates section written. **Do not touch the sweep or its baseline while a release is
> mid-sweep:** a release run reads the same screen list and baseline you would be editing. No migration, no API, no product
> code unless step A4 proves a real defect.

**Read first.** `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading → a helper; open a helper's cited lines before
relying on them). Then **the release record's NEWEST "PROMOTE" entry before anything else** — the 2026-10-19 one: any new sweep
findings, unmeasured screens, or baseline decisions the owner made at that promote are part of this job (fold them in as
extra rows of Part A; same policy below). The 10-18 entry's Gates section (lines 28–39 at writing) is the ask for Part A.
Then `scripts/check-layout-invariants.mjs` header (lines 1–87), `scripts/layout-screens.mjs` header (lines 1–45),
`scripts/memory-guard.mjs`, `.claude/commands/release.md` §1d-5, and `docs/projects/active/FREE_COACH_HEADER_PARITY_PLAN.md`
§9.5 (B4 at ~383 and ~421). `.probe/release-2026-10-18/warm.json` and `dark.json` are the 10-18 run's dumps (local, ignored).

## Where the sweep runs (binding)
AGENTS.md's memory rule: **a whole-product sweep never runs on the dev server.** It runs on staging
(`$env:UAT_BASE_URL = 'https://dev.fieldlogichq.ca'`, `--workers=2` — the first 10-18 warm run aborted on memory at 4) or on a
local production build. On the dev server only `--only=<ids>` for the few screens you touched, `--workers=1`, and only when
no other session is using it (ask). Every proof below is `--only`, all four widths (do not pass `--changed`: it defaults to
two widths, and `components/help/` or `components/coaches/` in the diff widens it to every screen). Free memory is checked
by `memory-guard.mjs`; **an abort is a failure, not a pass.** `auth-setup` signs other sessions out — ask the owner first
(B2 needs one new sign-in; see there).

## Automation status (verified 2026-10-19)
`WATCHED_PATHS` in `scripts/check-agent-automation.mjs` (lines 27–53) names `.claude/settings.json`, the pre-commit hook, the
snapshot and prod-DB tools, the DB checks and the stack-health files. **None of these is on it:** `check-layout-invariants.mjs`,
`layout-screens.mjs`, `memory-guard.mjs`, `uat-fixture-context.mjs`, `scripts/.layout-baseline.json`, `tests/uat/auth.setup.ts`.
They are still shared checks, so: the owner's paste of this prompt is the ask for **exactly the edits listed here**; anything
else (a new rule, a changed gate, `memory-guard.mjs`, hooks, settings) is a proposal, not a change. Run `npm run check:automation`
at the end and confirm none of your files appear.

## Baseline policy (binding)
- **Re-key only where the finding is the same defect under a new key** (same screen, width, rule, element, same measured
  numbers; only the wording in the key moved). Keep the entry's `reason` and `detail`.
- **Never accept a new finding into the baseline silently.** No `--init` to make a run pass (`--init` snapshots every finding
  of the run, :1622–1642). A genuinely new finding is reported to the owner with screen, width, rule, numbers and a
  recommended fix; it is fixed, or recorded with a written reason **on the owner's word**.
- `--prune` only on the owner's word, only from a complete run (never `--allow-partial`), never on a dark run.
- **Every baseline change is listed in the hand-off with its reason.**

## Part A — the 2026-10-18 follow-ups
Baseline at HEAD: 2,742 entries, `generated` 2026-10-17T19:14:05Z. Check `git status` first — another session may hold
uncommitted edits to the screen list or baseline.

**A1 · The pick-one pill opens a sheet on a phone (`cf450ffa`, 2026-10-18), and two interacts wait for the old panel.**
`admin-accounting-team-pill` (`layout-screens.mjs` :1537–1549, wait at :1543) and `admin-families-show` (entry :1555, helper
`openFamiliesShow` :78–86, wait at :84) click the pill, then wait for `[data-pill="panel"]` — which stays inside a closed
`<details>` at ≤640. The product (`components/coaches/SingleSelectDropdown.tsx` :231–240, :256–271): at a phone the summary
reports `aria-haspopup="dialog"`, prevents the `<details>` opening and raises a `SheetFrame` with `role="dialog"` and
`aria-label` = the pill's label. Unmeasured: 361 and 390, warm; 361 dark. Repair both with ONE helper that waits for the list
wherever the product puts it at that width (proposal: `details[open] [data-pill="panel"]:visible, [role="dialog"][aria-label]:visible`
as a union, `.first()`) — and prove with a probe that the sheet is what got measured (see "Proof"). The team-pill entry's
`skip: ['content-overflow']` (:1546–1548) is a desk reason ("an open list hangs over the page") and applies at every width, so
a phone sheet's overflow would be skipped too: leave it, **tell the owner**; a per-width skip is a runner change — propose only.

**A2 · `guest-scorekeeper-sheet` is unmeasured at every width — fix TWO lines, not one.** `openScoreSheet` waits on
`form[role="dialog"]` (:157) and the entry's `scope` is `form[role="dialog"]` (:1670). The page (`app/[orgSlug]/scorekeeper/page.tsx`
:965–987) now renders the phone sheet as `SheetFrame form role="dialog"` (a `div`; `form` sets `aria-modal`, `SheetFrame.tsx`
:147) and the desk card as `div role="dialog" aria-modal="true"`; the `<form>` is inside either. Both want
`[role="dialog"][aria-modal="true"]` (the selector `guest-check-in-sheet` already uses, :1681). ⚠ A scope that matches nothing
**silently falls back to the whole page** (`check-layout-invariants.mjs` :530), so fixing the wait alone would measure the page
behind the dim and still look green — prove the scope matched. The model probe is
`.probe/release-2026-10-18/scorekeeper-probe.mjs` (it proved the sheet opens; it carries the saved session to staging's host).
Once measured, the 6 old entries `guest-scorekeeper-sheet|361/390/768|tap-floor|button·Cancel / Finalize Score` (baseline lines
7708–7792, no reason) either reproduce or go stale; and the sheet has probably not been measured since `1b1546b9` (2026-10-07),
so expect NEW findings. Report all of it; baseline nothing.

**A3 · Re-key the 20 `Rep Teams` entries after `3d84076e` (sentence case).** Verified against the 10-18 dump: exactly 20 keys
in `warm.json` are NEW only because "Rep Teams" became "Rep teams" — **18 `a·Rep teams` tap-floor keys** (`admin-rep-assistant-coaches`,
`admin-rep-past`, `admin-rep-rename-slugs`, `admin-rep-shared-library`, `admin-rep-team-history`, `admin-rep-team-history-year`,
at 361/390/768) **plus 2 `div·HistoryRep teams · 15U AAA…` content-overflow keys** (`admin-rep-team-history-year` @361, @390).
(The record says "20 `a·Rep teams`"; it is 18 + 2.) All 20 old keys exist in the baseline (lines 636–4352), none carries a
reason, and every `detail` string equals the dump's. Re-key by a script written to a `.cjs` file under `.probe/layout-upkeep/`
(rename in place, keep key order and `reason`/`detail`; not `--init`, not `--prune`). If the 10-19 run added more case
re-keys, apply the same test to each (same element, same numbers) before including it. Proof: `--only=` those six screens,
all widths → no NEW, and none of the 20 listed as "no longer reproduce".

**A4 · `admin-house-league` @361/390: the "Season statuses" help bubble spills 109px.** Four NEW `content-overflow` keys
(`warm.json` lines 420–421, 574–575): the `span` wrapping the status badge and the "?" and the tooltip's own `span`, "content
spills 109px with overflow-x:visible — no scroller owns it". Look before deciding:
- The bubble exists in the DOM **only while open** (`components/help/HelpTooltip.tsx` :75–80); it is a 240px box centred on the
  16px trigger (`help.module.css` :159–177). The entry has no `interact` (:1565) and the runner never hovers, clicks or focuses
  (grep: only the hit test). So first find **what opened it during the measurement** (a probe at 361: `document.querySelectorAll('[role=tooltip]')`
  and `document.activeElement` right after load).
- Then measure what a person gets by tapping the "?" at 361/390 (the same 109px at both widths suggests the trigger sits a fixed
  distance from the right edge — verify, don't assume). If the bubble leaves the screen, **it is a real defect in a shared
  component** (about eight files mount `<HelpTooltip`; `seasons/[seasonId]/page.tsx` :383 carries the same "Season statuses"):
  fix the placement (keep it inside the viewport), re-run `--only` for every sweep screen that mounts one, give it its own commit
  and a ledger § walk (next free § — check). If a person cannot reach that state and the sweep only got there by accident, the
  fix is the sweep (stop it opening the bubble) — still not a baseline entry, unless the owner says so with a reason.
  **State which one it is, with the measurement, before changing anything.** `admin-hl-season` is a second place to look.

## Part B — the free coach joins the sweep (Free coach header parity, B4)
**What B4 already has:** the fixture itself — `scripts/seed-free-coach-fixture.mjs` (committed `9c390423`, 2026-10-18; dev-only,
idempotent, refuses any other host; makes `uat-free-coach@uat-free-coach.local`, one `basic_coach_teams` row "UAT Free Team",
an owner membership, tools `roster` + `schedule` on; **no players, events or notices**), its `UAT_FREE_COACH_EMAIL/PASSWORD`
block in `UAT_SETUP.md` (:93–96), both keys in `.env.local`, and the wipe route already protects the account
(`app/api/dev/seed/wipe/route.ts` :16). **What is left** (verified absent): a saved sign-in, an env loader entry, a runner
session, a context resolver, and the screens.

**PM UX summary first, in the chat (AGENCY_RULES), and put these to the owner before building:**
1. *The empty-fixture trap.* With no rows the Roster, Schedule and bell measure only their empty states — the sweep's own
   header calls that coverage that isn't. Recommended: a few idempotent rows in the seed (a handful of players, a game and a
   practice, a notice) — read the tables from `docs/agents/db/DATA_DICTIONARY.md` / live `information_schema`, never from
   migrations. Alternative: sweep empty states and say so in the hand-off. Do not decide it yourself.
2. *Cost:* ~11 new screens × 4 widths ≈ +44 pairs on 270 screens (~4%).
3. *Side effect:* once listed, a machine without `tests/uat/.auth/free-coach.json` makes a **whole** sweep stop with the repair
   command, as the club sessions do. Say so in the hand-off; do not edit `release.md`.

**B1 · Sign-in.** `tests/uat/helpers/types.ts` (`UATEnv` :63–83, `loadUATEnv` :97–129): add an optional `freeCoach` from
`UAT_FREE_COACH_*` (same shape as `plusScorekeeper`). `tests/uat/auth.setup.ts` (pattern :98–122): `authenticate: free-coach`,
skipped when its env pair is absent, saves `.auth/free-coach.json`. `UAT_SETUP.md`: one line that the setup test exists.
**B2 · Run only that setup test** so no other session is rotated: `npx playwright test --config playwright.config.ts --project=auth-setup --grep "free-coach"`
(check with `--list` first; ask the owner if you must run the whole project). The file does not exist locally today.
**B3 · Runner and context.** `check-layout-invariants.mjs`: `SESSION_FILES.freeCoach` (:101–117) and, beside :1233, resolve a
free-coach context only when such a screen is in the run (as the admin context is). `uat-fixture-context.mjs`: a
`resolveFreeCoachContext()` (pattern :464–490) returning the team id **found by the account's own membership, never by
name or position** (the seed does the same, :87–91), throwing with the seed command as the repair. `/api/me/role-summary`
(the runner's sign-in proof, :1279–1297) answers an org-less coach — confirm, don't weaken the check.
**B4 · Screens** in `layout-screens.mjs`: session `freeCoach`, **no `area`** (so the admin-only checks skip them — `admin-identity.mjs`
and `measure-dev-memory.mjs` filter on `area`/`'coach'`), `route:` on each entry for `--changed` (the sentinel map at
:384–409 cannot turn `[basicTeamId]` back). Candidates from `app/coaches/**`: team Overview (`/coaches/team/{id}`) **plus its More
sheet at phone widths** (the free bar is `nav[data-free-coach-bar]`, button `#free-mob-more`, sheet `[role="menu"]`; copy
`openMoreSheet`'s no-op guard :88–94 — the paid selector `Coaches mobile navigation` does not match), `/roster`, `/schedule`,
`/tournaments`, `/explore`, `/coaches/notifications`, `/coaches/tournaments`, `/coaches/teams`, `/coaches/help`; `/fees` and
`/announcements` only if the fixture turns the tool on. **Leave `/chat` out** (it redirects while chat is paused,
`chat/page.tsx` :26). Probe each address first: a screen that redirects is measured as the page behind it (non-admin entries are
not held to the landing check, :1478). Update the header JSDoc (:9–45) and `Ctx` typedef (:47–58).
**B5 ·** Run the new ids on staging; every finding is NEW by definition. Group them by rule, say which are the shared bar's
and which the pages', and give the owner the list. **Baseline them only on the owner's word, each with a reason** — `--init
--only=<new ids> --allow-partial` writes every finding of those screens, so run it only then.
**B6 ·** Re-run one full-width pair of an old free-coach-adjacent screen (`coach-team-hub`) to prove nothing else moved.

## Proof
For every repaired or new entry: `node scripts/check-layout-invariants.mjs --only=<ids> --dump=.probe/layout-upkeep/<name>.json`
(staging, or dev with `--workers=1`), all four widths, **zero unmeasured**, and **evidence the state was reached** — the
gesture alone is not proof (the lesson in the screen list's header): a probe or the dump showing the sheet's own rows, and for
A2 that the scope matched. Run the focused checks (`npm run verify:changed -- <files>`; the unit guards that read these files:
`coach-nav-groups` and `room-address-keys-guard` read the runner and the screen list) and `npm run check:automation`. Offer `/review` once
(new logic in the runner and context); `/simplify` only if the pill helper replaced copies. No `/docs`, no demo work.

## Records (same unit of work)
- The release record's 10-18 "Follow-up owed" line (auto-memory, outside the repo): mark it done with the commit hash and date.
- `FREE_COACH_HEADER_PARITY_PLAN.md` §9.5 B4 (:383–384) and the follow-ups line (:421–422): B4 done, `<hash>` `<date>`.
- `TODO.md` line 536: its clause "free-coach UAT login + free phone screens in the layout sweep" → done, with the hash (positive
  fact with an anchor — never "uncommitted"/"not on prod"). The file may hold other sessions' edits: build your lines as HEAD + your
  exact block in a temporary index (auto-memory `reference_partial_commit_shared_tree`).
- No QA-ledger walk unless A4 ships a product fix (then its own §, own commit).

## Commit
Only after the owner confirms; explicit pathspecs, never `git add -A`; re-check the branch is `dev`. Suggested: (1) Part A — the
screen list + baseline re-key; (2) A4's product fix if any, on its own; (3) Part B — auth setup, types, runner, context, screens,
`UAT_SETUP.md`, the seed if extended; (4) records. Run `git show --stat HEAD` after each and confirm only your paths. **Do not
push** until the owner says.

## Hand-off (product-owner voice)
What was swept (screens, widths, where, how long); unmeasured = 0 or which and why; the A4 verdict with its measurement; a table
of **every baseline change** — key, action, reason; the free-coach findings grouped by rule; what the owner must decide
(the fixture's rows, any baseline acceptances, the entry-wide `skip: ['content-overflow']`, and — as a proposal only — a runner
that fails when a declared `scope` matches nothing).

## Do not
Release, push or merge. Run a whole sweep on the dev server. Run the whole `auth-setup` project without the owner. Change a rule,
a gate, `memory-guard.mjs`, a hook or `.claude/settings*`. Delete a baseline entry other than by the re-key. Write a report
file or a `--report` inventory into the repo.
