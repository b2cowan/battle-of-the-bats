# Tryout names switch + score breakdown — implementation plan

**Status:** BUILT ON DEV 2026-08-25. Awaiting owner QA (`OWNER_QA_LEDGER.md` §103).
**Owner ruling:** 2026-08-25 — blind evaluation becomes a two-way switch; the Decide board gains a
per-player breakdown; the rating leads the row.
**Mockup (approved, binding):** `claude.ai/code/artifact/55c9e3d6-f8f4-4c40-b711-d2b8d8a0a666`
**Migration:** 263 — **applied to DEV only.** Must reach prod BEFORE this code is promoted.

---

## 0. What was actually wrong

The owner's report was *"it is very hard to know where to go to update this feature"*, pointing at
the check-in screen's `Blind · names hidden` chip. Investigation widened it twice:

1. **The chip was a dead end.** Four screens reported the blind state (check-in, the live board, the
   Set-up card, Decide) and exactly one — Decide, three stages forward — carried the control.
2. **The control was one-way, and coaches did not want that.** Blind was on at birth; the only
   permitted change was a permanent reveal, guarded server-side by a 409 (`already_revealed`). A
   coach who never wanted blind scoring had to walk to Decide to switch it off. The owner's answer,
   after the one-way rule was argued for: *"many coaches just want to be able to see names and bib
   numbers — make it easy for them to switch."*
3. **The one-way rule was silently doing a SECOND job** (raised before the work started, accepted):
   it made `is_anonymous` **evidence**. The tryout report's fairness receipt tells a parent the
   scoring was blind. A switchable flag cannot support that sentence.

Separately, on the Decide board: the composite score sat in small grey text inside the meta line,
while the **live scoreboard — same players, same ranking helper, same arithmetic — printed it
large**. The two screens had drifted, and a coach had no way to see what made a number.

---

## 1. The names switch (`TryoutNamesSwitch`)

**One component, four mounts.** Replaces `TryoutRevealControl` (deleted).

| Where | Was | Now |
|---|---|---|
| Tryout day → Check-in | inert `Blind · names hidden` chip | the switch, wired to the candidate list |
| Tryout day → Live board | a sentence in the subtitle | the switch, beside the score lock |
| Set up → Tryout dates | a hint paragraph ending "reveal on the Decide tab" | hint + switch on one row |
| Decide | one-way `Reveal names` + a confirm | the switch |

- **State and control are the same object.** The pill reports `Names hidden` / `Names showing` and
  changes it; a track+knob makes it read as a control rather than a label (the original defect).
- **Two hues, not one at two opacities** — blue keeps the meaning the old blind chip taught, olive
  is the portal's normal-state accent. A coach in a dugout reads colour before text.
- **Assistants get `.static`** — the same words, no control. Seeing the state is not the same
  permission as changing it.
- **No confirmation dialog.** The old one said "this can't be undone"; once it can be, the dialog is
  friction attached to a false statement.
- **Controlled or self-loading.** Hosts that already know the state (check-in, live board) pass
  `blind`; the others fetch. Tri-state internally (`null` = still loading) so the pill never flashes
  a state it hasn't confirmed.
- **It changes the tryout, not one person's view** — helpers' phones and the printed check-in sheet
  follow. Deliberate, and the reason assistants are read-only.

### 1.1 The honesty half — migration 263, `rep_tryouts.names_shown_at`

Write-once timestamp, stamped the first time names are shown, **never cleared**.

- The **route** stamps it (`isAnonymous: false` and no existing stamp); `updateRepTryout`'s field
  type admits no null, so no caller can clear it however carelessly it patches.
- The **report** reads the stamp, never the live flag: `blind: 'throughout' | 'names_shown'`.
  - `throughout` → *"players appeared as bib numbers only, start to finish"*
  - `names_shown` → *"…until names were shown on Aug 12, 2027"* (undated if the stamp is absent)
- **Backfilled** in the same migration from `updated_at` for rows already revealed under the old
  rule. Without it, every historical tryout would have claimed *blind throughout* the moment the
  report started trusting the column — a new lie, in the flattering direction.
- **One predicate, `wasBlindThroughout`** (post-review, §7.1): `isAnonymous && !namesShownAt`. The
  second half catches a row revealed before the stamp existed — not stamped but visibly not blind is
  still not blind — and it fails closed on an absent tryout. The development baseline calls the same
  function; it used to answer the question itself, and answered it wrongly.

---

## 2. The rating leads the Decide row

The score moves out of the meta line into a `.ratingBtn` block between the rank and the player —
large number, evaluator count beneath, hairline on its right so it reads as a column. Unscored is a
smaller, dimmer dash so a board of un-scored kids does not read as a board of low scores.

The meta line now carries the player's **three strongest categories** (ordered by score, not card
order), so a collapsed row says something about the kid before anything is opened.

Phone: the row already wrapped at ≤560px with the decision buttons taking their own full-width line;
the rating rides on the first line with the rank and the name.

---

## 3. The breakdown (`ScoreBreakdown`, inside the board)

Opens under the tapped player — one at a time, because the panel is for looking hard at one kid and
five open panels is a ranked list nobody can scan. Two tap targets: the rating block and the
categories line, both `aria-expanded`.

**Half one — where the score came from.** Every scorecard category with its cross-evaluator average,
a bar, and **the share** (never the raw weight — the standing scorecard-weights ruling). The weakest
category is marked in a second channel as well as colour, and named in the note.

**Half two — who it came from.** Each evaluator's own composite for that player, highest first.
This is the half that earns the feature: `4.1` from a `4.6` and a `3.5` is a different player from
`4.1` three helpers agreed on. Rows whose spread reaches **20% of the scale** get the note
*"These helpers are N apart on the same player — worth a second look."*

Evaluator identity is **not** blind-gated: blind hides the candidate from the scorer, never the
scorer from the head coach.

### 3.1 Shared arithmetic — `weightedComposite`

Extracted from inside `rankTryoutCandidates` the moment a second caller appeared, and
`evaluatorCompositesByCandidate` composites one evaluator's scores through the same function. A
partial evaluator is composited on the categories they filled, exactly as a partly-scored candidate
is. Two hand-copies of a weighting rule is how a panel ends up contradicting the row it opened from
— `tests/unit/tryout-scoring.test.ts` holds the single-evaluator case where that would show.

---

## 4. Coverage

- `tryout-scoring.test.ts` (new, 9 assertions): share weighting beats an even mean;
  re-normalization over scored categories; zero-weight fallback; null ≠ zero; **two candidates with
  an identical composite separated by their spread**; partial evaluator; agreement with the headline
  composite for a solo evaluator.
- `tryout-report.test.ts`: two new tests, one of them the reason the column exists — *the only input
  that differs is the stamp; the live flag is blind in both cases* — plus the un-stamped legacy row.
- Post-review: one more test pins the shared blind predicate (§7.1). Full suite **2,518 passing**,
  typecheck clean, `verify:changed` green except the expected dev-only schema parity (migs 262 + 263
  awaiting the next prod release), and `check:layout` reports no new findings on the tryouts screen.

---

## 5. Follow-through done in the same unit of work

- **Data Dictionary** — `names_shown_at` documented; `is_anonymous` re-described as view state, with
  an explicit "do not use this for the fairness claim" warning. Snapshots refreshed (watermark #263).
- **In-app help** — the tryouts recipe and the blind FAQ rewritten (they promised one-way reveal in
  three places); the fairness-receipt sentence corrected in three more; search keywords and
  `searchText` re-indexed for *show names / hide names / names switch / score breakdown / helpers
  split*.
- **Demo narration** — the pitch/walkthrough tryout panel said "you reveal them when you are ready";
  now describes the switch and the breakdown.

## 6. Deliberately not built

- **A per-coach view override** (head coach sees names while helpers stay blind). Raised with the
  owner; the ask was for the tryout setting, not a personal view. Different feature.
- **A reveal history** beyond the first stamp. One write-once moment answers the report's question;
  a full audit trail is a bigger claim than anything reads today.

---

## 7. `/review` — what the funnel caught (2026-08-25, post-build)

High-risk tier, 5 lenses. 13 findings → 11 confirmed and fixed, 2 refuted. Security/PII and the API
contract were clean; the lesson is concentrated in the two below.

### 7.1 The ruling broke an invariant in a feature nobody edited

`is_anonymous` stopped being evidence the day the switch became two-way. That was **understood** —
it is why migration 263 exists — and the fix was still applied only where the problem was reported.
`lib/tryout-baseline.ts` was freezing `blindUsed` from the live flag into a **permanent** development
card, so the same tryout could be labelled blind on one screen and honestly described on another.

**The rule: when a premise dies, grep for the premise, not for the bug.** `wasBlindThroughout` now
exists so the question has one answer, and a truth-table test pins it.

The second instance was a comment, not code: "revealing names is one-way, so there is no transition
that could strand stale memory on screen" was load-bearing documentation for why a map is never
cleared. Still no leak — a `c.name &&` render gate holds it — but a future editor trusting that
comment would remove the only thing that does.

### 7.2 A panel that contradicts the number it explains is worse than no panel

Shares were computed over every category on the scorecard; the composite re-normalizes over the ones
actually scored. A half-scored candidate was shown a percentage for a category that contributed
nothing to the score printed directly above it — in the one surface built to explain that score.
Shares now cover the scored subset only, and an unscored row says "not scored" rather than claiming
a share.

### 7.3 Four copies of one control need one source of truth

Three separate stale-pill defects, all the same shape: Set up (page state outranks the card, and the
page only refreshes when a session moves), Decide (a self-loading copy fetched once and never again,
on a page where every stage stays mounted), and the live board (bypassed the poll invalidation its
neighbour uses). Plus a response landing after a team switch — the portal does not remount across
teams, which is why every sibling loader here carries a sequence token.

### 7.4 The rendered check earned its slot again

The switch measured **25px against the 44px tap floor** — invisible to types, lint, and every
file-reading gate. Also worth recording: an intermediate sweep reported the page as crashed, and it
was the dev server exhausted after three back-to-back full sweeps, not the code. **A degraded sweep
is not evidence in either direction** — restart, then re-run scoped.

### 7.5 "Corrected in the same unit of work" was false when written

Five customer-visible strings still described the retired one-way reveal, including the demo tour.
The claim had already been recorded in TODO.md and the PM brief before the grep that would have
proved it. State what was checked, not what was intended.
