# App-wide table & list consistency — REVIEW PROMPT

**Status:** commissioned by the owner 2026-09-06, out of Owner QA §146 part F3. **REVIEW RUN
2026-09-06** — Phases 1–3 and 5 delivered, Phase 4's mockups published; **the owner approved the
standard, the frames and all seven decisions the same day and the fix work was built on `dev`**
(plan `APP_WIDE_TABLE_CONSISTENCY_PLAN.md` + PM brief; owner QA §149). Deliverables:
`docs/agents/design/TABLE_AND_LIST_STANDARD.md` · `TABLE_EXCEPTION_REGISTER.md` ·
`TABLE_INVENTORY_2026-09-06.md`; mockups + decision panel
https://claude.ai/code/artifact/0aa319dd-a6eb-4fff-b09b-df8591475fe1. The plan + PM brief (§8.4)
are deliberately not yet written. Coverage gap to close before the build: the club-side admin
tables could not be rendered (see the standard's §7). Nothing is built.
This document is the **prompt** for that review session, not the review.
**Origin:** `docs/projects/active/COACH_MONEY_ONE_SURFACE_PLAN.md` §9 asked a much smaller question
(row density across four money tabs). The owner declined to answer it in that frame and widened it.

---

## 1. What the owner actually asked for

> *"this is worth a review session, not just heights but font, color, etc consistency as well. we
> may have exceptions for certain things but they should be documented so the non-exceptions still
> follow the same rules (i.e. if the ledger screen is intentionally shorter row height to fit more
> on the screen the fonts should still be the same, row colors the same, etc. unless also documented
> as a known exception). please write up a prompt to conduct this review and provide recommendations
> with mockups. these design rules should not be limited to money screens but should include
> standardization where applicable across the app."*

**The governing idea, stated plainly, because everything else follows from it:**

> **One axis of difference does not license the others.**
> A screen may deviate from the standard on a named axis, for a stated reason, recorded in a
> register. Every axis it did *not* claim an exception on still follows the standard exactly.

Today the product has the opposite habit: a screen that needed tighter rows quietly grew its own
type sizes, its own tints and its own hairline along the way, and nothing recorded which of those
four were decisions and which were side effects. **The deliverable is not uniformity. It is a
standard plus an honest register of departures from it** — so that a year from now, a difference
between two tables is either in the register or it is a bug, with no third category.

---

## 2. Why this is worth a session

- **The product is mostly tables.** 77 files render a `<table>`; there are 254 CSS modules. Coaches,
  club admins and platform admins all spend most of their time reading rows.
- **Drift here is invisible per screen and obvious across screens.** Every one of these surfaces
  reads fine alone. The cost only appears when a treasurer moves between four tabs in ten seconds,
  which is precisely what the Money hub asks them to do.
- **It has already bitten, repeatedly and expensively.** The §146 pass found band headings that had
  rendered as plain dark text for four months because their whole treatment was outranked; a
  closing "answer" row set quieter than the subtotals above it; and two families drawing the same
  category to line to total tree with forked sizes that diverged twice in one day.
- **It is cheap to hold once written and expensive to retrofit later.** Every new screen is another
  vote for whichever recipe its author copied.

---

## 3. Scope

**In scope — every surface that lays rows of records out for reading**, wherever it lives:

| Area | Examples |
|---|---|
| Coach money | Budget vs. Actual (Statement · By activity · Months), Budget plan list, the ledger, Player dues, Fundraising, Club allocations |
| Coach portal | Roster, Schedule, Practices, Tryouts, Development, Reports |
| Club admin | Families, Members, Rep teams, Accounting, Registrations |
| Tournaments | Standings, Schedule, Brackets, Divisions, Venues |
| Platform admin | Orgs, Users, Audit, Exports, Observability, Email, Feedback, Change requests |
| Public / marketing | Pricing comparison tables, public standings and schedules |

**Deliberately in scope beyond the desktop table:** the **phone fallback** for each (card stack,
`data-label` values, sideways scroll with a pinned first column), because that is where one recipe
most often becomes three.

**Out of scope:** forms, dashboards and stat tiles, charts, navigation, and anything that is not a
list of records. Note them if they collide, but do not standardise them here.

---

## 4. The axes to review

Review every surface on **all** of these, not just the one that prompted the question. For each, the
output is: *what is the standard, which screens depart from it, and is each departure a decision or
an accident?*

1. **Density** — row height, cell padding, whether a row may wrap to two lines.
2. **Type** — family, size, weight, case (small caps vs sentence case) and letter-spacing, per row
   role: column heading · band/section heading · group/category row · item row · total/closing row ·
   meta/caption.
3. **Colour** — page ground, row ground, which rows are tinted and why, hairline colour and weight,
   ink hierarchy (primary/secondary/tertiary), and where status colour is allowed to appear at all.
4. **Alignment and columns** — text left, numbers right; column widths; what may be a fixed width;
   how a long name wraps or truncates.
5. **Structure** — whether the surface has a header row, band rows, group rows, a totals footer, a
   closing "answer" row; in what order; and what each is called.
6. **Interaction** — what folds and what does not; chevron size, side and position; whether the row
   itself is a tap target or only the chevron; what a figure opens; 44px tap floors; whether the
   surface offers Expand all / Collapse all, and where that control sits.
   ⚠⚠ **MEASURE TARGET WIDTH BY HAND — the tap-floor gate reads HEIGHT ONLY.** A control that
   shrank horizontally passes it silently, and this is not hypothetical: the money grid's category
   toggle is sized to its own content (chevron plus the category's name), so a category called
   "Gear" exposes a far smaller keyboard/AT target than one called "Tournament entry fees" — on the
   same table, in the same column. The full-row click shortcut hides this for a mouse and a thumb
   but not for the exposed control itself. Whatever the standard says about row-level tapping, it
   must state a **minimum target width** for the semantic control, and the review should recommend
   how to gate it — this is currently unmeasured everywhere in the app.
7. **Empty, zero and absent** — the empty state, a zero figure, a "nothing here" dash, "not
   applicable" versus "none yet", loading, and error.
8. **Responsive behaviour** — the widths at which the recipe changes, sideways scroll, the pinned
   first column, and the 641–768 tablet band (which has its own standing ruling).
9. **The chrome around the table** — toolbar position and order, filter and arrangement controls,
   pagers, Export, and the notes stack underneath.

---

## 5. Where to start — facts already established, so the review does not begin blind

Ground the inventory in these; verify each rather than trusting this list.

- **The app has 8 type role tokens** (`--type-display` through `--type-token`, in `app/globals.css`),
  each with a written job. That is the app-wide ladder.
- **The coach money grid runs its own private size ladder beside it** (`--money-cat-size`,
  `--money-line-size`, `--money-catnum-size`, plus two weights, declared on the coaches shell).
  ⚠ **This is argued and deliberate, not obvious drift** — read its comment block before judging it.
  It is the single best test case for the owner's rule: is it a documented exception, or should it
  fold into the ladder? Either answer is defensible; what is not defensible is leaving it unrecorded.
- **`.moneyGrid` is the shared table recipe** that the §146 pass consolidated three money surfaces
  onto. It is the strongest existing candidate for "the standard", and the review should say plainly
  whether it generalises beyond money or is itself a money-specific exception.
- **Guards that already exist and must not be duplicated:** `check:layout` (rendered invariants and
  tap floors at 361/390/768/1440), `check:css-selectors` (dead selectors),
  `check:css-module-purity`, `check:contrast` / `check:text-contrast`, and
  `money-hierarchy-type-scale` — which guards the two *relationships* a variable cannot express: a
  category reads larger than its own lines, and neither family reverts to small caps. A new gate
  should follow that last one's shape: **assert relationships and role membership, never literal
  pixel values.**
- **Standing rulings that constrain the answer** (honour them, or explicitly ask the owner to
  re-open one — do not quietly overrule):
  - the closing answer row gets **no fourth type rung** above the subtotals (owner, twice, QA §146);
  - the unplanned dash **keeps its amber** (owner, QA §146 F1);
  - an exported file's shape **is** its screen's shape (owner, QA §146 F2);
  - one spelling everywhere a customer can read it, "8:00 a.m." included (binding, build-enforced);
  - a shared component beats a shared class;
  - the 641–768 tablet band has its own rules, and a hidden control needs a reachable replacement.

---

## 6. Method

**Phase 1 — Inventory (evidence, not impression).**
Measure the real rendered surfaces; do not read stylesheets and infer. For each surface record the
nine axes as observed values at 390 and 1440. Produce one table: surfaces down, axes across. The
point of this phase is to make the spread *visible* — how many distinct row heights, how many
distinct heading treatments, how many hairline colours the product actually ships today.

**Phase 2 — Propose the standard.**
One recipe per row role, expressed in **tokens and relationships**, never in literals. Say what a
column heading is, what a group row is, what a total is, in a way a new screen can follow without
copying an existing file. Name the surface the standard is derived from, and why that one.

**Phase 3 — Build the exception register.**
Every departure found in Phase 1 gets a row: *surface · axis · what it does instead · the reason ·
decided by whom and when · which axes it is explicitly NOT excepted from.* Each becomes one of
**KEEP** (a real decision, now recorded), **FIX** (drift, bring to standard), or **ASK** (needs the
owner). ⚠ Do not smuggle a new ruling into this register — anything an owner has already decided is
a KEEP with a citation, not a fresh opinion.

**Phase 4 — Recommendations, with mockups.**
See §7. Sequence the FIX work by *reader impact*, not by how easy each one is.

**Phase 5 — Enforcement.**
Recommend how the standard is held after the session ends. A document nobody can fail is a document
that goes stale, and this repo has proof. Prefer extending an existing gate to adding a new one, and
prefer relationship assertions to pixel snapshots.

---

## 7. Mockups — the gate, and it is item ONE of any build that follows

Recommendations land as **Claude Artifacts**, never as descriptions in prose, and never as
screenshots pasted into a document.

- **Whole-screen before and after, at true size** — not cropped fragments, not a swatch board. A
  row-height change that looks fine on three rows is judged on a real screen's worth of rows.
- **At least one dense surface and one sparse one**, so the standard is tested where it is hardest.
- **Both phone (390) and desktop (1440)**, since the phone fallback is where recipes fork.
- **Light and dark**, because the static contrast gates read one of them only.
- Use **real fixture data**, never lorem — a wrong number in a mockup gets checked instead of the
  shape, and pretty names hide the wrap cases that break real tables.
- **No code changes before the owner has approved a mockup.** Standing rule here; it applies to this
  work in full.

---

## 8. Deliverables

1. `docs/agents/design/TABLE_AND_LIST_STANDARD.md` — the standard. Lives with the design agent's
   reference material, which evolves in place and is never archived.
2. `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` — the register from Phase 3. **This is the half
   the owner actually asked for; do not let it become an appendix to the standard.**
3. A mockup Artifact per §7, linked from both.
4. `docs/projects/active/APP_WIDE_TABLE_CONSISTENCY_PLAN.md` + `_PM_BRIEF.md` — the sequenced FIX
   work, written only after the owner has approved the standard and the mockups.
5. A recommendation on enforcement (§6 Phase 5), with an honest note on what it cannot catch.
6. An owner QA walk as a checkable Artifact when the work ships.

---

## 9. What would make this review a failure

- **A style guide with no register.** The register is the ask. A standard that pretends there are no
  exceptions will be quietly violated within a month, and is then worse than nothing.
- **Uniformity for its own sake.** A dense operational list and a board-facing statement have
  genuinely different jobs. The answer there is a documented exception, not a forced match.
- **Arguing from stylesheets instead of from rendered screens.** Half the defects this repo has
  found in this area were rules that never applied — outranked, misspelled, or scoped to nothing.
  A specificity loss reads exactly like an absent rule, right up until you measure the page.
- **Overruling a standing ruling by accident.** Several values in scope were decided by the owner on
  a built screen, some of them twice. Cite and honour, or ask.
- **Scope creep into forms and dashboards.** They will be tempting. They are a different session.
- **Recommending a pixel-snapshot gate.** It will fail on every legitimate change and be switched
  off within a fortnight.

---

## 10. Suggested opening move

Start with the four coach money tabs the owner was looking at when he asked (§9 of the one-surface
plan): Budget vs. Actual, Budget plan, the ledger and Player dues. They share a hub, a reader and a
ten-second switching distance, so drift between them is felt most sharply — and they are now the
only place in the app where a single table recipe has actually been consolidated, which makes them
the natural place to test whether that recipe generalises. **Then widen to the club admin and
platform admin tables before writing the standard**, so that it is not a money standard wearing an
app-wide name.
