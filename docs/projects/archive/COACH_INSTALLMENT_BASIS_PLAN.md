# Coach Portal — how installment amounts get set

**Status:** BUILT on dev 2026-08-13 · all three owner calls answered · `/simplify` + `/review` run
· **owner QA and the rendered layout sweep still owed** — see §6
**Binding visual spec:** `claude.ai/code/artifact/1177bcf0-1103-41e9-891f-cb39c063bbd4`
(source: `docs/projects/archive/COACH_INSTALLMENT_BASIS_MOCKUP.html`)
**PM brief:** `COACH_INSTALLMENT_BASIS_PM_BRIEF.md`
**Extends (does not reopen):** the 2026-08-12 effective-total ruling (`lib/coach-budget-totals.ts`);
the 2026-08-13 safe-replace ruling in the generate route; the Money-hub table consistency treatment
landed in `482a2b19`

---

## 1. Trigger

Owner, on the Generate Player Installments sheet, 2026-08-13:

> *"Why when it asks for an installment amount does it ignore it and just apply the sum divided by
> total budget per player? It should just warn that the amount I am putting in is less than the
> budget but let me put it in. I should have the option of selecting manual amounts or evenly split
> based on budget or evenly split based on the estimated total."*

---

## 2. The defect underneath the request

The Preview step **never sends the typed amount.** It sends the dates and the row count; the server
re-derives an even split every time. But Confirm **does** send the typed amount.

So a coach typing $150 sees a preview of $800 and creates $150. The screen they read before attaching
money to families disagrees with what it creates.

Already on the record — the page-actions Phase 1 review logged it as *"the preview table is computed
from the budget while the write uses the typed amounts (pre-existing), deferred to the upcoming modal
upgrade."* **This is that upgrade.**

---

## 3. What gets built

### 3.1 A basis picker (the sheet's new first control)

| Choice | Basis |
|---|---|
| **Split the budget evenly** | cost line items − expected funding |
| **Split the season estimate evenly** | the estimate − expected funding |
| **Set the amounts myself** | whatever the coach types |

Each card states its own arithmetic and its per-player result **before** it is chosen, so all three
answers are comparable without committing. A basis with no number to offer is shown greyed with the
reason, never as `$0.00`.

⚠ **Expected funding comes off BOTH split bases.** Budgeting expected funding exists so dues come
down by it; the estimate option is therefore not literally estimate ÷ roster, and each card says so.

### 3.2 Amounts are derived in split modes

The amount box fills itself, goes dashed and reads "Auto". Adding or removing a date recalculates
every row — the same money split across players *and* periods. Rounding remainders land on the last
installment so each player's total is exact.

### 3.3 Manual mode warns, never blocks

A running comparison against **funded by players** (the figure the rest of the Money hub quotes):
short (amber), over (danger — it is the one that takes money off families who do not owe it), or an
exact match (a quiet tick, so a coach who did the arithmetic sees it confirmed). Generating anyway is
always allowed; there are legitimate reasons for a deposit-only schedule.

### 3.4 The preview tells the truth

Renders the amounts that will actually be written, in every mode. Gains a **Total** column and a
team-total row, drops the redundant `#1 / #2` numbering (the due date already identifies the payment),
and carries the shortfall warning forward onto the confirmation step instead of leaving it behind.

### 3.5 Owner call 1 — manual unblocks a dead end **[approved]**

The sheet is now one door opened from **two tabs** (Budget Plan and Player Dues, since `482a2b19`'s
predecessor). Opened from Player Dues a coach may have no budget at all, and today the sheet refuses
outright. Three of its four refusals exist only because there is no number to divide:

- no budget lines yet
- expected funding already covers the season
- a season estimate of $0

**None is a reason a coach cannot type $400.** All three become unavailable *split bases* with manual
live, and the budget nudge survives as a link under the picker rather than a wall in front of it.

⚠ **An empty roster stays a hard blocker** — with no players there is genuinely nothing to write.

**Tradeoff, accepted:** budget-first becomes guidance rather than a gate, and a team can end up with
dues no plan stands behind. The reconciliation strip stays silent in that case because there is
nothing to reconcile against.

### 3.6 Owner call 3 — the sheet's opening is trimmed **[approved]**

The sheet could open with three stacked paragraphs before the first field. The picker cards restate
the first one's arithmetic, so it goes; the over-planned warning and the replace notice stay and are
tightened. On a phone this is the difference between seeing one basis card and seeing two.

### 3.7 Owner call 2 — the preview joins the shared money treatment **[approved]**

The table-consistency inventory counted twelve money tables. **This preview is a thirteenth it
missed** — it lives inside a modal, so a tab-by-tab walk never met it, and it is now reachable from
two tabs. `482a2b19` shipped without it, so per the owner's instruction it is folded in here rather
than left as the one money table out of step.

### 3.8 A row without a date is incomplete, not ignorable

Today an undated row is silently dropped from both the preview and the write. That is survivable when
the server re-derives everything; it is not once the split divides by row count, because the sheet
would show a split across three rows and create two. Every row now needs a date, and the sheet says
which one is missing.

---

## 4. Explicitly NOT in scope

- **Changing dues after a player has paid.** Agreed in principle 2026-08-13 (keep the paid
  installments, rewrite only the unpaid ones), but it belongs with the payment-record work — see
  `COACH_DUES_PAYMENT_RECORD_BUILD_PROMPT.md`. The shipped skip-and-report behaviour is untouched here.
- **Per-player amounts.** The write route accepts overrides; no screen offers them and none is added.
- **A "money in" block on the Budget Plan page.** Drawn, reviewed and **withdrawn by the owner**
  2026-08-13 ("takes up too much space before the budget rows"). ⚠ Parked finding worth keeping:
  **player dues can never be modelled as an expected-funding line** — funding is subtracted on the way
  to "funded by players", so a dues funding line drives per-player to $0.00 and the sheet then refuses
  with "your funding covers the whole budget". Whatever the better display turns out to be, it is a
  reporting block, never a line in the plan.

---

## 5. What does not change

The safe replace and its skip-and-name reporting; the money-write capability gate; both callers;
preview-before-confirm in every mode; the over-planned warning; one schedule for the whole roster.

---

## 6. Verification

- `npm run typecheck` + `npm test` + `npm run verify:changed`
  (⚠ `verify:changed` fails on schema parity while prod is behind dev on migrations 230/231 —
  pre-existing, not ours).
- Unit tests on the shared basis/split arithmetic — remainder on the last installment, both bases
  clamped at zero, availability reasons.
- Rendered sweep sliced: `--only=coach-accounting,coach-budget,coach-dues`.
  **An aborted sweep exits 0 through a pipe — read the output, never the exit code.**
- `/simplify` then `/review`.
- **`/docs`** — the Money guide describes generating dues; the three modes change what it must say.
- **Demo check** — the coach sandbox seeds a budget and dues; ask whether a demo moment should show
  the picker.
- Owner QA rides `OWNER_QA_LEDGER.md` §12 (Group 1C).

---

## 7. Log

- **2026-08-13** — raised, inventoried, mockup drawn and revised five times (money-in block added then
  withdrawn; `#1/#2` preview headers dropped; three owner calls drawn both ways and answered:
  manual unblocks, fold into the shared money cell, trim the opening). Built.
- **2026-08-13** — `/simplify` (6 applied, 3 skipped) then `/review` (high-risk, 5 lenses).
  **Review found four real defects in the new code, all fixed:**
  1. `splitPerPlayer` could return a **NEGATIVE** installment (6¢ over 12 dates → −$0.05), rendered
     as an ordinary "$0.05" by a formatter that prints absolute values, then refused wholesale by
     the write endpoint. Rewritten to work in whole cents; two regression tests pin it.
  2. The Preview button could stick **permanently disabled** — invalidating a preview mid-flight
     never lowered the loading flag. The basis radios added three new ways to trigger it.
  3. Omitting `basis` on the preview endpoint silently re-priced the roster ($680 vs $780 on the
     worked example), because the old endpoint was estimate-aware and the new default was not.
  4. The preview could still promise a schedule the write refuses (chunks rounding to $0.00).
  Also: manual amounts now round to cents; `NaN` no longer passes the write route's amount check;
  the write route gained the installment cap the preview already had; the data dictionary's claim
  about the schedule note was corrected.
- **2026-08-13** — demo: the sheet now shows the sandbox's own invitation instead of the raw string
  `SandboxReadOnly` when a prospect confirms (nothing in the coaches portal handled that refusal —
  only two admin screens did). The 12U demo team's season estimate was decoupled from its line
  total (`MIDSEASON_SEASON_ESTIMATE`) so the two even-split cards no longer print the same number.
- **2026-08-13** — `/docs` run: the "set every player's dues at once" FAQ said a Season Budget Plan
  was **required**, which this change makes false.
- **⚠ STILL OWED:** owner QA (no ledger entry written), the rendered layout sweep (never completed —
  it needs a restarted dev server), and the commit.
