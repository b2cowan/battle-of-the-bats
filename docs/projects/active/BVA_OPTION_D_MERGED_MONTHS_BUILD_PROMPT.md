# Prompt — Months becomes the season's cash statement (Option D build: bands, Net, opening balance)

**Written 2026-08-23 by the BvA income planning session, at the owner's direction, with every
ruling taken. Open this in a fresh session. The owner approved the build with** *"ok, this looks
good, I agree with the build"* **on the mockups, then walked and accepted the opening-balance
workflow. Nothing below is open for re-litigation; re-verify code facts, not decisions.**

⚠ Re-verify every code claim against the tree — this repo's plans have been wrong before. You
share `dev` and one working copy with concurrent sessions (AGENCY_RULES concurrent-work safety:
explicit pathspecs, re-check branch, expect foreign hunks in TODO/ledger/help files — the
2026-08-23 sessions separated hunks via save/reset/re-apply/restore; do the same if needed).

**Read first, in order:**
1. `docs/projects/active/BVA_MONTHLY_INCOME_PLAN.md` — the whole project record; §2 holds the
   D-session rulings ledger.
2. **The mockups ARE the spec** (rulings stamped in place):
   `claude.ai/code/artifact/4a61dfc0-d6ee-49e3-80a7-70032a0f24b2` — Option D panel (drawn on the
   REAL QA Money U13 season, reconciled to the dollar), the Scheduled forward-view and Budget-net
   panels, the opening-balance modal step and settings row. A picture owes FUNCTIONALITY, not
   pixels (owner 2026-08-21).
3. `lib/coach-cash-strip.ts` + its unit tests — Phase 1's cash arithmetic (commit `b3ba1f5c`),
   which this build GROWS into the bands. Its header carries the register-contract rules.
4. `scripts/check-money-report-arithmetic.mjs` — the five claims as they stand; §3 below reworks
   them deliberately.
5. `app/api/coaches/[orgSlug]/teams/[teamId]/register/route.ts` — the register is the cash
   contract for every figure in the two bands.
6. `components/coaches/StartNextSeasonModal.tsx` (the carry step's home),
   `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` money group (the edit row's home,
   beside `DuesMoneySettingRows`).

## §0 · The rulings, all TAKEN 2026-08-23 (owner; binding)

1. **The Months view becomes the season's cash statement — Option D.** Two bands in the
   Statement's vocabulary: **REVENUE** groups at category level — Player dues · Fundraising ·
   Sponsorships · Other income · Money back & reimbursements (when present) — each opening to
   ITEM level (the actual families / drives / sponsors / records); **EXPENSES** = the existing
   categories → items, plus a **Paid back to families** group (dues payouts). `Total revenue` and
   `Total expenses` rows close each band.
2. **CASH in both bands.** Gross both directions, register dating rules, family-paid-direct costs
   EXCLUDED (owner: "we didn't pay anything — once we pay the player it shows up at that point").
   Consequence the owner accepted: a per-item Actual on Months can differ from the Statement's
   where a refund or family-paid cost exists — two labeled truths (see §3 guard rework).
3. **`Net for the month` row** under Total expenses (revenue − expenses). Its Total = the season
   net = the running balance's ending value.
4. **Running balance's Total cell carries the ENDING value** (= Cash on hand, pinned always on
   screen), not an em dash.
5. **Scheduled lens = the season's forward view** (drawn): remaining dues installments by due
   month · sponsor pledges · pending club requests as scheduled revenue; commitments still owed as
   scheduled expenses. Dateless items (pledges, pending requests) sit in the **No date yet**
   column — in the Total, in no month. Mirrors the register's forward view exactly.
6. **Budget lens gets the Net + running rows too** (drawn): the plan's revenue phasing (funding
   lines + dues installments due) minus its cost phasing, projected from the opening balance.
7. **Opening balance** (drawn, workflow walked and accepted):
   - Born in **Start next season**: a "Carry your money forward?" step — carry all (default,
     showing the register's closing figure) · carry a different amount · start at $0. Sits after
     the existing warnings step; unsettled money still WARNS, never blocks; the modal says
     settling up happens BEFORE rollover (a closed season's book takes no new payments).
   - Corrected in **Team settings → Money**: "Season opening balance" row beside the dues
     settings — provenance line ("Carried from the <season> when this one was started"),
     consequence sentence, money-write capability only. Serves mid-stream first seasons too.
   - Read in three places, all read-only: the register's FIRST line ("Opening balance — carried
     from the <season>", linking to the settings row), the Months summary block's first row, and
     inside Cash on hand. **Hidden everywhere when zero and never carried.**
   - A **handoff, not a live link**: nothing reaches back to change it after the carry; the
     settings row is the only correction path.
8. **Dues item rows show family names** — same audience as the Player Dues tab (`canViewMoney`).
9. The strip's separate Money in / Money out rows **dissolve** — the band totals ARE those rows.
   `buildCashFlow` survives for Net/Running; the footnote basis-sentences survive per lens.

## §1 · Build phase D-1 — bands, totals, Net, lenses (its own gate is ALREADY GIVEN; QA §84)

- **Feeds exist.** The route already loads every primitive (Phase 1 ungated them): dues payments
  + payouts, money-in both kinds, realised entries WITH dates, club splits/requests, standings
  payments, `paid_by_player_id`. The bands are `buildActualCashStrip`'s streams KEYED one level
  deeper (per player / per drive / per sponsor / per record / per item) — grow the lib helper's
  output from two maps to grouped rows; keep its dating/inclusion rules byte-identical (its unit
  tests pin them; extend, don't rewrite).
- **Grid assembly:** revenue groups render with the same collapse/expand, pinned-column, windowed
  months, `Total` column machinery as expense categories — one row machinery, never a parallel
  copy. Expense Actual cells change basis to cash (standings payments by paid day, family-paid
  excluded, refunds NO LONGER NETTED into cells — they move to the Money-back revenue group).
  Budget/Scheduled cell arithmetic for expenses is UNCHANGED.
- **Lenses for revenue rows:** Budget = funding-line phasing + dues installments by due month;
  Scheduled = §0.5's forward view; Actual = cash; Difference = plan − cash for elapsed months,
  with the Statement's up/down wording (sign flips vs costs — "came in ahead/short", never
  "over/under budget").
- **Difference lens:** summary rows (Net/Running) stay hidden under Difference, as the strip is
  today.
- ⚠ **The shortfall sentence** now reads the lens's running row — verify it still fires (Budget
  and Scheduled lenses are exactly where it earns its keep).
- ⚠ **Phones:** rows grow, columns don't. Do not touch the phone-table reflow (separate sequenced
  session, TODO's phone-money-list item).
- **Exports:** the Months export learns the bands (same columns discipline). Check
  `lib/coach-money-exports.ts` + export catalog.

## §2 · Build phase D-2 — item drill-down + opening balance (gated: offer §84 walk after D-1
first; the owner may take both in one walk — ask)

- Item rows: per-family dues (names per §0.8), per-drive, per-sponsor, per-record; elide nothing —
  the mockup's "⋯ 10 more families" was drawing economy, not a spec.
- **Opening balance needs migration 262** (`rep_program_years` — one nullable numeric + a
  carried-from marker; check the next free number first, concurrent sessions mint migrations).
  Schema change ⇒ DATA_DICTIONARY + `refresh:snapshots` same unit of work.
- Rollover write: the carry step writes the new season's opening balance atomically with the
  rollover (the closing figure computed server-side from the register's own arithmetic — never
  trust the client's display number).
- Register: opening line first in the book, balance accumulation starts from it,
  `projectedBalance` follows; `check:register` §§1–2 must fold it in. Money-summary's `onHand`
  gains the same addend — **the matched pair moves together or the identity screams.**
- Team settings row per §0.7; the register line links to it.

## §3 · The guard rework — deliberate, not collateral (the most careful edit in this build)

`check-money-report-arithmetic.mjs` claims today: (1) statement's own totals agree · (2)
statement = grid = chart season totals · (3) month-by-month · (4) category-by-category ·
(5) strip = register by month. **After D, the grid's Actual is CASH, so claims 2–4 must split:**
- statement ↔ chart stay one identity (both report-basis) — keep.
- grid ↔ REGISTER becomes the grid's anchor: every band cell, summed per month and per
  category/group, equals the register's settled cash rows bucketed the same way (register rows
  carry category names and source kinds — the mapping exists). Claim 5 generalises into this.
- Net/Running/opening: opening + Σnet = ending = cashOnHand.
- Keep the fixture-honesty gates and ADD: a sponsor pledge + a pending club request (Scheduled
  forward view can't be proven without them — seed if missing).
⚠ Write the header's what-this-does-NOT-prove note in the same spirit as the existing one: the
grid agreeing with the register does not prove either dates a movement correctly —
`coach-cash-strip`'s and `coach-expense-movements`' unit tests own the roots.

## §4 · Traps (verified this session)

1. **The QA Money U13 lab team reconciles to the dollar** against the D mockup — use it as your
   first live check (org `qa-money-lab`; its $599/$61 family-paid costs and pending $450 request
   are the exact edge shapes). `check:layout` renders BvA; the modal steps are sweep-invisible —
   owner QA covers them.
2. **Money-centralization P2/P3 are unstarted** (verify) and own adjacent chrome (tags pill on
   this panel's toolbar; door re-pointing). Coordinate, don't collide.
3. **Dues "collected" figure** (capped per player) is a DIFFERENT number than the dues band's cash
   sum (uncapped receipts) — do not unify them; the cap rule is owner-ruled for Collections.
4. Sponsor dating is recording-day (no received-date writer for sponsors yet) — matches register;
   widening it is an owner question, not a build call.
5. **Help + demos aftercare** (CLAUDE.md): the coaches help guide's Months section was rewritten
   for Phase 1 — it changes AGAIN here (bands, Net, opening balance); the coach demo tour
   narrates BvA (step 4) and the seeded world must render the bands sensibly — re-read both, and
   `check:demos` must stay green. QA ledger section (§84 — verify next free number), TODO line
   update, design_decisions built-stamp.
6. **2,379+ unit tests, typecheck, `verify:changed`** (schema-parity fails on pre-existing
   cross-session drift — not yours unless you migrated, in which case snapshots first).
7. **No commit without the owner's explicit OK.** Product-owner voice in every summary.
