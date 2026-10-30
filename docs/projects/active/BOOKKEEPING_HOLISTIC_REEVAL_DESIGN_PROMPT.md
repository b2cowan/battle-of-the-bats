# Bookkeeping holistic re-evaluation — kickoff prompt

**✅ Executed and ruled 2026-10-27.** Hub: https://claude.ai/artifact/6zJfxoAFpi9uZKqYDUfnNx; rulings in `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` §12 and the new ladder in §3. Kept for history.

**Use this to start a NEW chat.** This is a design/evaluation session, not a build session — no product
code changes until a stage is drawn and ruled.

## Why this session exists

The owner reviewed the accountant-review-fixes round (QA ledger §382, §383 — both ✅ PASSED 2026-10-27)
and, instead of ruling the next small item one at a time, widened the question (owner, 2026-10-27):

> "it is not that easy and it has gaps. there is too much scrolling, the ledger does not display enough
> information, there is no running balance, etc. I don't want a narrow scope, I want this built right."

Treat this as scope information about the **whole** Bookkeeping experience, not a deferral of one ticket
(`feedback_holistic_reeval_over_item_fixes` in the owner's memory — don't rule point fixes on this surface
ahead of this re-evaluation, even ones that look obviously right in isolation).

The same conversation also confirmed: the outside-accountant step is **out of scope** (owner, 2026-10-27)
— he reviews with his own accountant on his own schedule, it is not a project gate. Two small open items
name that removed step and need the owner's reconsideration before build resumes on them (raise directly,
no mockup needed):
- **R3** — "the outside accountant is consulted before any tax field is built" (plan §11).
- **R9's S9a trigger** — the Support Console health signal fires "after the first real
  expense-and-owner close has been handed to the outside accountant" (plan §11).

## What exists today (read before anything else)

- `docs/projects/active/BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` — the current plan, its Stage 0–4 table
  (§3), and §11's accountant-review rulings (R1–R10, including the 2026-10-27 supersession note on R10).
- `docs/projects/active/BOOKKEEPING_OWNER_EXPERIENCE_PM_BRIEF.md`
- `docs/projects/active/BOOKKEEPING_OWNER_EXPERIENCE_REVIEW.html` — the Stage 0 field map and screen
  concepts; largely built now, treat as history not a live proposal.
- QA ledger §382 and §383 (`docs/projects/active/OWNER_QA_LEDGER.md`) — what was walked and passed, and
  what the owner's two open-question rulings (A: void keeps its own values, BKX-5.9; B: console lettering,
  BKX-5.10) already decided but has not been built yet.
- `docs/projects/archive/BOOKKEEPING_CLOSURE_RECORD.md` — the earlier, archived attempt; its unfinished
  B3/B4 gates (source acceptance/reconciliation, backup/recovery/accountant/close) are still open.
- **The plan's own stated scope boundary, which this session is here to reconsider, not assume:**
  "Start with expenses already supported by the tool. Add a full proprietor ledger only after the revenue
  source and owner-movement contracts are settled" (plan §1) and "Stages 0–2 improve a useful expense-only
  tool. Stage 3 is a separate financial-data build with a firm dependency on Revenue's accepted contract"
  (plan §3). The owner has now said he does not want to stop at expense-only. Figure out, station by
  station, how much of a real ledger and real reporting can be built **now**, off data the tool already
  has (expenses, owner contributions/draws/transfers), versus what genuinely cannot exist before the
  Revenue/Stripe source contract lands (live income rows, processor fees, payouts, reconciliation) — and
  put that split in front of the owner as a shape question. Don't assume the answer either way.
- The product's shared interaction rules this surface should be judged against: the One Window pattern
  (`[[project_one_window]]` in memory; forms/confirmations open as a panel over the screen, not a full page
  navigation — Add an expense today is a full-page form with a "Back to expenses" link, which is the old
  shape) and the Support Console's own lettering, which Bookkeeping has not yet moved onto (BKX-5.10).

## Step 0 — a measured walk-through, not a QA gate

Per the owner's standing process (`feedback_deep_dive_is_walk_then_stages` in memory): open with a
**measured walk**, never a QA gate in front of it. Walk the actual built product, in the order the owner
meets it, at both desktop and phone widths. For each station, capture: *as built* (real screenshots +
measured numbers — scroll depth, viewport height used, field counts, tap-target sizes), *my read* (what
works, what gets in the way, what I'd change — with clickable finding flags), and **shape questions**
(Keep · Reshape · Not yet) with a recommendation and "what rides on it."

**Stations, and the owner's named complaints each one must answer honestly (not explain away):**

1. **Overview** — the daily-workspace cards (recorded spend, needs-a-receipt, dates-to-review, needs
   attention, recent expenses). Does it orient the owner in one screen, or does the real content start
   below the fold?
2. **Expenses list + Add an expense** — today a full-page navigation with its own "Back to expenses"
   link (see screenshot in this project's chat, 2026-10-27). Measure actual scroll length to reach Save
   on a normal CAD entry, a USD entry, and a correction. This is the station that answers "too much
   scrolling" — don't guess at the cause, measure it (is it field count, spacing, or page chrome?).
3. **Currency / FX.** Confirmed in code: there is no FX-rate field. The stored shape is original amount +
   CAD amount + a required free-text conversion note (`scripts/bookkeeping-aws/schema.sql`); nothing
   computes or stores a rate. Walk a real USD entry and ask the owner directly what he actually wants here
   — a rate field that auto-fills the CAD amount, a rate field alongside both amounts for cross-checking,
   or something else. Don't assume which.
4. **The Ledger tab.** This is the sharpest named gap. What's built and walked today is the owner's own
   contributions/draws/transfers only — not a real money ledger. Measure exactly what columns/fields it
   shows per row today, and compare against what the owner says he needs to see (he named: not enough
   information, no running balance). Look at the club and coach ledgers' pattern (readable rows, filters,
   a record window, a running/closing balance) as the named reuse candidates (plan §4) and judge whether
   that recipe — or something else — actually answers what the owner wants from *his own* books.
5. **Reports tab.** Today's ceiling is period + category + supplier totals with drill-down, plus a
   printable summary (plan §3 Stage 2, D5). Ask the owner directly what "not robust" means to him
   concretely — trends over time, vendor comparisons, a running cash position, something else — rather
   than assuming from the word alone.
6. **Expense record (correct/void).** Already walked and passed (§382/§383) on the current fixes; confirm
   it still reads well once the surrounding screens change shape, don't re-litigate it.
7. **Needs attention / Sources.** Needs attention already exists; Sources is a hidden preview stub for
   Stage 3 — note it, don't redesign it this session.
8. **Formatting.** BKX-5.10 (the console-lettering move) is already owner-ruled yes but unbuilt — fold it
   into this ladder as an early, cheap stage rather than leaving it an orphaned item; don't re-ask the
   owner whether to do it.

## Standing back

After the stations, name the rules that cut across them (the real driver of "too much scrolling" if it's
one thing repeated across stations; whether Add an expense and Void both belong on the One Window pattern
as a panel rather than a page; what "enough information" means consistently across the Ledger and Reports;
whatever else the walk surfaces).

## A stage ladder — rework, don't patch

Build a new stage table that replaces the current Stage 0–4 structure with one that actually reaches an
end state the owner calls "built right": easy to use (addresses the scrolling/shape complaints) **and**
complete enough to be a real set of books day to day (addresses the Ledger, FX and reporting gaps) —
without necessarily waiting on the full Revenue/Stripe integration, per the split raised above. Carry
forward, don't re-litigate: the already-built and walked expense entry/correction/void flow (§382/§383),
and the two already-ruled small items (BKX-5.9, BKX-5.10) — place them on the ladder rather than dropping
them. Keep the genuinely Stripe-gated work (live income import, fees, payouts, reconciliation) as its own
later stage with the Revenue contract dependency stated plainly, exactly as today's plan already does.

**Draw stage 1 at true size**, in the SAME publish as the walk and ladder (not as a follow-up) — before =
capture, after = drawn, with NEW/RESTYLED/UNCHANGED tags and one checkbox per shape-question option,
per the house rule that a stage must show the proposal, not describe it
(`feedback_deep_dive_is_walk_then_stages` §"Stage 1 drawn must SHOW the proposal"). A shape question with
no drawing beside it is not reviewable.

## Output

One hub artifact (Claude Artifact, not a blank canvas — `feedback_mockups_as_claude_artifacts` in memory):
the measured walk on its first tab, the standing-back notes, the stage ladder, stage 1 drawn at true size,
and a paste-back summary the owner can mark up. Run it through `/design` before handing it to the owner
(`feedback_always_run_design_on_mockups`). Update this project's plan file's Stage table and §11 only once
the owner rules the ladder — do not pre-edit the plan's scope boundary language before that happens.

Also put R3 and R9's S9a trigger in front of the owner early in the session (a quick decision, not a
mockup) since the step they name is already gone.
