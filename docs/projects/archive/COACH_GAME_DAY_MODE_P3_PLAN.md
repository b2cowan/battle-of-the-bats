# Game-Day Mode — Phase 3 Plan ("playing-time polish")

**Status:** ✅ **BUILT on dev 2026-08-05, UNCOMMITTED.** Owner signed off every recommendation in
§7 on 2026-08-05, opening Gate 2. Built as planned: the bench sort (frozen per period), the
season-default arm-care cap, and the wake lock. **Cut as planned:** tonight-vs-season deltas and
the line score. **No migration.** Owner QA = `OWNER_QA_LEDGER.md` **§1.18** (and §1.15's
bench-order deviation is answered there, not twice).

**Built-vs-plan deltas, both from the funnel:**
1. **The bench group label is conditional.** `/review` found that a mid-period benching of a
   long-time sitter leaves them at the bottom (correct — the freeze) with a "5th straight" chip
   (also correct), which makes an unconditional "longest sitting first" label false. The label
   now claims the order only while the order still holds, and returns at the next boundary.
   Frame 19 draws the unconditional label — this is the one deviation from rev 5.
2. **A third spelling of the cap rule was converged**, not just the two the plan named: the
   season-analytics rollup had its own copy. §4.2's "flag, don't fix" still applies to the
   generator alone.

**Date:** 2026-08-05
**Parent plan:** `COACH_GAME_DAY_MODE_PLAN.md` (§7 P3 scope, §9 parked questions)
**Build prompt:** `COACH_GAME_DAY_MODE_P3_BUILD_PROMPT.md`
**PM brief:** `COACH_GAME_DAY_MODE_PM_BRIEF.md` → *Phase 3* section
**Mockups:** Claude Artifact "Game-Day Mode — bench console" — **rev 5**, frames 19–23
**Predecessors:** P1 COMMITTED dev `bcd695a3`; P2 (moments) **COMMITTED dev `f03e0e46`**
(verified 2026-08-05 — the parent plan's "uncommitted" line is stale); migration 228 applied to
dev, **PROD-PENDING**.

> ⚠ **Owner QA is not a dependency of this phase** (ruling 2026-08-05). §1.15 and §1.17 are
> written and waiting for one full QA day. Nothing here waits on a verdict. The two questions
> that used to read "wait for QA" — the helper board and the bench-sort deviation — are owner
> **decisions on the sign-off card** (§7), answered from the drawings.

---

## 1. The honest summary

P3 is the first Game-Day phase that is genuinely optional. The console already works; every
candidate is polish on a working screen. So the plan's first job is to argue what **not** to
build, and it does:

| # | Candidate | Verdict | Why |
|---|---|---|---|
| 3.1 | Bench sorted longest-benched-first | **BUILD** | A signed-off drawing that didn't get built. Small, but it decides where the coach's eye lands. |
| 3.2 | Pitching cap reads the **season default** | **BUILD — the one with a safety argument** | Today a team with a season-wide cap and no per-player caps gets **no arm-care chip at all**. |
| 3.3 | "Playing time tonight" vs season averages | **CUT** | Duplicates the season report on a smaller screen, at a materially heavier read, in the phase most likely to write itself into a verdict. |
| 3.4a | Wake lock (parked owner question) | **BUILD, if the owner says yes** | Cheap, reversible, visible, and the console is a screen you glance at for two hours. |
| 3.4b | Per-period line score (parked owner question) | **DEFER AGAIN** | Needs a migration and a new half-finished record at the field. That is the D4 error with a scoreboard on it. |

Net phase: **two display fixes and one screen behaviour.** No migration, no new route, no new
write, no notification, no archive-list edit. If the owner cuts 3.4a as well, P3 is a
half-day and still worth doing for 3.2 alone.

---

## 2. What is NOT being built (read this first)

- **Tonight-vs-season playing-time deltas (§3.3).** Cut. Reasoning in §5. Drawn in frame 23 so
  the decision is visible and reversible, not silently dropped.
- **A per-period line score.** Deferred for the third time. No schema exists; inventing one
  creates exactly the half-finished parallel record D4 exists to prevent (a coach who logs
  innings 1–3 and stops has produced a line score that lies). Revisit only on a real customer
  ask, and then as its own phase with its own migration.
- **Any change to the auto-fill generator's cap arithmetic.** §4.2 documents a genuine
  inconsistency found while planning — the generator takes the *stricter* of the per-player and
  team caps, while the data model and the arm-care card treat a per-player cap as an override.
  P3 **flags it and matches the data model**; it does not change lineup generation, which is a
  separately-tested unit of work.
- **Batting-order editing in the console**, any new record written at the field, any change to
  the one-notification promise, and any moments change. Out by construction.
- **Re-opening the Helper board question** beyond the ruling asked for in §7 Q7.
- **Any new gesture, sound, vibration or auto-advance.** The practice-run bans carry over intact.

---

## 3. Item 3.1 — the bench, sorted (and the rule that keeps it still)

### What is true today
The board's Bench group renders players in **roster order** and relies on the red
"2nd straight inning sitting" chip to draw the eye. Signed-off mockup frame 2 says
*"Longest-benched sits on top."* The arithmetic already exists on the screen (it drives the
chip), so this is a **sort, not a new calculation**.

### The real question
Does the row order change under the coach's thumb mid-period? A list that re-orders itself
between the moment a coach looks and the moment they tap is how the wrong child gets subbed in.
Three options were weighed:

| Option | Behaviour | Verdict |
|---|---|---|
| **(a) Sort at the period boundary, frozen within a period** | Order is computed when the period cursor moves; a player benched mid-period joins the **bottom** of the list, and nobody already on it moves. | ✅ **Recommended** |
| (b) Sort always | Re-orders the instant any sub lands — including immediately after a tap, while the coach's thumb is still travelling. | ❌ The defect the drawing invites |
| (c) Keep roster order, make the chip louder | Zero risk, zero change to where the eye lands on a 12-player bench where the chip sits below the fold. | ❌ Declines the drawing without a reason |

Option (a) is recommended because it is the only one where the sort's own logic and the
freeze agree: a player who just sat down has a streak of 1 and would sort **last** anyway, so
"append newcomers to the bottom" is not a special case — it is the sorted answer, arrived at
without moving anything.

### Sort key (stable, in this order)
1. Bench streak through the current period, **descending** (the existing `benchStreakThrough`).
2. Total bench periods so far this game, descending.
3. Existing roster order (the stable tiebreak — never jersey-number arithmetic, which is not
   an ordering the coach thinks in).

### Where it lives
`benchStreakThrough` is currently a local function on the console page. P3 moves it and the new
ordering into `lib/coach-game-day.ts` as one pure, table-driven-testable function
(`orderBenchRows(rows, period)`), beside the swap math it belongs with. **No new module** — that
is the /simplify answer given in advance.

### Is this a P1 defect or P3 scope?
Recommended: **P3 scope, built first.** "Fix it before the P1 commit" is no longer available —
P1 is committed (`bcd695a3`). The work, the freeze decision and the tests are identical either
way; the only difference is the label. Logged in ledger §1.15 either way so it isn't lost.

---

## 4. Item 3.2 — the pitching cap reads the season default (the safety item)

### What is true today
The board renders `{N} of {cap} innings pitched` and reddens it at the cap — but `cap` is read
**only** from the player's own arm-care cap. The aggregated console read never sends the
season-level default. **Consequence: a team that set one season-wide cap and no per-player caps
sees no chip at all**, so the console is silent about arm care for most of the roster — on the
one screen where a coach is deciding who pitches the next inning.

This is the strongest argument in the phase and the reason P3 is worth doing at all.

### 4.1 The resolution the console must use
The same one the lineup builder already uses, in the same order:

```
per-player cap  ??  this game's rules override  ??  the season default  ??  no cap (no chip)
```

The middle two are already resolved together by the existing `resolveLineupCaps(season, override)`
helper; the console reuses it rather than spelling it a second time. The per-game override lives
on the lineup row the console **already reads**, so the only payload change is the season default.

### 4.2 ⚠ Found while planning: two spellings of "the cap that applies"
- The **data model** says a per-player cap is an override (`maxInnings … null = use the season
  default`), and the **arm-care card** on Overview reads it that way.
- The **auto-fill generator** takes the **stricter of the two** — so a coach who sets a season
  default of 3 and then deliberately gives one pitcher a personal cap of 4 has that 4 ignored
  by auto-fill, and honoured by the arm-care warning.

Recommendation: the console follows the **data model + arm-care** spelling (per-player wins).
The generator divergence is **flagged, not fixed** — changing lineup generation is a different
unit of work with its own tests. Recorded here and in the ledger so it is not re-discovered.

### 4.3 Payload
One field on the existing aggregated game-console read (never a second route):
`seasonPitcherCap`, gated with the lineup zone, since it is only meaningful where the board is.
No migration; the value is already stored and already read elsewhere.

### 4.4 What the chip says
- Player **with** a personal cap → unchanged from today.
- Player with **no** personal cap on a team **with** a season default → the chip appears, with
  the number from the season default. Same words, same reddening at the cap.
- **Neither** set → no chip. Silence stays silence; the product never invents a ceiling
  (the standing arm-care rule — this module may only report numbers the coach set).
- The chip still only renders for a player actually pitching this game.

---

## 5. Item 3.3 — "Playing time tonight" vs season averages: **cut**

The after-game recap already shows tonight's periods per player, as bars. P3 would add each
player's own season average beside it.

Why it is cut:

1. **It duplicates the season report** — which the recap already links to, one tap away, on a
   screen with room for it.
2. **It is the wrong read on the wrong screen.** Season averages need every saved lineup for the
   season; the console's read is deliberately one event. Loading a season to decorate a card
   that renders only *after* the game is a real cost paid on a live-game screen.
3. **A one-game delta is close to meaningless** in a sport where a coach rotates deliberately.
   "3 tonight vs 4.6 average" reads as a shortfall on a night the coach chose.
4. **It is the item most likely to write itself into a verdict.** The playing-time vocabulary
   ruling (2026-08-04) binds: measurement in context, never a fairness verdict — no "behind",
   no red/green judgement, no ranking of children against each other. A delta with a bar is one
   careless colour away from breaking that, for value already available elsewhere.

If the owner wants it anyway, the smallest honest version is drawn in **frame 23**: plain
numbers (`Tonight 5 · Season 4.6`), each child against **their own** average only, no bar
comparison, no colour, fetched lazily in review mode from the existing season-analytics route —
never on the live path. Recommended **no**.

---

## 6. Item 3.4 — the two parked owner questions

### 6.1 Wake lock — recommended **yes**, with rules
The practice-run screen bans it. A bench console is a different object: a coach glances at it
between pitches for two hours, and a phone that sleeps every 30 seconds turns a two-tap
substitution into a four-tap one. If the owner says yes, the rules are:

- **Live window only.** Review mode never holds the screen awake.
- **Drive grants only.** A read-only Helper's battery is never spent on a board they can't touch.
- **Visible, never silent** — a header chip reading *Screen staying on*, one tap to turn it off,
  remembered for the game like the other console UI preferences.
- **Released automatically** when the tab is hidden, on End game, and on leaving the screen.
- Unsupported browsers simply don't show the chip. No warning, no fallback, no nag.

It is cheap, reversible, and entirely coach-visible — which is why it is worth asking now rather
than deriving from first principles. **The owner has now run real games; this is a direct
question, not a design exercise.**

### 6.2 Per-period line score — recommended **defer again**
No schema exists. It needs a migration, and it creates the one thing this feature was designed
around not creating: a parallel record at the field that is worthless when half-finished. Defer
until a real customer asks, then scope it as its own phase.

---

## 7. What needs signing off (mirrors mockup rev 5)

| # | Decision | Recommendation |
|---|---|---|
| **Q1** | Bench sort — P1 defect or P3 scope? | **P3 scope**, built first (P1 is already committed; the work is identical) |
| **Q2** | Which sort rule? | **(a)** sort at the period boundary, frozen within a period |
| **Q3** | Build the season-default cap chip? | **Yes** — the safety item |
| **Q4** | Which cap spelling does the chip show? | **Per-player wins** (data model + arm-care). Generator's stricter `min()` flagged, not fixed |
| **Q5** | Wake lock? | **Yes**, live-window + drive-grants only, visible chip, off in one tap |
| **Q6** | Tonight-vs-season playing-time context? | **No — cut.** Frame 23 draws the minimal version if you disagree |
| **Q7** | *Inherited:* the Helper and the board (mockup frame 10 draws it read-only; what shipped hides it) | **Keep what shipped** — the lineup grant gates strategy data; re-caption frame 10 rather than re-open the board. P3's chip and sort then never reach a Helper, by construction |
| **Q8** | Line score | **Defer again** |

---

## 8. Constraints this phase does not re-litigate

- **D4 by construction.** P3 changes what the console *shows*, never what it *stores*. Every
  item here is derived from data that already exists.
- **Live-season instrument.** The console stays on the live rail and joins **neither**
  `APPROVED_ARCHIVE_DOORS` nor `APPROVED_SEASON_AWARE_ROUTES`. The write-guard contract must stay
  green **with no list edits** — if a P3 change ever needs one, that is the signal to stop.
- **No notifications of any kind.** The one-notification-at-End-game promise is untouchable.
- **No new optimistic interaction.** The bench order and the cap chip are *derived* from state
  that already exists; the wake lock is a local device behaviour with no request behind it. So
  the standing rule ("an optimistic rollback must undo only its own change" — three prior
  defects on this screen) has **nothing to bite on in P3**, and that is deliberate. If any P3
  change grows a request, it stops being P3.
- **Tokens only** (hex fallbacks are caught by the operator ratchet); sport-neutral vocabulary via
  the Sport Pack; the playing-time vocabulary ruling applies to every word on the screen.
- **One aggregated read.** `seasonPitcherCap` extends the existing game-console read; per-zone
  data stays gated at the SOURCE (`can` flags gate affordances, never data).

## 9. Data model

**None.** No migration. Confirmed: every P3 item reads data that already exists
(`lineup_settings.pitcherMaxInningsDefault`, `rep_team_lineups.rules_override`, the lineup grid
itself). If that changes during the build, one migration-writing session at a time — take the
next free number from `supabase/migrations/` at write time, never pre-claim one.

## 10. Sequencing before code (Gate 2)

1. **Owner sign-off on this plan + rev 5** (§7), including Q1 and Q7.
2. ✅ **P2 is committed** (`f03e0e46`) — this gate is already satisfied. It was a
   shared-working-copy rule, not a QA gate: no third uncommitted layer on the same screen while
   other sessions work in this checkout.
3. **Migration 228 is prod-pending.** P3 adds none of its own.

## 11. Verification bar

- **Unit, pure and table-driven** (like P1's 54): the bench ordering *including its stability
  rule* (a mid-period sub does not move an existing row; the boundary re-sorts once), and cap
  resolution (per-player over game override over season default; neither set = no chip; a
  non-pitching player = no chip).
- **All existing suites green with no list edits:** P1's 54 game-day tests, P2's 22 moments
  tests, the mirrored-game 409s, the season-write-guard contract.
- `npm run typecheck` · full `npm test` · `npm run verify:changed`.
- ⚠ **Run the rendered layout check** if a dev server is up — P1 and P2 both skipped it for want
  of a seeded probe GAME, and P3 is the phase most likely to change what the board looks like at
  340px. **If it is skipped again, say so in the ledger** rather than letting it read as passed.
- Post-build: `/simplify` → `/review` → `/docs` (the game-day guide's arm-care and playing-time
  paragraphs both move).
- New `OWNER_QA_LEDGER.md` **§1.18**, phone-first, cross-referencing §1.15's bench-sort item so
  the same question is never asked twice.
- Dev-server restart before owner browser QA (shared module + payload change).
