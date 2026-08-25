# Budget vs. Actual learns the whole income truth — implementation plan

**Status: PHASE 1 BUILT ON DEV 2026-08-23 (owner QA §83 owed) · PHASE 2 = OPTION D, and its
FIRST HALF (D-1) IS BUILT ON DEV 2026-08-23 (owner QA §85 owed; no migration) — see §2.1 for what
landed, the five build decisions and the guard rebuild. D-2 (revenue item rows + the season
opening balance) is gated on the §85 walk.**

**Phase 1 detail. Go received the same
day (owner: "agree with your recommendations", on the mockup artifact `f0598811`), which also took
the Exhibit C RULING: when cash arrives in a month outside the budgeted/spent span, the grid GROWS
the column (fold-into-edge-month and footnote-only-disclosure both rejected). Built per §1 exactly:
`lib/coach-cash-strip.ts` (+ unit tests) assembles the two Actual maps from the primitive records;
the route ungated the entries/dues reads and added the payouts read; `buildMonthGrid` gained
`cashDates`; the component reads the server maps under Actual and each lens footnotes its own
basis; `check:money-report` proves strip = register month-by-month both directions to the cent,
with fixture-honesty gates for the payout/fundraising/family-paid shapes. Help guide's Months
paragraph rewritten. Phase 2 remains gated on its own mockup session — not started.**
Origin: `BVA_MONTHLY_INCOME_BUILD_AND_PLANNING_PROMPT.md` (owner-directed mid-§80 walk).
Ruling of record: `memory/design_decisions.md` 2026-08-23 — "Money in is player dues only" is
REVERSED; the Actual-lens cash-flow strip owes the whole cash truth, proven against the register.
PM brief: `BVA_MONTHLY_INCOME_PM_BRIEF.md`.

- **Phase 1 (this plan's build): the Months view's cash-flow strip tells the whole cash truth on
  the Actual lens, with a build-blocking guard proving it equals the register.** Scope locked to
  row values + footnote — any visible shape change beyond that stops the build and goes to a
  drawing first.
- **Phase 2 (NOT this build): income in the month grid itself.** Mockups-first, owner rulings from
  drawings, then its own gated build. A go for Phase 1 is not a go for Phase 2; no grid change of
  any kind rides Phase 1.

---

## §0 · Prompt re-verified against the tree (2026-08-23, this session)

Every claim in the prompt's §0–§3 was re-read in code today. All hold. Line references below were
true at verification time.

| Prompt claim | Verified where |
|---|---|
| Strip's Money in (Actual) = dues payments only | route `budget-vs-actual/route.ts` §872–892 (`duesInActual`); component `MoneyMonthGrid.tsx` :152 |
| Strip's Money out = the grid's cost cells, all lenses | component :150–151 (`grid.totals.cells[i][lens]`) |
| "same dollar twice" footnote | component :405 |
| Report NETS `charge_to_org` into item actuals (deliberately) | route :427–433 + :468–473 (`clubRequestIsReimbursement` → `clubRefunds`) |
| Grid is money-OUT only by design | route :488–493; Phase 2's question, untouched here |
| Dues payouts reach NO figure on this report | `getRepDuesPayoutsByProgramYear` is imported by register/money-summary/dues/upcoming-payables/entries — **not** by budget-vs-actual |
| Register = the proven cash truth (`check:register`) | `register/route.ts` whole file; `scripts/check-register-balance.mjs` identity §§1–5 |
| Guard pattern licensed | `check:register` + `check:money-report` both exist in `package.json`; `check-money-report-arithmetic.mjs` already reads the BvA payload |
| mig 261 `received_date`, register honors it w/ `created_at` fallback | register :388–408 (`raw.received_date ?? orgDayKey(raw.created_at)`); sponsor realises only on `sponsor_status === 'received'` |
| Club requests settle on reviewed day | register :477–478; BvA :463 (`reviewedAt ?? createdAt`) |
| Next migration = 262; Phase 1 needs NONE | `supabase/migrations/` ends at 261. Confirmed: no schema change below |
| Money-centralization P2/P3 state | plan §8: P1 ✅ built (§80); **P2 and P3 not started** — P3 will touch the BvA toolbar (tags pill), we touch the strip + payload; different chrome, coordinate release notes |

### Four traps found TODAY that the prompt did not name (each verified in code)

1. **A family-paid-direct cost is spending but never cash.** The register marks expenses with
   `paidByPlayerId` as `movesCash: false` (register :247) and `money-summary`'s `cashPaid` has
   always excluded them. The BvA route's expense select (:113) does **not** fetch
   `paid_by_player_id` — the strip's Money out must exclude these rows or it can never equal the
   register. The query gains the column (a select-list change, not a migration).
2. **Realised fundraiser entries are only loaded when the team has funding budget lines**
   (route :333 — `fundingLines.length > 0 ? getRealisedFundraiserEntries(...) : []`). Cash arrives
   whether or not it was budgeted; the register reads entries unconditionally. The strip's read
   must be unconditional or drive/sponsor cash vanishes on any team that never budgeted funding.
   (Same class of gate on dues payments: route :532 loads them only when schedules exist — the
   register loads them unconditionally; the strip read follows the register.)
3. **The shared entries reader carries no dates at all.** `SeasonFundraiserEntry`
   (`lib/db.ts` :9230) has neither `received_date` nor `created_at` — it was built for totals; the
   register does its own dated query for exactly this reason (register :97–104). Phase 1 extends
   the shared reader's select + interface with `receivedDate` and `createdAt` (additive — no
   existing caller breaks), rather than minting a third entries query. The register's own query is
   NOT touched.
4. **The grid's month columns are derived from budget periods + cost/commitment dates only**
   (`buildMonthGrid` → `deriveMonthRange`, `lib/coach-budget-months.ts` :284–292). A month where
   cash arrived but nothing was budgeted or spent has NO column, and `buildCashFlow` iterates the
   grid's months — so that cash would silently vanish from the strip (and the guard would fail,
   correctly). The month-domain derivation must also be fed the cash dates. The range is
   contiguous (first→last), so no interior gaps; the existing truncation cap applies and the guard
   treats a truncated grid the way `check-money-report` already does (unproven → exit 2), never as
   a pass.

---

## §1 · Phase 1 — exact row-by-row cash composition (the deliverable's arithmetic)

All bucketing by **month of the org-calendar day** (`orgDayKey`/`monthKeyOf`), matching the
register's dating exactly. Gross both directions — never the report's netted cells (the report
nets `charge_to_org` refunds and money-back into item actuals; reusing those cells while adding
the same refunds to Money in double-counts them). Assembled from the primitive records the route
already holds (plus the two reads named below).

**Money in (Actual), by month — four disjoint streams (no double count is possible by
construction; the write paths refuse overlaps):**

| Stream | Record | Dated by | Read status in BvA route |
|---|---|---|---|
| Dues payments | `rep_dues_payments` | `received_date` | already loaded (`duesPayments`) — gate removed per trap 2 |
| Recorded arrivals, BOTH kinds (`income` AND `money_back` — money back is cash IN even though the report nets it) | `rep_team_money_in` | `received_date` | already loaded (`moneyInRecords`) |
| Realised drive/sponsor money, **GROSS** `amount_raised` (a rebate is a CREDIT — a family sends less dues — never cash out; gross fundraising + actual dues receipts is the identity the register already proves) | `rep_fundraiser_entries` where realised (drives always; sponsors only `received`) | `received_date ?? created_at`-day (mig 261; legacy + sponsor rows fall back, exactly as the register does — widening sponsor dating is an owner question, not a build call) | read exists but is **gated + dateless** — reader gains dates (trap 3), read becomes unconditional (trap 2) |
| Club money the org sent: approved `charge_to_org` requests | `rep_team_payment_requests` | `reviewed_at ?? created_at`-day | already loaded (`clubApprovedRequests`) |

**Money out (Actual), by month:**

| Stream | Record | Dated by | Read status |
|---|---|---|---|
| Expense payments — **excluding** rows whose expense has `paid_by_player_id` (trap 1) | commitment standings' payments | `paidDate` | already loaded (`standings`); expense select gains `paid_by_player_id` |
| Dues payouts (**the one missing read** — today absent from the strip entirely) | `rep_dues_payouts` | `paid_date` | **NEW**: `getRepDuesPayoutsByProgramYear(programYear.id)` joins an existing `Promise.all` wave — no per-open fan-out |
| Paid club allocation installments | `rep_allocation_installments` where `paid_at` | `orgDayKey(paid_at)` | already loaded (`clubSplits`) |
| Club money the team sent: approved `payment_to_org` requests | `rep_team_payment_requests` | `reviewed_at ?? created_at`-day | already loaded |

**Scheduled/Budget lenses: UNCHANGED.** In = dues installments by due month (the only income with
a schedule); out = the lens's own cells (projections are the plan's business). The footnote states
each lens honestly.

**Running balance** follows from the two maps (opening 0 — the strip is season-scoped, exactly as
the register's book is). With the guard, its trajectory finally matches Cash on hand's story; the
shortfall sentence needs no change.

**Footnote:** the "Money in is player dues only… same dollar twice" sentence RETIRES with the
ruling it explained. The Actual lens's note now states the whole-cash basis (and that a cost a
family paid direct moved no team cash); Budget/Scheduled state that dues installments are the only
income with a schedule.

### Where the arithmetic lives

The month-bucketing of primitive rows goes in a small pure helper in `lib/` (beside
`buildCashFlow` in `coach-budget-months.ts`, or a sibling module) with unit tests — the
`coach-expense-movements` lesson: a helper inside a route handler is an untestable one. The route
assembles primitive rows and calls it once; the payload gains the Actual-lens out-map (and the
in-map widens). The component's only change: under the Actual lens, read the server's two maps
instead of dues-only in + grid cells out; other lenses untouched. **One arithmetic rule
respected:** the strip is deliberately a DIFFERENT arithmetic from the report (cash-gross vs
report-net) — that is the ruling, stated in code where the two diverge; within the cash
arithmetic, the route sums once and the browser renders.

### §1.2 The guard IS the deliverable (`check:money-report` extended)

`scripts/check-money-report-arithmetic.mjs` already fetches the BvA payload; it additionally
fetches `/register` (as `check-register-balance.mjs` does) and asserts the identity:

> **For every month, the Actual strip's Money in equals the register's settled cash rows'
> `moneyIn` bucketed by that month — and Money out likewise — to the cent, both directions; and
> summed over months, each side equals the register's own season totals.**

Register side of the identity: rows with `scheduled: false` and `movesCash: true`, bucketed by
`monthKeyOf(row.date)`. That is exactly the set whose sum the register already proves equals Cash
on hand, so transitively: **the strip's running balance at the last settled month IS Cash on
hand.** The script keeps its existing conventions: fixture-honesty gates (a run whose fixture has
no payout, no drive cash, no club row proves nothing → says so, exit 2), truncated grid → the
per-month claim is unproven (exit 2), never a silent pass. Without this guard the strip and the
register WILL drift again — they already had (payouts missing, drives missing, found on the §80
walk).

### §1.3 Build steps (order of work)

1. `lib/db.ts`: `SeasonFundraiserEntry` + its select gain `receivedDate` (`received_date`) and
   `createdAt` — additive.
2. BvA route: expense select gains `paid_by_player_id`; entries + dues-payment reads become
   unconditional; `getRepDuesPayoutsByProgramYear` joins an existing wave; assemble the primitive
   cash rows.
3. `lib` helper: bucket cash rows to the two month-maps; feed cash dates into the month-domain
   derivation (`buildMonthGrid` input or its `deriveMonthRange` call); unit tests (dating
   fallbacks, family-paid exclusion, sponsor-realisation, month-domain widening, gross-not-net).
4. Payload: Actual cash maps ship beside `moneyIn`/`monthGrid` (exact field shape at build time;
   additive, nothing existing renamed).
5. Component: Actual lens reads the two server maps; footnote rewrite. **No other visible change —
   if one turns out to be wanted, STOP and draw it.**
6. Guard: extend `check-money-report-arithmetic.mjs` per §1.2; run `check:register`,
   `check:money-report`, unit tests, `verify:changed`, `check:layout` on the BvA page.
7. Aftercare (§3).

### §1.4 Exit criteria

A coach who records a drive amount or receives dues sees that month's Money in move; a payout
moves Money out; the guard is green over a fixture containing all the shapes that can fail
(payout, drive cash, club rows, family-paid cost); `check:register` / `check:money-report` / the
full unit suite stay green; the strip's shape is pixel-identical but for the numbers and the
footnote.

---

## §2 · Phase 2 — income in the month GRID (MOCKUP SESSION HELD 2026-08-23, rulings pending)

Three options drawn and priced on the Phase 1 worked season — artifact
`claude.ai/code/artifact/4a61dfc0-d6ee-49e3-80a7-70032a0f24b2`:
- **A. Income band in the treasurer's grid** — dues row + the Statement's Revenue grouping, all
  four lenses; the one wrinkle drawn honestly: money back / club reimbursements are cost
  reductions on the REPORT and arrivals in CASH, so the band ($6,290 on the fixture) and the cash
  row ($6,670) coexist with a bridging footnote (a "money back" income row was priced and advised
  against — it would break the one-grouping rule with the Statement). Largest build.
- **B. Fourth view "Cash flow"** — the register folded into months, pure cash, no netting wrinkle,
  inherits the Phase 1 guard; priced against it: a deliberate second months table ("a second
  report wearing the first's clothes" is the route's own standing warning), a fourth View button,
  no plan comparison. Medium.
- **C. Strip self-expands (RECOMMENDED)** — Actual-lens Money in/out rows grow chevrons opening
  per-source cash rows; collapsed = pixel-identical to Phase 1; no netting wrinkle, no new view,
  inherits the guard; gives up monthly plan-vs-actual for income (Statement keeps it seasonally);
  compatible with adding A later. Smallest build.
**SESSION TURN (owner, same day): a fourth shape — Option D, the FULL MERGE — now supersedes A–C
as the working proposal.** The owner's direction: Months regroups like the Statement — a REVENUE
band whose groups (Player dues · Fundraising · Sponsorships) sit at the same level as expense
categories and open to the actual families/drives/sponsors, Total revenue and Total expenses rows,
Running balance at the bottom. Drawn in the artifact on the REAL QA Money U13 season (pulled from
dev DB; reconciles with the owner's screenshot to the dollar, including the two family-paid costs
that explain his grid-vs-strip gaps). The load-bearing design call, drawn and priced: **cash in
both bands** — revenue − expenses = running balance to the cent (register-guarded), the strip's
separate cash rows dissolve into the band totals, payouts become an expense-side group, money
back/club-in become a revenue group when present, and a family-paid cost steps out to the
Statement via footnote. Priced consequence: Months' per-item Actual can differ from the
Statement's where refunds/family-paid exist (two labeled truths; Statement↔chart stays one guard,
this grid↔register the other). Coverage mapping in the artifact answers the owner's question:
D covers everything Option B's cash-flow view showed, at finer grain.
**Rulings TAKEN (owner, 2026-08-23, in-session):** D is the shape · CASH in both bands (confirmed
via the family-paid call: "we didn't pay anything — once we pay the player it shows up at that
point") · a **Net for the month** row under Total expenses whose season total equals the running
balance's ending value · the **Running balance's Total cell carries that ending value** (= Cash on
hand, always on screen) instead of an em dash · family-paid costs stay out, footnoted, until paid.
**Further rulings taken same session:** a **Net for the month** row (season total = running
balance's ending value) · the Running balance's Total cell carries the ending value (= Cash on
hand, pinned on screen) · **a season can carry an OPENING BALANCE** — first row of the summary
block, carried automatically at Start-next-season from the closing season's ending cash, editable
in Team settings → Money; ⚠ it must reach this report, the REGISTER's book, and Cash on hand in
one build item or the surfaces argue (guard covers it). Both proposed lenses are now DRAWN in the
artifact (Scheduled = forward view with dateless pledges/pending requests in the No-date column,
counted in Total but no month; Budget = the plan's own net + projected balance from the opening
balance).
**BUILD AGREED (owner, 2026-08-23: "ok, this looks good, I agree with the build")** — D as drawn,
including both lenses, the Net row, the filled running-balance Total cell, and the opening
balance. **One owner-directed pause:** the opening-balance WORKFLOW walks before it builds. The
owner's requirements, both now drawn in the artifact: a step in the Start-next-season modal —
"Carry your money forward?" (carry all, default · carry a different amount · start at $0, showing
the register's own closing figure) — and a subtle edit home, drawn as a "Season opening balance"
row in Team settings → Money beside the two dues settings already living there, with the
register's Opening-balance line linking to it. Walkthrough note: settling up happens BEFORE
rollover (a closed season's book takes no new payments — the standing warn-never-block tradeoff,
unchanged); the carried number is a handoff, corrected only via the settings row.
**Workflow walkthrough ACCEPTED (owner: "looks good") and the build is handed to a fresh session:
`BVA_OPTION_D_MERGED_MONTHS_BUILD_PROMPT.md` (written 2026-08-23) carries every ruling, the spec
artifact link, the guard-rework instructions (statement↔chart stays report-basis; the grid
re-anchors to the register), and the traps. Build order: D-1 bands + totals + Net + lenses, then
D-2 item drill-down + opening balance (migration 262-or-next).**

### §2.1 · D-1 BUILT ON DEV 2026-08-23 (owner QA **§85** — the prompt said §84, which was already
taken by the family dues statement PDF). No migration.

Built as drawn: two bands over ONE month domain, `Total revenue` / `Total expenses` closing each,
`Net for the month` and a `Running balance` whose Total cell carries the ending value. The strip's
Money in / Money out rows dissolved into the band totals. Scheduled became the forward view
(remaining dues instalments · sponsor pledges · pending club asks, dateless items in **No date
yet**), Budget gained its own net, Difference is signed so a positive figure is good news on both
bands. **QA Money U13 reconciles to the mockup to the dollar** ($8,141.69 / $5,279.00 / $2,862.69).

**Five build decisions worth their own line, each stated in code where it lives:**
1. **One builder, both bands.** `buildMonthGrid` gained an optional `budgets: CategoryEvent[]`
   stream and a caller-owned `months` domain, rather than a sibling revenue builder. A plan is not
   always a budget line — a dues instalment schedule is a plan and has no line — and that one
   honest addition is what let revenue reuse the windowing, the undated bucket, the category
   identity and the totals instead of copying four rules that have been consolidated twice.
2. **`undatedBudget: number` became `undated: MonthCell`.** The forward view gave Scheduled its own
   undated money (a pledge, a club ask); the bucket needed a field per lens. The "No date yet"
   column's appearance rule moved from *which lens* to *is there a figure*, which is the 2026-08-21
   ruling enforced on the thing it was always about.
3. **`lensCell`/`lensTotal` gained a direction.** Difference on revenue is `actual − budget`; on
   costs it stays `budget − actual`. Without it a dues shortfall prints positive and green.
4. **Pending OUTGOING club money stays out of both bands**, matching the standing decision that
   keeps club instalments off the Scheduled expense column. The register carries it; this grid does
   not, and the reason is written on the loop.
5. **The shortfall sentence learned tense.** "On this plan you go short" is a projection's sentence
   and was plainly wrong under Actual, where the money has already gone. Found by reading the coach
   demo back with the bands in place.

**The guard was rebuilt, not patched (§3 of the prompt, done deliberately).**
`check-money-report-arithmetic.mjs` now carries TWO reports answering to two authorities:
statement ↔ chart (report-basis, season total + the chart's own internal sum), and **both bands ↔
the REGISTER** — month by month, expense category by category, revenue group by group, plus
opening + net = ending = Cash on hand. `statement = grid` is **gone on purpose**: it would now fail
on every team that has ever been refunded a dollar. ⚠ **A real coverage loss is recorded in the
script's header**: the grid was the chart's only per-month partner, so the chart's monthly figures
are now guarded solely by `coach-expense-movements.test.ts`. The fixture-honesty gates gained a
**sponsor pledge** (seeded into `seed-uat-coach-fixture.mjs`) and a **pending club request**.

Green: 2,427 unit tests · typecheck · `check:money-report` with every breaking shape present ·
`check:demos` · `check:layout --only=coach-budget-vs-actual` with **no new finding** (the
`Record money` tap-floor it surfaced fails identically on Transactions and Payables — a money
centralization P1 leftover, not this build's).

**D-2 remains gated:** revenue item rows (per family / drive / sponsor) and the opening balance
(migration, `Start next season` carry step, Team settings row, register's first line, Cash on hand
— the matched pair moves together or the surfaces argue).
Standing constraints applied: mental-model principle (2026-08-21), "never a tab row where a
filter would do", do-not-worsen phones (the phone-stepper session is separate), one grouping with
the Statement. **The winning option is its own gated build with its own QA section.**

## §3 · Aftercare (same unit of work as Phase 1)

- **Help guide**: `lib/help-content/coaches.tsx` (BvA section, ~:1992) restates the retiring
  sentence verbatim — "Money in counts player dues; fundraiser rebates already credit dues…".
  Rewritten via `/docs` in the same change.
- **Demo copy**: checked this session — the coach tour's BvA step narrates the report, dues,
  sponsor story; the register step narrates cash; **neither narrates the strip**, so no sentence
  goes stale. "Should a demo moment show this?" — no new moment: the strip fix makes existing
  numbers true rather than adding a story beat. `npm run check:demos` still runs with
  `verify:changed`.
- **QA ledger**: new section **§83** (next free number) for the owner's walk.
- **TODO.md**: the existing line (currently "PROMPT WRITTEN, session not started") updates to
  point here.
- **design_decisions.md**: the 2026-08-23 entry updates from "build assigned" to built, with its
  commit anchor (status-wording rule: positive fact + anchor, never a perishable negative).
- **No migration, no DATA_DICTIONARY change** (schema untouched; mig 262 stays free).
- **Coordination**: money-centralization P2 will re-point the drive door (which then asks the
  date) and P3 will touch the BvA toolbar — both unstarted today; release notes name both
  programs if they land together.
