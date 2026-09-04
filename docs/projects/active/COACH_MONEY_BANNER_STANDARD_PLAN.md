# The Money Banner Standard — one summary recipe for every money tab

**Status:** APPROVED 2026-09-03 (owner decisions D1–D6, below); building.
**Mockup of record:** artifact `2b5bd78b-cbc5-4c5c-b7e0-d3956121caf6` (rev 4) — true-size drawings of
every screen's before AND after, including both shelf states. Build to it exactly; departures get
called out at QA.
**PM brief:** `COACH_MONEY_BANNER_STANDARD_PM_BRIEF.md`.
**Migrations:** none — every figure is one the screen already computes.

---

## §0 The finding this exists for

Five money tabs open with a summary; they are five separate implementations of one idea. Measured
from the stylesheets, not eyeballed:

| | BvA | Club | Fundraising | Budget Plan | Player Dues |
|---|---|---|---|---|---|
| Shape | prose strip | 3 cells, one band | 4 separate cards | titled panel, 3 cols | none (foot totals) |
| Label | 11px / .08em | 11px / .07em | **12px / .04em** | 11px / .07em | — |
| Figure weight | 700 | 700 | **900** | 700 | — |
| Tabular figures | yes | yes | **no** | yes | — |

⚠ **The precedent is load-bearing.** `tests/unit/money-hierarchy-type-scale.test.ts` exists to stop
the money TABLES forking into two type scales — written after they drifted twice in one day, each
time fixed only on the half someone was looking at, its own header recording that "a comment asking
the next contributor to change both has now failed twice". The banners are the same disease one
layer up with no guard, which is what D6 answers.

⚠ **And the pattern is already ratified one level down.** List · Room · Question gives every ROOM a
"story strip of money tiles" (Billed/Paid/Left · Raised/Team keeps/Credited · Pledged/Arrived/To
come · Total/Paid/Left/Next due). This plan is mostly that rule applied upward to the tab header.

## §1 The recipe (D1 — adopted)

**One band. Three or four tiles. Never five.** Each tile is exactly:

- **Label** — `--type-label` (11px), 700, `.07em`, uppercase, `--text-tertiary`. ≤4 words.
- **Figure** — `--type-figure` (24px), 700, tabular numerals, `--text-primary`. One number.
- **Caption** — `--type-support` (12px), `--text-tertiary`, ≤6 words. Optional; omitted, never padded.

The container is ONE bordered band with 1px gutters between tiles (today's `.clubBand` treatment) —
so a summary reads as one object above the content rather than N cards competing with the bordered
table beneath it.

**Three deviations the recipe ALLOWS, and no others:**
1. **Semantic colour on a VERDICT figure** — headroom over/under, overdue, awaiting a decision.
   Never decorative: a figure that is merely a total stays in primary ink. (This is why Fundraising's
   green/purple figures go quiet — they are totals.)
2. **A tile that hides at zero**, where its absence is the good news (off-plan, past due). A row of
   4 becomes a row of 3 and the band re-fits.
3. **One note line beneath the band** — never inside it (Club's "Waiting on the club isn't yours yet").

## §2 Per-screen scope

### D2 — Budget vs. Actual: **Option A**, four tiles, off-plan self-hiding
`Headroom` (verdict colour, caption under/over budget) · `Spent` (caption "of $X planned") ·
`Off-plan` (amber, caption "nobody budgeted this", **hidden when zero**) · `Season end` (caption
"plus $Y possible", the figure keeps its deep link to Months · Scheduled).
⚠ Revises the 2026-08-26 one-row ruling only in FORM: same single row, same ~70px, figures in
columns instead of a sentence. ~25 words → ~12.

### D3 — Budget Plan: **into the standard**
Panel → band. The `Estimated`/`Scheduled` chip, the amber short-of-plan caption and BOTH doors
(`set an estimate`, `set dues`) survive inside tiles. What goes: the "THE PLAN" panel title (the tab
names it) and the inline line-counts, which move into captions.
⚠ Revises the owner-approved mockup `d37d62e3` round 3 (2026-08-13) — approved knowingly at D3.

### Club: the reference
Structurally unchanged. The trailing "out" leaves the figure (its caption already says it); label
tracking aligns; the note line stays beneath.

### Fundraising: 4 cards → one band — ✅ BUILT 2026-09-04 (QA §139 owed)
Weight 900 → 700, tabular numerals on, `.04em` → `.07em` labels, the green/blue/plum totals to
primary ink, and the two blank captions gain the sentence each figure needs ("after family credits",
"lowers their dues").

⚠ **THE TILES ARE NOT THE FOUR THIS PLAN SKETCHED, and the change was ruled 2026-09-04** (offered as
a mockup with the alternative beside it). The sketch kept `Raised — drives` and `Raised — sponsors`
as two of the four seats. Shipped instead: **Raised · Team keeps · Credited to families · Still to
come**, with the drives/sponsors split moved into Raised's caption.

Two reasons, and the second is the load-bearing one:
- the split is already stated twice by the two LISTS beneath, each under its own heading — the tab
  became two lists at List · Room · Question Phase B, after this plan was written;
- **what was stated nowhere was the money a sponsor has promised and not sent** — the only
  actionable figure on the screen. It self-hides when every promise is kept, per the standard's
  deviation-2 rule.

⚠⚠ **AND IT COULD NOT HAVE BEEN STATED, because the figure did not exist.** `rollUpFundraising`
summed `totalRaised` for sponsors whose stored `sponsor_status` was not yet `received`; that column
flips on the FIRST cheque (mig 268), so any row in that branch had received nothing and contributed
0. The tab's "· $X pledged" caption was **unreachable** — dead copy one nav level below a Money-hub
rail printing the real figure under the same word, and a part-paid sponsor's outstanding half was
reported nowhere on this tab at all. Fixed to the hub's arithmetic (`stillToCome` per sponsor) so
the two cannot disagree. **The function had no unit test; that is how the dead branch survived, and
it now has ten** (`tests/unit/coach-fundraising-rollup.test.ts`).

### D4 — Player Dues: the band arrives, **both table footers retire** — ✅ SHIPPED + QA PASSED 2026-09-03
Band on BOTH views: `Assessed` (caption "N players") · `Collected` (caption "+ $X from credits") ·
`Balance owing` (no caption) · `Past due` (danger, caption "N families", **hidden at zero**).

⚠ **THE CAPTIONS ARE NOT THE ONES THIS PLAN FIRST WROTE — and all three changes were RATIFIED by
the owner at QA §137 Part F (2026-09-03, passed with no note). They are rulings now.** The plan
proposed "N% of assessed" under Collected and "after $X credits" under Balance owing:
- **Credits moved to Collected, not Balance owing.** Balance owing sums positive ROLLING balances —
  it is *not* `assessed − collected − credits` (a family in credit does not offset a family who
  owes), so "after $X credits" would have read as an arithmetic claim the figure does not make. The
  fixture proves the gap: $11,308.30 − $2,225.00 − $2,859.63 = $6,223.67, while Balance owing is
  $7,389.32. Under Collected the same number is exactly true and also says the thing the tab needs
  said — that credits are not cash.
- **"N% of assessed" was dropped.** It is derivable from the two figures either side of it, and the
  recipe's caption rule is "the qualifier the figure cannot carry itself".
- **Assessed gained "N players"**, which nothing else on the band says.
⚠⚠ **The footers RETIRE — the figures move, they do not double.** This is what makes the change
legal against the 2026-08-14 ruling ("a number printed twice on one screen only invites the question
of why the two might disagree"). It knowingly revises the 2026-08-13 ruling that put season totals
in `<tfoot>` under the column each totals; the owner's reasoning is that five tabs opening the same
way beats per-table alignment, and that the foot of a 13-row table is below the fold.
**Do not ship the band while a footer survives.**

### D5 — the Collection schedule: timeline, in the header, on BOTH views
Today it is a COLUMN KEY (one cell per instalment) inside the By-installment view. Rebuilt as a
TIMELINE it stops belonging to one view — it describes the season's collection, equally true under
either table — so it moves into the header beside the band, on both.
- One row of segments: instalment number · a bar · its date. Fixed height at 2 or 12 terms.
- **Two-tone bar** — solid `--success` for CASH IN, a lighter `--credit` band for COVERED BY CREDITS.
  ⚠ This fixes a live defect: today the figure counts cash and the meter counts cash + credits, so a
  term covered by fundraising renders "$0.00 of $970.80" beside a half-full bar.
- Late segments are marked with a ⚠ glyph and a danger-tinted instalment number.
  ⚠ **This plan first said "past-due segments take danger ink" and that was wrong** (corrected at
  build, 2026-09-03): the bar's fill is money that ARRIVED, and inking it red colours the good news
  by the verdict of the bar around it. What is late is the EMPTY part. The glyph + tinted number is
  also the pairing the deutan rule requires — never colour alone.
- The focused segment (the one the shut summary names) takes primary ink on its number rather than a
  ring: a ring is a second shape competing with the ⚠, and the summary line already names it in words.
- A **Due next** line beneath: "Installment 4 · Oct 4 — $97.08 of $970.80 in, 9 families to go".
- Legend renders ONLY when credits actually exist.
- Phone: segments keep bars + numbers, drop per-term dates; the Due-next line does the work.

**D5b — foldable, OPEN by default, remembered per device** (the `Spending trend` shelf idiom, shipped
2026-09-02). ⚠ **The collapsed summary line IS the Due-next sentence** — shut, the shelf still answers
the question it exists for. The toggle is a real button with the 44px touch floor (the fold rule).

### D5 also — the grid's pinned zone
`Due next` and `Balance` move from the FAR RIGHT to sit beside `Player` in the pinned zone. With ten
instalments the two columns a coach acts on are currently the two pushed off the right edge.

### D6 — the guard
A build-blocking check: a money tab that draws a tab summary any other way fails. Lands LAST, after
every tab has adopted, or it fails the build on the un-migrated ones.

## §3 Build order (each phase its own commit)

⚠⚠ **CONCURRENCY, 2026-09-03:** another session holds uncommitted work in `accounting/dues/panel.tsx`
and `accounting/fundraisers/panel.tsx` (List · Room · Question Phase B/C). Phases 3 and 4 are BLOCKED
until that lands — do not edit those files concurrently; a constructed-blob stage cannot rescue two
sessions editing the same regions.

1. **P1 — the shared band + BvA.** `MoneySummaryBand` (new shared component) + its recipe CSS in
   `coaches.module.css`, and BvA adopts it (D2 Option A). A component with no consumer is untestable,
   so these land together.
2. **P2 — Club + Budget Plan.** Both files are currently clean.
3. **P3 — Fundraising.** ✅ BUILT 2026-09-04, once the §135 session released the panel. Band +
   the `sponsorPledged` correction + its first unit coverage. QA **§139** owed.
4. **P4 — Player Dues.** ✅ BUILT + **QA PASSED 2026-09-03** (§137, 22/22, all six parts, zero
   defects; the Past-due path the UAT fixture cannot reach was walked on a late team and passed). Band both views + both footers retired + the timeline
   shelf (`dues/CollectionSchedule.tsx`, new) + two-tone bar + `Due next`/`Balance` moved into the
   pinned zone. Also in the phase, because the work surfaced them:
   - `coach-dues-installments` added to `scripts/layout-screens.mjs` — **the By-installment lens had
     never been swept**, so every check on this tab was measuring one of its two bodies.
   - `.footLabel` retired (its last caller was the season footer) and `daysUntil()` deleted from
     `lib/dues-installment-view.ts` (its only caller was the retired band's caption).
   - Past-due money and the family count now come from the ONE `pastDueInstallments` predicate, so
     the band's figure and its caption cannot disagree.
5. **P5 — the guard** (D6), plus unit coverage for the band's own rules.

### P4's pin: the offsets are MEASURED, and the first attempt was wrong

⚠⚠ Worth reading before touching `.duesMatrixPin`. Three columns pin above 1024. `position: sticky`
measures `left` from the SCROLLER's edge, so column 2's offset must equal column 1's RENDERED width.
The first build declared those widths in CSS and reused the same custom properties as the offsets —
which reads as airtight and is not: `width` on a table cell is a *suggestion* to auto table layout.
Measured in a browser at 1024, an 11rem/9rem/6.5rem declaration rendered **129/120/120px**, leaving
47px and 24px windows *between* pinned columns with the scrolled instalment cells visible through
them. `table-layout: fixed` would make the widths authoritative and also make the table exactly its
container's width — which removes the overflow the pin exists for. So the browser picks the widths
and `InstallmentBreakdown` reads them back into `--dues-pin-1`/`--dues-pin-2`; the CSS is gated on
the `data-pin-ready` that write sets, and degrades to a Player-only pin until then.

⚠ The pin is **≥1024 only**, and that is a measurement rather than a taste: the trio runs ~24rem, and
on the 641px tablet band — where this grid overflows soonest — that pins ~70% of the scroller.

## §4 Verification

- `verify:changed` per phase; `typecheck` after P1 (shared component + shared stylesheet).
- `check:layout --only=` the touched screens — the band changes every money tab's first 200px, and
  the shelf toggle needs its 44px floor proven at 361/390/768.
- Unit: the band's tile rules (hide-at-zero, ≤4 tiles, caption optional) and the timeline's
  cash-vs-credit split, which is the defect P4 fixes.
- Help + demo narration re-read where a named figure moves (the dues footers especially — help
  describes "Balance owing" at the foot today).
- **Owner QA:** one checkable walk at the next free § in `OWNER_QA_LEDGER.md`, covering all five tabs
  at desktop + phone, both shelf states, a 10-instalment schedule, and a credits-covered term.

## §5 Explicitly out of scope

The Money hub's Overview cards (a different object — a hub, not a tab), the room tile strips (already
ruled by List · Room · Question), and any change to what the figures MEAN. This plan moves and
restyles figures the screens already compute; it derives nothing new.
