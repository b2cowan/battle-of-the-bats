# Coach Money — The Dues Ladder

**Status:** committed `3545b64e` 2026-09-07 (after /review, §7.8) — owner QA owed
**Owner-approved mockup (round 4):** https://claude.ai/code/artifact/5df27ea9-8210-45de-a569-26c6c74894dc
**PM brief:** `COACH_DUES_LADDER_PM_BRIEF.md`
**Came out of:** the §148 walk. The owner asked why Avery's *After fundraising* read $700.00 when
she had raised $198.15. It does, correctly, because her cash had already settled every instalment —
and that is the defect: the tile answers a question about a bill while appearing to answer one about
fundraising.

---

## 1. The ruling

**Player Dues reads as one arithmetic ladder, on the table and in the drawer:**

```
Dues − Fundraising − Other credits − Paid + Handed back = Balance
```

- No operator glyphs anywhere. Column order and the rule before Balance carry it.
- **`Handed back` hides at zero** — as a whole column on the table when no family on the roster has
  a payout, and per family in the drawer.
- **`After fundraising` and `Left to send` are retired from the drawer's tile row.** Balance replaces
  Left to send: for every family who owes money the two are the same figure, and they only diverge
  when the family is *owed*, where Balance is the honest one.
- **Handed back is drawn in amber**, not the green used for money coming in — colour carries the
  direction no operator states.
- **Zero terms stay visible**, in the quiet ink.

## 2. The definitions (the whole correctness story)

Every figure is **gross** — issued, sent, handed back — rather than netted. Today the product nets
payouts away silently inside `Credits` and `Paid`, and that is exactly what makes two headings lie
once the columns are named:

| Family | Today's screen | The truth it hides |
|---|---|---|
| Blake | `Credits ($176.98)` | Raised **$150.00** on the Bottle Drive, took **$100.00** back. A column headed *Fundraising* would say $50.00. |
| Logan | `Credits ($100.00)` | A **$300.00** sponsorship with **$200.00** handed back. |
| Casey | `Paid $900.00` | Sent **$1,200.00**. §148 ruled Paid shows what the family actually sent — this column already contradicts its own definition. |

Which credit a payout consumes is **arbitrary** (oldest-first), so Blake's landed on the Bottle Drive
rebate purely by date. Splitting `Credits` in two is what makes that arbitrariness visible; going
gross is what removes it from the figures a coach reads.

### The split, exactly

```
own         = min(overpaymentIssued, max(0, grossPayments − cappedPaid))
dues        = schedule total                      (unchanged)
fundraising = credits issued of type 'fundraiser' (gross)
other       = credits issued − fundraising − own  (gross, ≥ 0 by construction)
paid        = payments received                   (gross)
handedBack  = payouts                             (gross)
```

**⚠ THE BALANCE IS NOT RECOMPUTED FROM THESE.** It stays exactly the figure it is today
(`outstanding − netCredits`), and the ladder equals it *by construction* — proved algebraically and
pinned by a unit test across all twelve fixture families. This is the same discipline as
`splitFamilyOwnMoney`: **a re-split of one total, never a re-derivation.** A redesign that quietly
moved a balance coaches have acted on would be a different and much worse change.

**⚠ WHY `own` IS CLAMPED RATHER THAN JUST `overpaymentIssued`.** A coach can add a credit by hand and
pick *Overpayment* as its kind (`MANUAL_CREDIT_TYPES`). That credit has no matching payment, so
subtracting the raw overpayment total would push the ladder's balance above the real one by its
amount. Clamping to the excess the payments actually carry drops the hand-typed remainder into
`other`, where it belongs — it is a credit a coach asserted, not money the family sent — and the
ladder ties in both cases.

*(Follow-up worth considering separately, NOT in this change: whether `overpayment` should be in the
manual picker at all. It names a derived fact — this family sent more than we billed — and letting a
coach assert it by hand creates a figure the payments list contradicts.)*

## 3. What changes on screen

### 3.1 The Player Dues table (Season totals)
`Total dues · Credits · Paid · Balance · Status` → `Dues · Fundraising · Other credits · Paid ·
[Handed back] · Balance · Status`. Nine columns fit 1200px. **No balance moves; no status changes.**
The one figure that changes value anywhere is Casey's `Paid`, $900.00 → $1,200.00.

**The row's `sent $550.00 more than billed` sub-line is removed.** It was the right fix for a
four-column table and is redundant in a six-column one — `Paid $1,250.00` now sits on the same row as
`Dues $700.00`, and Status already reads *Overpaid*. It also had a latent flaw: it says *sent* about
a figure that means *still held*. ⚠ **This supersedes a §148 deliverable that shipped 2026-09-06 —
record it as superseded, not reversed**, or it reads as drift later.

### 3.2 The player drawer — the tiles
Four tiles → five (six with a payout). `After fundraising` and `Left to send` go.
**The per-tile captions go too** ("Bottle Drive rebate", "1 payment", …): each was a lossy summary of
a section a few centimetres below, and tiles with a caption sat taller than tiles without.

### 3.3 The player drawer — the lists
**One section per tile, each carrying its total in the header.** The pattern is already two-thirds
built: `Payments — $1,250.00 received` and `Paid out — $100.00 handed back` both do this. `Credits`
was the only bare header, and the only section holding three unrelated things.

| Tile | Section |
|---|---|
| Dues | the instalment table |
| Fundraising | `Fundraising — $198.15 raised` |
| Other credits | `Other credits — $380.00` |
| Paid | `Payments — $1,250.00 received` |
| Handed back | `Paid out — $100.00 handed back` |

- **Sections mirror the ladder**, so Payments moves below the two credit sections. Cheap: recording a
  payment goes through the buttons at the top of the drawer, not this list.
- The `Fundraiser ·` type prefix leaves rows inside the Fundraising section (the heading says it).
  `Reimbursement ·` / `Contribution ·` stay in Other credits, which really is mixed.
- **The engine's overpayment row retires into the Payments heading** as
  `· $550.00 more than billed`. That row has no date, no pencil, no bin and no link — it is a caption
  wearing a row's costume, and under the ladder it has no tile, because the money is inside Paid.
  ⚠ **The caption must keep the row's hover text** (*change the dues total to change it*) — it is the
  only place the screen says how to move the figure.
- `+ Add a credit` moves to the **Other credits** header.

### 3.4 Phone
The balance leads, with the ladder folded behind a chevron (52px tap target, clear of the 44px
floor). **The phone receipt keeps its per-line sources** — on a phone the sections are a screenful
below, and the receipt is the only place the whole picture fits at once. Different distance,
different answer.

### 3.5 Rejected: the collapsed desktop drawer
Built in the mockup and argued against on the evidence. Shut, it is a worse copy of the table row the
coach just clicked — they opened the drawer *to* see the breakdown; it spends 52px to repeat one
number already on the row behind it; and it puts the drawer's best content behind a control the
layout sweep cannot see inside. On a phone it earns its keep because there is no room.

## 4. Reach — every surface that reads these figures

1. The dues payload (the table, the drawer, the by-instalment lens).
2. The roster player's money panel — §148 put both producers on one shared helper; **they must not
   drift**, so the ladder ships to both or neither.
3. **The dues export** — *an export's shape IS its screen's shape* (§146 F2). Same columns, same
   order, same gross figures.
4. The family statement PDF (reads `ownMoneyHeld`).
5. In-app help — describes `After fundraising`, the four-figure order, and quotes the retired
   sub-line verbatim in two places.
6. The demo sandbox — check whether any dock line or tour step names these words.

## 5. Verification

- Unit: the ladder equals today's balance for every fixture family, plus the hand-typed-overpayment
  case, the payout case, and the zero case.
- **Measured, not asserted:** all twelve balances read off the rendered page and compared to their
  pre-change values. This is the §148 invariant and the one thing that must not move.
- `verify:changed`, typecheck, rendered layout sweep at 361/390/768/1440.

## 6. Deliberately not in this change

- Removing `overpayment` from the manual credit picker (§2).
- Anything about the CREDITS list's own affordances beyond the split and the retired row.
- The main table's `Showing` / `View` controls, statuses, or the Collection schedule.

---

## 7. Build notes (2026-09-07)

**Built and green:** the split helper + 9 new unit tests (all twelve fixture families asserted
against *today's* balance, not against hand-typed figures), the dues payload, the table's six money
columns, the drawer's tiles and its four sections in ladder order, the dues export (CSV + PDF), and
the roster player page.

### 7.1 The own-money set is a predicate, not a total — and it lives in two places
`Fundraising` + `Other credits` in the tile row must equal the rows printed beneath them, so the
route's `overpaymentIssued` filter and the panel's `isOwnMoneyCredit` are the **same** test: an
overpayment credit is the family's own money when it is the engine's schedule row **or** carries a
payment. A coach-typed one is neither, so it shows and counts under Other credits — where the clamp
in `splitDuesLadder` already puts it.

### 7.2 The roster player page: figures matched, labels left alone
Casey would have read `Paid $900.00` there against `$1,200.00` on the dues table — the exact
two-producers-drift §148 was written about. The page now reads the ladder. **Its box labels were
deliberately not touched** (`Assessed`, not `Dues`): that wording question was not in the approved
mockup. A figure difference is a bug; a label difference is a design call.
⚠ **Open, for the owner:** the season band says `Assessed`, the table now says `Dues`, the player
page says `Assessed`. One concept, two words, three surfaces.

### 7.3 `.rowSubNote` is retired, with a headstone
Removing the row sub-line left its CSS class with no consumer, and `check:css-selectors` refused it
(correctly). ⚠ **`APP_WIDE_TABLE_CONSISTENCY_PLAN.md` §Density names it in a `.tr:has(.rowSubNote)`
rule that is planned but not yet built** — that session's work is in the same working copy. The rule
is deleted with a comment at its old address recording its exact shape, so re-declaring it is a copy
rather than a re-derivation.

### 7.4 The export takes a column the screen hides
`Handed back` renders on the table only when a roster has a payout; in the file it is **always** a
column. A file whose column *count* depends on its data cannot be appended to last month's, and a
spreadsheet reader has no chevron to ask why a heading vanished. ⚖ This is an outward-facing column
break, taken deliberately in the release that makes the old headings wrong.

### 7.5 Help and the demo sandboxes: deferred by owner ruling, with a due point
The in-app dues help describes `After fundraising`, the four-figure order, and quotes the retired
sub-line verbatim in two places; the coach demo's money narration wants the same question asked of
it. **Both wait for the end of the dues-by-family project** (owner ruling on the §148 walk,
2026-09-07). A deferral with a named due point — not a skip.

### 7.6 Not built, and deliberately so
`overpayment` is still offered in the manual credit picker. ⚠ It is a worse defect than it looks:
the reconcile counts **every** overpayment credit and shrinks the stale ones, so a coach-typed one is
silently eaten on the next pass. The ladder handles it correctly either way. Its own change.

### 7.7 Gates
typecheck clean · **3,123 unit tests, 0 failing** · full `verify:changed` green (spelling, CSS
purity, contrast, dates, schema parity, dictionary, org-context, demos, dead selectors, export
registry, repo root) · focused ESLint 0 errors. **Owed:** the rendered layout sweep at
361/390/768/1440, and the measured twelve-balance comparison on the running app.

### 7.8 `/review` — 2026-09-07, high-risk tier, four lenses (correctness · data/contract · blast radius · concurrency/tenant/state)

**Confirmed and fixed before commit:**
- **Critical — the fold dropped a trim that was not on the host.** The shrink walks newest-first, and
  the newest overpayment row can be coach-typed (never a survivor). Trim it, fold two legacy engine
  rows beneath it, and the first cut nulled the trim unconditionally — nothing in `remove`, nothing
  in `topUp`, so the executor never wrote it: stale amount, credits overstated by the trim, `reduced`
  reporting a reduction that never happened. The planner now keeps an off-host trim; the executor
  applies fold and trim together rather than either/or. Pinned.
- **High — the fold's host update had no zero-rows-matched recovery.** Siblings deleted first, then
  an unchecked update; a concurrent host delete lost every dollar until a later pass recreated it.
  The grow branch has carried this recovery since 2026-09-01; the fold branch now mirrors it
  (`insertCredit` hoisted so both can reach it). Transient by the engine's design, but a free fix.
- **High — the family statement PDF read the netted pair.** Casey's document said *received
  $900.00* while Player Dues says $1,200.00; Blake's band said *credits $176.98* over a credits
  table on the same page whose rows sum to $276.98. The statement reads the ladder (gross); a
  fifth *handed back* tile joins the band only for a refunded household, so every other family's
  document is byte-identical. Two tests.
- **Medium — the Payments caption (gross) and the owed-back strip (net) diverged on a partial
  refund** with nothing bridging them. The caption now names the part of the excess since handed
  back — the §148 helper's own figure, stated rather than re-derived.

**Advisory, deliberately not fixed here:**
- A concurrent fold and grow on one family can lose the grow's new dollars until the next pass —
  the engine reconciles to `payments − schedule` on every call, the grow branch has always carried
  the same blind SET, and the window exists only until a legacy family's rows are folded once.
  Serialising reconciles per player is a separate hardening.
- The per-player schedule route calls the reconcile unguarded after the schedule is saved; a fold
  write that throws now returns a 500 over a saved schedule (pre-existing shape on the shrink path,
  widened). The bulk run already catches and would mark such a player *failed* despite a correct
  schedule.
- `{created: 0, reduced: 0}` after a pure fold reads as a no-op to any future caller that trusts
  it (none does today).
- `+ Add a credit` lives under *Other credits* but can create a `fundraiser`-kind credit that lands
  in the section above after the refetch. Owner-approved placement; the walk should look.

**Refuted:** the payout-floor projection consuming the planner's `remove`/`trim`/`topUp` (it never
reads the plan — it projects from `strandedExcess` independently); `.rowSubNote` consumers (none);
a builder of the export or summary shapes assembling them by hand (none); the roster page seeing an
undefined ladder (route passes the whole summary; page imports the type).

**Gates after the fixes:** typecheck · **3,134 unit tests** (11 new across three files) · full
`verify:changed` · `check:layout --only=coach-dues,coach-player` at 361/390/768/1440, **no new
findings** — the `--changed` widening to all 73 screens aborted at the memory floor on a server the
walk had exhausted, and was deliberately not re-run: the only shared-stylesheet change is the
deletion of a class with no consumer, which cannot alter a rendered pixel.

### 7.9 Follow-up, same day (owner: "go ahead with those 3 items") — committed `e160f76b`

- **Assessed → Dues.** One concept had two words on three surfaces. The season band's first tile and
  the roster player page's first box now say **Dues**, matching the column, the drawer tile, the
  tab and the Statement row. *Billed* was the alternative (it pairs with Collected and the drawer
  already says "more than billed"); the walk's Part I asks whether Dues reads on the band.
- **`overpayment` left the manual credit picker.** It names a derived fact the engine owns and
  reconciles every pass; a hand-typed one contradicted the receipts and was silently eaten. The
  picker offers Contribution · Fundraiser · Other. Existing rows of the kind still display, count,
  and open for edit with a fixed label — the treatment `forgiven` and `reimbursement` always had.
  The one UAT scenario that posts an overpayment by hand already expects a refusal, so it holds.
- **⚠ THE PHONE SHAPE HAD NOT BEEN BUILT.** §3.4 promised it, the mockup drew it, the owner approved
  it — and the first commit shipped only the desktop tile row, which spills six tiles across 390px.
  The rendered gate passed because it cannot see inside an open drawer. Built now: the balance leads
  on a native `<details>`, the working folds out as a receipt with each line naming its source,
  Handed back in amber, the summary a 52px tap target. The desktop card's `display` moved into its
  class so the phone rule can win — an inline display beats any stylesheet.
- **Owner QA §151** — walk artifact `COACH_DUES_LADDER_WALK.html`, nine parts. Part F is the phone,
  walked by hand because nothing else can; Part I carries the two open calls (the Add-a-credit
  placement, Dues vs Billed).
