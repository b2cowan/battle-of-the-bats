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

### Fundraising: 4 cards → one band
Weight 900 → 700, tabular numerals on, `.04em` → `.07em` labels, the green/purple totals to primary
ink, and the two blank captions gain the sentence each figure needs ("after family credits",
"lowers their dues"). "Raised — fundraisers" → "Raised — drives" (the word the rest of the tab uses).

### D4 — Player Dues: the band arrives, **both table footers retire**
Band on BOTH views: `Assessed` · `Collected` (caption "N% of assessed") · `Balance owing` (caption
"after $X credits") · `Past due` (danger, caption "N families behind").
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
- Past-due segments take danger ink; the next-due segment is ringed.
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
3. **P3 — Fundraising.** BLOCKED on the peer session.
4. **P4 — Player Dues.** BLOCKED. Band both views + footers retire + timeline shelf + two-tone bar +
   pinned columns. The biggest phase; build it whole.
5. **P5 — the guard** (D6), plus unit coverage for the band's own rules.

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
