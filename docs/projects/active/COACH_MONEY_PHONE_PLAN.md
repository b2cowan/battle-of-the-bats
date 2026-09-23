# Money on a phone — implementation plan

**Hub (mockup · findings · decisions · brief):** `docs/projects/active/COACH_MONEY_PHONE_HUB.html`
· live at `https://claude.ai/artifact/BC3Vx5H4YtVA8UdPJyJZRa`
**PM brief:** `COACH_MONEY_PHONE_PM_BRIEF.md`
**Status:** M1 + M2 **RULED + BUILT on dev 2026-09-22**. Owner walk owed (ledger §226). No migration.

---

## 0 · Why this is its own project

The phone re-evaluation (`COACH_MOBILE_EXPERIENCE_PLAN.md`) measured Money at 3,019px with 136 of
495 words at 11px or smaller, and deliberately set it aside — *"a book, and not on the owner's
phone-first list — its own walk later."* Every stage since has re-listed Money under **not
reopened**. This is that walk.

It is a separate project rather than a stage on that hub because the six Money tabs have their own
shared recipes (the summary band, the list toolbar), their own vocabulary rulings, and their own
ledger section — and because that hub file is edited concurrently by other sessions.

## 1 · What the walk measured (UAT fixture, 2026-09-22, 361×844 and 390×844)

| Tab | Band @390 | Note | Toolbar | First line of content |
|---|---|---|---|---|
| Budget Plan | 326 | 122 | 148 (3 rows) | y=894 — **122px BELOW the bar at 772** |
| Budget vs. Actual | 387 | 45 | — | y=806 — **34px BELOW the bar** |
| Player Dues | 387 | — | 96 (2 rows) | inside a sticky scroller, not read |
| Fundraising | 387 | — | 44 | 123px clear |
| Club | 291 | 45 | 44 | 181px clear |
| Ledger | — | — | 179 (4 rows) | 421px clear |

**⚠⚠ THE FINDING THAT DECIDED THE SHAPE OF THE FIX.** Budget vs. Actual honours the band's own
"≤6 words" caption contract on every tile — twelve to twenty-three characters, one line each — and
its band was still **387px, the tallest of the six**. Four one-line tiles stacked one per row is
387px however short the words are. **The stacking was the defect; the captions were a second,
smaller one.** An editorial pass alone would have fixed nothing.

Three of six tabs had nonetheless grown sentence-length captions (Budget Plan 60 characters, Player
Dues 54) against a contract that says *"≤6 words: the qualifier the figure cannot carry itself.
Omitted rather than padded."*

## 2 · M1 — the band's phone form (ruled: option D + M1a "last tile")

Measured candidates, band height at 390 / 361, ✗ = a figure or label overflowed its tile:

| Tab | today | A two-up | B +figure step | **D +one-line caption** | C no caption |
|---|---|---|---|---|---|
| Budget Plan | 326 / 343 | 246 / ✗ | 211 / 228 | **176 / 176** | 134 / 134 |
| Budget vs. Actual | 387 / 387 | 194 / ✗ | 176 / 176 | **176 / 176** | 134 / 134 |
| Player Dues | 387 / 405 | 246 / ✗ | 228 / 228 | **176 / 176** | 134 / 134 |
| Fundraising | 387 / 387 | 212 / 229 | 193 / 211 | **176 / 193** | 134 / 152 |
| Club | 291 / 291 | 229 / 229 | 193 / 211 | **176 / 193** | 134 / 152 |

- **A fails and that is worth recording**, because "just make it two columns" is the idea everyone
  has first: at 361 with the desk's 24px figure, `+$8,090.02`, `$11,600.32` and `$11,491.30` all
  overflow. The figure step is what makes two-up survive, not a cosmetic choice.
- **C was refused** — S.4 is label + figure + *one line*, not label + figure.

**Built as:**

- `.moneyBand[data-tiles="2|3|4"]` → `repeat(2, minmax(0, 1fr))` at **≤760** (replacing
  `grid-template-columns: 1fr`), with `.moneyBandTile:nth-child(odd):last-child { grid-column: 1/-1 }`.
- At **≤640** only: tile padding `0.7rem 0.75rem`, figure → `var(--type-title)`.
- `MoneyTile.captionShort?: ReactNode` — the declared phone form. Rendered as two spans
  (`.moneyBandCapDesk` / `.moneyBandCapPhone`), both declared at base, CSS shows one. `display:none`
  also removes the other from the accessibility tree, so a screen reader reads one caption.

**⚠ THE OLD ARGUMENT IS NOT OVERTURNED — IT WAS MISREAD FOR A YEAR.** The Club band refused the
portal's **auto-fit** summary grid because an auto-fit row reflows 3 → 2 + 1 and orphans whichever
figure lands alone. That settled *"not auto-fit"*. It never settled *"one column"*. A **fixed**
two-column grid orphans nothing: the odd tile spans.

**M1a — the odd tile is the LAST one, by position.** On Budget Plan that lands on Closing balance,
which the panel's own comment calls the season's verdict. A tab that wants a different tile wide
reorders its roster. A `wide` flag on a component six tabs share is the drift the band exists to
prevent.

### The six captions that changed (desk form untouched on all six)

The phone box is ~**24 characters** at the support step in a two-up tile at 390 — measured, and the
threshold every one of these was cut to.

| Tile | Phone form |
|---|---|
| Total revenue | `Includes installments` (or `Installments (draft)`) |
| Total expenses | `Over your estimate · Edit` / `Your estimate · Edit` |
| Closing balance | `From $500.00 opening` |
| Dues | `13 players` |
| Collected | `$1,482.65 over the bills` |
| Balance owing | `excludes credit owed back` |

Two words were fought for. **"Over"** stays in words rather than living only in `planCapBad` red —
colour alone is not a statement, and the note that says it at length is not guaranteed to be the
status showing. **"excludes"** stays because without it "2 families in credit" reads as part *of*
Balance owing, which is the one misreading that caption exists to prevent.

**⚠ NOT DONE, DELIBERATELY: the label shortenings the drawing sketched** for Fundraising
("Credited") and Club ("Still to pay", "Waiting"). A label is a NAME; renaming one is a vocabulary
decision under the one-word-one-concept rule, not something to slip into a layout pass. Both tabs
therefore sit at 193px rather than 176 because one label wraps — and neither was ever failing.

## 3 · M2 — the toolbar's phone form (ruled; one reversal taken on the built screen)

Budget Plan's row was 148px in three lines. `Manage categories & items` measured **235px — 66 % of
a 358px row on its own** — and was the control forcing line three.

**Built as:** `deskActions`, one list, drawn two ways. Above 640 it is byte-for-byte the row it has
always been (the fold verb as a child, the vocabulary door in `actions` beside the create). At ≤640
both are rows in a 44px `⋯` `CoachToolbarMenu` with `drawerOnPhone` — the practice plan's stage-4
shape, from the identical 148px.

- **The `⋯` sits in `actions`, with the doing** — not with the lenses. Filed with the lenses it
  split the row as [lenses + ⋯] / [export + create]; in `actions` the four doing-controls lay out
  as one group.
- **`CoachKit` `.toolbar` column gap 0.75rem → 0.5rem at ≤768.** Worth 24px, and the row measured
  **363px into a 358px bar — over by five**. The controls are at the 44px floor and must not
  shrink; the air between them is what was spare.
- **Export stays on the row at every width.** It is already icon-only at 45px, and its dialog is a
  child of its own trigger, which the menu unmounts on pick — moving it would mean hoisting
  controlled open-state into a component seven Money tabs, Roster and Schedule all share, to buy
  45px.
- **The lenses stay on the row.** A lens a coach cannot see is a screen they cannot explain.

### ⚠⚠ THE REVERSAL, FOUND ON THE BUILT SCREEN AND NOT IN ANY DRAWING

`Add Line` was built as a bare lime **+** (109px → 44px) — the Schedule's phone create, and the last
65px that made this toolbar **one row**. The screenshot showed why it cannot stay: **the Money hub's
page header already collapses *Record money* to a bare lime + on a phone.** Budget Plan drew two
identical lime squares 90px apart meaning "record a payment" and "add a budget line".

Reverted; the create keeps its words. *One name, one weight* read the other way round: it forbids
one job wearing two weights, and equally forbids **two jobs wearing one glyph**. The header owns the
bare lime + on this hub.

**Cost, stated:** the toolbar is 96px (two rows — lenses above, doing below) rather than the drawn
44. Still down from 148, and Budget Plan's first line still clears the bar by 80px. **The one-row
version is available the day the header's create is re-weighted — a Money-hub header decision, not
this toolbar's.**

**Not done:** Player Dues' toolbar stays at 96px (its 308px segmented view switch is the blocker —
redesigning it is a different decision) and the Ledger's at 179px (its date range is a genuine
full-width lens). Neither tab's content was below the fold.

## 4 · Result, re-measured on the running product

| Tab | Band | Toolbar | First line of content @390 |
|---|---|---|---|
| Budget Plan | 326 → **176** | 148 → **96** | 122px below the bar → **80px above** |
| Budget vs. Actual | 387 → **176** | — | 34px below the bar → **178px above** |
| Player Dues | 387 → **176** | 96 | already clear |
| Fundraising | 387 → **193** | 44 | 123 → 318px clear |
| Club | 291 → **193** | 44 | 181 → 279px clear |

Three bands land on exactly 176px — the first time the six tabs have opened at a matching height on
a phone, which is what the shared band was built for.

## 5 · Verification

- `check:layout --only=coach-budget,coach-budget-vs-actual,coach-dues,coach-fundraisers,coach-club`
  at **361 · 390 · 768 · 1440** — **no new findings at any width**; nothing above 640 moved.
  Four stale 768 tap-floor entries no longer reproduced and were pruned (792 → 788).
- Unit **4,576 pass / 0 fail**. `money-summary-band-guard` gained **rule 6**, pinning the two-up
  grid, the spanning odd tile, the figure step and both caption forms — and each of its three CSS
  assertions was negative-tested to confirm it flips on a simulated regression.
- `check:spelling` ✓ · `check:css-selectors` ✓ (no new dead/clashing/orphaned) · `tsc` clean for
  these files · lint 0 errors.
- Probes (read-only, `.probe/`): `money-band-measure` · `money-fold-measure` · `money-band-twoup` ·
  `money-band-variants` · `money-toolbar` · `toolbar-fit`.

## 5a · `/review`, 2026-09-23 — one confirmed defect, reproduced before it was fixed

Standard tier, three lenses (correctness · blast-radius · accessibility+cascade).
**13 findings → 4 after dedup → 1 confirmed, 9 refuted.**

**⚠⚠ CONFIRMED · the phone caption printed "0 lines".** The Total expenses tile read
`0 lines · Set a total` where the desk form correctly said only *"set an estimated total"*. The desk
caption has guarded its count with `costLineCount > 0` all along; the phone form did not, and its
separator was unconditional. **Two forms of one caption have to agree about WHETHER a clause
appears, not merely how it is worded** — the one thing the whole `captionShort` idea can get wrong.
Reachable on an ordinary state: a coach who sets **player dues first** un-sets `trueEmpty`, so the
band renders with no expense line and no estimate. Fixed in **`30af1c7f`**.

**⚠ HOW IT WAS PROVEN — the method is the reusable part.** The UAT fixture cannot reach the state
(eleven lines, a $13,000 estimate) and mutating it would have written to the database. The probe
**rewrote the budget-plan API RESPONSE in the browser** (Playwright route interception:
`plan.lines` emptied, `seasonBudgetAmount` nulled, `duesScheduled` left true), so the real component
rendered the real stylesheet in a state the fixture does not hold, writing nothing anywhere. The
guard was then **temporarily reverted and the probe re-run** — it printed `0 lines · Set a total`,
making this a reproduced defect rather than a plausible reading of the source.
`.probe/zero-lines-repro.mjs`.

**⚠⚠ TWO HOLES IN THE GATE, both closed by hand.** `check:layout` runs at 361 · 390 · 768 · 1440 and
**both of this change's breakpoints fall between those widths** — the band narrows at ≤760, the
shared toolbar gap tightens at ≤768, and **nothing the sweep measures lands in 641–767.** Measured
by hand: the band at 641 / 700 / 759 (two columns, every figure and label fits, exactly one caption
form visible) and the six busiest shared toolbars at 700 / 767 (no collisions, no spill).
⚠ Pre-existing and NOT this change's: the Ledger scrolls sideways at 700px — the Money tab strip and
the register table, neither in a toolbar, and a *smaller* gap cannot cause overflow.

**⚠ AND THE RENDERED GATE WENT STALE MID-BUILD.** It was first run BEFORE the last three edits (the
toolbar gap, the "⋯" moving into the actions slot, the Add Line reversal) and was nearly reported as
green. Re-running it is what widened it to Roster and Schedule. **A gate run before the last edit is
not a gate.**

**Refuted, so they are not re-hunted:** a `captionShort`/`caption` gating mismatch (all seven tiles
checked); a control vanishing from both toolbar branches; a first-paint flash from the phone check;
tests double-matching the duplicated caption text; the gap regressing any of the ten toolbar
callers; cascade order between the 760 and 640 blocks; warm-theme collisions; the band in a narrow
container; colour as the sole signal for "over budget".

**Advisory, not fixed:** *Collapse all* in the drawer exposes no toggle state — **refuted as a
regression**, the desk button it replaced had the identical shape and `menuitemradio` would be wrong
(it is not one of a set). The odd-tile span rule would also match a one-tile band — harmless, no
caller can produce one.

## 6 · Owed

1. **Owner walk on a real phone** — ledger §226. **Still owed, and now against LIVE code.**
2. `/docs` — the Money help guide describes the toolbar it had.
3. ⚠⚠ **NOT owed: the commit.** This work was swept into **`76dbe79b`** by a peer cutting a release
   (bundled with the game-day console redraw and the handout's ghost sections) and pushed to
   `origin/master` under the 2026-09-23 promote, whose customer note reads *"Money screens fit a
   phone screen too."* **It shipped before its walk.** The review fix `30af1c7f` is a separate
   local commit, unpushed at the time of writing.

## 7 · Out of scope, stated

- **The tables**, the other half of "Money is 3,019px". Different rule (*a table whose columns fit
  stays a table*), own drawings.
- **Anything above 640px**, except the kit's ≤768 toolbar gap, which is stated above.
- **The warning notes** — they keep their words; only captions that repeated them were cut.
- **The six-tab strip** across the top of Money. The walk did not measure it as a failure.
