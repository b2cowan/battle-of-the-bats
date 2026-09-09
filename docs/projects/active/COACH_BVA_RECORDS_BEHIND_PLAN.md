# Behind-the-figure panel — dates and doors

**Status:** approved 2026-09-09 (owner, from mockup artifact `7af46200`).
**Surface:** Budget vs. Actual → statement → the panel behind a spent/received figure.
**PM brief:** `COACH_BVA_RECORDS_BEHIND_PM_BRIEF.md` · **Mockup:** `COACH_BVA_RECORDS_BEHIND_MOCKUP.html`

---

## 1. The two defects

### 1.1 "no date recorded" on money that is fully dated

A drive's or sponsor's realised money reaches the statement as **one row per record** (owner ruling
2026-09-07 — the pool used to be a single unnamed row, and "a derived pool is a name with no record
behind it at all" was the reason it stopped being one). That row is an **addition of every arrival**,
so it carries no single day, and the route sets `paidDate: null`. The panel then falls through to the
undated wording.

Every one of those arrivals is dated. The Months grid's own cell panel, reading the same money
through the cash strip, prints `Sep 4 · received` for the very cheque the statement calls undated —
so **one report gives two answers about one arrival**, which is the failure mode this module has
guarded against since the one-arithmetic pass.

⚠ **The row is NOT going to be split into one row per cheque.** The row's figure is what the team
**kept** (gross less the family rebate); the cheques are **gross**. A per-cheque list would stop
adding up to the figure above it unless the rebate appeared as its own subtraction — which
duplicates the "money back, netted off" group two inches below and re-opens a settled decision. The
row stays a sum; it just stops lying about what kind of thing it is.

### 1.2 The spent side has no way out

`RecordsBehind`'s actual half ends with *"Every payment counted against this row… Edit them on
Transactions."* — a sentence that **names a destination and does not go there**. There is no footer
and no link on any row, for any role.

Its twin — the Months grid's cell panel — has carried doors since 2026-08-24, governed by
`cellPanelSpec`: **at most two, the ledger and the thing itself.** The statement panel was never
brought under that rule. The existing guard in `bva-figure-doors-guard.test.ts` describes the month
panel's doors as the reason the *plan* panel needed one; nobody checked the statement's spent panel,
which dead-ends for everybody.

### 1.3 (found on the way) the panel is `scroll` with nothing that scrolls

`RecordsBehind` passes `scroll` to `QuestionShell`, which puts `.modalScrollBody` on the dialog:
`display:flex; flex-direction:column; overflow:hidden`. That recipe expects **one child that
scrolls** (`.formGrid`, `.payDrawer`, `.settlementScroll`, …). This panel renders a bare fragment, so
no child matches — the list is a shrinking flex item inside an `overflow:hidden` box. A row with
enough records **clips silently today**, and a pinned footer makes it visible. Fixed here because
the footer depends on it.

---

## 2. What ships

### 2.1 The arrival summary travels with the row

`RollupSpend` (and `ItemRow.costs`) gain **one** optional field:

```ts
derived?: {
  recordId: string;               // the drive / sponsor — the room the row opens to
  kind: 'fundraiser' | 'sponsor';
  count: number;                  // how many arrivals were summed
  firstDay: string; lastDay: string;  // YYYY-MM-DD, the span they landed in
} | null;
```

One field rather than two, because identity and dates are the **same fact**: "this row is a roll-up
of a fundraising record's arrivals." Both the date line and the door read it.

⚠ **`paidDate` STAYS NULL on these rows and must not be repurposed.** It is the dated grain every
month/chart feed reads; a synthesised value there would place derived money a second time on a feed
the cash strip already places it on correctly.

⚠ **The day comes from `receivedDate ?? orgDayKey(createdAt)` — the cash strip's exact fallback.**
Anything else re-opens 1.1 one level down: the two views would agree on the count and disagree on
the day for legacy rows.

⚠⚠ **A $0 ENTRY IS NOT AN ARRIVAL** (`/review` correctness lens, 2026-09-09 — found after the first
build, fixed before commit). `rep_fundraiser_entries` is CHECK `amount_raised >= 0` *deliberately* —
the dictionary's own words: *"a player can be recorded with $0 raised"* — and a drive's entries are
always realised, so a participation row reaches this aggregation exactly like a paid one. Counted,
it says "3 payments" where two dollars-worth arrived and, worse, **drags `firstDay` back to a day on
which no money came in**. The count exists to say "this row is an addition"; a signal that counts
non-events is worse than no signal.

**The screen is on GROSS, never on kept.** A fully-rebated entry — every dollar credited to the
family who raised it — *is* a real arrival on a real day, and the row's own words already say
"$X of $Y, $Z to families". Only "nothing came in" is skipped. A record left with no arrivals still
**links** to its room (identity is always true) and falls through to "no date recorded", which is
honest; it is also unreachable, because such a record's `kept` is 0 and the row is dropped a few
lines earlier. Both halves are guarded in `bva-figure-doors-guard.test.ts`.

### 2.2 What the date line says

Pure helper `arrivalsNote()` in `lib/coach-money-derived.ts` (formatting-agnostic: it takes
already-formatted day labels, so the module keeps its no-`Date` purity):

| Case | Line |
|---|---|
| several arrivals, different days | `2 payments · May 10 – Jun 14` |
| several arrivals, one day | `3 payments · May 10` |
| one arrival | `Sep 4` |
| genuinely undated (typed record, no date) | `no date recorded` — **survives, and is now only ever true** |

⚠ **"payments", for drives as well as sponsors.** The panel's own closing sentence already calls
every record on it a payment; a second word for one thing on one screen is the drift the
one-spelling rule exists to stop. Owner reviewed the sponsor case; the drive case reads
"8 payments · May 2 – Jun 14" and is the one to watch on the walk.

Rejected in the mockup and recorded so it is not re-proposed: `1 payment · Sep 4`. Consistent, and
two words heavier on every single-arrival row on the screen.

### 2.3 The doors

- **Each derived row becomes a link** into that drive's or sponsor's own room
  (`fundraisers` + `?fundraiser=<id>`), **ungated** — the same rule the month panel's subject door
  follows. This mirrors the plan half of the same panel, where every line already opens its budget
  line, and is why the sponsor panel needs no second hub button.
- **One footer door, "Open the Ledger"** (timeline view), on the actual side of every such panel —
  including the ordinary all-typed-costs panel, which is the majority case and the one that
  currently dead-ends hardest.
- The closing sentence **drops " Edit them on Transactions."** The button says it, and better.

⚠ **NOT added: a second "Open Sponsors" hub button** on the sponsor panel. The rows are the better
door; a hub button beside them is a second, worse door landing further from the work — the exact
reasoning that keeps the *writer's* plan panel button-free. Owner-confirmed 2026-09-09.

### 2.4 The scroll fix

A shared `.modalScrollBody > .behindScroll` rule in `coaches.module.css`, next to its siblings, and
the panel's actual/plan bodies wrapped in it. Header and footer pin; the list scrolls between them —
the recipe the `scroll` flag was always promising.

---

## 3. Guards

Extend `tests/unit/bva-figure-doors-guard.test.ts`:

1. **The panel may not dead-end.** The actual side must render a `modalFooter` with a ledger door.
2. **A derived row must be a link.** The panel must key a `Link` off `c.derived`.
3. **`paidDate` must not be synthesised on a derived row** — the route must keep `paidDate: null`
   there, or the month feeds gain a second placement of money the cash strip already placed.

New unit test `tests/unit/coach-money-arrivals-note.test.ts` for the four cases in 2.2.

⚠ The arithmetic guard (`check:money-report`) is **untouched and must stay green**: no figure moves
in this change. If it goes red, something in 2.1 repurposed a dated field.

---

## 4. Out of scope (deliberately)

- **Splitting a derived row into per-cheque rows** — see 1.1.
- **The plan half of the panel** — already correct; its lines are links and its read-only door
  exists (owner ruling 2026-09-04).
- **The Months grid's panels** — the pattern being copied, unchanged.
- **A date on a sponsor PLEDGE** — nothing records when a pledge lands; it stays undated by nature
  (Q13, phase D).

---

## 5. An adjacency to know about, deliberately not acted on

Two **pre-existing** defects in how the dues actual is computed were found by a concurrent session's
review on 2026-09-09 and recorded in `COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN.md` §6g: a write-off can
absorb a payback (moving the figure by $100 on one measured family), and a partially-linked credit
can drop payback money (the Statement reading $950 where the dues screen reads $1,000). Neither is
in this change's blast radius and neither is being fixed here — they move money a coach reads and
need the owner's word.

**⚖ BOTH WERE FIXED THE SAME DAY, so this section defends against a discrepancy that no longer
exists** — the two screens now agree, and the second defect turned out not to be pre-existing at all
(no partially-linked credit could exist until an earlier fix let one land). The reasoning is kept
because the *argument* is what matters and it will be needed again: when a door and a disagreement
meet, the door is not the thing to remove.

**Why it was noted at all.** `DuesBehind` is the door onto that figure, and this change gives it an
**Open Player Dues** button — so while those defects stood, a family holding the second shape could
reach, in one tap, a screen that disagreed with the panel they had just read. That was an argument
*for* the door, not against it: friction was hiding a real disagreement, and the fix is to make the
two screens agree, never to keep them a navigation apart. Two consequences for anyone working here:

- **Ship no dues figure as a literal** in a test, a doc or a walk step without saying it can move.
  Nothing in this project does — checked.
- **Do not add copy claiming the panel and the dues screen agree.** The panel's standing claim is
  narrower and still true: its three lines add up to *the figure that opened it*. That is internal
  consistency, which these defects do not break.
