# Build prompt — Pass 3: the refund sheet derives (paste into a fresh chat)

Passes 1 and 2 are built, reviewed and committed. The design is ruled and the mockups are
binding. **Do not re-open the model.** Your job is the last pass: the season-end settlement sheet
that both previous passes were built for.

**Plan (authoritative):** `docs/projects/active/COACH_SEASON_REFUND_REVAMP_PLAN.md` — §4 (the
arithmetic), §6 Pass 3 (the scope), §10 (demos/help/archive), §11 (traps). Its Pass 1 and Pass 2
build logs tell you what already exists; do not re-derive any of it.
**PM brief:** `..._PM_BRIEF.md`
**Binding mockups:** `claude.ai/code/artifact/eae663d0-56e5-46e9-a2e2-9f7220468be2`
(source `COACH_CREDIT_APPLICATION_MOCKUP.html` — §7 and §8 are Pass 3; the mockups ARE the spec,
including elements tagged UNCHANGED)

---

## Before anything: the blocker check

Passes 1 and 2 are committed (`8fb37066`, `cfb3a5f7`) — **verify with `git log` and `git status`
rather than trusting this line.** This repo's working copy is shared by concurrent agents:

- Confirm you are on `dev`. If not, switch before doing anything.
- If the tree is dirty with someone else's work, that is normal — **stage explicit pathspecs
  only**, never `git add -A`, and after every commit run `git show --stat HEAD` and confirm only
  your files landed. This has already gone wrong once in this project: a help session's in-flight
  edits were swept into a commit, caught by that stat check, unwound, and re-committed clean.
- Bracketed directories need `:(literal)` or they stage nothing.
- **No commit or push without explicit per-action OK from the owner.**

---

## The model, in one sentence

**A credit is money the team owes a family**, settled exactly one of three ways — it lowers their
remaining bills, it is paid out in cash, or it is handed back at season's end — and

```
credits issued = applied to bills + paid out + owed back
```

holds for every player, in every mode, at all times. That identity is already built and pinned by
a 500-run property test. Pass 3 consumes it; it does not reinvent it.

The distribution rule, ruled by the owner (2026-08-14), stated once:

> Owed-back money is paid to whoever earned it. Amounts already settled — forgiven, or handed
> over — count as that family's share, already received. Whatever is left divides evenly among the
> families still taking one.

Debt joining the pot, a departed player stepping out, forgiveness, and hand-set amounts are all
that one sentence. It is why the sheet can always show its work and always balance.

---

## What already exists (use it; do not rebuild it)

- **The credit engine** owns all credit arithmetic: application to bills, the three states, the
  payout ceiling, and the per-player derivation every reader goes through. There is **one shared
  assembly** that fetches nothing and derives a player's whole position. Every money reader in the
  portal already goes through it. **Pass 3 must too** — a hand-assembled derivation in the refund
  route is the exact regrowth Passes 1 and 2 each had to kill.
- **Payments are facts, payouts are facts.** Both have receipt lists, ledger lines dated the day
  the money moved, and removals that void rather than erase.
- **The outbox exists.** The Pay out sheet is built and works from a player's record. Pass 3's
  per-row and bulk "Pay out" must **reuse that sheet**, pre-filled — not a second payout path.
- **Forgiveness is a credit type.** It lowers bills, is never owed back, and can never be paid
  out. Everything downstream already respects that.
- **Out-of-pocket expenses** create a reimbursement credit, count in the budget, and move no cash.

---

## What Pass 3 builds

Plan §6 Pass 3 is the scope. In the owner's terms:

1. **Delete** the Calculate button, the typed pot, and the current collapsible body.
2. **The derived pot card**, showing its work (plan §4.3), with the hold-back control.
3. **The settlement table** — Player · Owed back · Even share · Refund — where a row **opens** to
   its own breakdown, families are grouped so siblings are paid once, and **every row is payable**
   from there (the existing Pay out sheet, pre-filled), plus a bulk "Pay all".
4. **The row menu**: an even share / a set amount / no share / forgive balance owing.
5. **The shortfall state** (say it, share nothing, pro-rate nothing) and **the cash-timing strip**
   (§4.5 — a forward-looking split spends money that has not arrived; the sheet says whose).
6. **It renders whenever any family is owed anything** — not gated on season end. In October the
   share column is simply empty and the section reads "the team is holding $675 of families' money."

**Definition of done:** no typed input anywhere; rows always re-add to the pot; every number
explicable by opening one row.

---

## ⚠ The two verified findings that moved every number — do not re-introduce them

**1. The fundraiser flow posts the FULL amount raised to the team's books.** The player's rebate is
a credit, not a deduction from income. So the **$1,575** figure that circulated for the review team
had rebates removed *once already* — and the old calculator subtracted all credits *again*.

```
Dues received (UNCAPPED)   $6,050.00
Fundraising raised         $2,500.00
Spent                     −$6,350.00
                          ──────────
Cash the team holds        $2,200.00
Owed to families            −$675.00
                          ──────────
Surplus to share           $1,525.00     ÷ 10 = $152.50 each   ← NOT $90
```

**2. The pot must read UNCAPPED receipts.** The Collected tile caps dues at each schedule total so
an overpayment isn't double-counted in a *balance*. For the **pot** that cap is wrong — the money
physically arrived and the team holds it.

---

## ⚠ Traps, including five learned the hard way in Passes 1 and 2

1. **Per-player and the total must be ONE operation.** The Pass 2 review found the existing refund
   route clamping each row at zero while building its total from unclamped figures — so one
   family's over-payout silently cancelled another family's real credit inside the shared pool.
   The per-player figure is the definition; the total is its sum. Pass 3 replaces this code — do
   not inherit the shape.
2. **Money already handed back is not still owed**, and **forgiveness was never owed**. Both are
   already excluded by the shared helpers. Use them rather than summing credits by hand — a guard
   test fails the build on hand-rolled credit sums.
3. **The refund screen is ALREADY an archive door.** No allow-list gains an entry — but an
   archived season must render the **record** with **no payout controls, no hold-back, no row
   menu**, and every write route resolves the ACTIVE year only.
4. **Money panels stay mounted** — any modal takes the caller's `tabActive` or its unsaved-changes
   guard hijacks clicks app-wide (paid for twice already).
5. **Negative money stays red; "still owes" is amber, not danger. Never colour alone** (the
   olive↔danger ΔE 1.0 deutan finding stands).
6. **Timezone:** "the day money left" is an org-timezone date.
7. **`check:layout` must run on a restarted server against a fixture with REAL DATA.** A green
   sweep over an empty Money screen proves nothing — this bit the project twice. An abort on the
   memory floor is a **failure**, not a pass; the exit code seen through a pipe is `tail`'s.
8. **Migration ⇒ dictionary + snapshot refresh in the SAME unit of work.**
9. **A seeder applies no deltas.** Marking one player inactive shifted every roster index on the
   second run and quietly deactivated two others before crashing. Assert the world both ways so a
   half-finished run repairs itself.

---

## The review world (dev)

Org `qa-money-lab`, head coach `qa-money-head@dev.local` / `devpass123`. Re-seed:
`node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`

- **QA Season End U15** — Pass 3's subject. Ten players, dues settled, one $50 overpayment,
  credits $675, budget $7,000 with $6,350 spent. Every family paid **before** the drive closed, so
  every credit dollar is owed back. The numbers above are this team's.
- **QA Mid Season U14** — the drive closed mid-season: applied credits, a forgiven balance, a
  departed player, a part-paid family, a half-paid-out rebate, and an out-of-pocket expense. Use it
  to prove the sheet is honest **before** season end.

Owner QA for the two built passes is ledger **§19** and **§20** — read them to see the standard
the §21 you write must meet.

---

## ⚠ The demo obligation comes due in this pass

The coach sandbox has **no fundraiser at all**, so it cannot show any of this — deliberately
deferred to Pass 3 so the demo world is re-seeded and re-narrated **once**. That deferral is now
payable. It means:

- a seeded fundraiser and credit whose dates shift with the nightly re-anchor (a stamp is only a
  projection — unshifted money strands the demo a re-anchor behind its books);
- a `check-demo-coach` pin so the story cannot rot silently;
- and a tour/dock sentence, because **fundraising lowering a family's bill is the most sympathetic
  thing this product does** and the demo currently never shows it.

⚠ The demo's pinned story is **$240 overdue across exactly two families** — do not break it. The
part-paid family was deliberately put on a *future* instalment for this reason.

`check:demos` catches breakage, never absence. Read the demo's own sentences against the new
screens and say plainly what you changed.

---

## Process

1. **PM UX summary in the conversation first** (AGENCY_RULES, blocking) before any code.
2. Build, then per pass: `/simplify` → `/review` → `/docs`. The Money guide will need the
   settlement sheet; the refund section it describes today is about to stop existing.
3. Gates: `npx next typegen` then typecheck · full unit suite · `verify:changed` · **rendered**
   `check:layout` on a restarted server against real data · `check:demos`.
4. Owner QA: add **§21** to `OWNER_QA_LEDGER.md`, and update the at-a-glance row.
5. Record the outcome in the plan's Pass 3 build log and in `TODO.md` — **positive facts with
   anchors** ("committed `<hash>` <date>"), never perishable negatives.

⚠ **Migrations 230–234 are all dev-only.** Anything Pass 3 adds joins that queue, and every one of
them must reach production before this code ships.

## House rules (AGENCY_RULES.md is binding)

Branch `dev` only. **No commit/push without explicit per-action OK.** Explicit pathspecs; verify
after every commit. Product-owner voice in replies — what the coach sees and does differently —
with technical detail kept to the plan, the commit and the code.
