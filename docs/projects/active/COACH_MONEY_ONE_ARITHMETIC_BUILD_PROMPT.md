# Kickoff prompt — one home for the money arithmetic

*(paste into a fresh chat)*

**Build `COACH_MONEY_ONE_ARITHMETIC_PLAN.md`, Phases A → B → C, in that order, serially.** Direction
approved by the owner 2026-08-17. This is the follow-on from the money redesign's P4 review, which
found the third instance of one mechanism and stopped rather than patching it a third time.

---

## Read first, in this order

1. **`COACH_MONEY_ONE_ARITHMETIC_PLAN.md`** — the whole thing. §1 is the proven divergence table,
   **§1b is a retraction you must not undo**, §2 says which arithmetics are meant to be one and
   which is deliberately exempt, §3 is the phases, §4 the constraints.
2. **The evidence artifact** — https://claude.ai/code/artifact/bd12805c-98a5-465a-931b-1273b8adcb70
   — diagrams of the three feeds and the numbers behind every claim.
3. **`COACH_MONEY_TAB_REDESIGN_PLAN.md` §10 P4** — how this was found, and the retraction in its own
   words.

---

## ⚠⚠ Verify before building — this plan has already been wrong about this subject once

- **Argue from what the code does, never from what this plan says it does.** §1b exists because P4
  logged a date defect that turned out to be a write-side convention working correctly. The read
  path looked inconsistent; only the writer explained why it wasn't. **Re-derive §1's table from the
  code before you touch anything**, and say so if any row has stopped being true.
- ⛔ **DO NOT "FIX" THE TWO DATE RULES.** Expense paid stamps are stored at ORG NOON on purpose so a
  naive UTC slice lands on the coach's own day; club timestamps are click-time instants and need the
  timezone-aware read. Making them the "same" reintroduces the off-by-one the convention prevents.
- ⚠⚠ **A PARALLEL SESSION SHARES THIS WORKING COPY.** Sessions have committed each other's in-flight
  work four times in four days — most recently a help-content file. Re-check the branch is `dev`,
  stage **explicit pathspecs only** (⚠ bracket directories like `[teamId]` need `:(literal)` or they
  stage nothing), and run `git show --stat HEAD` after every commit. Expect files you never touched
  to be modified, and expect HEAD to move under you.
- ⚠ **Migrations 236–250 are dev-only** and the owner promotes them. `verify:changed` fails on that
  schema-parity gap — run the checks after that gate directly. **This project needs no migration; if
  you think it does, stop and say why out loud.**
- ⚠ **The money quarter (Owner QA §38 · §41 · §43 · §46 · §49) is unwalked.** You are building on
  five unwalked storeys. Do not treat a ledger section as a description of what the screen does.

---

## What the phases are

**Phase A — the check, then the two fixes it exposes.**
An identity check over the report: the statement's season total, the grid's months summed, and the
chart's final cumulative point are one number. Model it on `npm run check:register` — including its
best feature, which is that it **exits non-zero when the fixture is too thin to prove anything**. A
team with no refund and no split commitment cannot fail this check, so a green run there is a lie.
The check then fails on the two live divergences; fix both directly.

**Phase B — derive the grid and the chart from the rollup.**
The rollup already returns the dated movements behind each item's totals — the grid's refund rows
already read them, which is exactly why refunds never drifted. Three real gaps, all in the plan §3:
per-half commitment movements, the `Scheduled` exception, and the grid needing category identity.

**Phase C — write the rule down and guard it.**

---

## ⚠⚠ The single biggest risk, stated plainly

**The Months grid currently splits a commitment across the months it was actually paid, and it is
the only feed that gets this right.** It does so by reading the raw deposit and balance stamps. A
careless derivation from the rollup — which today collapses a commitment into one record dated by
its earliest payment — **regresses the one correct feed while fixing the two wrong ones.** Phase B
step 1 exists to prevent exactly this, and Phase A's check is what would catch it. Do them in order.

---

## 🔒 Constraints (plan §4 — none open)

No coach-visible change except the two corrected chart figures · the statement's and the grid's
current numbers must not move · ⛔ the season close-out pot is NOT in scope and must not be folded
into anything (its isolation is why it is the best-tested money module in the repo) · `Scheduled`
keeps its own feed and says so in code · working season only, no `?year=` · every money-redesign
rule survives untouched.

---

## Done means

- The new check passes **and fails on a thin fixture** — prove both.
- `npm run check:register` still passes; it is a different claim and must not move.
- `verify:changed`, `typecheck`, `npm test`.
- `npm run check:layout --only=coach-budget-vs-actual` — its baseline entry exists. ⚠ **Run one
  screen you did NOT touch first** (`--only=coach-roster`): the portal's notification badge produces
  6 findings on every screen and three phases have now lost time reporting them as new. Do not
  re-baseline them.
- A **new Owner QA Ledger section** — the two chart figures that changed, and the one thing only
  eyes can check: that the chart, the statement and Months tell one story. Positive facts with
  anchors, per the anti-drift rule. Never renumber.
- The plan's §1 table **re-verified against the code at the end**, and corrected in place if any row
  has stopped being true. This project exists because a document and the code disagreed.
- Offer `/simplify`, then `/review`, before handing off. **Every money phase so far has produced a
  real defect in review — P1 a Critical, P2 a Critical plus two pre-existing security holes, P3 five
  defects, P4 eight including two pre-existing money bugs. Budget for it.**

## ⚖ Disagree out loud, before the work

If a phase rests on a premise the code contradicts, say so **before** building it — not in the
summary afterwards. The most valuable thing the last four phases produced was push-back: P3 found
the register's build-blocking test unpassable because the cash figure itself was wrong three ways,
and P4's owner review found a whole class of money missing from a report. Re-frame the question if
it is the wrong one. Widen it if the evidence is wider than the ask. Do not manufacture disagreement.
