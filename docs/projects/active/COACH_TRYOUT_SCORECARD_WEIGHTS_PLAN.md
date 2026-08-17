# Tryout scorecard — weights that read

**Status:** BUILT on dev 2026-08-17 · **✅ OWNER QA PASSED 2026-08-17** (ledger §50) · awaiting production.
**Binding mockup:** `claude.ai/code/artifact/a43106bf-9b2a-4f5a-b7c1-ae9ee37a182d` — the mockup IS the spec.
**Trigger:** owner, on the builder screenshot — *"it is not clear that the 1's represent the weight of each category."*

---

## 1. The finding, and why a label was not the fix

The composite is a weight-**normalised** mean (`lib/tryout-scoring.ts` — `Σ(avg × w) / Σw`). Only each
category's **share of the total** ever reaches a player's score, so six `1`s and six `3`s are the
identical scorecard. Naming the field would have fixed the sentence and left the number meaningless.

**The number on screen is now the share**, as whole percents summing to exactly 100 (largest
remainder, so the footer never has to explain 99%).

Three further things the code did that the screen never said:

| Behaviour in code | Was surfaced as | Now |
| --- | --- | --- |
| weight `0` → still scored, excluded from ranking | typing `0` into an unlabelled box | a **Notes only · not ranked** chip; the row drops out of the split |
| all weights `0` → silent fallback to an even mean | nothing at all | an inline warning naming the fallback |
| reweighting after scoring → silent re-rank | nothing at all | a line beside the controls, shown only when scores exist |

## 2. What was built

**Weighting**
- **"Count every category equally"** switch, ON by default. While on, the weight controls are hidden
  entirely and each row shows its even share. **Derived from the stored weights** (all equal and > 0)
  — no new column, no migration, no stored switch state.
- Switch OFF → per-row stepper (0…n, no upper cap) + proportion bar + live percent.
- **Turning the switch back ON discards the tuning** (owner ruling, this date) — it is the deliberate
  "start over" path. Confirms first *only* when there is real shaping to lose: an uneven split, or any
  category on notes-only. All-equal-but-not-1 flips straight through, because resetting it changes
  nothing the coach can see.
- Confirm goes through the shared `useConfirm()` → `FeedbackModal` (the coach-skinned dialog, 2026-08-17
  ruling) — **not** a hand-rolled dialog. Title *"Start over with an even split?"*, actions
  *Reset to equal* / *Keep my weighting*, `tone: 'warning'` (lime confirm, not danger red).
- Saving with the switch on **writes weight 1 for every category** — what the screen promised is what
  gets stored, and it canonicalises legacy rubrics on their next save.

**Rows**
- Note collapses to *+ Add a note for evaluators*, renders as a one-line read-back once written.
- Move up / move down per row (disabled at the ends). This order is the evaluators' tap order.
- Rows carry a client-side `uid`; `uid` and `noteOpen` are **outside the dirty snapshot**, so a row that
  merely opened its note field is not "edited".

**Modal**
- Head and foot pinned; only the field area scrolls. Footer carries a running summary
  (`N categories · scored 1–5` / `Weighted equally · 20% each` or `3 ranked · shares total 100%`).
- Rating scale is a real segmented control with a consequence line, replacing two `.addBtn` dashed
  buttons + an inline-style selected border.
- **Live evaluator preview** — beside the fields ≥900px, stacked underneath below that.
- Generic `Category name` placeholder (it used to name the first starter category on every row).

**The scale grid (owner call, on seeing the 1–10 preview) — this one reaches the LIVE field screen**
- `TryoutScorerSurface` laid its scale out with `flex-wrap` + `flex: 1 1 auto`. At 1–10 on a phone
  that produced **six thin buttons then four stretched ones**, and the wrap point moved with the
  viewport, so two devices disagreed about the layout of the same scorecard.
- Both the real scorer and the builder's preview are now a fixed `repeat(5, minmax(0, 1fr))` grid:
  1–5 is one row, 1–10 is an even 5 + 5. Five columns clear the 44px tap floor down to a 280px
  viewport, so `min-width: 48px` came off (it was the thing that could overflow a narrow grid).
- ⚠ The field scorer is **not in `scripts/layout-screens.mjs`** — no baseline churn, and no
  automated coverage either. Owner QA step added.

**Accessibility** — the weight field previously had **no accessible name at all** (a `title` tooltip
only). Every control now carries one: per-row share group, stepper buttons, reorder buttons, delete,
note field, `role="switch"` + `aria-checked` on the toggle, `role="dialog"` + `aria-labelledby` on the
modal.

**Outside the modal** — the collapsed card list showed `weight 1` per row; it now shows the same
percent (or `Notes only`), and the meta line says `weighted equally` / `custom weighting`.

## 3. Files

| File | Change |
| --- | --- |
| `components/rep-teams/TryoutRubricCard.tsx` | rewritten builder; share maths, switch, reset confirm, reorder, collapsed notes, preview |
| `components/rep-teams/TryoutRubricCard.module.css` | **new** — the builder's own sheet (dark + warm), registered in the token guardrail's `operator` scope |
| `components/rep-teams/TryoutScorerSurface.module.css` | the **live** field scorer's scale → a fixed 5-column grid |
| `app/api/.../tryout-rubric/route.ts` | GET returns `hasScores` |
| `scripts/check-public-tokens.mjs` | registers the new stylesheet |
| `lib/help-content/coaches.tsx` | the "each with a weight" step and the scorecard-edit FAQ |

The card body outside the modal deliberately keeps `TryoutDayCard.module.css`'s list recipe — it is the
same one-line-row idiom as the sessions list beside it.

## 4. Deliberate calls

- **Weights kept, behind the switch** rather than removed. The common path costs one switch row.
- **Stepper, not a typed percent.** Typed percents must total 100, which forces the product to either
  reject arithmetic the coach believes is fine or silently re-scale what they typed.
- **Notes-only stays weight `0`** — it is already how the product behaves; no data change, no new concept.
- **Stored weights are taken EXACTLY as stored** — neither rounded nor capped. ⚠ The first cut rounded
  them, and `/review` proved that was silent data loss (see §7.1). A stored weight is free-form and
  non-negative; the stepper adds and subtracts whole steps from whatever it finds and does not need
  the value pre-flattened.

## 5. Verification

Green: `typecheck`, `test` (2077), `check:tokens` (all 6 scopes, operator still **0** grandfathered
literals — the new sheet is fully tokenised), `check:css-purity`, `check:contrast`,
`check:text-contrast`, `check:dictionary`, `check:indexes`, `check:org-context`, `check:demos`,
focused lint (3 pre-existing warnings, 0 errors).

⚠ `check:schema-parity` **fails, and did so before this change** — verified by re-running with these
files stashed. Pre-existing dev-only migration drift from other sessions.

⚠ `check:layout` **not re-baselined.** The builder only exists inside a modal the sweep never opens,
and its checklist row is collapsed by default — the rendered sweep cannot see any of this. Owner QA is
the only coverage this screen has.

## 7. What `/review` found (high-risk tier, 5 lenses, run on `e1eaa0b0`)

16 claims → 8 after dedup → **6 confirmed, 1 refuted, 1 out of scope.** Security came back clean. All
six fixes are in the follow-up commit. **Two of the six were defects in this project's own headline
work** — worth stating plainly, because both were invisible to every gate.

**7.1 — Critical: rounding stored weights on load silently rewrote a coach's split.**
`toDraft` did `Math.round(c.weight)`. A stored weight is free-form: the API accepts any non-negative
number, and the pre-redesign builder's `step={1}` never stopped a decimal being *typed* (it governs
the spinner and native validation, and that form never submitted natively). So `[1.3, 1.4]` — a legal
~48/52 scorecard — rounded to `[1, 1]`, which made `isEqual` derive the switch **ON**, which meant a
coach opening the builder to fix a typo and pressing Save wrote `[1, 1]`. **No dirty state and no
confirm, because from the form's point of view nothing had changed.** The same rounding turned a
stored `0.4` into `0` — moving a category that was still feeding the ranking into one the screen
labelled *"Notes only · not ranked"*. It also made the collapsed card (unrounded) and the builder
(rounded) print different percentages for the same untouched scorecard.
**Fix:** no rounding. `weight: Math.max(0, c.weight)`.
**The lesson:** a normalisation applied on READ becomes a WRITE the moment the form saves. The comment
above it reasoned carefully about not *capping* and never noticed it was rounding.

**7.2 — High: the all-zero warning this project added did not fire.**
`rankedCount` / `allNotesOnly` / the percentages / the footer count were all computed over the full
`cats` array, which includes **unnamed rows that `save()` deliberately drops**. Add a category, don't
name it, step the only real category to 0 → the blank row's weight 1 kept `rankedCount` at 1, the
warning stayed silent, and the save stored exactly the all-zero rubric the warning exists to catch.
The same bug diluted every displayed share against a denominator the payload would never have.
**Fix:** every derived figure is computed over named rows only, and a row shows **no share line at
all** until it has a name. **The lesson: a fix that reasons over the draft must reason over the rows
that will actually be SAVED.**

**7.3 — High: this commit put a SECOND confirm dialog on a screen that already had one.**
`ConfirmProvider` holds a single resolver slot and `FeedbackModal` moves focus but never traps Tab. So
the discard guard and the new reset-to-equal ask could overwrite each other — dialog A's promise
stranded forever, the coach's answer landing on a question they were never shown — and the form stayed
drivable behind the dialog, so the quoted *"your weighting is X, Y, Z"* could stop being true before
they answered.
**Fix:** a re-entrancy guard on the toggle; the modal body is a `<fieldset disabled>` while any
confirm is pending; Save and Cancel disabled with it. ⚠ The fieldset's `border: 0; margin: 0;
min-width: 0` resets are load-bearing — `min-width: min-content` would push the modal past its own
max-width.

**7.4 — Medium: an untouched new category could block a valid save.** `addCat` seeded the new row with
the *first row's* weight while the orphan rule spells the default as `1`, so a new row inheriting a `3`
read as substance and refused to save. **Fix:** a new row always starts at 1 — the default and the rule
that reads it have to be the same number.

**7.5 — Medium: a comment claimed a tap floor the arithmetic doesn't support.** The scorer grid comment
said five columns clear 44px "down to a 280px viewport". Chrome is 90px, so a button is
`(viewport − 90) ÷ 5`: **38px at 280, 44px at 310, 46px at 320.** **Fix:** the arithmetic is written
into the comment; sub-320px is explicitly out of scope (no surface in this portal supports it). A media
query was considered and rejected as engineering for a device nothing else here serves.

**7.6 — Advisory:** the dirty baseline was double-serialised (`snapshot()` returned a string into
`snapshotEqual`, which stringifies again). Harmless today, a footgun if it ever deep-compares.
**Fix:** `snapshot()` returns the object.

**Refuted (dropped):** "the remove button lost its danger tone at rest" — `.iconDanger` is a `:hover`
rule only, in both the old sheet and the new one. No behaviour change.

**Confirmed but OUT OF SCOPE — a pre-existing, portal-wide issue, deliberately not fixed here:**
`ConfirmProvider` sits above the routed page, so a pending dialog **survives client-side navigation**
and floats over whatever the coach lands on. This affects **every `useConfirm()` call site in the
portal** (23+, including discard guards shipped weeks ago) and is not something this commit introduced.
Fixing it changes every dialog in the product and needs its own change and its own QA.

⚠ **`--changed` on the rendered check reported "nothing to sweep" because the change was already
COMMITTED — that is a false green, not a pass.** Forced `--only=coach-tryouts` instead; its 6 "NEW"
findings were then reproduced on an untouched screen (`coach-overview`), proving they are portal chrome
(notification badge, team switcher), not this work. **Test an untouched screen before believing a
"NEW" finding.**

## 6. Owner QA

1. Open a scorecard with the starter set — switch is ON, every row reads `20%`, footer says
   `Weighted equally · 20% each`.
2. Switch OFF → steppers appear at 1 each, still 20%. Step Hitting to 3 → shares redistribute live and
   still total 100.
3. Step a category to 0 → **Notes only · not ranked**, and the remaining shares redistribute.
4. Step *every* category to 0 → the fallback warning appears.
5. Switch back ON → the reset confirm appears, names the current split, and offers
   *Reset to equal* / *Keep my weighting*. Cancel keeps the tuning; confirm evens it.
6. Switch OFF then straight back ON with nothing changed → **no confirm** (nothing to lose).
7. Reorder a row → the helper preview reorders with it.
8. Add a note → it appears under that category in the preview.
9. Save, reopen → the switch reflects what was saved; the collapsed card list shows percents.
10. Score a player, then reopen the builder → the "already scored — this re-orders your board" line.
11. Repeat 1–5 in the **warm** skin, outdoors if possible (solid lime fills, olive share bars).
12. Phone: the modal is a bottom sheet, Save is reachable without scrolling past the categories.
