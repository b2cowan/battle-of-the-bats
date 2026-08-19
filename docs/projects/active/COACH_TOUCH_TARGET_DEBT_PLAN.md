# Coach portal — touch-target debt

**Status:** named, not started. **Raised:** 2026-08-19, out of the Insights reports portal's
follow-up calls (`COACH_PORTAL_THREE_OPEN_CALLS_PROMPT.md`, call 2).

## Why this file exists

The layout sweep's 44px tap floor had been failing product-wide and was quietly baselined into
silence: **1,928 accepted `tap-floor` entries, 1,524 of them with no reason written down.** The
brief that surfaced this described it as "about twenty-five desktop controls". It was not.

The owner's 2026-08-19 decision split that population in two:

- **Desktop (>768px) — decided, closed.** 44px is a finger measurement and was the wrong instrument
  at mouse widths. The floor now stops at the last touch width, argued once at
  `TAP_FLOOR_MAX_WIDTH` in `scripts/check-layout-invariants.mjs`. The 1,175 desktop entries were
  retired with it (304 of them had carried individually-written reasons that all said the same
  thing; they are now that one rule). **Nothing moved on screen** — the chrome slimdown stands.
- **Touch (361/390/768) — REAL, and this file.** 753 entries survive, **653 with no reason**. The
  floor genuinely applies here and the portal genuinely fails it.

⚠ **Do not close this by bulk-writing reasons onto the entries.** The check counts unexplained
entries on purpose: an entry without a reason is debt that has not been argued yet. Writing a
sentence onto 653 of them converts a visible problem into an invisible decision, which is the exact
failure this project was created to undo.

## ⚠ The count moves, and it moved on day one

The figures below are **as of the 2026-08-19 decision: 753 entries / 653 unargued.** Within the same
session, `/review` pushed them to **755 / 655** — and *how* is the point:

The UAT fixture was reseeded before the verification sweep. The team then had games, so the
season-record widget rendered **for the first time since the baseline was captured**, and its
"Season insights →" link measured **21px at 361px wide**. That failure was always there. It was
invisible because the fixture the baseline was built from was too empty to render the control.

> **This is the empty-fixture trap running in reverse.** The standing warning is "a green sweep over
> an empty screen is not evidence." The mirror image is just as real: **an empty screen also hides
> RED.** A baseline captured against a thin fixture records the product as cleaner than it is — which
> means the true touch debt is a FLOOR, not a total. Expect this number to rise as fixtures fill out,
> and do not read a rise as a regression.

## What is actually broken

753 entries, but only **345 distinct controls** — the rest is the same control measured across
widths and screens. Crucially it is **not** mostly shared primitives: only four controls appear on
five or more screens (`Import` 31px/13 screens, `Export` 33px/9, `Help: Money` 34px/12, a filter
`All` 21px/5). The other 341 are per-screen controls, which means this is a genuine backlog rather
than one fix repeated.

By worst measured height, per distinct control:

| Height | Distinct controls | Character |
|---|---|---|
| under 20px | 40 | Inline text links and icon-less remove buttons. Smallest is a 13px input on the staff screen; the `Remove <name>` buttons on a practice plan are 14px. |
| 20–27px | 54 | Row-level links (a player's name on the depth chart is 16–23px), drill-in arrows (`Schedule →` 15px, `Player Dues` 15px). |
| 28–35px | 126 | Compact toolbar and card actions — the largest group, and the cheapest to lift. |
| 36–43px | 125 | Near-misses. The shared button primitives sit at ~41px; a few px of padding clears the whole band. |

Concentration by screen (distinct controls · smallest):

| Screen | Controls | Smallest |
|---|---|---|
| `coach-depth-chart` | 139 | 16px |
| `coach-roster` | 48 | 23px |
| `coach-practice-plan` | 39 | 14px |
| `coach-development-templates` | 19 | 21px |
| `coach-history-development` | 15 | 19px |
| `coach-help` | 13 | 19px |
| `coach-fundraisers` | 11 | 15px |
| `coach-payables` | 10 | 15px |
| everything else (30 screens) | 1–9 each | 13–34px |

**Three screens hold a third of it.** The depth chart alone is 139 controls — it is a dense grid of
player chips, and it is the one place where "add padding" is not obviously the right answer.

## Suggested order (not yet approved)

1. **The 36–43px band, via the shared primitives.** ~125 controls, most reachable from a small
   number of button/link components. Highest ratio of entries retired to risk taken.
2. **The under-20px band.** 40 controls, but these are the ones a coach actually mis-taps on a
   phone — a 13px target is not a rounding error. Mostly inline links that want to become padded
   rows at touch widths.
3. **The depth chart, on its own.** Its density is a deliberate design; raising 139 targets is a
   layout question, not a padding question, and it needs a mockup session before anyone touches it.
4. **The 20–35px middle.** Screen by screen, retiring baseline entries as they go.

Each step ends by re-running the sweep and letting the baseline **shrink** — the ratchet tightens,
it is never re-initialised.

## Out of scope

- The desktop floor. Decided and closed above; reopening it means arguing a **different** number for
  pointer widths, not restoring 44px.
- The 38 `contrast` entries, also unexplained, also in the baseline. Same shape of problem, a
  separate project.

## Verification

`node scripts/check-layout-invariants.mjs` (dev server up, `node scripts/seed-uat-coach-fixture.mjs`
run first). ⚠ A green sweep over an empty or unchanged screen is not evidence — that trap has bitten
this portal twice. Confirm the screens under test actually rendered their content.
