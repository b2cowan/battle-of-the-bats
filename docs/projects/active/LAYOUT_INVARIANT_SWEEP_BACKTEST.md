# Layout invariant sweep — backtest against real history (2026-08-03)

Companion to [LAYOUT_INVARIANT_SWEEP_PLAN.md](LAYOUT_INVARIANT_SWEEP_PLAN.md) §10. The question:
do the six rules catch the kinds of UI defect that have historically reached the owner's eyes?

**Answer: 3 of 24 as shipped (13%).** Extending the screen list to the surfaces this corpus names
would take it to ~11 of 24 (46%). The rules are aimed correctly; the aperture is too small, and one
rule was structurally blind on the portal it was built for.

> **✅ Acted on 2026-08-03 — the two rule-level defects below are fixed and verified.** `contrast` no
> longer declines on a gradient over an opaque colour (§3.1), and `hidden-behind-chrome` now inspects
> prose containers as well as controls (§3.2). Both were verified red on the real defect and green
> again once the shipped fix was restored. Together they surfaced **9 genuine contrast findings with
> zero false positives** across 13 sampled screen-widths; the baseline was deliberately not
> re-snapshotted, since absorbing them would hide them. Rows 7 and 13 below would now be caught,
> taking the as-shipped rate to **5 of 24** — the remaining misses are coverage and class gaps, not
> rule defects. See LAYOUT_INVARIANT_SWEEP_PLAN.md §10.1–§10.2b.

## Method

1. **Corpus** — 24 mechanical UI/layout/styling defects that were actually **fixed and recorded**,
   drawn from commit bodies (a visual correction described in prose), plan-file review notes, and
   `memory/design_decisions.md`, over the last ~6 weeks. Judgement defects were collected separately
   (7 more, §4) because they are expected misses, not rule failures.
2. **Classify** — for each: would a rule have fired, and which one. Strict: "the sweep might have
   noticed something nearby" is a NO.
3. **Verify** — five scored "would have caught" were re-tested by restoring the pre-fix state in the
   working tree and running the sweep scoped to that screen. **Three of five were wrong** and are
   rescored NO below. Two rules that had never been seen red were falsified deliberately.

## 1. Verified — the five reproductions

| # | Defect | Rule | Result |
|---|---|---|---|
| V4 | `--home-dim: #8A8177` reinstated (03a83307) | `contrast` | ✅ **RED.** 3.83:1 on white, 3.49:1 on card, 2.94:1 on the bottom nav — matches §7.1 exactly. |
| V3 | Pre-fix Development page restored (7b6e5e23^) | `contrast` | ✅ **RED.** `button "Add test"` ink-on-olive at 2.41:1 — the 929589b2 dark-island class. |
| V1 | Frozen alias tokens reverted (78abc845) | `contrast` | ❌ **Rescored NO.** The defect is on the coach tournament record, not in the screen list. Widened to 11 listed screens: silent. |
| V2 | Warm inherited-white reverted + pre-fix page (7b6e5e23) | `contrast` | ❌ **Rescored NO.** Two white-on-cream `<p>` elements render; the rule declines because `.coachesMain` carries a `background-image`. See §3.1. |
| V5 | `/coaches/join` nav clearance reverted (537689e3) | `hidden-behind-chrome` | ❌ **Rescored NO.** Heading measured at y=16 under a 64px fixed nav — the defect — and the rule stayed silent: it only inspects controls, and the nearest control sat at y=150. |

Two further reproductions were attempted and are **unverifiable**, not negative: the consumer
overflow fix (9b24bc4a) targets a stylesheet since deleted, and the admin-dashboard overflow
(c970e0c6) does not reproduce because the surrounding grid has changed — injecting a long unbreakable
name into a panel produced no overflow at 390px.

### Falsifying the never-red rules

| Rule | Test | Result |
|---|---|---|
| `sticky-no-travel` | Re-added `overflow-y: auto` to `.coachesMain` — the thing the shell ruling forbids | ✅ **RED.** "masthead … trapped in `<main>`, which runs 1204px past a 900px viewport yet has no vertical travel". The plan's central claim is now tested, not asserted. |
| `page-overflow` / `content-overflow` | Injected a 130vw block into `.page` | ✅ **RED**, both. (Minor: the culprit finder reported "none identified" — it does not walk pseudo-elements.) |
| `hidden-behind-chrome` | V5 above | ❌ **Stayed green on a real overlap.** Its zero across 112 combinations has never been shown to be a real zero. |

## 2. The corpus — 24 mechanical defects

`fit` = a rule aims at this defect · `listed` = the affected screen is in `layout-screens.mjs`

### 2a. Rule fits (15)

| # | What the user saw | Screen | Rule | fit | listed | Verdict |
|---|---|---|---|---|---|---|
| 1 | Muted labels, counts and helper text unreadable portal-wide (3.83:1) | all coach | `contrast` | ✓ | ✓ | **CAUGHT** (V4) |
| 2 | Save / Send announcement / Submit roster: near-black ink on olive fill | roster, schedule | `contrast` | ✓ | ✓ | **CAUGHT** (V3) |
| 3 | Org-vs-own tag and money chips: pastel text invisible on cream | roster, accounting | `contrast` | ✓ | ✓ | **CAUGHT** (class verified via #2) |
| 4 | "How to pay" / "That's a wrap" illegible under warm (frozen aliases) | coach tournament record | `contrast` | ✓ | ✗ | MISS — coverage (V1) |
| 5 | Warm dark-ink headings invisible over a near-black body | free portal shell | `contrast` | ✓ | ✗ | MISS — coverage |
| 6 | Phone top bar and bottom nav stayed dark in warm; team name dark-on-dark | free portal, mobile | `contrast` | ✓ | ✗ | MISS — coverage |
| 7 | White-on-cream text at ~1.25:1 (inherited `--white` outside the warm gate) | development, practice run | `contrast` | ✓ | ✓ | **MISS — rule blind** (V2, §3.1) |
| 8 | Unreadable dev-error text, blue eyebrows, edgeless borders | system / auth screens | `contrast` | ✓ | ✗ | MISS — coverage |
| 9 | White label on warm-gold team fill (threshold unreachable for ~98% of hues) | consumer game detail | `contrast` | ✓ | ✗ | MISS — coverage |
| 10 | Sideways scroll + clipped text; wrapper sized to its widest card | consumer Following / Scores | `page-overflow` | ✓ | ✗ | MISS — coverage |
| 11 | Control row overflowed the device edge, latching a 448px viewport (~13% zoom-out) | public schedule, playoff stage | `page-overflow` | ✓ | ✗ | MISS — coverage |
| 12 | A panel pushed wider than its grid column and overflowed the viewport | admin dashboard, mobile | `page-overflow` | ✓ | ✗ | MISS — coverage |
| 13 | Fixed marketing header overlapping the claim card, in every state | `/coaches/join` | `hidden-behind-chrome` | ✓ | ✗ | **MISS — rule + coverage** (V5, §3.2) |
| 14 | Undo unreachable: docked bar sat 32px behind the nav on notched phones | lineups, iPhone | `hidden-behind-chrome` | ✓ | ✓ | MISS — no safe-area inset in headless Chromium |
| 15 | 24px of content cut off under a sticky footer | lineups | `hidden-behind-chrome` | ~ | ✓ | MISS — the rule considers `position: fixed` only |

### 2b. No rule aims at it (9)

| # | What the user saw | Screen | Class | Verdict |
|---|---|---|---|---|
| 16 | More menu: 318px of rows below the fold, nothing said so; warm panel indistinguishable from the page | coach More sheet | vertical overflow + affordance + state | MISS |
| 17 | A 1.69px hairline: the nav measured 70.31px while its token published 72px | coach bottom nav | constant drift | MISS |
| 18 | The bottom bar and all four tabs jumped 1px on every Home ⇄ tournament hop | consumer shell | constant drift | MISS |
| 19 | Auto-fill's Generate button swallowed by the new dock, on 6 of 8 viewport/inset combos | lineup popovers | state (popover closed) | MISS |
| 20 | "Share team" clipped by `overflow: hidden` | public team page | clipping — `content-overflow` skips non-`visible` overflow | MISS |
| 21 | Sign in needed two taps on iOS Safari (hover style, no `cursor`) | consumer Account | interaction; catchable by a lint | MISS |
| 22 | Schedule dropdowns never animated — `@keyframes` lived in another CSS module | admin schedule | static reference | MISS |
| 23 | Hoisted bar rendered unseparated with a stray `undefined` class | coach record | static reference | MISS |
| 24 | The flip pill's label truncated the event-header title | admin/public header, phone | truncation | MISS |

Two further truncation defects (a tournament name ellipsed at 227px on Browse rows; venue names cut
in the filter panel) are the same class as #24 and are not double-counted.

## 3. Root causes of the two rule-level misses

### 3.1 `contrast` cannot see the portal's own paper

`effectiveBg` returns `null` on any `background-image`. `.coachesMain` paints the blueprint grid on
every org-scoped coach screen, in both themes. So text sitting on the page ground — muted labels,
helper copy, empty-state text, section titles — is declined outright. Text inside **cards** is
measured, because a card paints an opaque surface that short-circuits the walk.

Measured at 390px, elements with their own text:

| Screen | text elements | declined | share |
|---|---:|---:|---:|
| coach-roster | 87 | 43 | 49% |
| coach-schedule | 17 | 9 | 53% |
| coach-development | 38 | 18 | 47% |
| coach-tryouts | 42 | 13 | 31% |
| coach-overview | 42 | 8 | 19% |
| coach-team-hub | 42 | 8 | 19% |

**All 99 are recoverable** — in every case the gradient sits on an element that also declares an
opaque `background-color`, so the correct composite is knowable rather than guessed. Four genuine AA
failures are hiding there today: `coach-roster` at 4.49:1, `coach-tryouts` at 4.39:1 (×3).

### 3.2 `hidden-behind-chrome` only inspects controls

Its selector is `button, a[href], summary, select, textarea, input, [role="button"]`. A heading, a
paragraph or a whole card sliding under a fixed bar is out of scope by construction — which is what
the `/coaches/join` defect was, and what most "the header is covering the page" reports are.

## 4. Judgement defects — counted separately (7)

Expected misses. Listed because their volume is the real signal: they are as common as the
mechanical ones and no rule will ever reach them.

| What the user saw | Screen |
|---|---|
| Five unequal tiles in a 2-across grid left a hole beside every short one | development hub |
| One message in three containers; nothing shared a left edge | coaching staff |
| The rail repeated the org name and status chip the header already showed | tournament admin |
| The flip control rewrote its own label on arrival; chooser rows unstable | admin/coach header |
| League headings sat 244–304px inboard of their own navigation | league pages |
| A paying customer's visitors were told the org forgot to set something up | public org page |
| Three view tabs wrapped to two lines | lineups |

Plus two interaction defects with the same character: tapping away didn't dismiss any panel on iOS
Safari, and typing in a bottom sheet dismissed the keyboard every keystroke.

**Where the real risk lives.** Of 33 recorded defects, 24 are mechanical and 9 are judgement or
interaction. Of the 24 mechanical, the sweep as aimed reaches 3. The owner's eyes remain the only
gate on two-thirds of what has historically gone wrong — and that is the honest case for extending
the aperture rather than trusting the green.

## 5. Bounds on all of this

- **Sample bias.** The corpus is only defects that were fixed **and** described. A defect fixed
  silently inside a feature commit, or still open, is invisible here. It skews to the last six weeks
  and to the coach portal, because that is where the recorded prose is.
- **Two items were unverifiable** — the code has since been deleted or restructured.
- **Fixture reach bounds the sweep itself.** `ready: 'h1'` proves the shell rendered, not the
  content: without `networkidle` the Development page measures the string "Loading development…".
  Several screens measure a near-empty page, so the baseline's 2,109 entries describe a thin UAT
  team, not a real season.
- **Findings drift between runs.** A `tap-floor` finding (`input`, 13px) on `coach-staff` appeared
  once and not again, and two baseline entries flipped between reproducing and not across four runs.
  Small deltas are not signal.
