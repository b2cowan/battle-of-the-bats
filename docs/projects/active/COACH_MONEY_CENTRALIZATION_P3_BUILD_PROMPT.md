# Build prompt — Money centralization P3: tags earn their keep, and the leftovers go

**Written 2026-08-25, the day owner QA §87 (P2) closed. Open this in a FRESH session — the P2
session is saturated with P2's specifics and this phase should start from decisions, not residue.
P1 and P2 are COMMITTED on `dev`. P3 is authorized in shape by the plan; this prompt is context,
and the gate below still has to be run before any code.**

**Read first:**
1. `COACH_MONEY_CENTRALIZATION_PLAN.md` — the framework (§2), **ruling §5.3 on tags**, and the P3
   bullet in §8 (which now carries the asterisk sweep).
2. `COACH_MONEY_CENTRALIZATION_P2_BUILD_PROMPT.md` → its **"THE GATE OUTCOME"** section. That is
   the grammar the product now speaks; P3 must not contradict it.
3. `COACH_PAYABLES_REBUILD_PLAN.md` §7 — the reporting-filter pill convention the tag control must
   follow.
4. Owner QA **§80** and **§87** — both PASSED. They show what this grammar had to survive.

## HOW P3 BEGINS — BLOCKING, NO CODE BEFORE IT

Present in the conversation, and then WAIT for the owner's explicit go:

1. A **PM-voice summary** of what a coach sees differently — per screen.
2. The **verified inventory** of what changes (from the tree, not from this prompt — §4 below was
   checked on 2026-08-25 but this repo's plans have been wrong before and this one claims no
   exemption).
3. **One drawing, for the one undecided thing** — see §2. Everything else in this phase is settled
   by a sentence, and a picture that owes no functionality is theatre.
4. Anywhere the code forces a deviation — raised, never quietly resolved.

## 1 · What P3 is, in one line each

- **Tags earn their keep** (owner ruling §5.3): the chip row becomes the counted pill, and **a
  tag-filtered view ALWAYS shows its total.**
- **The debt goes**: one live defect, one lying comment, one stale comment.
- **The required asterisk converges, portal-wide** (owner ruling 2026-08-25).

## 2 · Tags — the ruling, and the ONE thing not yet drawn

**The owner's words, recorded when he closed the retire question:** *"maybe they have items for
tournament fees and deposits but want to tag each one with the tournament name, later filter by how
much they paid for a specific tournament."* So a tag is the **occasion** label a budget item cannot
express — the item says *what kind of cost*, the tag says *which occasion* — and the question tags
exist to answer is **"what did the Summer Classic actually cost us?"**

That sentence is the whole spec: **a filtered view that shows rows but no total has not answered
it.**

**Already drawn and ruled — do not re-draw:** the counted pill itself (mockup 05, "Tags · 1
selected ▾"), replacing the chip row on **both** money faces. It uses the shared dropdown family
(`MultiSelectDropdown` et al.) — §7's own instruction is one family, one look, do not hand-roll a
fourth.

**⚠ NOT DRAWN, AND THE ONE THING THAT NEEDS A PICTURE: where the filtered total sits.** Payables
already carries a rough version of this (its "vs {tag}: N, $X" summary) and **Transactions has
nothing at all**. Two faces, two table shapes, one figure that must read identically on both.
Draw it, get a yes, then build.

⚠ **Tag FILTER, not a tag report.** Plan §6 forbids building a tag report on the way past. The pill
narrows a list and the list states its total; that is the whole feature.

## 3 · The required asterisk — ruled 2026-08-25, portal-wide

**A required field takes a PLAIN asterisk in the label's own ink. The dedicated red marker is
RETIRED**, not merely avoided in new code. Ruling and reasoning: `memory/design_decisions.md`
2026-08-25. The short version: **red in this portal means something has gone wrong** — money owed,
overdue, a refused save — and a field is not in error for being required; the asterisk already
carries the meaning, so the colour was only adding volume and spending a signal real failures need.

⚠ **THE STATE IT CORRECTS IS MIXED INSIDE SINGLE FILES, NOT SPLIT BY SCREEN.** Measured
2026-08-25: **44 required labels across 8 files, 29 red vs 15 plain** — with **Player Dues and the
money record form each using both**. Anyone scoping this as "money does one thing, roster does
another" will size it wrong and miss half the sites.

⚠ **IT REACHES BEYOND MONEY** — roster, schedule, the head-coach editor and the start-interest form
all carry the red marker. It rides this phase because P3 is the words-and-leftovers pass, not
because it belongs to the money project.

⚠ **SEQUENCE IT AT ONE END OF THE PHASE, not tangled through it.** It touches files other sessions
work in; keeping it as one contiguous block makes it trivially re-runnable if it has to be redone
after a merge. **Check `git status` for live edits in roster/schedule before starting it** — that
is exactly why it was not swept on the day it was ruled.

⚠ Retire the marker's CSS rule too, or the next form will find it and use it.

## 4 · The debt — VERIFIED 2026-08-25, and one item has already closed itself

**(a) LIVE DEFECT — the Add-credit picker offers two types the server refuses.** The picker renders
every entry of the credit-type label map, which includes **Forgiven** and **Reimbursement**; the
route's allow-list is `contribution · fundraiser · overpayment · other`. **A coach who picks either
gets a 400.** ⚠ And the comment sitting directly above those two labels *claims they are not
offered* — so the code lies about itself, which is why this survived. Fix the picker AND the
comment. Forgiveness is granted from the settlement sheet; reimbursements ride out-of-pocket
expenses — the comment is right about the intent and wrong about the fact.

**(b) ✅ ALREADY CLOSED — do not chase it.** The payout note placeholder that taught guardian names
("e.g. sent to Dana") went with the in-drawer payout sheet, which P2's simplify pass deleted once
the conversation took over that door. The only surviving hit is a *comment* recording the
2026-08-13 privacy ruling, which is legitimate history. **The plan still lists this as debt; it is
stale there. Correct the plan rather than re-fixing nothing.**

**(c) STALE COMMENT — Budget vs. Actual.** A comment still describes a *"Money-tag filter (Phase
3): scope the actuals to expenses carrying a tag (server-side)"* over code where that filter no
longer exists (cut in §64 — verified: zero references remain in that file). ⚠ **That file is
actively edited by the BvA income-truth session — check `git status` and coordinate, or take this
one item last.**

⚠ Also worth a glance while you are in there: the money-tag block in the shared money panel is
still headed "Money tags (Phase 3)". Phase numbers in comments age badly; say what it is, not which
sprint made it.

## 5 · Traps

- **`check:layout` cannot see a modal** — but it CAN see the pill and the total, which live on the
  page. Run it; a filter control that pushes a toolbar into a wrap at 361px is exactly what it
  catches. The asterisk sweep will also touch swept screens.
- **The filtered total must not be a second arithmetic.** The money guards (`check:register`,
  `check:money-report`) exist because two places computing one figure is how they drift. Derive it
  from the rows the filter already produced.
- **Read-only money assistants** must see the pill (reading is not writing) but no write door.
- **Both faces, not one.** Every tag change lands on Transactions AND Payables — the two faces
  share one component, and "seen twice" has bitten this screen before (the Manage-tags button).
- **The org-shared tag rows are read-only** to a team; the pill must not offer to edit them.
- Concurrent sessions on `dev`: the BvA income-truth work and a tryouts/PDF session were both live
  on 2026-08-25. **Explicit pathspecs on every commit; `git show --stat HEAD` afterwards.**

## 6 · Every phase carries these

Typecheck · focused lint · unit tests · `check:register` · `check:money-report` · `check:demos` ·
`check:layout --changed` · **help docs re-read** (the money guide describes the tag chips) · **both
demo sandboxes re-read** (CLAUDE.md's standing warning — the money vocabulary is exactly where
hand-written demo sentences go stale while every page still renders) · a new **Owner QA ledger
section** · TODO + PM brief updated in the same unit of work.

## 7 · What P3 must NOT do

- **No tag report** (§6 of the plan).
- **No Payables tab fold** — deferred and OWNER-LED (§5.2).
- **Do not reopen P2's grammar**: pre-answers lock at a record-naming door, Record is money that
  moved, Payables keeps its own Add, the club installment keeps its one tap.
- **Phone money tables remain a separate, later session.**
- P4 (a payment learning who paid it) is the phase after this one — do not start it in passing; it
  reaches real money owed to a household and its acceptance test is credit unwind on edit/delete.
