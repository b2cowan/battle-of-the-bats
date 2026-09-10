# More than once — a player hands money in to a drive as many times as it takes

**Status:** **BUILT 2026-09-10**, owner QA walk owed. Migration **287 applied to dev, PROD-OWED**
(registered `pending` in `supabase/migrations/MANUAL_PROD_STEPS.json`). Kickoff prompt:
`COACH_FUNDRAISER_MORE_THAN_ONCE_BUILD_PROMPT.md`.

> ⚠⚠ **§5.1's "no figure on any screen changes" WAS TRUE ONLY BECAUSE THE CONSTRAINT MADE IT TRUE,
> and the build had to widen to keep it true.** Four readers counted "how many players" by counting
> ENTRY ROWS — the board's fraction, the Fundraising list's per-drive `playerCount` (which prints as
> the money export's **Players** column), and the entries route's roster projection **and its
> sort**. Those were the same number right up until a player could hand in twice; left alone, a
> player handing in three times would have read as three players under a heading that says
> otherwise. All four now count distinct players, and the projection SUMS a player's hand-ins
> instead of serving whichever single row the amount-desc read happened to set last (which, sorted
> descending, was their SMALLEST). This is the part of the change most worth adversarial QA.
>
> Two further things found and fixed while building, neither in this plan:
> · **The remove confirm named no date** — §5 asserts it "already names one entry by amount and
>   date"; it named the amount only, so two $60 hand-ins by one player produced two identical
>   dialogs. It names the date now.
> · **The coach demo's reconcile never shifted `rep_fundraiser_entries.received_date`** — a
>   pre-existing gap, not caused by this change: the sponsor's two dated cheques have been standing
>   still since 2026-09-08 while the season they arrived in walked forward. It is the THIRD dated
>   table the reconcile forgot, which is the trigger its own header names for rethinking that list.

**Raised:** on the §157 walk (2026-09-10), at step F1, by the owner, from the Record door's
"Who raised it" list.
**Mockup of record:** artifact `94c27428` (`COACH_FUNDRAISER_MORE_THAN_ONCE_MOCKUP.html`).
**Owner QA:** ledger **§166**, walk artifact `0c968647`
(`COACH_FUNDRAISER_MORE_THAN_ONCE_WALK.html`), run order step **B22**.
**PM brief:** `COACH_FUNDRAISER_MORE_THAN_ONCE_PM_BRIEF.md`.

---

## 1 · The finding

A drive allows **several whole-team entries** and **exactly one entry per player**. The owner asked
why. There is no design reason — it is inherited, and the two halves were never compared.

Argued from the code, not the plan:

- `UNIQUE (fundraiser_id, player_id)` with `player_id NOT NULL` comes from **migration 030**, the
  original fundraisers table. It predates whole-team entries by roughly a year.
- Migration 237 made `player_id` nullable; the whole-team entry (2026-09-08, `1b06f9e7`) then landed
  in the gap that constraint leaves, because **SQL NULLs do not collide for uniqueness**. The
  `COACH_FUNDRAISING_ONE_WAY_IN_PLAN.md` note reads *"needed NO schema change"* — that was a
  statement about cost, not a ruling about how many team entries there should be. **Nobody decided
  this.**
- The POST refuses the second player entry outright:
  `"An entry already exists for this player. Use PATCH to update it."`
- `DATA_DICTIONARY.md` records the constraint and, in the same breath, that it deliberately does not
  cap a **sponsor's arrivals** — several cheques per sponsor, each its own dated arrival.

So one tab carries three shapes for one idea, and only one of them is a running total:

| Object | Money arrives | Board |
|---|---|---|
| A sponsor's cheques | many, each dated | many arrivals |
| The whole team on a drive | many, each dated | many entries |
| **A player on a drive** | **one number, overwritten** | **one row** |

**The argument the §157 walk itself makes for the team side applies unchanged to a player.** Step F3b:
*"Two hoodie tables on two weekends are two events, not one to be edited."* A player who hands in in
August and again in September is the same situation, and today the coach does the addition in their
head and overwrites a date that was correct.

### 1.1 What the coach actually hits

The Record door **hides every player who has already handed something in** — the friction that
surfaced this. On a running drive, the three players most likely to hand in again are the three
missing from the list, and the form says to go and find their row instead. Once every player has
handed in once, the list empties and the door says *"Every player already has an amount logged for
this drive."* — a Record button on an active drive with nothing left to record.

---

## 2 · What changes on screen

**A row on the drive's board becomes a PARTICIPANT, not an entry.** A player, or the whole team,
carrying their **total** for this drive. Under it, folded, each hand-in with its own date, amount and
credit.

**The exception speaks; the ordinary case is untouched.** A participant with one hand-in renders
*byte-for-byte as it does today* — date inline, Edit and Remove on the row, no chevron. A drive where
nobody handed in twice is visually identical to the drive that exists now. This is the load-bearing
constraint on the design: the fold must cost the common case nothing.

**Every player is in the "Who raised it" list, always.** The exclusion, its "N players already have
an amount logged" sentence and its every-player-logged dead end are all deleted.

**The consequence sentence gains one clause**, and only when the player already has a hand-in:
*"…and Avery Test's total for this drive becomes $576.00."*

See the mockup for the exact before/after of both surfaces.

---

## 3 · The rules

| Question | Answer |
|---|---|
| What is a board row? | A participant, carrying their total. Was a single amount; becomes a sum. |
| Under the fold? | Each hand-in, oldest first: date, amount, credit. |
| When is there a fold? | Two or more hand-ins only. |
| What does **Received** show? | The most recent hand-in's date. |
| Edit / Remove | On the hand-in. A one-hand-in row keeps them where they are today. |
| Removing the last hand-in | The participant leaves the board — same as removing an entry today. |
| Credit | Each hand-in keeps its stamped share; the row sums them. A share changed mid-drive stops rewriting history. |
| Ledger | Each hand-in is already its own ledger line. Two hand-ins are two correctly dated lines. |
| Does anything move money? | **No.** Every existing entry becomes a one-hand-in participant; no figure on any screen changes. |
| Phone | The board is already cards. Participant card carries the total and opens; hand-ins are cards under it. |

### 3.1 The facts line

`3 of 12 players logged` counts **distinct players** and is unchanged by this — the fraction was
already defined that way when team entries were added (owner ruling 2026-09-08: *a team entry is
never a player*). `plus N team entries` keeps counting **entries**, because that is what the words
say.

---

## 4 · What it costs — the honest trade

Today, recording $60 for Avery twice by mistake is **refused**. After this it succeeds, and Avery
quietly has $120.

**The proposed answer is to state the consequence, not to block the door** — the same trade this
product made when a bill lowered stopped being a collection. The new clause names the resulting total
at the moment of saving, and it appears precisely when the risk exists.

The fallback, if the owner wants a guard: a soft confirm on a **same-day, same-amount** repeat. One
extra tap on a rare shape, rather than a rule that shapes the whole board. §7 asks.

---

## 5 · Where the work lands

1. **Data** — lift the one-per-player uniqueness. A new migration; the existing rows are already
   valid under the looser rule, so there is no backfill and nothing to convert.
   ⚠ `rep_fundraiser_entries` is in `BUDGET_ITEM_REFERENCES`; leave that alone, this touches no
   budget-item link.
2. **The POST** stops refusing a second entry for a player. **The PATCH is unchanged** — editing one
   hand-in has always meant editing one row.
3. **The board** groups by participant, sums, folds. This is the bulk of the work and the part that
   needs the mockup honoured: the one-hand-in row must not change.
4. **The Record door** drops the exclusion, its hint and its dead-end empty state; the consequence
   sentence gains its clause.
5. **The delete confirms** already name one entry by amount and date — they keep working, and now
   name one hand-in rather than a player's whole contribution to the drive.
6. **Help + demo.** The fundraising article describes logging money to a drive; the coach sandbox's
   drive narration does too. Both need re-reading against this — see the demo-drift rule in
   `CLAUDE.md`, and note this surface has gone stale across three consecutive releases.

### 5.1 What must NOT change

- Any figure, on any screen, for any drive that exists today.
- The `N of M players logged` fraction's meaning.
- The whole-team entry's 0% stamp (owner ruling 2026-09-08 — storing the drive's rate on a team row
  would let the first amount correction mint a credit for a family the row does not name).
- The credit's application path. Each hand-in credits exactly as one entry credits now.

---

## 6 · Verification

- Unit: participant grouping (sums, ordering, the most-recent date, the no-fold single case), the
  fraction under multi-hand-in players, credit summing across differing stamped shares.
- A drive with: one player × 3 hand-ins; two players × 1; the team × 2; a player whose last hand-in
  is removed; a drive whose share changed between two hand-ins by one player.
- The §157 fixture (UAT Test Team, Chocolate sale) is already the right shape — Avery, Casey, Devon,
  one team entry.
- Owner QA walk, with the board at phone width.

---

## 7 · ⚖ THE THREE RULINGS — SETTLED 2026-09-10, ON THE MOCKUP

Approved on the mockup, which carried all three recommendations.

1. **The word — RULED: `entry`.** The mockup's prose says *hand-in*; it **never ships**. Screens,
   confirms, help and the demo narration all keep saying *entry* — a second word for one object is
   what the one-spelling rule exists to stop, and it is a build-enforced gate.
2. **The accidental double — RULED: the consequence sentence, not a refusal.** The form's existing
   consequence line gains one clause naming the player's resulting total, shown only when they already
   have an entry. *(Rejected alternative: a soft confirm on a same-day, same-amount repeat.)*
3. **The whole team folds too — RULED: yes.** One grammar for the board. ⚠ Accepted knowingly against
   §157 F3b, which celebrated seeing two team entries as two rows: folding them puts one click between
   the coach and that fact.

---

## 8 · Relationship to the report proposal

`COACH_BVA_THINGS_NOT_DATES_PLAN.md` arrived in the same hour and is **separate, with no dependency
either way** — a different screen, a different object, and no shared code. Sequence them however
suits; the report one is the higher priority of the two.

They share one instinct, which is why they arrived together: **a figure should open onto the things it
is made of.** This plan applies it to a player's total on a drive; that one applies it to a figure on
the report.
