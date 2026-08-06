# Game-Day Mode — Phase 3 Build Prompt ("playing-time polish")

**Status:** ⛔ **NO CODE.** This session's deliverable is a **written plan + a mockup round**,
presented for owner sign-off. Phase 3 is the first Game-Day phase that is genuinely
*discretionary* — every item is polish on a screen that already works — so the plan's honest
job is partly to argue what NOT to build.

**Parent plan:** `COACH_GAME_DAY_MODE_PLAN.md` — §7 P3 scope and §9's two parked owner
questions bind. **P1 is COMMITTED dev `bcd695a3`**; **P2 (moments) is BUILT on dev,
uncommitted**, `/simplify` + `/review` + `/docs` all run.

⚠ **Owner QA is deliberately NOT a dependency of this phase.** The owner runs one full QA day
across every pending ledger entry once the projects are complete (ruling 2026-08-05). §1.15 and
§1.17 are written and waiting; nothing in P3 waits on them. Keep writing the ledger as you go —
§1.18 is still owed at the end — but never gate work on a verdict.

---

## Gate 1 — Plan + mockups FIRST (hard; nothing else happens this session)

1. **Write `COACH_GAME_DAY_MODE_P3_PLAN.md`** in `docs/projects/active/` (+ a short PM brief
   per AGENCY_RULES) covering the scope below, and add the one-line TODO.md pointer.
2. **Extend the SAME mockup artifact** — "Game-Day Mode — bench console",
   `46d0fa8b-f009-47b2-b62c-0b52f54bf6fe` — as **rev 5** (republish the same URL). Rev 4 is the
   signed-off P1+P2 spec; **do not alter its frames** except where P3 genuinely changes one,
   and label any such change the way rev 4's frame 11 labelled the footer.
3. **Present in-conversation with an explicit sign-off set**, the way rev 4 did: one card per
   open decision, each with a recommendation. Do not bury a decision in prose.
4. **Only after explicit owner OK does Gate 2 open.**

⚠ **The plan must include a "what we are NOT building" section.** P3 is optional by
construction. A plan that proposes all four items with equal enthusiasm has not done its job.

---

## Gate 2 — Sequencing before any code (all three)

> ⚠ **P3 is NOT gated on owner QA** (owner ruling 2026-08-05). The owner runs one full QA day
> across every pending ledger entry once the projects are complete — so §1.15 and §1.17 being
> untested blocks nothing here. **Never re-introduce a QA dependency into this phase.** Any
> question that previously read "wait for the QA verdict" is instead an **owner decision to put
> on the Gate 1 sign-off card**, answered from the drawings.

1. **Owner sign-off on the P3 plan + rev 5 mockups** (Gate 1) — including the two inherited
   decisions, which belong on the sign-off card, not in a QA queue:
   - **The helper board** (§1.15): a schedule-only Helper currently sees NO bench board;
     mockup frame 10 drew it read-only. P3's surfaces inherit whichever way this is ruled.
   - **The bench-sort deviation** (§3.1 below): P1 defect to fix now, or P3 scope.
2. **P2 is COMMITTED.** Not a QA gate — a shared-working-copy one: do not stack a third
   uncommitted layer on the same screen while other sessions are working in this checkout.
3. **Migration 228 is PROD-PENDING.** P3 needs no migration of its own (confirm this in the
   plan). If that changes, one migration-writing session at a time: take the next free number
   from `supabase/migrations/` at write time, never pre-claim one.

---

## Scope — four candidates, and the honest state of each

### 3.1 Bench sorted longest-benched-first — ⚠ **this is a P1 GAP, not new polish**

Mockup frame 2 (signed off) says *"Longest-benched sits on top."* **The built screen does not
do this** — the bench renders in roster order and leans on the red "2nd straight inning
sitting" chip instead. Verified 2026-08-05; also logged in ledger §1.15 so it isn't lost, but
**the ruling belongs on the Gate 1 sign-off card, not in the QA queue** — it decides this
phase's scope, so it has to be answered before code either way.

- The bench-streak arithmetic **already exists** on the screen (it drives the chip), so this is
  a sort, not a new calculation.
- **The plan must ask the real question:** does the row order change under the coach's thumb
  mid-game? A list that re-orders itself between the moment a coach looks and the moment they
  tap is how the wrong child gets subbed in. Options to weigh and recommend:
  (a) sort only on period change, never mid-period; (b) sort always; (c) keep roster order and
  make the chip louder instead. **Recommend one.**
- If the owner rules this a **P1 defect** rather than P3 scope, it moves out of this phase and
  gets fixed before the P1/P2 commit. Say so and re-scope rather than absorbing it silently.

### 3.2 Pitcher-cap countdown — **partly built; the gap is the SEASON default**

P1 already renders `{N} of {cap} innings pitched` and reddens it at the cap. What it does
**not** do: read the **season-level default cap**
(`programYear.lineupSettings.pitcherMaxInningsDefault`). Today a team that set one season-wide
default and no per-player caps gets **no chip at all** — the console silently has nothing to
say about arm care for most of the roster.

- This is the item with the strongest safety argument in the whole phase.
- The lineup builder and the auto-fill already resolve per-player-then-season; the console must
  use the **same resolution**, not a second spelling of it. Find the existing helper first.
- Mockup: show the chip on a player with **no personal cap** on a team **with** a season
  default, and say in the caption where the number came from.

### 3.3 "Playing time tonight" vs season averages

The after-game recap shows tonight's innings per player. P3 would show them **in context** —
this player against their own season average.

- ⚠ **The playing-time vocabulary ruling (2026-08-04) binds hard here.** Measurement in
  context, never a fairness verdict. No "behind", no "unfair", no red/green judgement, no
  ranking of children against each other. Draw the words, not just the bars — this is the item
  most likely to write itself into a verdict by accident.
- Weigh: is a one-game-vs-season delta even meaningful in a sport where a coach rotates
  deliberately? The plan should be willing to answer "no, cut it."

### 3.4 Parked owner questions (plan §9) — decide them in this round

- **Wake lock.** The practice run screen bans it; a bench console arguably wants the screen to
  stay on. The owner has now (or will shortly have) run a real game — **ask directly**, don't
  re-derive from first principles. If yes: it is a live-window-only, coach-visible behaviour,
  never silent.
- **Per-period score breakdown (line score).** No schema exists for it. Deferred since P1.
  Recommend defer again unless the owner has heard a real ask; if built, it needs a migration
  and therefore its own sequencing.

**Explicitly OUT of P3:** anything that writes a new record at the field (D4), any change to
the one-notification promise, batting-order editing in the console, and any moments change
(P2 is done and QA'd separately).

---

## Constraints that bind (do not re-litigate)

- **D4 by construction.** P3 changes what the console *shows*, never what it *stores*. If a
  proposed item needs a new record at the field, it is out of scope — say so in the plan.
- **Live-season instrument.** The console rides the live rail and joins NEITHER
  `APPROVED_ARCHIVE_DOORS` nor `APPROVED_SEASON_AWARE_ROUTES`. The write-guard contract must
  stay green **without list edits**.
- **No notifications of any kind** are added by P3. The one-notification-at-End-game promise is
  untouchable.
- **Practice-run bans carry over:** no gestures, no sound, no vibration, no auto-advance.
- **Tokens only** (hex fallbacks get caught by the operator ratchet); sport-neutral vocabulary
  via the Sport Pack; the playing-time vocabulary ruling applies to every word.
- **Read payload:** extend the existing aggregated game-console read rather than adding a
  second read route; per-zone data stays gated at the SOURCE (`can` flags gate affordances,
  never data).
- ⚠ **Optimistic UI rollback must undo ONLY its own change**, never restore a pre-request
  snapshot. This defect class has now appeared three times on this screen (P1 attendance, P1
  lineup save, P2 moment delete). If P3 adds any optimistic interaction, this is the review's
  first question.

---

## Shared working copy (unchanged rules)

- Other sessions' uncommitted hunks live in shared files. Commit with explicit pathspecs only,
  `:(literal)` for bracketed dirs, hunk-level splitting where a shared file mixes sessions,
  per-action owner OK.
- NEVER round-trip a source file through PowerShell Get-Content/Set-Content (ANSI read →
  whole-file mojibake). Edit tool or bash only.

## Verification bar (if Gate 2 opens)

- Unit: the bench sort (incl. its stability rule), season-default cap resolution (per-player
  overrides season; neither set = no chip), and any context arithmetic — all pure and
  table-driven, like P1's 54 tests.
- P1's 54 game-day tests + P2's 22 moments tests + the mirrored-game 409s + the season-write-guard
  contract all stay green **with no list edits**.
- `npm run typecheck` · full `npm test` · `npm run verify:changed`.
- ⚠ **Run the rendered layout check this time if a dev server is up** — P1 and P2 both skipped
  it for want of a seeded probe GAME, and P3 is the phase most likely to change what the board
  looks like at 340px. If it is skipped again, SAY SO in the ledger rather than letting it read
  as passed.
- Post-build: `/simplify`, then `/review`, then `/docs` (the game-day guide's arm-care and
  playing-time paragraphs both move).
- New `OWNER_QA_LEDGER.md` §1.18, phone-first, and **cross-reference §1.15's bench-sort item**
  so the same question isn't asked twice.
- Dev-server restart rule before owner browser QA.
