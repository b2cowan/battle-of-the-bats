# Build prompt — the product has never decided what a tablet is

**Written 2026-08-27, out of the back-in-header spread (§113), which added six never-measured
screens to the rendered check and got 321 findings back. Open this in a FRESH session.**

⚠⚠ **THIS IS NOT A FIX-LIST, AND READING IT AS ONE IS THE FIRST WAY TO GET IT WRONG.** The 321 are
mostly one control repeated, and underneath them is a question nobody has answered: **what does the
641–768px band mean to this product?** Answer that first and most of the list resolves itself;
start fixing controls and you will hand-tune a hundred things into a shape nobody chose.

**Read first:**
1. `memory/design_decisions.md` **2026-08-26** ("THE WAY BACK MOVES INTO THE PAGE HEADER") — the
   pass that surfaced this, and the last entry in the log that names the same root cause.
2. `docs/projects/active/OWNER_QA_LEDGER.md` **§113** — the walk, and its "what this found that was
   not in its brief" section.
3. `scripts/check-layout-invariants.mjs` — `TAP_FLOOR_MAX_WIDTH` and how the floor is applied.
4. `scripts/.layout-baseline.json` — not to read through, but to **count** (see §3).

---

## 1 · HOW THIS BEGINS — BLOCKING, NO CODE BEFORE IT

Present in the conversation and WAIT for the owner's go:

1. **MOCKUPS — every change this pass proposes, drawn and published as a Claude Artifact, before
   any code.** This is the owner's evaluation step and it is not optional; see §5 for exactly what
   must be drawn and why a tap-target mockup is worthless unless it is true size.
2. **The design question in §4, answered as a recommendation**, with each option's cost stated in
   pixels and in rows a coach loses — and each option *drawn*, not only described. A tap target is
   the one thing prose cannot settle.
3. **The verified counts — re-derived from a clean run, not copied from §3 below.** ⚠ §3's numbers
   were true on 2026-08-27 against a degrading dev server and are perishable by design. The pass
   that produced this prompt was itself saved by refusing to trust the previous brief's inventory;
   do not break that chain.
4. **A PM-voice summary** of what a coach on an iPad sees differently when this is done.
5. **Anywhere the evidence contradicts this document** — raised, never quietly resolved.

---

## 2 · WHAT WAS ACTUALLY FOUND

Six coach screens had **no entry in the rendered check at all** — not skipped with a reason,
**absent**. §113 added them (a player's profile, the lineup builder, a lineup template, a plan
template, an evaluation session, an opponent's page) and seeded the three fixture rows that three
of them needed to open. The first honest run returned **321 findings**.

**None of them came from §113's change.** They are debt that has been shipping for months on
screens nobody had ever measured.

### ⚠⚠ THE RESHAPE — 321 FINDINGS IS ROUGHLY 35 DISTINCT CONTROLS

Nearly all of the volume is **one control repeated per player, per inning**:

- On the lineup template editor at 768: **107 findings, of which 72 are the same
  `Inning N position for #N <player>` dropdown** — 12 players × 6 innings — and another **24 are
  the per-row drag handle and remove button**. **Eleven** are genuinely distinct chrome.
- The lineup builder at 768 is the same shape (**108**), for the same reason.

So the two lineup editors carry **~200 of the 321 between them, from three repeated controls.**
The other four screens carry ordinary, ~5–8-distinct-control findings each.

**Fix the three families and the grid decision, and the list collapses.** Count controls, not
findings, before estimating anything.

### ⚠⚠ AND THE ROOT CAUSE IS PORTAL-WIDE, NOT LOCAL TO THESE SIX

- The rendered check enforces the 44px touch floor **up to and including 768px**
  (`TAP_FLOOR_MAX_WIDTH`).
- The coaches stylesheet writes its touch rules at **`max-width: 640px` sixty times** and at
  **768px fourteen times.**
- The baseline already holds **417 tap-floor findings at 768** — **more than 361 and 390 combined**
  (173 each).

**The product's touch sizing stops at 640. Real tablets and the check do not.** The six new screens
did not create that; they walked into it. §113 hit the same wall with one control and fixed it by
extending that control's floor to 768 — one data point, and the precedent this work should
generalise or overturn.

### ⚠ THE BASELINE IS MOSTLY UNEXPLAINED, AND THAT IS ITS OWN FINDING

**961 baselined findings; 698 carry NO reason at all.** At 768 specifically: 417 entries, **334
with no reason.** The mechanism asks for a reason and has largely not been given one.

**This matters to this work directly:** the cheapest way to "close" 321 findings is to baseline
them, and doing that without examining them would take the unexplained share from 698 to over 1,000
and make the record actively misleading. §113 refused to do it for exactly that reason — the
refusal is why this document exists.

---

## 3 · THE NUMBERS — verified 2026-08-27, RE-VERIFY THEM

| Screen | @361 | @390 | @768 | @1440 |
|---|---|---|---|---|
| A player's profile | 5 | 5 | 8 | 0 |
| Lineup builder | 8 | 8 | **108** | 0 |
| A lineup template | 6 | 6 | **107** | 0 |
| A plan template | 5 | 5 | 6 | 0 |
| An evaluation session | 6 | 6 | 7 | 0 |
| An opponent's page | 8 | 8 | 9 | 0 |

**321 total. Every screen is clean at 1440.** That is the tell: this is a touch-band problem, not a
layout problem.

⚠ **The run that produced the 768 column also hit a navigation failure on the lineup builder at
361, on a dev server that had been up for hours.** Restart the server before the clean run — a
degraded server produces "did not render" lines that look like defects and are not.

---

## 4 · THE DESIGN QUESTION — this is the whole job

**Is a 12-player × 6-inning lineup grid a touch surface?**

A 44px floor on 72 cells makes that grid roughly **530px of rows** and considerably wider than it
is now, on a screen 768px across. The grid is dense *on purpose* — it is a spreadsheet a coach
reads across.

Three honest answers, and the work is completely different under each:

1. **Yes — raise the cells.** The grid grows, scrolls more, and a coach on an iPad can actually hit
   a cell. Most expensive, and the option nobody should believe until they have seen it drawn at
   true size (§5, specimen 1).
2. **No — the grid is a pointer surface and is exempt, with a reason.** Then the exemption is
   written into the check (a real exemption with a name, **not** 200 baseline rows), and the
   remaining ~120 findings are ordinary work. ⚠ If this is the answer, the product owes tablet
   coaches *some* answer — a different arrangement at that width, or an honest statement that the
   builder wants a laptop.
3. **The band itself is wrong.** If 641–768 is not a touch band for this product, the check's own
   floor is what should move — and that is a one-line change with 417 baselined findings behind it,
   which is either a huge cleanup or a huge loss of coverage depending on who is right.

**⚠ Do not let this be decided by whichever is easiest to implement.** Option 3 in particular is
seductive because it makes 417 findings vanish; that is exactly why it needs the owner, not an
agent, and needs to be argued on what a coach holds in their hands at a game.

---

## 5 · WHAT MUST BE DRAWN — the owner evaluates this with their eyes, not from a list

**Every change this pass proposes is drawn and published as a Claude Artifact before any code**
(standing rules: mockups go to Artifacts, and an approved mockup IS the spec). Do not describe a
tap target in prose and ask for approval — the entire question is whether something is big enough
to hit, and that is not a thing anyone can approve from a number.

### ⚠⚠ TRUE SIZE, OR THE MOCKUP PROVES NOTHING

A tap-target mockup viewed at whatever zoom a laptop happens to be at is worse than no mockup: it
looks authoritative and answers the wrong question. Two requirements, both non-negotiable:

- **Draw inside a fixed 768px-wide frame**, with a visible 44px reference square and the real
  measurement printed beside each specimen ("34px today → 44px"). The frame must not reflow with
  the reader's window.
- **⚠ TELL THE OWNER TO OPEN THE ARTIFACT ON THEIR ACTUAL IPAD.** An Artifact is a URL, which is the
  one real advantage over a screenshot — the owner can put a thumb on the thing. Say so explicitly
  in the hand-off message; a mockup evaluated only on a desktop has not tested the claim.

### The four specimens — draw the DECISIONS, not the 35 controls

1. **The lineup grid at 768, all three §4 options side by side.** Same twelve players, same six
   innings, in each treatment, so the owner can see what raising the cells does to how much of a
   season fits on screen. This is the one that decides the project.
2. **The per-row control pattern** — the drag handle and the remove button on a player's row,
   today's size against the proposal. These repeat twelve times, so a small change here is the
   difference between a tidy row and a very tall one.
3. **The small-button pattern** — a player's profile carries a **15px** "Preview" and a **20px**
   "Manage dues →". Draw what those become; they are the most extreme offenders in the whole set
   and the least defensible.
4. **⚠ ONE WHOLE SCREEN, BEFORE AND AFTER, at true 768 width — and this is the one that cannot be
   skipped.** Specimens 1–3 each look reasonable in isolation; what nobody can judge from them is
   the **cumulative** effect of raising ~35 controls on one screen. If the answer is "the first
   thing a coach cares about is now below the fold," the owner has to see that before approving,
   not after it is built. Draw the lineup builder, because it is both the worst offender and the
   screen used standing up at a field.

### Caption rules

Per the standing mockup rule, every element carries a **NEW / RESTYLED / UNCHANGED** tag, so the
owner can judge scope, not just appearance. On this project the tags matter more than usual: most
of what is on screen is UNCHANGED and only the control sizes move, and a mockup that redraws the
whole screen in a fresh style would be asking approval for a redesign nobody proposed.

⚠ **Keep one file path across rounds** so the Artifact's version history threads together, and
write the source next to this prompt.

---

## 6 · WHAT THIS MUST NOT DO

- **Do not remove the six screens from the check.** They were absent for months and that is the
  defect this inherited. An absent screen reads as coverage from every direction.
- **Do not blanket-baseline.** A reason written across findings nobody examined is how a record
  starts lying, and this baseline is already 698 entries into that.
- **Do not fix the two lineup editors control-by-control** before §4 is answered.
- **Do not touch the shared hub chrome piecemeal.** The standing precedent (from the commitment
  page, 2026-08-26) is: *raise the controls your change OWNS; the shared header and toolbar are a
  separate, deferred fix that lands on every screen id at once or is not the fix.*
- **No new back treatment, no header changes.** §113 is closed and its rules stand.

---

## 7 · TRAPS, ALL PAID FOR ALREADY

- ⚠⚠ **THE TAP FLOOR COMES FROM THE SURFACE A CONTROL SITS ON.** §113's arrow was verified at 390
  and nowhere else, so it shipped at 34px through the whole 641–768 band on twelve screens. **Verify
  a control at every width the check measures, not at the one the design was drawn for.**
- **A control repeated per row is one defect, not N.** Ninety-six of one screen's 107 findings are
  three controls. Report distinct controls; a "321 findings fixed" claim would be theatre.
- **The check's element signature is the accessible name.** Changing a label changes the baseline
  key and orphans its entry — a silent loss of a recorded decision.
- **`--changed` sweeps only 361 and 1440 by default**, so *this entire band is invisible to the
  everyday path*. That is how it got here. Run 768 explicitly.
- **The dev server leaks per request and these are heavy screens.** Restart before a clean run;
  never run two sweeps at once (it has cost this repo a full working day already).
- **Concurrent sessions share this working copy.** Explicit pathspecs; `git show --stat HEAD`
  afterwards; and if a file you need carries another session's hunks, stage a constructed blob
  rather than the file.

---

## 8 · EVERY PHASE CARRIES THESE

**Mockups approved before code** (§5 — including the whole-screen before/after, and confirmation
the owner opened it on a real tablet) · typecheck · focused lint · unit tests · a **clean-server**
`check:layout` run at 361/390/768/1440
on every screen touched, with the **distinct-control** count reported, not the finding count ·
`check:demos` · a new **Owner QA ledger section with a checkable artifact** (owner ruling
2026-08-26: every QA walkthrough is an artifact with real checkboxes) · TODO + this plan updated in
the same unit of work · and, if §4 lands on an exemption, the exemption written into the check with
a name and a reason rather than into the baseline.
