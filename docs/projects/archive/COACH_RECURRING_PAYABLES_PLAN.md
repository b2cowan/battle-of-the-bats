# ⛔ SUPERSEDED 2026-08-19 — folded into the Coach Payables Rebuild

> **This plan is archived. Do not build from it.** Its subject — a repeating monthly cost — is now
> phase P4 of **`docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md`** (owner decision 2026-08-19).
>
> **Why it was superseded.** This plan solved recurrence on top of the old one-boolean model, where
> a commitment is only ever unpaid or paid. Walking QA §27 on 2026-08-19 found that model cannot
> express partial payment or an undo at all — so recurrence built here would have been a second
> mechanism beside two more that still had to be invented. The rebuild makes instalments, partial
> payment, undo and recurrence one record instead of four features.
>
> **What CARRIES FORWARD, unchanged and still correct:**
> - ⚠ **`lib/coach-monthly-recurrence.ts` and its 43 unit tests are LIVE and reusable.** Committed
>   `c404bd4b` 2026-08-15 with no callers, deliberately. The rebuild’s P4 generator calls it. It is
>   month arithmetic and none of it is wasted.
> - **§3.4 — the ceiling counts the SERIES, not the request** (24 monthly occurrences), refused by
>   generator *and* route with the same message.
> - **§3.5 — the server regenerates from the rule** and refuses any date the rule cannot produce, so
>   "preview before commit" is a guarantee rather than a client-side courtesy.
> - **§3.6 — do NOT reuse the importer’s duplicate rule.** Every occurrence of a repeat shares one
>   description by design; that reviewer would flag them all.
> - **§3.7 — partial failure is reported by date.**
> - The **review-before-commit** shape itself (a preview table, nothing written until confirm).
>
> **What is REVERSED, and must not be carried forward:**
> - ⚠⚠ **§5.1’s rejection of "this one / this and future / all".** The owner adopted a three-way
>   scope on 2026-08-19 — *this payment only · this and later payments · all unpaid payments*. §5.1’s
>   objection (a bulk edit reaching money that already moved) is answered by the new rule that bulk
>   scopes may **never** touch an instalment settled in full.
> - ⚠ **§5.2’s frozen rows.** Part-paid now counts as UNPAID and is reachable by bulk scopes; and a
>   fully settled row stays individually editable, per the standing 2026-08-16 ruling.
> - **§3.1 — the "deposit half or it is invisible" rule.** Every commitment now has at least one
>   instalment, so the "No schedule" state stops being representable.
> - **Monthly-only.** The rebuild offers weekly / every two weeks / monthly.
> - **A series of separate payables.** Twelve months of gym time is now ONE commitment with twelve
>   instalments, not twelve linked bills (owner call 2026-08-19).

---

# Coach Money — recurring payables (monthly)

**Status:** planned 2026-08-15 · **§6.1 + §6.5 committed `c404bd4b` 2026-08-15 (the engine only)** ·
the screen, routes and migration are still awaiting owner approval of §4 and §5
**Engine ready:** `lib/coach-monthly-recurrence.ts` + `tests/unit/coach-monthly-recurrence.test.ts`
exist and pass (22 cases). It has **no callers yet, deliberately** — the chat that picks up §6.2/§6.3
can build the preview against a proven generator instead of inventing the month maths inside a form.
See the "engine, as built" note at the head of §6.1 for the two contract details a caller needs.
**Owner decisions:** 2026-08-15, settled — recorded in §2. **Decision 3 was revised the same day**
(the owner asked for series editing); the revision is §2.3 and §5.
**Origin mockup (approved, Q6):** https://claude.ai/code/artifact/d693ab01-4cf4-4566-bad5-dedc74ea2ba8
**Build mockup (this plan):** https://claude.ai/code/artifact/97d419b6-b31d-415c-852a-403e25b273fc
(source: `COACH_RECURRING_PAYABLES_MOCKUP.html`)
**PM brief:** [COACH_RECURRING_PAYABLES_PM_BRIEF.md](COACH_RECURRING_PAYABLES_PM_BRIEF.md)
**Sibling plan:** [COACH_BUDGET_LINE_ALIGNMENT_PLAN.md](COACH_BUDGET_LINE_ALIGNMENT_PLAN.md) — spending
points at a budget *line*, not just a category. Independent; can ship first.
**Migration:** **one** — a series table + a nullable link column (§5.4). Was "none" before the
decision-3 revision.

---

## 1. Why

A monthly commitment is the commonest thing a rep team owes money on — a winter dome block, field
rental, insurance, equipment financing — and the portal has no way to say "this, every month". The
coach adds twelve payables one at a time, or writes a spreadsheet and pastes it into the payables
importer. Both work. Neither is the product knowing what a repeat is.

The shape is already settled twice over inside this codebase, which is what makes the feature small:

- **`lib/coach-recurrence.ts`** (schedule, Chunk C P1 #6) — a recurring series is *a set of proposed
  rows reviewed before anything is created*. The generator is pure and shared; the client previews
  from it and the commit route **regenerates from the same rule and refuses any date it did not
  itself produce**, so a client/server disagreement can never write an unreviewed date.
- **`components/coaches/BudgetImportSheet.tsx` + `lib/coach-budget-import.ts`** (Chunk H2) — the
  payables importer: one review step, a per-row verdict, nothing written until confirm.

This reuses that pattern rather than inventing one. What is genuinely new is only the **monthly date
arithmetic** — the existing engine is weekly-only — and, after the decision-3 revision, **the same
review table reopened over rows that already exist** (§5).

## 2. Settled by the owner (2026-08-15)

1. **Monthly is the cadence.** Weekly/biweekly payables are not in v1.
2. **Preview before commit.** Nothing is created until the coach has seen the generated dates and
   can untick any of them (a rink closure, a month off).
3. ~~**No linked series.**~~ **REVISED, same day — the series is editable after it exists.** Each
   occurrence is still an ordinary, independent payable that can be edited or deleted on its own;
   what changes is that they now also **remember they belong together**, so the whole run can be
   re-priced, shortened or extended from one place. See §5 for the shape, which deliberately is
   *not* the calendar-style "this one / this and future / all occurrences".
4. **The commit button states what it will create** — "Add 5 payables" — so a fat-fingered end date
   is caught before it becomes 40 rows to clean up.
5. **It lives in the Add Payable form** as a "Repeats" group, beside the existing "Split into a
   deposit and a balance" group.

## 3. What the reading found — the rules this must obey

These are not preferences. Each one is a defect if it is skipped.

### 3.1 ⚠ An occurrence must be written as the **deposit half**, or it is invisible

`payableStatus()` in the payables panel reports **only what is recorded**: a payable with no deposit
and no balance amount reads **"No schedule"**, never reaches the Payment schedule tab, never appears
in Due next / Next 30 days, and has no Mark paid control. A total with no half is a commitment with
no date attached.

The importer already established the convention (`rowsFromPayables`): *"a single amount with one due
date is recorded the way the payable form already records it — as the deposit half with no balance."*

So each generated occurrence is written as `amount = X`, `depositAmount = X`,
`depositDueDate = <occurrence date>`, `balanceAmount = null`, `balanceDueDate = null`. **The
mockup's promise — "they'll appear on the Payment schedule straight away" — is true only because of
this line.**

### 3.2 "Repeats" and "Split into a deposit and a balance" are mutually exclusive

Both groups write the same two date columns, and a payable that both repeats monthly *and* splits
into a deposit and a balance is undefined — does each occurrence get both halves, or does the split
spread across the series? Neither answer is obviously right, so the form states the rule instead of
the server discovering it: **opening one disables the other**, with one line saying why. The
disabled group keeps its values (children stay mounted, per the `CoachFormDisclosure` contract), so
toggling back and forth loses nothing.

### 3.3 The 31st problem must be answered visibly

"The 1st" is safe; "the 31st" is not. Across a six-month run it hits February. Silently skipping the
month produces five payables from a six-month rule; silently clamping produces a date the coach
never typed. **Rule: clamp to the last day of a short month, and say so on the row** — the coach
gets the six they asked for, and can see exactly what happened to February.

The day-of-month picker also offers **"Last day of month"** explicitly, which is what an invoice
term usually means anyway, and sidesteps the whole class.

### 3.4 One ceiling, enforced in both places

`MAX_RECURRENCE_OCCURRENCES = 60` is right for a weekly season (53 weeks). Monthly across a season
is 12; across two, 24. **`MAX_MONTHLY_OCCURRENCES = 24`**, refused by the generator *and* by the
commit route with the same message — the precedent is `MAX_INSTALLMENTS` on the dues generator,
whose docblock records why the two must refuse the same schedules ("a roster-sized multiplier on an
unbounded input, reachable by anyone who can already write money here"). **The ceiling counts the
series, not the request** — extending an existing run of 20 by 6 is refused (§5.3).

### 3.5 The server regenerates; it does not trust the list

Straight from `reviewRecurrenceOccurrences`: post the **rule** plus the kept dates, regenerate from
the rule server-side, and refuse the whole request if any submitted date is one the rule cannot
produce. A generated date the client omitted is a deliberate removal (the month off). Without this,
"preview before commit" is a client-side courtesy rather than a guarantee.

⚠ This applies to **creation and extension only**. The series sheet (§5) edits rows that already
exist; there is no rule to reconcile against, and pretending otherwise would forbid the individual
row edits the product already allows.

### 3.6 Do **not** reuse the importer's duplicate rule

`reviewPayableRows` warns "A payable with this description already exists — this adds a second one."
Every occurrence of a repeat shares one description **by design**, so that reviewer would flag five
of six rows amber for doing exactly what was asked. Reuse the *review pattern*, not that reviewer.

The real duplicate risk is different and worth handling — see §4.2.

### 3.7 Partial failure is reported by date

The commit is N inserts, not one transaction (Supabase gives the importer no transaction either; it
loops `createRepTeamExpense` and collects `created` / `failed` / `skipped` per row). Same here: "4
of 6 created — Feb 1 and Mar 1 could not be saved." The dues generator's docblock records what
happens when this is swallowed: the coach is told "✓ done" over silent data loss.

### 3.8 The discard guard must cover the preview

`payableDirty` currently reads the form's text fields. A coach who has built a twelve-row preview
and clicks the overlay must be asked. The schedule page already does this (`discardDetail` names the
recurrence rows); reuse `useDiscardGuard` / `touched` the same way. **Same for the series sheet.**

### 3.9 Dates are DATE-only strings, and stay that way

Pure string stepping. No `Date` is constructed to answer "what day is this", and no instant is ever
formatted down to a calendar day (`toISOString().slice(0,10)` is the banned idiom — see the
date-correctness guardrail and `lib/coach-recurrence.ts`'s docblock). "Today", where needed, comes
from `lib/timezone.ts`.

## 4. Enhancements over the approved Q6 mockup — **need owner approval**

The Q6 sketch is right in shape. Four additions, each cheap, each closing a hole it leaves.

### 4.1 The amount is editable per occurrence — **recommended**

The schedule's weekly preview makes each occurrence's *distinguishing* field editable inline (the
opponent). The direct analogue here is the **amount**: a dome block whose final month is prorated, a
January invoice that arrives higher, a summer month at half the rate. One input per row, and the
same input serves the series sheet in §5 — build it once.

### 4.2 Dates that already exist arrive unticked — **recommended**

Nothing stops a coach running the same repeat twice — close the modal, reopen it, set it up again,
and the season quietly holds two of everything. At preview time, any occurrence whose **description
+ due date** already exists this season is marked *"already on the schedule"* and **unticked by
default**. The coach can tick it back if the team genuinely owes two.

Still needed after the decision-3 revision: the series link stops a *second run of the same series*
from being invisible, but a coach can still set up a second, separately-created repeat over the same
months.

### 4.3 "Ends after N payments" beside "Until" — **recommended**

The sketch offers an end date only. Coaches think in both ("until April" *and* "six payments"), and
a count **cannot** produce the runaway the fat-finger guard in decision 4 is written against.

### 4.4 The shared fields say they are shared — **recommended, one line**

Category, payee, payment method, notes and tags apply to **every** occurrence. The "Add details
(optional)" group's meta reads "applies to all 6" while Repeats is on.

### 4.5 A repeat points at a budget line, like any other cost — **owner call, 2026-08-15**

The sibling plan replaces the Category picker on both money forms with **"What is this against?"**,
listing the team's own budget lines. **The Repeats group inherits it, and the chosen line applies to
every occurrence** — one more entry for the "applies to all N" line in §4.4.

This matters more here than anywhere else in Money. A repeat is the **largest single commitment a
coach makes in one action**, and it is the one place the product can check a whole run against a
budget line *before* any of it exists. So the commit callout carries the consequence:

> Creates **5 payables totalling $1,530.00** … Against **Dome rental** — $2,150 left on that line,
> so this run leaves **$620**.

**Ordering.** The sibling plan is the higher priority and expected to land first, in which case this
inherits the field for free. If this somehow ships first it carries the plain Category picker and
gains the line picker with the sibling — no rework beyond swapping the field, because the group has
never owned that control.

### 4.6 Deliberately **not** doing

- **Per-occurrence descriptions / auto-appended months** ("Winter dome block — Nov 2026"). The
  Payment schedule is date-ordered; six identical descriptions differing only by date read fine.
- **Suggesting a repeat from a budget line.** Real, and covered by the sibling plan's follow-ups.
- **Weekly / biweekly payables** — owner decision 1.

## 5. The series, after it exists — **the decision-3 revision**

### 5.1 What it is *not*

**Not "this one / this and future / all occurrences".** That three-way question is the expensive,
error-prone half of calendar recurrence, and it asks the coach to reason about a rule they cannot
see. Every one of these rows is money with a date on it, and some of it has already been paid — a
blanket "all occurrences" over that is precisely the operation nobody should be offered.

### 5.2 What it is: the creation preview, reopened

**The way in is the row's existing "⋯" menu** — the one the in-flight Edit/Delete work is already
adding — with a third item, **"↻ Edit repeating series"**, shown only on a payable that belongs to a
run (owner call, 2026-08-15). Nothing is added to the row itself: no badge, no second line, no extra
height on a table coaches scan down. The sheet names the run when it opens, which is where that
information belongs.

It opens the **series sheet**: the same table the coach approved at creation, now loaded with the
rows that actually exist.

| Row state | In the sheet |
|---|---|
| **Unpaid** | Amount is editable. Can be removed. Counts toward the change summary. |
| **Paid** (or part-paid) | Shown with its paid stamp, **frozen** — no re-price, no remove. Money that has moved is not a series operation. |
| **Overdue** | Editable like any unpaid row, flagged so it isn't quietly re-priced instead of chased. |
| **Added but not yet saved** | Status reads **"New"** (owner wording, 2026-08-15) — one signal, in the status column where every other state already lives, rather than a chip beside the date. |

Shared fields (description, **budget line** — see §4.5 — payee, payment method) can be changed **for
the whole run at once**, and that change lands on **unpaid occurrences only** — stated on the
control, not left to be discovered. A paid row keeps the description it was paid under.

The footer states the change before it is saved, in the same voice as the create button:
**"Save — 2 amounts changed, 1 payment removed, 3 added"**.

### 5.3 Extending and ending

- **"Add more months"** continues from the last date using the remembered rule; the new dates appear
  in the same table, unticked-and-reviewable, exactly like creation. The 24 ceiling counts the whole
  series (§3.4).
- **"Remove remaining payments"** deletes every *unpaid* occurrence after a confirm that names the
  count and the date range. Paid occurrences stay — they are history, not schedule.
- Deleting the last unpaid row does not delete the series; the series ends when its rows do.

### 5.4 What is stored — **migration**

Two things, and they are deliberately inert:

- **`rep_payable_series`** — one row per run: team, program year, description, the rule
  (cadence, day-of-month, first date, end), created-by. It is a **memory of what was set up**, so
  "add more months" knows what "more" means.
- **`rep_team_expenses.series_id`** — nullable link. Every occurrence remains a complete,
  independent payable; the link adds a marker and a way back to the sheet, and removing it would
  cost nothing but the convenience.

⚠ **The stored rule never generates anything on its own.** Nothing is created except when a coach
opens the sheet and confirms a reviewed list. The original decision's spirit — no invisible
machinery quietly writing rows — is preserved exactly; what changed is that the coach can now
*return* to the list they approved.

An occurrence edited on its own (via the row's own Edit) stays in the series and is marked
**"edited"** in the sheet, so a series-wide re-price does not silently undo a deliberate one-off.

## 6. Build

### 6.1 New — `lib/coach-monthly-recurrence.ts` — ✅ **BUILT 2026-08-15**

> **The engine, as built.** Four things a caller must know, all decided while building and all
> documented in the module's own docblocks:
>
> 1. **The ceiling REFUSES; it does not truncate.** A run longer than 24 returns `[]`, not the first
>    24 — the weekly module truncates, and doing that here would show the coach a 24-row preview for
>    a 25-payment rule the commit route would then refuse.
> 2. **The ceiling counts the SERIES, and the engine now enforces that** (§3.4/§5.3). The `/review`
>    pass flagged this as a gap the next chat would have to remember; rather than leave it as a note,
>    the reconcile — the one place §3.5 puts every write through — **requires** the number of
>    occurrences the series already holds. Creation passes 0; extension passes the real count. It is
>    required, not defaulted, so a route cannot forget the question: it has to answer it out loud.
>    A refusal comes back **empty** as well as flagged, so a route that writes the accepted rows
>    without reading the flag writes nothing rather than a 26-row series. **What §6.3 still owes:**
>    the query that counts the existing occurrences, and the coach-facing message.
> 3. **⚠ An empty result has three causes, not one:** a malformed rule, the ceiling, or — on an
>    "until" run only — a window too narrow to hold even one occurrence ("the 20th, from the 15th
>    until the 18th"). A preview that reports every empty result as "your run is too long" tells that
>    coach precisely the wrong thing. Once the rule's parts are known good, a *count* run can only be
>    the ceiling; an *until* run is separated by re-asking for one occurrence and seeing whether it
>    lands after the end date. (An earlier draft of this note claimed a single cause — it was wrong,
>    and the review caught it before the screen was built on it.)
> 4. **`clamped` on an accepted row comes from the server's own fresh generation**, never from the
>    submitted row — so the per-date result of a commit can say "Feb 28" truthfully even if a client
>    claimed otherwise. `dayOfMonth: 'last'` never reports as clamped: that date *is* what was asked
>    for, so no "February has no 31st" note belongs on it.
>
> **What the engine refuses outright** (each one a `[]`, never a guess): a start or end date that is
> not a real day on the calendar (month 13, the 30th of February, the 29th in a non-leap year); a
> rule that ends two different ways at once (both a count *and* an end date — a left-behind **blank**
> end field is ignored rather than refused, since that is ordinary form state); and a count run it
> could not complete. The reconcile likewise refuses `2026-02-31` — the exact date a client that
> stepped months without the clamp would send — which is the §3.5 guarantee doing its job on the
> §3.3 ruling.
>
> **Per-occurrence descriptions are NOT in the contract** — §4.6 rules them out, and an accepted row
> is exactly date + clamped + amount so the shape cannot invite the excluded feature back in.

Sibling of `coach-recurrence.ts`, same contract, same discipline: **pure date maths, no I/O, no
React**, imported with a relative `./timezone.ts` path so the unit tests run under plain
`node --test`.

```
MAX_MONTHLY_OCCURRENCES = 24

MonthlyRecurrenceRule {
  dayOfMonth: number | 'last'    // 1–31, or the month's last day
  startDate: string              // YYYY-MM-DD
  end: { until: string } | { count: number }
}

generateMonthlyOccurrences(rule): MonthlyOccurrence[]   // { date, clamped: boolean }
reviewMonthlyOccurrences(rule, submitted): { accepted, removed, unknown }
```

`clamped: true` is what the preview row renders its "last day of Feb" note from. Month stepping and
the clamp live here rather than in `lib/timezone.ts`: clamping is a **product ruling** (§3.3), and
it belongs with the rule that owns it, not in the date primitives.

### 6.2 Client — the Add Payable form, and the series sheet

`app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`

- A third `CoachFormDisclosure`, label **"Repeats"**, meta `Monthly · 6 dates` when on.
- Controls: How often, Day of month (1st–31st + Last day), First due date, Ends (Until / After N).
- The occurrence table — tick, date (+ clamp note, + "already on the schedule"), description,
  editable amount — extracted as **one component used by both creation and the series sheet**. This
  is the one shared abstraction worth having up front: the two views differ only in whether a row
  already exists, and building them separately guarantees they drift.
- Footer: "N of M dates selected"; primary reads **"Add 5 payables"**, falling back to "Add Payable".
- Mutual exclusion with the deposit/balance group (§3.2); dirty tracking extended (§3.8).
- The budget-line picker from the sibling plan, applied to the whole run, with the
  remaining-on-line consequence in the commit callout (§4.5).
- **No change to the payables row.** The way in is a third item in the row's existing "⋯" menu,
  rendered only when the payable has a series (§5.2) — no marker, no added row height.

### 6.3 Server

- **`POST …/expenses/repeat`** — create. A sibling of the single-create POST rather than a flag on
  it: that route returns one `expense` and has other callers, while this returns a per-date result
  set (precedent: `budget-plan/import`). Auth exactly as the existing expenses POST
  (`resolveCoachContext` + `canWriteMoney`). Regenerate + reconcile (§3.5), enforce the cap (§3.4),
  create the series row, then loop `createRepTeamExpense` — the **same writer** the form and the
  importer use — with the deposit half set (§3.1). Returns `{ created: [{date, id}], failed: [...] }`.
- **`GET|PATCH|DELETE …/payable-series/[seriesId]`** — the sheet's load, save and "remove
  remaining". PATCH takes explicit per-row instructions and **refuses any instruction touching a
  paid row**, server-side — the frozen rule is not a UI courtesy.
- **Not on the season-read rail, by decision.** Creating and changing payables is an *instrument*,
  not a record: these routes resolve the team's ACTIVE program year, read no `?year=`, and therefore
  need no entry in `APPROVED_SEASON_AWARE_ROUTES` and no archive door. A finished season shows the
  rows and offers no sheet.

### 6.4 Migration

One migration: `rep_payable_series` + `rep_team_expenses.series_id` (nullable, indexed, ON DELETE
SET NULL so removing a series never removes money). Same unit of work: `DATA_DICTIONARY.md` and
`npm run refresh:snapshots`, per the schema-is-a-dictionary rule.

### 6.5 Tests — `tests/unit/coach-monthly-recurrence.test.ts` — ✅ **BUILT 2026-08-15 (36 cases)**

Plain `node --test`. Non-negotiable: the 31st across February (clamped, count preserved); "last day"
across a leap February; count-vs-until agreeing; the cap refusing at 25; `unknown` for a date the
rule cannot produce; a removed date reported as `removed`, not `unknown`. **All covered**, plus a
duplicate date treated as `unknown`, the Gregorian century leap rule (2100 has no 29 Feb), a run
crossing a year boundary, and a start date that is not itself on the chosen day.

**Hardened after `/review` (2026-08-15).** The adversarial pass found four real defects in the first
cut, each now fixed and pinned by a test: a start date that is not a real calendar day was accepted
and stepped on into **dates that do not exist** (`2026-14-01`), which the reconcile then accepted as
writable; a rule carrying both an end date and a count silently discarded the end date; a count run
that could not be completed came back short instead of refused; and the note above claimed an empty
result had a single cause. Two test-strength fixes went with them: the reconcile cases now pin their
input dates as **literals** rather than rebuilding them from the generator (a test that reconciles
the module against itself proves only self-consistency), and the `clamped` case now submits a
conflicting client-supplied value to prove the server's own arithmetic wins.

The **series** ceiling (§5.3) is covered too: extending a run of 20 by 6 is refused, refused by one
at 19 + 6, allowed once the coach unticks back to 24, and refused outright when the caller cannot
say how large the series is — plus the case that matters most, a six-month run that passes happily
on its own and is refused only once the series it joins is counted.

**Still owed:** the route-level test that a PATCH naming a **paid** occurrence is refused — it
belongs with §6.3, which is not built.

### 6.6 Sequencing — **ships after Edit/Delete for payables**

Individual row edit/delete remains the base the series sheet sits on: the sheet is a convenience
over rows that must each be fixable on their own. The other in-flight change — one "Add" button with
an Expense/Payable switch — means the Repeats group must be **absent when the switch is on Expense**
(an expense is money already spent; repeating it is meaningless).

## 7. Follow-through

- **Help docs** (`/docs`): the coaches Money article gains repeating payables *and* how to change a
  run after it exists.
- **Demo sandbox** (`riverdale-ridge`): a monthly dome block is what the seeded coach world should
  show, and it needs no seed *mechanics* change — the rows are ordinary payables. No existing dock
  or tour sentence mentions payable recurrence, so nothing already written goes stale.
- **Owner QA:** new ledger section — the 31st-across-February case, the re-run/duplicate case, the
  series sheet refusing to touch a paid occurrence, and confirmation that each created row appears on
  the Payment schedule with its own Mark paid.
- `/simplify` then `/review` after the build.
