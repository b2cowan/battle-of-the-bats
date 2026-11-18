# Release process hardening, Stage 1A: the layout sweep finishes

**Owner go:** running this prompt is the owner's go to build Stage 1A and to commit it on `dev` (explicit
pathspecs, never `master`, no push to `master`). It is not a go for anything in Stage 1B, 2 or 3.

## Read first

- `docs/projects/active/RELEASE_PROCESS_HARDENING_PLAN.md`: §2.1 (what was measured) and §5.1 (this stage, ten
  items and the acceptance list). §5.1 is the scope. Build all ten items in this session, except item 9, which
  waits on ask A3 below.
- The header of `scripts/check-layout-invariants.mjs` and all of `scripts/memory-guard.mjs`. The header is the
  single home for the sweep's numbers; update it, and do not restate its numbers elsewhere.
- `.claude/commands/release.md` §1d-5.
- The two "layout sweep OWED" lines in `TODO.md` (the 2026-10-30 and 2026-11-05 promotes). They hold the detail
  on the free coach's test team.

The plan's line numbers were read on 2026-11-15. Check them against the file before building on them.

## The problem in one paragraph

A healthy whole-product sweep on staging takes under an hour. It has not completed for three releases because
of how it fails: a low-memory stop on the PC throws away every finished screen, a screen that does not load is
waited on for up to 150 seconds twice, and stale sign-ins or a broken test club are discovered mid-run. On
2026-11-14 a run went 2 h 18 min on 35 dead screens and wrote no result. **Do not change what the sweep
measures.** Change how a run starts, fails, resumes and reports.

## Ask the owner at the start (one question, then carry on)

**A3:** accept today's dark-mode findings once, as a list, so later releases show only what is new?
Recommendation: yes. Build item 9 only on a yes given in this conversation. Everything else proceeds either way.

## Build

The ten items of plan §5.1, in this order:

1. The timing line (item 7) first, so every later run in this session produces numbers.
2. First-minute checks (item 1) and budgets that fit the target (item 2).
3. Dead screens cost seconds, once (item 3).
4. The journal and `--resume` (item 4). Pure functions for the key, the resume selection and the pause decision,
   with unit tests in `tests/unit/`.
5. Low memory pauses before it quits (item 5). Add beside `check()` in the memory guard; the other callers keep
   today's behaviour.
6. Page recycling (item 6).
7. The blocked setups (item 8): the free coach's test team, and why 35 `pubt-*` screens did not render on staging
   on 2026-11-14. If that is a real defect on the public tournament pages, report it to the owner as a product
   finding. Do not route around it.
8. Item 9 if A3 is yes.
9. `release.md` §1d-5 (item 10).

## Prove it (plan §5.1 acceptance)

Run against staging (`UAT_BASE_URL=https://dev.fieldlogichq.ca`). Use slices (`--only`) for the kill test, the
dead-screen test, the first-minute test and the same-findings test. Then run the whole product, warm then dark,
and record the wall-clock. The target is 45 minutes combined; a miss is reported with the timing table and its
cause.

**That whole-product run is the sweep owed since 2026-10-30.** NEW findings stop for the owner, exactly as §1d-5
says: the screen and width, what a person sees, and the commit that caused it. When it is clean, or every NEW
finding is ruled, close both "OWED" lines in `TODO.md` with the run's date and the commit it measured.

## Rules that bind this session

- Never the whole product on the dev server. Slices on the dev server only when staging cannot serve the case.
- No type-check, and no other heavy check, while a sweep is running. Check free memory before each long run.
- Never `--init`, `--prune` or a baseline edit to make a finding pass. A baseline changes on the owner's word.
- Never seed while a sweep runs: a seed's password reset signs every saved session out.
- `auth-setup` signs every other session out. Ask the owner before running it.
- Staging must be serving the commit the screen list is read from. If local `dev` is ahead of `origin/dev` in
  the screen list or the routes, say so and sweep what staging serves.
- This stage touches no watched automation path (`WATCHED_PATHS` in `scripts/check-agent-automation.mjs`). If a
  change turns out to need one, stop and ask.
- Other sessions share this tree. Stage explicit paths, and check `git show --stat HEAD` after each commit.

## Hand-off

- Offer `/simplify`, then `/review`, on the tool changes before the commit.
- Update the plan: the ladder's Stage 1A state with the commit hash and date, the measured timings in §2.1,
  and A3 as ruled.
- Report to the owner in plain language: how long the sweep now takes, what it found, what happens when it is
  interrupted, and anything that needs a ruling.
- Stage 1B's prompt is `docs/projects/active/RELEASE_PROCESS_HARDENING_STAGE1B_PROMPT.md`. Do not start it here.
