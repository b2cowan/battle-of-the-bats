# The register reads top to bottom — reading order, overdue, and a sticky control zone

**Status: built, revised repeatedly against the real rendered page.** Builds directly on
`COACH_MONEY_REGISTER_P3_PLAN.md` (the one dated book) — nothing here changes what the register
counts as cash, only how it's read and how much of the screen it takes to browse it. No migration;
no new table.

**Seventh round — the sticky stack itself got simpler, not just correctly measured.** Three rounds
of positioning bugs in the same stack (rows peeking through a gap, the column headers detached,
then pinned at the wrong offset) were all real, individually-fixed defects — but the pattern of
bugs was itself evidence that stacking four independent sticky layers (Money tab row, toolbar,
controls row, column headers) was fragile *by construction*, not bad luck. Raised directly rather
than patching a fourth bug in the same shape: **the Money tab row no longer pins on any tab,
including Transactions.** It's shared chrome across all seven Money tabs, and pinning it only on
one of them made the ONE piece of navigation meant to behave identically everywhere freeze on
exactly one tab and nowhere else — a bigger, more visible inconsistency than the register earning
its own toolbar for being the one tab long enough to need one. **The toolbar and the former second
controls row (item filter, "include scheduled," date range) merged into one pinned row** — two
rows of filters never needed to be two rows of sticky chrome; they wrap onto a second line on a
narrow screen the same way `.moneyFilterBar` already did, instead of needing their own measured
handoff. Cash on hand moved to sit beside Export/Add, matching the ORIGINAL ruling's own words
("next to Add") more literally than the standalone-row version ever did. Net result: **two sticky
layers now (one merged filter/action row, then the column headers), down from four** — one fewer
seam is one fewer place for this exact class of bug to recur, and one more row of the actual
ledger fits on screen without scrolling.

**Sixth round — the sticky column headers' real bug, and one that had been sitting underneath the
whole stack since round one.** The fifth round's sticky headers rendered detached, floating
mid-table; they were reverted the same day on the theory that per-`<th>` sticky inside a native
`<table>` doesn't compose reliably. That theory was wrong. The actual cause: every sticky offset
in this whole stack (tab row, toolbar, controls zone, and then the column headers on top of them)
was built from `--coach-top-strip`, a CSS variable that belongs to a *different* portal shell (the
tournament-record pages) and was never defined on a team page at all — it was silently falling
back to a guessed 48px on every load. The real shell publishes two variables for exactly this: the
fixed top strip's height, and the team masthead's own live-measured height (the masthead already
measures itself with a ResizeObserver, same pattern as this stack). Once the whole chain reads
from the right variables, both symptoms resolved together: **the team masthead no longer
overlaps the register's sticky filter row** (reported live, round six's second finding), and the
sticky column headers — rebuilt with the same per-`<th>` technique, unchanged, since it was never
the problem — pinned correctly against the tab row / filter row / controls stack.

**A second, separate bug then showed up in the same spot** — the header pinned, but at the wrong
vertical position, appearing well below where it should sit as if it were "sticking late." Root
cause: the table's own wrapper carries the shared horizontal-scroll-on-narrow-screens treatment
(`overflow-x: auto`), and CSS silently promotes the wrapper's *other* axis to scrolling too the
moment one axis isn't left at `visible` — turning the wrapper itself, not the page, into what the
sticky header measures against. The register's columns are compact and fixed-width enough now
that desktop never actually needs the horizontal scroll this was for, so the register's table
wrapper opts out of it specifically (mobile is unaffected — the header isn't even rendered there).
Zebra striping and the fixed 130px action column (round five) were unaffected by either fix and
stayed as built.

**Fourth round.** The "N rows not shown, net $X" gap message and the Today divider both came out.
In their place: a statement-style **Starting balance** line before the first visible row (the true
cumulative figure right before the date window opens) and an **Ending balance** line after the
last one — a coach reads the balance directly instead of doing arithmetic from a count and a net.
Neither renders during the Overdue audit view, which isn't a slice of the timeline and has no
"starting" or "ending" to speak of. No more Today divider either — a scheduled or overdue row
already carries its own tag, so a second cue for what day it is was redundant.

**Third round — a real defect, not a polish item.** The date range was letting every unsettled
row (overdue or future) ignore it entirely, on the theory that a coach should never lose sight of
open money. Seeing it live: a "Jul 19–Sep 17" range was showing installments from March, which
reads as the control being broken. Fixed — the range now applies uniformly to every dated row.
The safety net moved to where it belongs: the Overdue count in the filter strip is computed
before the range ever runs (so it's always the true total), and pressing it bypasses the range
entirely for that view (an audit of what's owed isn't "browsing," so the window shouldn't crop
it). An undated row is the one remaining exemption, and it isn't really about the range at all —
there's no date to compare, and undated rows already never vanish anywhere else on this screen.

**Second round of revisions, after seeing the sticky/filter fixes live:**
- Row density rebuilt for a genuine accounting-ledger feel ("fit like QuickBooks or Excel") —
  explicit smaller type and line-height on register rows specifically, not just a padding trim;
  the shared row style everywhere else in the portal is untouched.
- Auto-scroll-to-Today removed entirely — the page now opens at the very top, like any other
  list. The goal shifted from "land on recent activity" to "show as many rows as possible at
  once," which auto-scroll worked against.
- The seven type-filter pills (All/Expenses/Income/…) became one multi-select dropdown, so more
  than one kind can be chosen at once and the control fits on one line beside the date range.
  Overdue stays its own toggle, not folded into the dropdown — it's a status, not a kind.
- The budget-item picker became the same kind of multi-select dropdown, defaulting to "every
  item" instead of one at a time.

**First round of revisions (owner QA pass, same day as initial build):**
- The Overdue chip moved from its own control row into the SAME strip as the type filter chips
  (All/Expenses/Income/…) — one filter row, not two.
- "Include what's scheduled" now defaults **off**, reversing P3's original "on by default" — the
  date range does that job now, and defaulting every unpaid row into view on top of a 60-day
  window read as too much at once. Overdue rows are unaffected either way; this toggle only ever
  hides genuinely future money.
- The date-range "gap" summary no longer fragments into several near-identical messages when more
  than one overdue row is threaded through one run of hidden history — it now merges into a single
  summary, since an exempt row never closes a gap on its own.
- The sticky stack's offsets are now measured live (`ResizeObserver`) instead of estimated CSS
  constants — the estimate was wrong by enough that settled rows were visibly peeking through the
  gap between the sticky layers.

## Why this exists

Walking §46's QA fixtures surfaced three real problems, none of them arithmetic bugs — the
underlying balance math is correct and was re-verified by hand against real screenshots:

1. **The book reads newest-first, but a coach reads top-to-bottom as "what happened next."**
   Every row's own transaction actually explains the row *below* it (older), not the row above —
   which is backwards from how anyone reads a page, and reads as a bug even though the numbers are
   right.
2. **Scheduled/unsettled money is sorted into its own block right next to Today, regardless of how
   overdue it actually is.** A bill 95 days overdue currently sits shelved beside a bill due next
   week — both read as "coming up." Its true age is invisible.
3. **Everything a coach needs while browsing — filters, Add, the current tab, Cash on hand — sits
   above the table and scrolls away** the moment the season's history gets long enough to scroll,
   which it will.

## What changes

### 1. Row style (the register's rows)
- Row height drops from two lines (~76px) to one (~46px).
- The source badge ("Fundraising" / "Club" / "Player Dues" pill next to the description) is
  removed — the destination link already says where a row goes.
- The generic **Open** button becomes a destination-naming link: **Fundraising →**, **Club →**,
  **Player Dues →** — reading `REGISTER_SOURCE_LABEL` off the row.
- The secondary caption line ("Recorded on this date", "Installment #1") is dropped from the row.
- Date column is fixed-width and never wraps.
- **Unchanged:** directly-recorded rows (a plain cost, a commitment half) keep their edit door;
  only *derived* rows (dues, fundraising, club) get the destination link, per the row's existing
  `open.kind` discriminator. Category/Item still read `—` for Fundraising and Club rows — that gap
  is separately flagged (`lib/coach-money-derived.ts` exists and is wired into Budget vs. Actual
  but not into the register's row-builder) and is explicitly **not** part of this pass.

### 2. Reading order — one chronological book, oldest to newest
- The settled block stops reversing to newest-first. **Scheduled rows merge into the same list**,
  each sorted at its own true date, rather than segregating into a separate ascending block above
  Today.
- A single **Today** divider sits wherever "now" actually falls in that continuous sequence.
- On load, the book auto-scrolls so Today's divider sits just below the sticky zone (see below) —
  a coach still sees recent activity first without any scrolling, exactly as they do now; they just
  no longer land at the very top of a season's whole history.
- Cash on hand's identity is untouched: it is still the sum of every settled, non-scheduled
  movement, computed exactly as `cashOnHandCents` already does. Only *display order* changes.

### 3. Overdue money
- An unsettled row keeps its **true due date** — never moved forward to "today" or any other date.
  Whether a row is Overdue vs. Scheduled is a computed fact (due date < today), never something a
  coach declares at entry — **no separate "Add overdue" action.**
- An overdue row's Balance cell shows the balance **carried unchanged** from the row before it
  (same convention the out-of-pocket "no team cash" rows already use), labelled "not yet paid" —
  it never moves Cash on hand until it's actually settled.
- Overdue rows get their own tag, distinct from "Scheduled": **"Overdue · N days"**, using the
  existing dashed-border/italic scheduled-row treatment plus a red accent instead of the neutral
  one.

### 4. A sticky control zone (⚠ revised, seventh round — the tab row is NOT part of it)
- ⚠⚠ **SUPERSEDED, 2026-08-19.** This originally pinned the Money tab row (`CoachTabBar`) together
  with the register's own filters and column headers. Seeing it live surfaced a real cost the
  original call hadn't weighed: `CoachTabBar` is shared chrome across all seven Money tabs, and
  pinning it on Transactions alone made that ONE piece of navigation — meant to behave identically
  everywhere — freeze on exactly one tab and nowhere else. Reversed in favour of consistency with
  the other six tabs, which never pin it. The paragraphs below describe the ORIGINAL design; the
  as-built version is the "Seventh round" note at the top of this document.
- ~~The Money tab row (`CoachTabBar`, rendered by `accounting/page.tsx`), the register's own
  filter chips, the new date-range control, and the column headers all pin to the top of the
  scroll area together, directly under the fixed FieldLogicHQ strip.~~ As built: the tab row does
  not pin. The register's own toolbar (filters, item picker, "include scheduled," date range, Cash
  on hand, Export, Add — merged into ONE row, seventh round) and the column headers pin; nothing
  above the register's own content does.
- `CoachTabBar`'s `sticky?: boolean` prop (default `false`) is still real, documented infrastructure
  — shared with the Insights reports hub (`/history`) — but no page currently sets it to `true`.
  Left in place for a future screen that genuinely needs it rather than removed as dead code.
- ⚠ **The register's control row (`.panelToolbar`) is a shared class used by seven tabs' own
  toolbars.** The sticky treatment is a modifier scoped to the Transactions panel specifically (a
  wrapping element / additional class), not a change to `.panelToolbar` itself — the other six
  tabs keep their current (non-sticky) toolbar.
- The "Money" hub header (`$ Money`, the Import menu) is **not** pinned — it scrolls away as it
  does today, and so, as of the seventh round, does the tab row beneath it. Only the register's own
  toolbar and column headers become sticky.
- **Cash on hand's separate banner is removed.** It sits beside Export/Add in the toolbar's action
  cluster — "next to Add," matching this ruling's original words literally, once the seventh round
  folded it out of its own standalone controls row.
- **Overdue becomes a filter chip** (`Overdue · N`) alongside the existing All / Expenses / Income
  / Refunds / from Dues / from Fundraising / from Club strip, rather than a separate always-on
  banner pill.

### 5. Date range, defaulting to 30 days back / 30 days forward
- A new control in the sticky filter row, default **[today − 30] → [today + 30]**.
- ⚠⚠ **Unsettled rows — overdue or genuinely future — are exempt from the date range and always
  render**, regardless of how far outside the window their due date falls. The range narrows
  *routine settled history* only; it must never be the reason a coach doesn't see an open
  obligation. This reuses the existing pattern where "include what's scheduled" already sits
  outside whatever type-filter is active, rather than inventing a new mechanism.
- ⚠ **The Balance column stays visible under a narrowed date range** — this is a deliberate
  departure from the existing rule that a type filter (Expenses only, say) hides Balance. A date
  range is a window onto one unbroken timeline; every visible figure is still the true cumulative
  total, just starting mid-story. A type filter would have to fake the sum to keep a column at all,
  which is the actual reason *that* one disappears — the two are not the same kind of narrowing and
  should not share the same guard.
- When settled rows are hidden by the range, insert a short summary line at the boundary stating
  what's hidden and its net effect on the balance (so a balance jump between two visible rows is
  always explained, never mysterious), with a link to widen the range.

## Explicitly out of scope for this pass
- Fundraising/Club rows' Category/Item columns reading `—` — a real, separately-flagged gap
  (`placeDerivedActual` exists and is wired into Budget vs. Actual, not into this route).
- Any change to the FieldLogicHQ top strip, the sidebar, or the team masthead
  (`CoachTeamHeader`) — that's a distinct, portal-wide body of work, deliberately not touched here.
- Export behavior beyond what already respects the active filter — the date range narrows what's
  exported the same way a type filter already does.

## Verification
- `npm run check:register` must still pass (it already asserts the closing balance equals Cash on
  hand to the cent across all three derived sources) — this pass changes display order and
  filtering only, never the underlying arithmetic.
- `npm run typecheck` and `npm run lint:focused` on every touched file.
- Owner QA pass against the four approved mockup rounds (Claude Artifact, same URL across all
  rounds) before this is considered done.
