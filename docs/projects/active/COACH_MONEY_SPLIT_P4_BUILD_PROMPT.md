# Kickoff prompt — Money redesign Phase 4: the Club tab

*(paste into a fresh chat)*

**Phase 4 of the Money screens redesign, and ONLY Phase 4.** This is the last phase: *Allocations*
and *Payments* merge into one tab telling the story of where the team stands with the club.
P1 (`b3d9694b`), P2 (`91d1c2c8`) and P3 (`ddb85f42`) are on dev and are what you are building on.

---

## ⛔ THE FIRST DELIVERABLE IS A MOCKUP, NOT CODE

**`COACH_MONEY_TAB_REDESIGN_PLAN.md` §5 and §10 P4 both gate this phase on an owner mockup session,
and the plan's §0 leaves the tab's NAME open specifically to be settled there.** Two tabs becoming
one is the only change in this whole redesign the owner has not seen the shape of.

So: **read everything below, then produce the mockup and stop.** Publish it as a Claude Artifact
(that is the standing rule for every mockup in this repo — never a file, never inline). It must show:

1. **The merged screen** — billed, asked, settled, in one read. What is the top-level shape: one list,
   two stacked sections, a view control?
2. **⚖ The name.** **Club** (warm, what coaches say) vs **Org** (what the product's own badges
   already say — "From Org"). §6 records both; the mockup pass decides.
3. **The two workflows intact inside it** — paying an allocation, and making / editing / withdrawing
   a request. §35's recent work on those carries in **whole**; this merge moves doors, not rules.
4. **Where a pending request lives.** It appears **only here** — never on the register, never in the
   plan. Show what it looks like beside money that has actually moved.
5. **The empty state** on a team with no club money at all.

Get the ruling, record it in the plan's §0, **then** build. Do not build the mockup's first draft.

---

## Read first, in this order

1. **`COACH_MONEY_TAB_REDESIGN_PLAN.md`** — §5 (the merge) in full, §0 (what is ruled, what is open),
   §6 (the names, and what was rejected), §9 (section ids, redirects, exports, demos), §10 P1–P3
   (what shipped, and the decisions each took that you inherit — P3's entry is long and most of it
   applies to you).
2. **`COACH_MONEY_REGISTER_P3_PLAN.md`** — §1.1's row table and §3. The register already shows club
   rows, and they link into the two tabs you are about to merge.
3. **`OWNER_QA_LEDGER.md` §35** (the club screens as they stand today), then **§38, §41, §43 and
   §46**. See the warning below about all five.

---

## ⚠⚠ Verify before building

- **NOTHING IN THE MONEY AREA HAS BEEN OWNER-QA'd YET.** §38, §41, §43 and §46 are *all* owed, and
  the owner is deliberately walking them **together, once, when this project is done** (owner,
  2026-08-17). You are therefore building the fourth storey on three unwalked ones. **Argue from what
  the code does, never from what a ledger section says the screen does** — those sections describe
  intent that has not yet been confirmed by a human.
- **Confirm what the code does before trusting any summary of it.** The plan has been wrong about
  this codebase repeatedly, including in ways that would have built the opposite of a standing ruling.
- ⚠⚠ **A PARALLEL SESSION SHARES THIS WORKING COPY.** `COACH_BUDGET_ITEM_INTEGRITY_PLAN.md` is in
  flight and has uncommitted work in it. Sessions have committed each other's in-flight changes
  **three times in three days** — most recently a TODO.md line. Re-check the branch is `dev`, stage
  **explicit pathspecs only** (⚠ bracket directories like `[teamId]` need `:(literal)` or they stage
  nothing), and run `git show --stat HEAD` after every commit. Expect files you never touched to be
  modified.
- ⚠ **Migrations 236–249 are dev-only** and the owner promotes when they are ready. `verify:changed`
  fails on that schema-parity gap — run the checks after that gate directly. **If P4 needs a
  migration, it joins a queue that is already twelve deep; say so out loud rather than adding to it
  quietly.**

---

## What Phase 4 builds

### 1 · One tab, one relationship

Two tabs today — **Allocations** (what the club bills the team) and **Payments** (what the team asks
of the club) — are two halves of one relationship. Merged into **one tab telling where the team
stands with the club**: billed, asked, settled.

This retires the *Payments → Requests* rename question entirely (§6): the tab it would have renamed
no longer exists.

### 2 · The hub bar lands on its end state

**Overview · Budget Plan · Player Dues · Fundraising · Transactions · Payables · Club ·
Budget vs. Actual** — **8 tabs org-linked, 7 standalone** (the club tab exists only org-linked,
exactly as the two it replaces do today). That count is the whole point of the split: P1 added a tab,
P4 gives it back.

### 3 · ⚠⚠ The register's club rows must follow the merge — this is the real dependency

P3 put club money on the dated book. Two kinds of row link **into the tabs you are deleting**:

- a **settled allocation instalment** → the allocations tab;
- an **approved club request** → the payments tab.

Both carry a "Club" chip and an **Open** button. **When the two sections become one, those links must
point at it**, and the register's **from Club** filter must still mean what it says. There is also a
deep link from the Overview's next-30-days window into the register filtered to club money.

⚠ **`npm run check:register` is your proof that you did not break the money.** It reads the register
and Cash on hand for one team and fails if they disagree by a cent. Run it before and after.

### 4 · What the merge must NOT change

- ⛔ **A pending request appears only on this tab.** Never on the register — not even as a
  projection — and never in the plan. It is money the club may still decline.
- **An approved request is settled** on the day it was decided, and is already on the register and in
  the season close-out pot as of P3 + migration 247.
- **§35's rules carry in whole**: the empty states, the request records, pencil-while-pending, and the
  approve/withdraw race fixes. Moving a door does not re-open a decision.
- **Nothing here ever changes a payment schedule.**

### 5 · ⚠ Two open questions P3 handed you deliberately

- **Does the merged tab show this season only?** Migration 247 gave club requests a season, and every
  *cash figure* now reads it. **The request LIST was deliberately left team-lifetime** so that a
  pending request raised last season could not silently vanish from the coach's view. That was a
  holding decision for P3; the merged tab is where it gets decided properly. Whatever you choose,
  a coach must never lose sight of a request that is still awaiting an answer.
- **Between seasons, the request form is still offered and the server now refuses it.** That screen's
  write gate has never known about finished seasons; before migration 247 the save *succeeded* and
  made a record belonging to no season, so today's refusal is a safer outcome with a worse message.
  **P4 owns gating it properly** — see Owner QA §46 §I.

### 6 · ⚠⚠ The demo seed, or the merge demos worse than what it replaces

**The coach sandbox seeds NO allocations and NO requests**, so the merged Club tab would open **empty**
in the shop window — on a tab whose whole job is to show a relationship. §9 flags this and P4 owns it:
**seed club money into the demo world**, and then ask CLAUDE.md's two demo questions out loud —
*should a demo moment show this?* and *are the demo's existing sentences about this screen still
true?* The coach tour is eight steps now; step 5 walks the register and mentions club money on the
book.

---

## 🔒 Constraints (plan §8 — none open)

A pending request never enters the plan or the register · one row, one source · never both · the
register shows no variance and the report carries no row labels · working season only, no `?year=`
anywhere (`coach-history-endpoint-guard` is the contract) · money back ≠ paid out of pocket · nothing
changes a dues schedule · sport-neutral vocabulary · nothing on a saved record is read-only.

---

## ⚠ What P1–P3 leave you

- **`formMode` resolves `settle | edit | add` once** — read it, never re-test `settling`/`editing`.
- **The discard guard compares against what the form OPENED with.** Any new opener must set it.
- **The consequence line covers every form state.** Any new door must not bypass it.
- ⚠⚠ **Bump the money revision BEFORE reloading, never after.** The two money faces share a read
  cache keyed per revision; a reload that runs first replays the answers the save just made wrong.
  There is one `refreshAfterWrite` wrapper for exactly this reason — use it, do not re-derive it.
- ⚠⚠ **Every reload carries a request sequence and discards stale responses.** `/review` found that
  nothing decided which of two overlapping refreshes won, and a coach could watch a payment they had
  just made revert on screen. If you add a load, stamp it — the guard goes after every body is READ
  and before anything is WRITTEN.
- **Cash on hand and the register are ONE arithmetic** (`cashOnHandCents`). A money source added to
  one and not the other is a missing argument now, not a silent drift. **The season close-out pot is
  a third, separate arithmetic that takes the same figures** — if you touch what club money means, it
  is the third place to change.
- **`clubMoneyUncounted` is gone**, along with the caveat it printed on the close-out card. Do not
  reinstate a warning for a gap that no longer exists.

---

## Done means

- `npm run check:layout --only=coach-transactions,coach-payables,coach-budget` **plus the club
  screen(s)**. ⚠ **Run one screen you did NOT touch first** (`--only=coach-roster`): the portal's
  notification badge produces 6 findings on every screen and two phases have now lost time reporting
  them as new. Do not re-baseline them. ⚠ **Two screens becoming one is a deliberate baseline edit** —
  the same shape P1 made when one screen became two.
- `npm run check:register` — the balance must still equal Cash on hand, on a team with club money.
- **A fixture walk on `qa-money-lab`**, plus the demo world once its club money is seeded. ⚠ **A green
  walk over a thin fixture proves nothing** — create what you need.
- `verify:changed` and `typecheck`.
- `/docs` for the help guide (the org-money topic merges), then re-read the demo tour and moments copy,
  then `npm run check:demos`.
- Offer `/simplify`, then `/review`, before handing off. **P1's review found a Critical; P2's found
  another plus two pre-existing security holes; P3's found five defects including one that reverted a
  payment on screen.** Every pass so far has produced a real defect — budget for it.
- A **new Owner QA Ledger section** (annotate §35 and §46 where they name the two old tabs; never
  renumber), the plan's §10 P4 line, the PM brief and `TODO.md` per the anti-drift rule — positive
  facts with anchors.
- ⚠ **The owner walks §38, §41, §43, §46 and yours together when P4 lands.** Write your section
  knowing it is the last one before that walk, and that a defect in an earlier phase surfaces during
  it — leave the reader a clear order to walk in.

## ⚖ Disagree out loud, before the work

If the ruled design is wrong, say so **before** building it, arguing from what the code does rather
than what the plan claims. Every phase has produced a better outcome that way: P1 kept the arrivals
list's name against the plan's own §6; P2's "the item list follows the pill" turned out to be
unbuildable as written and the owner re-ruled it into a migration; **P3 found that the register's
build-blocking test was unpassable because Cash on hand itself was wrong three ways, and the owner
widened the phase to fix the figure and the season close-out pot with it.** Re-frame the question if
it is the wrong one. Widen it if the evidence is wider than the ask. Do not manufacture disagreement.
