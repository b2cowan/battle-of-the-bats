# Build prompt — QA ledger triage by exposure, then a Tier 1 browser pilot

> Written 2026-08-03 for a fresh chat. Self-contained: assume no memory of the session that wrote it.

## The situation

`docs/projects/active/OWNER_QA_LEDGER.md` holds **286 unticked QA steps and zero ticked**. It was
written as a *pre-release gate* — a list of things to verify before shipping.

**That framing is now wrong, and this is the single most important fact in this prompt.** A release
went out on 2026-08-03. `dev` sits ~2 commits ahead of `origin/master`. **Essentially everything in
that ledger is already live in front of customers.** It is not a pre-release gate; it is a list of
**unverified live behaviour**.

Two consequences:

1. **The ledger's own status labels are unreliable.** Many items say "built, uncommitted" for work
   that shipped. Some are still genuinely uncommitted — there were ~50 modified files in the working
   tree from concurrent sessions. **It is a mix, and a reader today would mis-judge the risk in both
   directions.** Verify each label against git rather than trusting the header.
2. **Priority should be driven by exposure, not by project completeness.** A finished feature nobody
   can reach matters less than a half-checked one handling a child's medical form.

## Task 1 — regroup by exposure, and correct the labels (document pass, no testing)

Restructure the ledger so the ordering answers *"what happens if this is wrong?"*. Proposed tiers —
challenge them if the content argues otherwise:

- **Tier 1 — can harm someone.** Guardian/child information, money, messaging families, anything
  granting a person access. Includes: player documents & guardian-PII gating · families following a
  team · the guardian tier · the coach byproducts · the helper persona (a **non-coach adult**
  attached to a team with children) · budget starter · money by month · money on a phone.
- **Tier 2 — daily coach actions.** Overview, schedule, attendance, roster, practice plans, tryouts.
  Wrong here is friction and lost trust, not harm.
- **Tier 3 — polish.** Findability, the dismiss/Escape sweep, the tournament creation preview, the
  sandbox.

While regrouping, **fix each item's status line against reality**: shipped · uncommitted in the
working tree · blocked. Keep every existing step's wording — this is a re-sort and a re-label, not a
rewrite. Do not delete steps.

⚠ **Known blocker, leave it blocked:** the guardian tier (§1.6c) is switched OFF pending counsel and
**cannot be QA'd at all**. Do not attempt it; keep it clearly marked.

## Task 2 — a Tier 1 browser pilot

**The owner has explicitly asked for a machine-run first pass.** `AGENCY_RULES.md` normally assigns
browser testing to the owner; that instruction is overridden for this work, by request.

**The infrastructure already exists — do not build a new harness.** `tests/uat/` has 38 scenario
specs, `auth.setup.ts` producing signed-in sessions for coach / org owner / org admin / platform
admin, a seeded UAT team, and helpers. Several existing specs are already access-boundary tests of
exactly the kind Tier 1 needs (`family-access-boundary`, `family-guardian-tier-boundary`,
`family-recap-boundary`, `plan-gating`, `coach-wall-doors`). Extend that set; match its conventions.

### What automation may claim, and what it may not

This split is not a guess — it was measured on 2026-08-03 by backtesting 33 recorded UI defects
(`LAYOUT_INVARIANT_SWEEP_BACKTEST.md`). **24 were mechanical, 9 were judgement or interaction.**

**Machine CAN clear:** whether a screen resolves at all for a given role · access boundaries (can
role X reach thing Y — the highest-value Tier 1 question, and one a machine answers *better* than a
person) · presence/absence of named controls and copy · rendered numbers, names and counts ·
layout invariants (`npm run check:layout`).

**Machine CANNOT clear, and must not be reported as passed:** whether hierarchy reads correctly ·
whether copy is honest or a bargain feels fair · real-device touch behaviour. Two defects in that
corpus existed **only** on a notched iPhone and in iOS Safari's touch handling; headless Chromium
sees neither. **The ledger's phone session genuinely needs a real device — say so, don't simulate it.**

### Binding method

- ⚠ **A screen that could not be measured is NOT a screen that passed.** Never let a skipped,
  errored, or unreachable step read as green. This repo has been bitten by exactly that.
- ⚠ **Verify before believing a finding.** The layout sweep produced **three false positives in one
  day**, two nearly acted on — layout geometry mistaken for painted content, a contrast rule blind to
  a gradient ground, and translucent-over-translucent compositing that invented a 1.05:1 reading on a
  perfectly readable badge. **Re-measure the alarming ones first**, and read the geometry directly
  rather than reasoning about the report.
- A coach screen opened with the wrong session renders a plausible dead end ("Not assigned to any
  teams") that measures fine and means nothing. Check you actually landed.

### Deliverable

A report in three buckets, per Tier 1 item:

| | |
|---|---|
| **CLEARED** | machine-verified, with what was asserted |
| **FAILED** | with the evidence, and re-measured before reporting |
| **STILL NEEDS THE OWNER** | and one line on *why* a machine cannot answer it |

Tick cleared steps in the ledger. Then **stop and report** — the owner decides whether to continue
into Tier 2 after seeing what the pilot was worth.

## Guardrails

- Branch: **`dev`** only. Never `master` without an explicit deployment request.
- Concurrent sessions share this working copy. **Stage explicit pathspecs, never `git add -A`.**
  Bracketed directories need `:(literal)`. Check `git show --stat HEAD` after committing.
- **No commits without a per-action OK from the owner.**
- Do **not** re-baseline `scripts/.layout-baseline.json` — it was freshly and completely re-snapshotted
  on 2026-08-03 (2,056 entries; contrast down from 1,903 at creation to 38).
- The dev server needs network access (`npm run dev`, escalated). A full layout sweep exhausts its
  heap — it reached 6 GB and died twice on 2026-08-03. Run heavy passes by width and restart between.

## Worth knowing

Today's headline defect — **every bolded phrase in every in-app help guide was invisible on the coach
portal's default theme**, ~1,650 pieces of text — **was live on production**, and was found by
tooling, not by anyone's eyes. That is the case for this work: things ship same-day here, and the
owner's eyes are the scarcest resource in the pipeline. Spend them where a machine genuinely can't go.
