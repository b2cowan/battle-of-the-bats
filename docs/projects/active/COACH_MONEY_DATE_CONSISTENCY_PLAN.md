# Money that moved has a date in the past — one rule, every door

**Owner-raised 2026-08-30**, walking the §122 build: *"when we log an expense, we prevent users from
selecting future dates, shouldn't we be consistent if we are doing sponsorship money that came in…
I am honestly fine either direction, but we at least have to be consistent between types of
transactions."*

**Status:** plan written 2026-08-30. Direction ruled by the owner in the same message (below).
No migration.

---

## 1 · The finding, from the code

The product already has a rule — *Record is for money that has already moved* — stated in the help
article and enforced on some doors. It is applied **inconsistently, in both directions, at two
different layers.**

### The screen

18 date inputs live on the coach money surfaces. Six cap future dates; twelve do not — but **most
of those twelve are correct**, because they are forward-looking by nature. Separating them is the
whole of this plan:

| Field | Caps future? | Correct? |
|---|---|---|
| Dues payment — *Date received* (dues panel) | Yes | ✅ |
| Dues payment — *Date received* (record conversation) | Yes | ✅ |
| Fundraiser entry — *Date received* (conversation) | Yes | ✅ |
| Fundraiser entry — *Date received* (inline edit) | Yes | ✅ |
| Expense — *Date paid* (conversation) | Yes | ✅ |
| Expense — *Date paid* (record/edit form) | Yes | ✅ |
| **Sponsor cheque — *Date received*** | **No** | ❌ **the owner's find** |
| **Income — *Date received* (conversation)** | **No** | ❌ |
| **Income — *Date received* (own form)** | **No** | ❌ |
| Sponsor pledge — *Expected by* ×2 | No | ✅ a promise is *supposed* to be ahead |
| Fundraiser *Start / End date* ×4 | No | ✅ a drive runs into the future |
| Dues *installment* row date | No | ✅ a due date is a future date |
| Dues credit — *Date* | No | ⚠ **D1, see §4** |

### The server

| Write door | Refuses a future date? |
|---|---|
| Sponsor arrival | Yes |
| Fundraiser entry | Yes |
| Dues payment | Yes |
| Expense — *Date paid* | Yes (via a helper, not an inline check) |
| **Income / money back** | **No** |

### So the two layers disagree, in opposite directions

- **Sponsor cheque** — the server refuses, the form invites. The coach picks a date, fills the
  form, presses save, and *then* learns it was never allowed. That is a **foreseeable refusal
  discovered instead of shown**, which is its own standing owner ruling (§118) and the exact
  grammar the §122 delete buttons were built on.
- **Income and money back** — the form blocks, the server does not. That route validates the
  date’s SHAPE and never its position, so the rule exists **only inside one screen**. Anything
  reaching the same table another way — an import, a future door, a script — could write income
  dated next March, and nothing stopped it.

⚠ **A CORRECTION OF RECORD:** the first cut of this plan said the EXPENSE route had no server
check. That was wrong — it refuses a future paid date through `whyPaidDateIsRefused`, which a
grep for an inline `tournamentToday()` comparison missed. The hole was one door over, on money-in.
Re-checked before building; the same mistake is why this plan lists what each door does rather
than asserting a pattern.

Neither is a data-corruption bug today. Both are the kind of gap that becomes one.

### Why it keeps happening — the structural cause

`accounting/DateField.tsx` is the shared date control for the money screens. It supports a
**`min`** and has **no concept of a `max`**. So every field that wants "not in the future" hand-rolls
`max={tournamentToday()}` on a raw input, and three of them forgot. **There is no single place that
owns the rule**, which is why a sweep that touched two doors left a third looking identical and
behaving differently.

---

## 2 · The ruling

**Owner, 2026-08-30:** either direction is acceptable *provided it is consistent*.

**Recommendation taken: BLOCK future dates on every "money that moved" door, at BOTH layers.**

It is not a coin flip, and the plan records why:

1. **The hub is built on the distinction.** Bills, pledges and the Scheduled lens are *money that is
   going to move*; Record is *money that has*. A future-dated actual dissolves the line, and
   **cash on hand** — the one figure a treasurer must be able to trust — would include money nobody
   has received.
2. **It is already the stated product position**, in the Fundraising help article: *"Everything you
   record here has a Date paid or Date received, and it can't be in the future."* Today that
   sentence is false on three doors.
3. **It is the smaller change.** Six of nine money-moved fields already do it; three do not.

The opposite direction would mean *removing* guards from money doors and teaching the product that
income can arrive tomorrow. That is not neutral; it is worse.

---

## 3 · The work

### P1 — One place owns the rule
`DateField` gains a **`max`** alongside its existing `min`, and a named helper expresses the rule in
words rather than as a bare date, so a reader sees the intent: money that moved cannot be dated
ahead. Every money-moved field adopts it. The point is that **the next door inherits the rule
instead of re-deciding it.**

### P2 — The three open screens close
The sponsor cheque, and both income doors, gain the cap — reaching parity with the six that already
have it.

### P3 — The sponsor door gets the RIGHT refusal, not just a block
⚖ A flat "no" is the wrong answer here, and this is the one place the plan adds design rather than
consistency. A sponsor typing a future date is almost always saying *"the cheque is coming on the
1st"* — and the product **already has the control for that**: the pledge's own **Expected by** date
(Q13, mig 269). So the refusal hands off, in the same grammar as the bill door the owner approved:

> *"That date hasn't arrived yet — a cheque you're expecting isn't recorded, it's promised. Set it
> as the pledge's expected-by date instead."*

### P4 — The server stops trusting the form
The expense/income write path gains the same future-date refusal the other three money doors
already carry, in the shared wording. This is the half that actually binds: a rule enforced only in
a form is a rule that holds until the second caller arrives.

### P5 — The help article becomes true again
The Fundraising and Ledger answers already promise this behaviour. Once P2–P4 land the promise is
kept; the sponsor hand-off (P3) needs one new sentence.

---

## 4 · Open question for the owner

**D1 — the dues credit date.** "Add a credit" on a family's dues carries a *Date* with no cap. A
credit is **not cash moving** — it is an award the team grants — so the cash-on-hand argument above
does not reach it. But its date decides which month it lands in on the reports.

- **Recommend: leave it open, and say why in the code.** A coach may legitimately date a credit
  forward ("this applies from September"), and capping it would be applying a money-moved rule to
  something that is not money moving. Consistency means *the same question answered the same way* —
  not every date field wearing the same cap.
- Ruling needed before it is touched either way. **Not built in this pass.**

---

## 5 · What this deliberately does NOT do

- **Does not cap forward-looking dates.** Expected-by, drive start/end, and installment due dates
  stay open. Capping them would be a defect, not consistency.
- **Does not sweep non-money dates** (birthdates, practice dates, schedule ranges). Different
  question, different rule.
- **Does not touch the ended session's uncommitted future-date module.** That work wired two doors
  and is mid-flight; this plan reuses whatever shared home survives rather than growing a second.

---

## 6 · Verification

- Unit coverage on the shared rule helper.
- UAT: a future-dated sponsor arrival is refused **and the refusal names the expected-by door**; a
  future-dated income entry is refused server-side; a past-dated one still saves. Run live.
- `verify:changed` green; `check:layout` on the money screens if layout moves (it should not — a
  `max` attribute changes no geometry).
- **QA rides the §122 walkthrough** (owner-directed 2026-08-30: *"simply add the QA to the 122
  walkthrough"*) rather than taking a section of its own.
