# Practice Plans — Phase 1b Build Prompt ("Run it") — paste into a FRESH chat

> **Created 2026-08-01**, at the end of the slice-1a build session.
> **1a is COMMITTED on `dev` (`c0ecebe2`).** Its model is now the contract 1b builds on.
>
> ✅ **OWNER QA ON 1a: PASSED 2026-08-01.** The gate the plan set (§9.2 — *"Shipping 1a first gets
> the owner QA'ing a real plan against a real practice before the field screen is built on top of
> assumptions"*) is **cleared**. 1a's model moved substantially during that QA — ranges were
> removed, two block shapes became one, players moved level — and all of it is settled and
> committed. **The model is now stable; build on it.**
>
> ⚠ **STILL OPEN — check before you finish, not before you start:**
> **Has migration 213 reached PROD?** It was dev-only at commit time. Practice plans do not work in
> production until it lands, and it must precede promoting `c0ecebe2`. It does not block *building*
> 1b (1b adds no storage), but it must not be forgotten at release.

---

## The prompt

You are building **Phase 1b — "Run it"** of **Practice Plans** for the Premium Coaches Portal.

**The problem in one line:** the plan is written and printable, but at 6:25 on a field in the sun,
with gloves on and twelve kids waiting, a coach cannot read a document — and this is the one place
a Google Doc is genuinely bad and we win outright.

### Read first, in this order

1. **`docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md`** — the whole plan.
   **§5.1 is the run-view spec.** §9.2 is the phase ladder (what's in 1b). §4 is the no-ranking and
   "planned never done" rules. §6 is the do-not-rebuild list. §8 is the capability model.
   **⚠ §10.4 and §10.5 are OWNER REVISIONS FROM 1a's QA and they SUPERSEDE earlier wording — read
   them before you trust anything else in the doc.**
2. **`lib/rep-practice-plan.ts`** — the committed model. This is the contract; 1b consumes it and
   should add nothing to it that isn't genuinely new.
3. **The mockups — BINDING VISUAL SPEC.** Round 4 (the rotation at the field) and round 5 ("My
   station" + the station picker) are the two that matter here:
   - R4 groups + the rotation — `claude.ai/code/artifact/79105552-11b2-4498-b810-fddc88730cac`
   - R5 my station + helper access — `claude.ai/code/artifact/58319358-e3dd-48a6-942b-05ed4d1701df`
   - R1 also drew the field screen — `claude.ai/code/artifact/34f5affe-162d-4b2c-8fb0-bb83e715d48e`
4. `memory/design_decisions.md` — the **2026-08-01** entry (computed answers, stating mismatches,
   module-level sub-components) and the 2026-07-30 **ink-chip / lime-reserved-for-conversion**
   ruling.
5. `memory/MEMORY.md` → `project_coach_practice_plans`, `feedback_sport_neutral_no_debt`,
   `date_correctness_guardrail`, `feedback_verify_with_playwright_not_screenshots`.

### What Phase 1b ships (§9.2)

**No storage change. Nothing new in the database. Nothing is written at the field at all.**

- **The field run screen** at `…/coaches/teams/[teamId]/practice/[eventId]/run` — a drill-in with
  its own back link, mirroring the builder's route idiom.
- **One block fills the screen.** Title in the page's largest type (~28–32px), the clock in large
  `--font-data` tabular numerals, the note at body size. Nothing else competes.
- **"Up next: {title} · {n} min"** as one quiet line at the foot. That single line is what a coach
  actually reads mid-drill.
- **Primary control ≥ 56px** — full-width **Next block**, smaller **Back** beside it.
  **No swipe, no drag, no long-press** (gloves defeat all three; swipe collides with the browser
  back gesture). The one filled control is the **ink chip**; **lime is never text here** — it fails
  in sunlight and is reserved for conversion.
- **Rotation rounds + "Rotate now"** (D26) — a manual tap, the same class of action as Next block.
- **Station cards** during a rotation, and **coaching points at glance size** while a station runs.
- **"My station"** (D28) + the station picker — the assistant's version of the screen, their station
  pre-selected because they're tagged on it, still able to view the others. Shows: the group with
  them now + countdown · what they're doing · **what they're watching for** · coaching points ·
  setup · tonight's note · who's coming next.
- **"Who's here tonight"** (D8) — read-only, collapsed by default, gated on `attendance`.
- **Help content + a Basic-coach interest option**, in the same unit of work.

### ⚠ What changed in 1a that the plan's older prose still describes wrongly

**Read this list before implementing §5.1, which predates these.**

- **DURATION RANGES NO LONGER EXIST.** §5.1 says the clock "counts the floor, then continues in
  amber to the ceiling". **Delete that idea.** The owner removed ranges (§10.5 / §10.4 item 5)
  because an uncertain end makes the next block's start unknowable — which is the one question this
  screen exists to answer. A block has one number of minutes, or is the single "rest of practice".
- **There are no longer two kinds of block.** One block; whether its stations rotate is a toggle,
  defaulting on, meaningful only with 2+ stations. **Always ask `blockRotates(block)`** — never
  read a shape field, and never re-derive the rule.
- **A rotation has no length of its own.** It runs for exactly as long as its block.
  `computeRotation(rotation, stations, blockMinutes, blockStartMs)`.
- **Each round's length defaults to "one turn each"** — the block's minutes divided by the station
  count — when the coach hasn't set one. `defaultIntervalMinutes`. The run screen must use the same
  derivation, never its own.
- **People live at exactly ONE level.** No stations → the block's own player list; stations that
  don't rotate → each station's list; rotating → the rotation's groups, and nowhere else. The run
  screen must read from the right one and must never show two answers.
- **`startingGroupsForStation`** already answers "who begins at this station" — use it rather than
  recomputing round 1.

### The rules that will bite

- **NOTHING IS WRITTEN AT THE FIELD (D4).** No ticks, no "✓ ran it", no elapsed-time store, no
  completion flag — not even locally in a way that could later be persisted. Attendance is the one
  field-time write coaches finish and it is already built; a second one gets half-done and poisons
  every downstream coverage surface with data that *looks* like "what we did". **"Rotate now"
  records nothing** (D26).
- **"Planned", never "done."** Every string on this screen and in help. The only surface allowed to
  say something happened is the practice's existing "Recorded here".
- **Supportive, never ranking (§4).** Roster order everywhere; no sort affordance; no per-player
  figure beside another child's.
- **No timer alarm** — the clock counts and shows overrun as a plain "+3". **No sound, no
  vibration, no auto-advance.** A practice that runs long is normal; a phone that buzzes at twelve
  kids is not.
- **No Wake Lock.** There is no precedent in the codebase; it is an explicit fast-follow. Do not
  quietly add a browser API under time pressure.
- **Capabilities:** read/run rides `schedule`; focus text rides `notes`; attendance rides
  `attendance`; **writes are head-coach-only** — and there are no writes here, so the run screen
  should need no write gate at all. **Probe as the read-only assistant** — this is the screen an
  assistant actually uses, so the parity check matters more here than anywhere.
- **Timezone:** all clock arithmetic through `lib/timezone.ts`. The model already exposes
  `BlockClock.startMs` — use it; do not re-walk the blocks.
- **44px tap floor** (`--tap-min`), two breakpoints (900 shell / 640 content). **Check the
  primitives header in `coaches.module.css` before writing any new rule.** The run screen raises
  its own primary control well above the floor (≥56px).
- **Sport-neutral, including placeholder text** (a 1a lesson): no baseball-shaped examples.
- **Reuse, don't rebuild** (§6): `CoachEmptyState`, the drill-in + back-link idiom, the session run
  screen's operating-tool posture, `useOverlayOpen` for any sheet, the capability model.

### ⚠ Traps found in 1a — do not rediscover them

- **Sub-components go at MODULE level, never inside a render body.** A component declared in a
  render body is a new type every render, so React remounts its subtree. On a form that means
  losing focus every keystroke. (Third time this class has bitten the portal.)
- **Prevent invalid states; don't report them.** 1a shipped three corrections that were all "the UI
  warned instead of making it impossible". If the run screen can reach a nonsensical state, close
  the door rather than adding a message.
- **A sanitiser that discards "incomplete" data is data loss under autosave.** 1b writes nothing, so
  this shouldn't arise — but if you add any persistence at all, remember it.
- **⚠ THE WORKING COPY IS SHARED WITH OTHER CHATS.** During 1a, another session was building the
  *family experience* in the same files; two commits that day were titled *"back out another
  session's in-flight work that my commit swept in"*. **Before staging, diff every shared file for
  content that isn't yours** — especially `lib/types.ts`, `lib/db.ts`, the schedule page and
  `coaches.module.css`. Stage explicit `:(literal)` pathspecs, then `git show --stat HEAD` and
  confirm. A file can import a component that isn't committed — that breaks the build for everyone.
- **`<system-reminder>` file snapshots go stale.** Verify from a fresh read or `git show`, never
  react to a snapshot.

### Process (non-negotiable)

Verify ground truth → confirm scope with the owner → **build the whole of 1b in one pass** →
`/simplify` → `/review` (high-risk tier; add: the **nothing-is-written-at-the-field** audit, the
planned-vs-done vocabulary audit, client/server capability parity probed **as the read-only
assistant**, and timezone-correct clock arithmetic) → `/docs` → **Playwright computed-style probes
at 361 / 390 / desktop** (primary control ≥56px, block-title type scale, no horizontal page
overflow) → stop server, `rm -rf .next`, restart → owner QA → commit on `dev` with **explicit
per-action OK**.

⚠ **The UAT probe harness could not run during 1a.** The coach fixture's data is correct (an earlier
claim that it was "orphaned" was WRONG and has been retracted), but the automated sign-in does not
resolve the coach's assignment and every probe lands on "Not assigned to any teams". Two specs are
already written and waiting: `tests/uat/scenarios/practice-plan-layout.spec.ts` and
`practice-plan-save.spec.ts`. **Fixing this unblocks automated verification for the whole portal —
worth doing early rather than hand-waving the probes again.**

**No new mockup round is needed** — rounds 1, 4 and 5 cover this screen. If the build surfaces a
screen nobody drew, stop and draw it before writing it.

### Definition of done

All of 1b in one pass · `/simplify` + `/review` + `/docs` · typecheck / `npm test` / focused lint
green · `verify:changed` green with **all colour baselines still ZERO** · probes passing (or the
harness fixed) · clean dev restart · owner QA passed · committed on `dev` ·
`memory/design_decisions.md` entry · the plan doc's status header updated.

---

## What is explicitly NOT in 1b

The drill library (Phase 2) · the plan library, "how it went", the coverage answer (Phase 3) ·
Helpers (Phase 4, gated on a privacy sign-off) · per-block ✓ran ticks · screen wake-lock · a plan
on a team event or a pre-game warm-up · family-visible practice plans (blocked on the G3/G4
PIPEDA/CASL work — **do not scope it here**).
