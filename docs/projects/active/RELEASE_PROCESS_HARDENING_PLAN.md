# Release process hardening — Implementation Plan

**Status:** on the board (Owner Morning Brief).
**History (not kept current):** PLAN written 2026-11-15, on the owner's word ("write a plan and give me the prompt to kick off stage 1").
Each stage records its own commit in the ladder below when it lands. Owner asks (§7): A3 ruled yes 2026-11-15; A2 ruled
yes and A4 re-confirmed off 2026-11-22; A1 and A5 answered yes 2026-11-22 as intent, confirmed in the 1B session.
Companion brief: `RELEASE_PROCESS_HARDENING_PM_BRIEF.md`.
Kickoff prompts: `RELEASE_PROCESS_HARDENING_STAGE1A_PROMPT.md`, `RELEASE_PROCESS_HARDENING_STAGE1B_PROMPT.md`.

## 1. The question this answers

> "I need you to do an evaluation of our release process focusing on security, efficiency, and stability. One
> glaring problem seems to be our layout sweep step, which has not happened the past few releases because it takes
> up too much resources to where it crashes the server, and when it does continue it takes 4-6 hours to complete."
> — owner, 2026-11-15

## 2. What the evaluation found (measured 2026-11-15, not felt)

**The checks are good. They hold only when the agent running the release remembers to run them, and every one of
them runs on the owner's PC beside whatever else is working.** Both halves of that sentence are the plan.

### 2.1 The layout sweep

- A healthy whole-product run on staging is under an hour. Recorded: 16 min warm + 8 dark at 4 workers
  (2026-10-13, 268 screens, `.claude/commands/release.md` §1d-5); 35–50 min warm and 18–24 dark at 2 workers
  (`.probe/release-2026-10-19`, `-10-20`, `-10-27`).
- The server is remote on staging. What runs out of memory is the PC: `scripts/memory-guard.mjs` reads the PC's
  free memory (floor 1,536 MB), and the browsers share it with other sessions' type-checks and dev servers.
- The hours come from fragility:
  - **An abort discards every finished screen.** `scripts/check-layout-invariants.mjs` exits on a memory trip
    (lines 1637–1640) before the dump is written (line 1646). There is no journal and no resume.
  - **A dead screen is waited on.** Navigation and the ready selector each get 150 s (lines 1479–1480), a budget
    sized for a dev server that compiles on first visit. On 2026-11-14, 35 `pubt-*` screens did not render; the
    run went 2 h 18 min (`.probe/release-2026-11-14/warm.log`) and wrote no result.
  - **Broken setups are found mid-run**: stale saved sign-ins, the free coach's test team (12 screens blocked).
  - **The job grew.** 268 screens on 2026-10-13; 361 screens, 1,479 warm pairs and 722 dark pairs counted by a
    helper on 2026-11-15 (re-count with `--list` before relying on these).
- Skipped on the 2026-10-30 and 2026-11-05 promotes (TODO.md, both "OWED" lines); the 2026-11-14 run never finished.
- Dark mode has no accepted list, so its findings are judged by hand each release. The warm accepted list holds
  2,593 entries, 1,924 without a reason (helper count).
- `--changed` reads `git diff --name-only HEAD` (line 336): the uncommitted tree only. It cannot answer "what
  changed since the last release", and a shared file widens it to nearly every screen. It is not a release gate.

### 2.2 Security

| # | Finding | Anchor |
|---|---|---|
| S1 | Pushing to `master` and applying a migration to production are pre-approved for agents. "Wait for the owner to type push" is an instruction, not a lock. | `.claude/settings.json` 238–239 and 47–59; `.claude/settings.local.json` 170–174 |
| S2 | The access-boundary tests are not in a release. 46 browser scenarios (`tests/uat/scenarios`) run by hand; `npm test` is never run by the release. The 2026-11-05 promote shipped with 7 known failing unit tests, 2026-10-27 with 6. | release-history record; `release.md` has no `npm test` |
| S3 | No dependency audit and no secret scan anywhere (hook, build, health, release). | helper census 2026-11-15 |
| S4 | Nothing asserts that every table keeps its access policies. Snapshots record row-level security on/off only. | `scripts/refresh-db-snapshots.mjs` |
| S5 | One access token reaches the dev and prod databases; prod-writing scripts are guarded by a flag, never a prompt. | `scripts/apply-migration-api.mjs` |

### 2.3 Stability

| # | Finding | Anchor |
|---|---|---|
| T1 | **No type check on the promote route.** The build's own type check is off on the promise that the release runs one; `/release promote` skips it. | `next.config.ts` 28–35; `release.md` 423 |
| T2 | Two routes to production with different checks. Promote, as written, runs one check (`check:migrations`). | `release.md` 375–423 |
| T3 | No backup step before a production database change, no way back from one, and the code rollback instruction reverts one commit of a many-commit release. | `release.md` 541–559 |
| T4 | Nothing checks production after a deploy: no smoke test, no outside uptime monitor; error alerts live in the database they report on. | helper census |
| T5 | The demo re-seed writes to the production database during the build, before the new code is live, and never fails the build. It failed silently on 2026-10-27. | `amplify.yml` 126 |
| T6 | The release tag goes on the local HEAD, before the build has succeeded. | `release.md` 317–322, 419 |
| T7 | A migration that must be applied after the deploy has no status of its own, so the gate is passed by override. | `release.md` 154–157 |

### 2.4 Efficiency

- Everything runs on one shared PC. That is the cause of the sweep aborts and of gates turning red when another
  session changes the dev database mid-release.
- The sweep's fragility (§2.1) and the hand-judged dark findings.

### 2.5 What the Stage 1A runs found (2026-11-15)

- **The 35 dead `pubt-*` screens of 2026-11-14 were the clock, not the pages.** Their fixtures (the Stage 3 and Stage 4
  public tournament scripts) were dated 3–7 November. A game is live only from its start to 2 hours after it
  (`lib/game-status.ts` `isGameLive`), a bracket is "upcoming" only while its next game is ahead
  (`lib/public-playoffs.ts`), and the page's clock cannot be pinned (server and browser `new Date()`). The product was
  right. Fixed at the root: `scripts/refresh-layout-public-fixtures.mjs` re-dates both sets, and the sweep's first
  minute reads each needed state from the server-rendered page (`FIXTURE_CHECKS` in `scripts/layout-screens.mjs`).
- **The free coach's 12 screens were blocked by a portal that had already ended.** The support-console walks
  (§414–§416, walked 2026-10-30) linked the free team to a staff-given Premium portal; its free time ended 2026-10-30,
  so the product treated the team as free again, but the sweep's resolver refuses any linked team.
  `scripts/seed-free-coach-fixture.mjs` now clears a link to an ENDED portal (only the team's link; the portal and its
  history are kept) and stops if the portal is still running. Run 2026-11-15; resolver passes.
- **The legal pages 404 on staging by design** (dark until GST/HST Stage 6 step 6.7; dev shows them with
  `LEGAL_PAGES_PREVIEW`). Marked `onlyWhereServed`: taken out of a staging run by name and listed on every run.
- ⚠ **PRODUCT FINDING for the owner — the coach Overview re-requests two pages about three times a second for as long
  as it is open.** Measured on staging 2026-11-15 (`.probe/stage1a/idle-probe.mjs`): the Overview's "Take attendance"
  door (`/schedule?event=…&tab=attendance`, `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` ~1829) and its money-report
  door (`/accounting?section=budget-vs-actual`) are link-prefetched every ~300 ms without end. Each answer is a 200,
  ~4 KB, `cache-control: no-store`; the other door prefetches (Announcements, Tryouts, Staff), which carry no query,
  are fetched once. Cost: a coach's phone data and battery while the Overview is open, and a server render (with its
  database reads) for every request from every open Overview. It also means those pages never go network-idle, so they
  wait out the sweep's 30 s network-idle cap: in the 2026-11-15 slices about half the coach pairs (the Overview and team
  hub, Roster, the practice plan, the money report, an event's attendance) took ~31 s each, against a median of 1–5 s
  for every other kind of screen — the largest single share of the sweep's time. Which other coach pages carry a looping
  door was not traced. Not fixed here (Stage 1A changes no product code); the sweep's waits are left as they
  are, because they decide what is measured.
  - **FIXED — committed `a5c429130` 2026-11-15** (`COACH_PREFETCH_LOOP_FIX_PROMPT.md`; owner go for `next.config.ts` the
    same day). **Cause:** Next 16.3's *optimistic routing* (on by default, still experimental) predicts a link's route
    tree from a sibling it already knows. The coaches layout's `@stripFacts` slot (navigation Phase 4, `dcddf7c80`
    2026-11-11) matches every team page with a catch-all `[...rest]`, the documented way to blank a slot. For an
    address with a query whose plain twin is known (or the reverse), the prediction leaves the catch-all's param
    unresolved (`reifyRouteTree`, a "should never happen" TODO still present in 16.4.6), and the link re-prefetches
    every ~300 ms. **Since:** staging 2026-11-11; **production since the 2026-11-15 promote** (the public coach demo
    looped each door ~7×/s; the 11-05 promote predates the slot). **Reach:** coach team pages only (~100 links: money and
    insights tabs, a player's tabs, back-to-event links, the doors); the strip is the app's only parallel slot. Proved
    by controls: admin pages with a query on the same Next fetch once; blocking the plain twin's prefetch stops it;
    `next dev` never prefetches on sight, so it cannot show it either way. **Fix:** `experimental.optimisticRouting:
    false` (the pre-16.3 behaviour: a route's first prefetch asks the server for its tree), with a guard
    (`tests/unit/prefetch-loop-guard.test.ts`) that keeps it off while any slot has a catch-all. **After, on a local
    production build:** Overview, Roster, practice plan, money report and an event's attendance each prefetch every
    address once, nothing in flight after 12 s; taps through the query doors land soft with the strip's facts;
    `check:layout` slice @361 p95 **3.8 s** (staging before: 33.6 s), the same 13 findings as sets. A coach notices
    nothing on screen. The next whole-product sweep's cost line is the measure on the release.

## 3. The shape of the fix

1. **Make the checks code, not prose.** One command runs the gate for both routes and prints one table. A waiver
   is typed with a reason and shows in the release summary. Nothing is skipped silently.
2. **Make the sweep finish.** Keep what it measures; change how it fails: first-minute checks, short budgets on
   a production build, progress kept, low memory pauses before it quits.
3. **Take the heavy checks off the PC.** A cloud runner checks every staging build. The release reads the result
   for that exact commit.
4. **Add the net under the release.** A way back for the database, a look at production after the deploy.

Not chosen: sweeping only the changed screens as the release gate. The map from a file to its screens is
hand-kept and widens to the whole product whenever a shared file changes, which is most releases.

## 4. Stage ladder

Ordered by dependency and rework risk. 1A before 2, because the cloud runner runs the same tool. 1B before 2,
because the runner calls the same gate steps. 3 is independent of 2.

| Stage | Covers | Shared automation touched | State |
|---|---|---|---|
| **1A · The sweep finishes** | §5.1 | none | items 1–10 BUILT 2026-11-15; COMMITTED 2026-11-18 on the owner's approval ("Yes, commit it (Recommended)", in conversation, after the 15 unit tests passed and every script loaded); slice acceptance tests passed (§5.1 "Measured"); whole-product run owed after the prefetch-loop fix reaches staging and the test sign-ins are refreshed |
| **1B · One gate, both routes** | §5.2 | `.claude/settings.json` (A1), `.githooks/pre-commit` (A5) | prompt written 2026-11-15 |
| **2 · The checks leave the PC** | §6.1 | none expected; new workflow files | needs A2 |
| **3 · The safety net** | §6.2 | `check-manual-prod-migrations.mjs`, `refresh-db-snapshots.mjs`, `stack-health.mjs` | needs A4 |

## 5. Stage 1

### 5.1 Stage 1A — the sweep finishes

Files: `scripts/check-layout-invariants.mjs`, `scripts/memory-guard.mjs`, `scripts/layout-screens.mjs` (fixtures
only), `.claude/commands/release.md` §1d-5, new unit tests. None is a watched path.

**What it measures does not change.** Every item below changes how a run starts, fails, and reports.

1. **Fail in the first minute.** Before the first unit: the target answers 200 (a sweep once started the second
   the build reported SUCCEED and died with "No server reachable"); every session in the run is signed in (the
   role-summary pre-check exists; keep it); every fixture the selected screens need resolves; one canary screen
   per session loads inside a short budget. All failures print together with their repair line.
2. **Budgets fit the target.** When `UAT_BASE_URL` is set the target is a production build and nothing compiles
   on first visit: navigation and ready-selector budgets drop from 150 s to a measured figure (start at 30 s;
   set it from the healthy p95 the timing line reports, about three times it, never under 20 s). The dev server
   keeps 150 s. Leave the network-idle and no-loading waits alone until the timing data says otherwise: they
   decide what is measured.
3. **A dead screen costs seconds, once.** A screen that does not render is queued and retried once, in a fresh
   context, after every unit has finished. Three failures in a row inside one unit trigger a re-check of that
   session's sign-in and the target; if the session is dead the rest of the unit is recorded unmeasured under
   one cause line.
4. **Progress is kept.** Each finished pair appends to a journal under `.probe/layout-run/`, keyed by commit,
   target host, theme, sidebar mode and a hash of the screen list. `--resume` skips journalled pairs; the dump
   and the NEW comparison read journal plus this run. A journal from another commit, host or list is refused.
   **Unchanged:** an abort still exits non-zero, and `--init` / `--prune` still refuse anything but a complete set.
5. **Low memory pauses before it quits.** On a trip: stop handing out pairs, wait (default 10 min, polling), and
   continue at one worker once free memory is back above the floor plus a margin. Abort as today when the wait
   runs out; the journal makes the re-run cheap. Add this beside `check()`; do not change `check()` for the
   other callers. The repair text stops telling a staging run to restart the dev server.
6. **One page does not live for 124 navigations.** Recycle the page every 25 screens in a unit. Prove on a slice
   that the findings are identical.
7. **The run reports its own cost.** The dump and the last line carry wall-clock, per-pair p50/p95, the ten
   slowest pairs, retries, workers and the memory low-water mark, so the release record holds real numbers.
8. **The setups that block it today, fixed at the root.** The free coach's test team (12 screens; detail in the
   two "OWED" lines in TODO.md). The 35 `pubt-*` screens that did not render on staging on 2026-11-14: find out
   whether that is a fixture, an address, or a real defect on the public tournament pages. A real defect is a
   product finding for the owner, not something to route around.
9. **Dark gets an accepted list — only on A3.** `--theme=dark --init` writes its own baseline file, on the
   owner's word only.
10. **The release instructions say the new commands.** §1d-5: `--resume`, what an abort now means, the new
    timings. The numbers' single home stays the tool's header.

**Acceptance, measured on staging:**

- Warm and dark complete for the whole product from the PC; wall-clock recorded. Target: 45 min combined. If it
  misses, report the timing table and the cause; do not tune silently.
- Kill test: stop a run midway, `--resume` finishes it, and on a 40-screen slice the resumed dump equals a
  straight-through dump as a set.
- Dead-screen test: a slice with an unreachable screen family fails fast (35 dead screens under 5 min in total).
- First-minute test: a stale session file stops the run inside 60 s and names the session.
- Same findings: a slice run with the tool at HEAD and with the changed tool produces identical finding keys.
- Unit tests cover the journal key, resume selection and the pause decision (pure functions).
- The acceptance run is the sweep owed since 2026-10-30. Clean, or every NEW finding ruled by the owner, closes
  both "OWED" lines in TODO.md with the run's date and the commit it measured.

**Measured 2026-11-15 (staging; the figures' single home is the header of `scripts/check-layout-invariants.mjs`,
"MEASURED"):** same findings ✅ (75 pairs), kill test ✅ (165 pairs, 70 + 95 resumed), dead screens ✅ (35 pairs in
3 min 19 s), first minute ✅ (3 s), unit tests ✅ (15). The whole-product run was STOPPED by the owner at 734 of 1,469
pairs: ~3/4 of the coach pairs took ~31 s each because of the coach Overview's prefetch loop (§2.5), so the 45-minute
target cannot be judged until that fix is on staging. Expected after it: about 20 min warm with dark in place.

**Owner rulings made during the build (2026-11-15):**
- **390 is on demand, not default.** 785 baseline entries ever recorded at 390, every one also at 361; the half-product
  run found the same 105 at both. A release sweep measures 361, 768, 1440 (+320 on marketing). `--width=390` still
  sweeps every screen there, and its baseline entries are kept.
- **Dark is read in place (`--with-dark`)**, on the warm run's own page at 361 + 1440, by flipping the theme attribute
  by the product's own rule. Proven identical to a real `--theme=dark` run: 38 pairs, 67 dark finding keys each. A real
  dark run still writes dark's accepted list (A3).
- Also built on the run's evidence: the journal is keyed by the TARGET's build id on staging (another session's commit
  no longer blocks a resume), a paused run returns to full speed after 2 minutes of healthy memory, and the legal pages
  (dark on staging by design) are taken out of a staging run by name (`onlyWhereServed`).

**Standing rules for the session:** never the whole product on the dev server; no type-check while a sweep
runs; never `--init` or a baseline edit to make a finding pass; never seed mid-sweep; `auth-setup` signs every
other session out, so ask the owner first.

### 5.2 Stage 1B — one gate, both routes

Files: new `scripts/release-gate.mjs` and its `package.json` script, `.claude/commands/release.md`,
`RELEASE_CONFIG.md`, a new secret-scan script, unit tests, and whatever the failing tests need. Watched paths
only on A1 and A5, each in its own commit.

1. **Measure first.** On the tree as it stands: `npm test`, `npx tsc --noEmit --skipLibCheck`,
   `pnpm audit --prod`. Record the counts here. Separate failures caused by another session's uncommitted files.
2. **A green unit suite.** Each failing test fixed at the root: decide from the code whether the test or the
   product is wrong. A test that cannot be fixed in the session is an owner question, never a silent skip.
   Known: tests that match `\n` fail on a fresh checkout with CRLF line endings (release history, 11 tests).
3. **`npm run release:gate`.** Serial, one table, non-zero on any hard failure, result written to
   `.probe/release-<date>/gate.json`:
   1. what is being promoted (`origin/master..origin/dev`), and local HEAD against `origin/dev`
   2. the staging build of that exact commit succeeded ("cannot verify" is a failure, as in the migration check)
   3. type check
   4. unit tests
   5. document check (`check:pdf`)
   6. database: `check:migrations`, then the manual-steps check with `--promote` (both called unchanged)
   7. dependency audit: high and critical fail; an accepted advisory lives in a small file with a reason, a date
      and the owner's word
   8. secret scan over the lines the promote adds: service keys, live payment keys, webhook secrets, cloud
      access keys, access tokens, private-key headers
   9. the layout sweep's result for this commit: complete and nothing NEW passes; missing, partial or another
      commit's reads "sweep owed"
   - `--skip=<step> --reason="…"` records a waiver in the table. A waiver is always visible in the summary.
   - The type check takes several GB; the gate never runs while a sweep is running.
4. **The release instructions.** Both routes call the gate; the "promote skips the type check" note goes; one
   checklist both routes point at; the summary shows the gate table and any waiver; the tag is put on
   `origin/master` after the build reports success; undo covers a many-commit release (back to the previous
   release tag, or redeploy the previous build); the "you're done" / "not finished" contradiction; the stale
   model name in the commit trailer; the two missing lines in `RELEASE_CONFIG.md`'s access policy; the dead
   pointer to `memory/feedback_branch_policy.md`.
5. **A guard so the hole cannot reopen.** A unit test: while `next.config.ts` skips the build's type check, the
   gate must contain the type-check step and both routes in `release.md` must call the gate.
6. **The secret scan joins `verify:changed`.** The audit does not (it needs the network).
7. **The push lock — only on A1.** `ask` rules for a push whose target is `master` and for a migration applied
   with `--prod`, in both shell forms; the historic one-off `--prod` allow lines go; `git push origin HEAD:dev`
   stays allowed. Own commit; the message says what behaviour changes. `.claude/settings.local.json` is
   machine-local and is edited in the same sitting.
8. **The secret scan at commit time — only on A5.** `.githooks/pre-commit`. Own commit.

**Acceptance:** the gate's step runner, waiver handling and secret patterns are unit-tested with fakes; one real
run of the gate is recorded with per-step durations; a planted type error, a planted fake key and a failing test
each turn it red (planted in the working tree and removed, never committed); `/release promote` read end to end
names every check `/release master` names.

## 6. Later stages (shape only; each gets its own detail when it is next)

### 6.1 Stage 2 — the checks leave the PC

- A GitHub Actions workflow on each push to `dev`: type check, unit tests, audit and secret scan at once; then,
  when staging serves that commit, the access-boundary browser scenarios and the layout sweep in shards.
- The tool needs `--shard=i/n` (a stable split of its units) and a merge of the shard dumps.
- The result is a status on the commit. Gate step 9 reads it, and steps 3, 4, 7 and 8 can read theirs.
- Open design questions: how the workflow learns that staging serves the commit; a sign-in for the runner that
  does not sign the PC's saved sessions out; two sweeps reading the dev database at once (the tool re-anchors
  one probe game); the account's included runner minutes.
- Needs A2.

### 6.2 Stage 3 — the safety net

- Before any production database change: a confirmed restore point, and a written way back per release. Needs A4.
- A status for "apply after the deploy" in the manual-steps list, so that class passes the gate without an override.
- After each deploy: a smoke check of the live site against a short list of pages and one signed-in read; an
  outside uptime monitor.
- The demo re-seed moves to after the deploy is live, and a failed re-seed is reported, not swallowed.
- A check that every table keeps its access policies (the snapshots learn the policies, not only on/off).

## 7. Owner asks

Answered on the Wave 1 owner checklist, pasted back 2026-11-22. A1 and A5 change shared agent automation, so under the
agency rules the yes counts only when given in the session that builds them: the 1B session asks both again when it opens.

| Ask | Question | Recommendation | Rides on it |
|---|---|---|---|
| **A1** | Should a push to production and a production database change always stop and ask you, whatever a session has been told? | Yes. **Answered yes 2026-11-22 (intent; confirm in the 1B session)** | Stage 1B item 7 |
| **A2** | May the test sign-ins and a dev-database key be stored with GitHub so a cloud runner can check staging? Nothing from production goes there. | Yes. **RULED yes, 2026-11-22** | Stage 2 |
| **A3** | Accept today's dark-mode findings once, as a list, so later releases show only what is new? | **RULED yes, 2026-11-15** (owner, in the Stage 1A session: "Yes (Recommended)"; the list is written from a complete whole-product dark run, after the count and top screens are shown) | Stage 1A item 9 |
| **A4** | Confirm in the Supabase account whether point-in-time recovery is on for production. | **RULED off, 2026-11-16, re-confirmed 2026-11-22**: off ("daily is enough before a first customer"); the 2026-11-18 rehearsal found it off and restored from a daily backup. Stage 3's safety net leans on the daily backups (7 days kept). | Stage 3 |
| **A5** | Also run the secret scan at every commit, not only at release? | Yes. **Answered yes 2026-11-22 (intent; confirm in the 1B session)** | Stage 1B item 8 |

## 8. Risks

- **A resumed run measures differently from a straight one.** The tool already holds "what a screen measures
  must not depend on the screen before it". The kill test and the same-findings test are the proof.
- **A shorter budget reports a slow screen as dead.** The budget is set from measured p95, and the end-of-run
  retry gets the full budget.
- **Greening the unit suite finds real product defects.** Those are findings for the owner; the stage reports
  them and does not widen into fixing the product.
- **The audit's first run lists many advisories.** High and critical in what ships are the gate; the rest is a
  report.
- **Other sessions share the tree and the PC.** Explicit pathspecs, a check of `git show --stat HEAD` after each
  commit, and no heavy check beside a sweep.

## 9. How we will know it worked

- The whole-product sweep runs on every promote, with its wall-clock in the release record.
- No promote reaches production without a type check and a green unit suite, on either route.
- A waived step appears in the release summary with its reason.
- After Stage 2: the release's own checking time is minutes, and none of it loads the PC.
