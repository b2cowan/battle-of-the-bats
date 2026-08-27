# The 641–768 band — plan of record

**Status:** BUILT on dev 2026-08-27. Owner QA = `OWNER_QA_LEDGER.md` §115. **No migration.**
Build prompt: `COACH_TABLET_BAND_BUILD_PROMPT.md`. PM brief: `COACH_TABLET_BAND_PM_BRIEF.md`.
Approved mockups: `claude.ai/code/artifact/005d7400-f546-43a2-8d88-f5f020e4f816`
(source kept in-repo at `COACH_TABLET_BAND_MOCKUP.html` — one file path across rounds).
Design log entry: `memory/design_decisions.md` 2026-08-27.

---

## 1 · The ruling this executes

**Owner, 2026-08-27, from the true-size mockups opened on a real tablet:** the coach portal's
**touch arrangement holds up to 768px, not up to 640px.**

**⚠⚠ THE DECISIVE FINDING, AND THE REASON THE BRIEF'S QUESTION WAS THE WRONG ONE.** The build
prompt asked whether a twelve-player × six-inning lineup grid is a touch surface, and presented
three open options. It is not an open question — **the product had already answered it, built the
answer, and shipped it.** Below 640px the grid raises every position cell to exactly 44px, removes
the 18px drag handle and the 22px remove ✕ entirely, pins the player's name, and moves reordering
and removal to the order view (where both controls are already 44px **at every width, today** —
measured, not assumed). All of that was gated at 640. So a coach on an iPad was handed the **mouse**
arrangement of a screen the product itself calls a finger screen, and the real decision was never
*what a lineup grid is* — it was **where that decision's edge belongs.**

Shipping the pointer arrangement at 768 while the touch arrangement runs at 640 amounts to
asserting that an iPhone has fingers and an iPad has a mouse, with the boundary at 640px. That is
not a claim anyone would defend once it is written down, which is what settled it.

**The two options that were NOT taken, and why they stay rejected:**

- **Exempt the grid as a pointer surface.** Defensible only if the answer to "can a coach use the
  lineup builder on an iPad?" is "no, and we say so in the product." Nobody was willing to say it
  about a **between-innings tool** most likely to be held one-handed at the side of a field.
- **Move the check's own tap floor below 768.** It erases 417 recorded findings in one line, which
  is exactly why it looks attractive — and it is contradicted by the product's own stylesheet,
  which already writes touch rules at 768 fifteen times. It would hide the disagreement, not settle
  it. **`TAP_FLOOR_MAX_WIDTH` stays at 768.**

## 2 · What the mockups proved before any code was written

The brief predicted a 44px floor on 72 cells would make the grid "roughly 530px of rows and
considerably wider than it is now, on a screen 768px across." **Measured in the browser, at 768:**

| | today | touch arrangement | change |
|---|---|---|---|
| Grid height | 586px | 730px | **+144px** |
| Grid width | 736px | 736px | **+0px — no sideways scroll appears** |
| Page height | 1,352px | 1,496px | +144px |
| Player rows above the fold | 9 | 7 | −2 |
| Sub-floor controls on the page | 109 | 13 | **−96** |

The width does not move because the cell's extra 6px comes out of the slack the player column was
absorbing. The cell also becomes **legible**: at 58px wide, "Bench" is clipped against its own
chevron in all 72 cells.

**⚠ The measurement was taken by injecting the product's own ≤640 rules at 768 in a real browser
session, not by arithmetic and not by a drawing.** The whole-screen before/after in the mockup is
those two renders. This is why the prompt's §5 insists on a whole screen: each specimen looked
reasonable alone, and only the pair answers "does the thing a coach opens this screen for move
below the fold?" (It does not — the score, the Out-player warning, the format/innings controls,
auto-fill and the three view tabs all sit exactly where they were.)

## 3 · The corrected inventory

⚠ **The build prompt's numbers were close and not exact, and re-deriving them was a condition of
starting.** A clean warm-server run at all four widths returned **318**, not 321: **a plan template
carries 4/4/5, not 5/5/6.** Everything else held — 961 baselined findings / 698 with no reason; 417
tap-floor entries at 768 with 334 unexplained; touch rules written 60 times at 640 and **15** (not
14) at 768.

**318 findings = 58 distinct control families**, not the ~35 the prompt estimated. And they were
**two problems, which the prompt read as one:**

| | families | findings | what it is |
|---|---|---|---|
| Fail **only** at 641–768 | 21 | 207 | the tablet band — the ruling above |
| Fail at **361/390 too** | 37 | 111 | ordinary touch debt on screens nobody had measured |

Answering the tablet question finishes **two** of the six screens, not six. Both piles were closed
in this pass; the second one never needed the ruling.

## 4 · What was built

**A · The grid decision.** The three touch rules — hide the grip, hide the remove ✕, raise the cell
to 44px/64px — moved out of the `max-width: 640px` block into a new `max-width: 768px` block, with
the reasoning written where the rule lives.

⚠ **Only those three moved.** Everything still in the 640 block answers a **narrow** screen, not a
touch screen: the swipe hint, the pinned lead columns, the trimmed inning gutters, the narrowed
name column. At 768 the grid does not overflow, so a scroll hint and a sticky shadow there would be
cueing a scroll that never happens.

**B · The view tab strip, which is load-bearing for A.** `Batting order / Positions / Playing time`
measured 29px. Moving the grid's touch arrangement up to 768 takes drag-and-remove **off** the grid
and leaves them reachable only through that strip — at 29px the two controls would not have moved,
they would have **gone**. Raised to 44px in the same band.

**C · Every other control the six screens own.** Raised to the floor at ≤768 — ⚠ which means **at
phone widths too**, see §5b:

- **A player's profile** — the three profile tabs (38px), `Preview` (15px — the smallest control in
  the whole set), `Manage dues →` (20px), and the three Skills & Goals card actions (38px).
- **The two lineup editors** — `View on schedule` (23px), `Clear positions` (25px), the Format and
  Innings selects (37px), `Auto-fill` / `Reshuffle` / `Templates` / `Generate` (31–34px),
  `Remove N Out player` (33px), the template-name field (35px). ⚠ The four toolbar buttons are
  named by class, **not** matched as `.lineupControls button` — see the rule's own note: the
  descendant form reached into the Auto-fill menu and took the bare `Game rules ▾` disclosure link
  from 16px to 44px, which no mockup showed and the sweep cannot see (that menu only exists once
  the coach opens it). Found by `/review` and corrected.
- **A plan template** — its name and purpose fields (35px), the tag box (28px), `Add a block` (33px).
- **An evaluation session** — the date and event fields (37–38px), the session note (35px), and the
  shared new-test row's two fields plus `Add test` (35–38px).
- **An opponent's page** — the observation box (43px — one pixel short), the five filing chips
  (25px), `Save observation` (39px), `Same team as…` (16px).

## 5 · The two boundaries this pass deliberately did not cross

**⚠ SHARED PRIMITIVES WERE NOT STRETCHED.** `.input`, `.select`, `.btnSecondary` and friends back
many of the controls above, and raising them would move **every form in the coaches portal**. That
is a portal-wide decision with a portal-wide sweep behind it and its own plan
(`COACH_TOUCH_TARGET_DEBT_PLAN.md`) — not something to do on the way past. Every raise here is
scoped to a container the screen owns, using the same idiom and the same reasoning as
`.commitFields` (2026-08-26).

**⚠ THE SHARED PAGE HEADER WAS NOT TOUCHED.** Six findings survive on purpose and are recorded in
the baseline **with a full written reason**, never as bare entries:

- the help **"?"** on five of the six screens (34px), which is the page header's right-corner
  anchor on **every** coaches screen; and
- `Save template` (31px), which is the shared primary-action slot in the same header.

Standing precedent from the commitment page: *the shared header and toolbar land on every screen id
at once, or it is not the fix.* Both belong to the portal-wide touch-debt project.

**The unexplained share of the baseline did not move: 698 before, 698 after.** The six entries
added all carry reasons. **Nothing from the 318 was baselined** — 312 were fixed and 6 were
deferred with an argument.

## 5b · ⚠⚠ CORRECTION — "nothing changes on a phone" WAS WRONG (`/review`, 2026-08-27)

The first version of this plan, its PM brief, the ledger and the QA walk all said **on a phone
nothing changes**. That is false, and the way it became false is the lesson:

**Only the lineup grid was verified at phone width; the claim was then generalised to the whole
change.** Every rule in §4C is written at `max-width: 768px`, which includes phones — and the
six screens' own numbers say so plainly: **37 findings at 361 and 37 at 390 went to zero.**
Thirty-seven distinct controls therefore got taller on a phone. That is an improvement (they were
under the floor there too), but it is a change, and **the mockups were drawn at 768 only, so
nobody looked at any of it at phone width.**

The grid claim itself survives intact and is the narrow thing that was actually checked: at 361 the
grid still overflows with the lead columns pinned and the swipe hint showing, exactly as before.

⚠ **The rule to carry forward: a media query written for a band you care about also applies to
every width below it.** If the intent is "tablet only", it needs a lower bound; if it is "touch",
say so and expect the phone to move too.

## 5c · ⚠ TWO OPEN OWNER DECISIONS THIS PASS SURFACED AND DID NOT TAKE

**1 · The ceiling does not reach a current full-size iPad.** Measured on the running build, in
portrait: iPad Mini 6 (744) and pre-2018 iPads (768) get the new arrangement; **iPad 9th gen (810),
iPad Air / iPad 10th gen (820) and iPad Pro 11" (834) do not** — they still render 32px cells, the
18px grip, and **110 sub-floor controls**. The ceiling came from `TAP_FLOOR_MAX_WIDTH`, and the
options put to the owner only ever considered *lowering* it. So the goal in the PM brief — *a coach
can operate the lineup builder on a tablet* — is met on small and old tablets only. **Raising the
portal's touch ceiling (and the check's floor with it) to cover ~834 is an owner decision of the
same kind as the original ruling, and is deliberately not taken here.**

**2 · 641–713px scrolls with the names scrolling away.** Wrapper overflow measured at 73px @641,
54px @660, 14px @700, **0 from ~714 up** (the table's 680px min-width plus ~34px of shell padding).
In that slice the grid scrolls sideways while the pinned lead columns and the swipe hint are still
gated at ≤640 — the two failures those rules exist to prevent. **The overflow is pre-existing**
(the min-width caused it before this change too), but this pass declared the band a touch band and
moved three of the five relevant rules into it. ⚠ §4A's in-code comment and the QA walk's Part D
both say "at 768 the grid does not overflow, so a hint would cue a scroll that never happens" —
**true at 768, false from 641 to 713.** Either extend the two rules to that boundary or correct the
claim; do not leave both standing.

⚠ **The gate cannot see either of these**: it measures 320/361/390/768/1440, so every width from
391 to 767 — and everything above 768 — is unmeasured by construction.

## 6 · Result

| | before | after |
|---|---|---|
| Findings across the six screens | 318 | **6** |
| …at 361 / 390 / 1440 | 37 / 37 / 0 | **0 / 0 / 0** |
| …at 768 | 244 | **6**, all deferred shared header, all reasoned |
| Distinct control families | 58 | **6** |
| Baseline entries without a reason | 698 | **698** |

## 7 · Two things found on the way past, raised and NOT fixed here

1. **A control that fails only where the fixture happens to render it.** The evaluation session's
   note field sits **outside** the wrapper its two sibling fields share, so the first pass missed
   it — and that pass still closed 309 of 318, which is exactly the shape of a miss that reads as
   success. Caught by re-running the sweep rather than by trusting the fix. *Two fields that read
   as one group on screen are not necessarily one group in the markup.*
2. **A standing copy ruling is being broken on that same screen.** Its label reads **"Session note
   (optional)"**, and the owner's 2026-08-26 ruling is *mark required, not optional* — a plain `*`
   on the few required fields, never "· optional" on the many. Out of scope for a tap-floor pass
   and deliberately left alone rather than folded in silently.

## 8 · Gate

Typecheck ✓ · focused lint **0 errors** on every changed file · units **2,633 / 2,633** ✓ ·
spelling ✓ · CSS-module purity ✓ (252 stylesheets) · demo sandboxes ✓ (2 presentable) ·
**no migration**.

**The six screens: 318 → 6**, `✓ No new layout findings`, at all four widths.

### ⚠⚠ THE FULL-PORTAL SWEEP EXITS 1, AND IT IS NOT THIS CHANGE — PROVEN, NOT ASSERTED

The coaches stylesheet is a shared file, so the check widens to all 28 coach screens plus the
marketing pages by its own rule. That run returns **175 NEW findings — none of them on these six
screens**, on `coach-notifications`, `coach-staff`, `coach-practice-plan`,
`coach-development-templates`, `coach-fundraisers`, `coach-sponsors-list`, the five finished-season
shelves and a dozen others.

**Two independent proofs that none of them belong to this change:**

1. **By construction.** Every rule added here lives inside `@media (max-width: 768px)` and sets only
   `min-height` (plus `display`/`align-items` on three inline links). It therefore cannot apply at
   1440 at all — which disposes of every 1440 finding — and on the screens where none of its
   selectors match, no element's box changes, so no finding can appear.
2. **By measurement.** Every affected screen where these selectors *do* match something was
   measured twice — as built, and with every added property switched back off in the browser.
   **Caused by this change: 0, on all six screens tested, at 390 and 768.** The change strictly
   *removes* sub-floor controls elsewhere: the practice-plan editor 71 → 66 at 768, the Development
   hub 9 → 6.

**What they actually are:** portal-wide touch debt that the baseline never saw, now visible because
the UAT fixture has filled out (probe sessions, probe plan templates, two sponsors, extra staff)
and because this shared working copy carries several other sessions' in-flight work. This is
`COACH_TOUCH_TARGET_DEBT_PLAN.md`'s own warning running exactly as written: *"an empty screen also
hides RED — a baseline captured against a thin fixture records the product as cleaner than it is,
so the true touch debt is a FLOOR, not a total. Do not read a rise as a regression."*

⚠ **They are deliberately NOT baselined here.** Recording 175 findings this pass did not examine —
under a reason it cannot honestly write — is precisely the failure this project existed to undo.
They belong to the touch-debt project, which now has a measured number to start from.

**Reported as distinct controls, not findings** — "318 findings fixed" would be theatre when 192 of
them were three controls repeated per player and per inning.
