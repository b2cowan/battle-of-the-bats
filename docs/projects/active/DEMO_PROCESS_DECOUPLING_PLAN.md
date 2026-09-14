# The demos stop holding up development and releases — Implementation Plan

**Status:** BUILT on dev 2026-09-13 (all five measures); first master build after this ships is the
proof of measure A. Owner-approved 2026-09-13 ("go ahead with all 5").
Companion brief: `DEMO_PROCESS_DECOUPLING_PM_BRIEF.md`.
Supersedes the *process* half of `DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md` (measures 2 and 4 there);
that plan's checkers (measures 1 and 5) stay exactly as built.

## The question this answers

> "I am getting tired of the demo updates holding up our development and releases. Can we find a
> more efficient way to manage this so it isn't a staple of the development and release process?"
> — owner, 2026-09-13

## Where the time was going (measured, not felt)

1. **A per-commit tax.** CLAUDE.md asked every user-facing change to answer two demo questions and
   fix the seed / dock / tour in the same unit of work. Since 2026-08-01, **54 of 584 commits (9%)
   touched demo internals**, nearly all of them feature commits dragging the demo along. And the
   habit still missed: CLAUDE.md's own paragraph recorded the coach-money narration going stale
   **five releases in a row**. The residue is visible in `lib/sandbox-chrome.ts`: 978 lines, of
   which ~150 are data and the rest are sixteen dated "RE-READ" diary blocks, each written to
   prove the questions had been asked.
2. **A manual prod re-seed that became a debt.** The runbook made `check:demos:prod` a pre-promote
   STOP whose fix was a laptop-run script against production. It was "owed" for weeks at a time
   (most recently since 2026-09-10); twice it was run from a working copy *ahead of* the deployed
   code, which is how the tournament demo briefly served an unreleased world.
3. **CLAUDE.md was 56% demo.** 1,568 of 2,775 words — almost all release-history narrative, read by
   every agent in every session regardless of task.
4. **22 hand-written sentences carrying figures**, of which 3 were machine-checked.

What was *not* the problem: the checkers. They found real product defects. Keep the machines,
remove the humans.

## The five measures

### A · The prod demo re-seeds itself in the master build — BUILT

`scripts/reseed-demos-if-stale.mjs`, run as the last `build` step in `amplify.yml`:

- Computes a **world fingerprint**: sha256 over the seed scripts and every file they import
  (relative-import graph, walked statically — `lib/demo-coach.ts`, `lib/demo-org.ts`, the budget
  rules the seed borrows, …) plus the list of migration filenames. Any release that changes the
  demo world *or* the database reseeds; a release that changes neither does nothing.
- Reads the **stamp** each seed leaves behind: the latest `platform_audit_log` row for the demo org
  with action `demo_world_seeded` (`new_value.fingerprint`). No migration — the audit log is the
  record of seeds, which is what it is for.
- Runs only the seeds whose stamp differs, from exactly the commit being deployed, with
  `--allow-prod` only when `AWS_BRANCH` is `master`. Both seed scripts write the stamp on success.
- **Never fails the build.** A demo that could not be rebuilt is loud in the build log and is
  reported by `check:demos:prod` the morning after; the product deploy does not wait for it. The
  stamp is written only on success, so a failed reseed retries at the next build.
- Also runs on `dev`-branch builds (against the dev database) — a free rehearsal of every prod
  reseed, one release early.

Why build-time and not the nightly tick: the seed is a 1,700-line script with top-level flow, the
serverless route has a 60-second ceiling the seed (27s from a laptop) would crowd, and an earlier
session ruled (2026-09-04, release history) that the nightly reconcile must not become a second
source of truth for content. The build has Node, the credentials, the files and the exact commit.

⚠ **First-build verification owed:** the Amplify build image's Node version must support `.ts`
imports without a flag (Node ≥ 22.18 / 24). The script checks and prints it; if unsupported it
says so and exits 0, and the fallback is one manual reseed plus an `nvm use` line in `amplify.yml`.

The old window (prod serves old code against reseeded rows for the ~5 minutes until the new build is
live) is the same window every migration already accepts.

### B · The release gate is demoted — BUILT

`.claude/commands/release.md`: §1d-1 no longer STOPs the promote or instructs a manual reseed. The
promote pre-flight's "live-demo drift gate" is gone. `check:demos:prod` moves to the Phase 2b
truth-up as a **morning-after** check: red there means the build's reseed did not run, which is
something to look at, not a release blocker. The manual command survives only as the fallback in
this plan.

### C · The per-commit habit is replaced — BUILT

- CLAUDE.md's "ask two questions on every user-facing change" rule is deleted. The demo's story is
  curated on its own cadence (`/demos`, below), never per commit.
- **Measure 2 of the drift plan, finally built**: `tests/unit/demo-destinations-guard.test.ts`
  asserts every tour `href` and every dock landing resolves to a real `app/` route, and every
  tour anchor names a `data-sandbox-tour` marker that still exists in a component. A moved or
  deleted screen breaks the build at the right moment; nothing else asks a developer to think
  about the demo.
- **`/demos` — the shop-window pass** (`.claude/commands/demos.md`): one session per release
  cycle, run *after* a promote, with a fixed checklist: what shipped since the last pass, the 22
  sentences read against the seeded world, both tours walked, the moments dock's coverage of the
  releases' headline features, and a decision per feature — swap a clause, add a seeded moment,
  or leave it found rather than told. The command appends one line to the pass log at the bottom
  of this plan so the next pass knows its window.

### D · The sentences are harder to break — BUILT

Two rules, applied once across all 22 lines and now stated at the top of `sandboxMoments()`:

1. **A number in a sentence is computed from the seed, or it is not in the sentence.** The
   countable-claims guard in `check-demo-coach.mjs` now covers dock lines AND tour steps; each
   claim's expected phrase is derived from the seed constants (never typed twice). The tournament
   checker gains the same guard for its registration-week figures.
2. **A sentence describes what the screen is for, not what it happens to show.** Clauses that
   quoted a derived reading nobody recomputes (the playing-time figures, the split opinion the
   product never renders) were rewritten as what-the-screen-is-for prose.

The sixteen RE-READ diary blocks were removed from `lib/sandbox-chrome.ts`; the design rules
(the one-proof-point cap, the prefix/same-path traps, the no-figures-in-the-ledger-step rule) stay.
Git history keeps the diary.

### E · CLAUDE.md's demo section is ~150 words — BUILT

The standing rule and two pointers. The release-state narrative already lived in the auto-memory
release-history record (its one home); nothing was lost.

## What the owner gives up

- Same-day demo currency for a new feature: it arrives at the next `/demos` pass, not the next
  commit.
- The pre-promote guarantee that the public demo is fresh the moment a release lands: it is fresh
  the moment the build finishes instead, and verified the morning after.

## Done-means

- [x] `npm test` green including the new destinations guard.
- [x] `npm run check:demos` green on dev after the sentence rewrite (the widened claims guard
      passes against the seeded world).
- [ ] First master build after this ships: build log shows the reseed step running, prod stamp
      written, `check:demos:prod` green the morning after. **This is the owed verification.**
- [x] CLAUDE.md demo section ≤ 200 words; `/demos` command exists; runbook §1d-1 rewritten.

## Shop-window pass log (`/demos` appends one line per pass)

- 2026-09-13 — baseline. The 22 sentences were read against the seeded world while building
  measure D; 4 sentences changed (tryout-day dock line lost the unrendered split-opinion clause;
  mid-season dock line's "three events this week" became "a game this Saturday"; tour step 2 lost
  "eleven of thirteen" and "three times"; tour step 6 lost its innings and sit counts). Moments
  proposed: 0. Walked by owner: no — owed at the next pass.
