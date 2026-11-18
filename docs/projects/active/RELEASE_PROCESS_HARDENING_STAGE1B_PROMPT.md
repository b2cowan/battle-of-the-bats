# Release process hardening, Stage 1B: one gate, both routes

**Owner go:** running this prompt is the owner's go to build Stage 1B and to commit it on `dev` (explicit
pathspecs, never `master`, no push to `master`). It is not a go for Stage 2 or 3.

**Run this after Stage 1A has landed.** Both stages edit `.claude/commands/release.md`, and the gate's last step
reads the result file the Stage 1A sweep writes.

## Read first

- `docs/projects/active/RELEASE_PROCESS_HARDENING_PLAN.md`: §2.2 and §2.3 (findings, with anchors) and §5.2
  (this stage, eight items and the acceptance list). §5.2 is the scope.
- `.claude/commands/release.md` in full, and `RELEASE_CONFIG.md`.
- `next.config.ts` lines 28–35: the build skips its own type check on the promise that the release runs one.

The plan's line numbers were read on 2026-11-15. Check them against the files before building on them.

## The problem in one paragraph

There are two routes to production, and the checks between them are prose an agent has to remember. The promote
route, as written, runs one check and skips the type check, while the build has its own type check switched off.
Releases have shipped with failing unit tests. Nothing scans for vulnerable packages or for a key committed by
accident. This stage turns the checks into one command with one table, makes both routes call it, and makes a
waiver visible.

## Ask the owner at the start (two questions, then carry on)

Both change shared agent automation, so each needs a yes **in this conversation**, and each goes in its own
commit whose message says what behaviour changes.

- **A1:** should a push to production and a production database change always stop and ask you, whatever a
  session has been told? Recommendation: yes. On yes, build item 7 (use the `update-config` skill).
- **A5:** also run the secret scan at every commit, not only at release? Recommendation: yes. On yes, build
  item 8.

Everything else proceeds either way.

## Build

Plan §5.2, items 1–6 in order, then 7 and 8 as ruled.

- **Item 1 comes first and is a measurement.** Record the counts in the plan before fixing anything. Another
  session's uncommitted files are in the tree; separate their failures from the ones at `HEAD`.
- **Item 2:** decide from the code whether a failing test or the product is wrong. A real product defect is a
  finding for the owner. Do not widen this stage into fixing the product, and do not delete a test to turn the
  suite green.
- **Item 3:** the gate calls the existing database checks unchanged. Do not edit them; they are watched paths
  and belong to Stage 3.
- **Item 4:** rewrite the release instructions so both routes point at one checklist. Keep every standing rule
  the file already holds (the demos never gate a promote, the release-notes pass, the records catch-up).

## Prove it (plan §5.2 acceptance)

- Unit tests for the gate's step runner, its waiver handling and the secret patterns, using fakes.
- One real run of the gate, with each step's duration recorded in the plan.
- A planted type error, a planted fake key and a failing test each turn the gate red. Plant them in the working
  tree and remove them; never commit them, and never create a branch.
- Read `/release promote` end to end and confirm it names every check `/release master` names.

## Rules that bind this session

- The type check takes several GB. Run heavy checks one at a time, and never beside a layout sweep.
- A database check that reports "cannot verify" is a failure, not a pass. Keep that stance in the gate.
- No push to `master`, no production migration, and no change to production data in this stage.
- `.claude/settings.json` and `.githooks/pre-commit` change only on A1 and A5. Any other watched path
  (`WATCHED_PATHS` in `scripts/check-agent-automation.mjs`): stop and ask.
- Other sessions share this tree. Stage explicit paths, and check `git show --stat HEAD` after each commit.

## Hand-off

- Offer `/simplify`, then `/review`, before the commit.
- Update the plan: the ladder's Stage 1B state with the commit hashes and date, the measured counts and
  durations, and A1 and A5 as ruled.
- Report to the owner in plain language: what a release now checks on both routes, how long the check takes,
  what a waiver looks like, and anything the tests or the scans found that needs a ruling.
