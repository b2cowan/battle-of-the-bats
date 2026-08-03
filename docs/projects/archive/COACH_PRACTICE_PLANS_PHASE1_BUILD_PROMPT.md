# Practice Plans — Phase 1a Build Prompt (paste into a FRESH chat)

> **Created 2026-07-31** at the close of the planning + 5-round mockup session.
> **All 30 decisions (D1–D30) are owner-accepted. All five mockup rounds are accepted and BINDING.**
> Planning is done — **do not re-open it.** This prompt is self-contained; a session that has never
> seen this project should be able to act on it.
>
> ⚠ **CHECK FIRST: a release is overdue and is the higher priority.** Prod was at `cf90d626`
> (2026-07-29) with 29+ commits on `dev`, including a **function-only migration (211) the drift gate
> cannot see**. Raise this with the owner before starting if it hasn't happened.

---

## The prompt

You are building **Phase 1a — "Write it"** of **Practice Plans** (Player Development roadmap Phase 4)
for the Premium Coaches Portal.

**The problem in one line:** a volunteer coach has ninety minutes on a field on Tuesday and twelve kids
each working on something different, and the product knows the roster, the attendance and every
player's focus areas — but has nowhere to put the plan.

### Read first, in this order

1. **`docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md`** — the whole plan. **§9.2 is the phase
   ladder** (what's in 1a vs 1b vs 2–4). **§10 is the 30 decisions.** §4 is the no-ranking rule, §5 the
   field artifact, §6 the do-not-rebuild list, §7 the storage, §8 + §8.1 the capability model.
2. **`docs/projects/active/COACH_PRACTICE_PLANS_PM_BRIEF.md`** — the plain-language framing.
3. **The five mockup rounds — BINDING VISUAL SPEC.** Read them before writing any markup:
   - R1 anchor + field screen + print — `claude.ai/code/artifact/34f5affe-162d-4b2c-8fb0-bb83e715d48e`
   - R2 anatomy + libraries + D10 — `claude.ai/code/artifact/1a76bcf4-22f3-4b8f-90e9-387180742363`
   - R3 drills + stations close up — `claude.ai/code/artifact/161e903c-0f82-45bf-868c-635789252d7e`
   - R4 groups + the rotation — `claude.ai/code/artifact/79105552-11b2-4498-b810-fddc88730cac`
   - R5 my station + helper access — `claude.ai/code/artifact/58319358-e3dd-48a6-942b-05ed4d1701df`
4. `memory/design_decisions.md` — the 2026-07-31 nav/destination ruling, the 2026-07-30 **ink-chip
   primary / lime-reserved-for-conversion** ruling, the Chunk C layout lessons (a sticky element needs
   a containing block taller than itself; check whether a shared rule already reserves space before
   adding a spacer), and the 2026-06-29 coaches-portal mobile conventions.
5. `memory/MEMORY.md` → `feedback_sport_neutral_no_debt`, `feedback_decouple_structure_from_identity`,
   `reference_help_docs_system`, `date_correctness_guardrail`.

### What Phase 1a ships (from §9.2)

The practice plan **on the practice event**, authored on a drill-in, plus the printed sheet, plus D10.
**Stations, groups and rotations are IN 1a** — the owner's reference practice is station-shaped, and a
release without them models a practice their own team doesn't run.

- Practice-level **goal** + **kit/bring** line (free-text owner).
- **Blocks:** description · goal · duration (a number, an optional "to", or one "rest of practice") ·
  **staff tags** · optional players. Reorder with **up/down buttons, never drag**.
- **Stations** (D27): name · how many · equipment · **setup** · who runs it · who's at it · rotation ·
  a one-off note for tonight.
- **Groups** (D21): pick myself (default) · **draw at random** (N groups / N per group + reshuffle) ·
  same as last practice. Only players who replied yes are drawn; the absent are named.
- **Rotation blocks** (D22–D26): stations × groups × an interval → a **computed group-by-round grid**.
- **The focus rail** — roster order, focus areas quoted from the shipped development records.
- **Copy from a previous practice.**
- **The one-page printed sheet** incl. the rotation grid — this is what makes 1a usable alone.
- **D10** — the evaluation-session editable date + practice link + re-stamp confirm + the practice's
  **"Recorded here"** section. See §10.1 and the rulings in §10.2.

**NOT in 1a** (do not build): the field run screen and "My station" (1b) · the drill library (Phase 2)
· the plan library, "how it went", the coverage answer (Phase 3) · Helpers (Phase 4, gated).

### The rules that will bite

- **Supportive, never ranking.** Every roster list is **roster order with no sort control, ever**. The
  random draw is *deliberately* dumb — no balancing by ability or focus area. No per-player number
  beside another child's. §4 has the full list; it is a `/review` checklist item.
- **"Planned", never "done".** Nothing in 1a records what happened. The only surface allowed to say
  something happened is D10's "Recorded here", because a coach typed real numbers.
- **Read-only at the field** (D4) — and regrouping is a pre-practice act, never mid-drill.
- **Head-coach-only writes**; **focus text gated on `notes`**; read/print rides `schedule`. Server +
  client parity is a review item — this leak class has bitten three chunks running. **Probe as the
  read-only assistant.**
- **A staff tag is a label, never a grant.** No accounts, no invitations, no capability implications.
- **Sport-neutral.** No hard-coded drills, station names, categories or durations.
- **Timezone:** all block-clock arithmetic through `lib/timezone.ts`. Never raw UTC date math.
- **44px tap floor** (`--tap-min`); two breakpoints (900 shell / 640 content). Check the primitives
  header in `coaches.module.css` before writing any new rule — **do not add a third standard.**
- **Ink chip is the primary action; lime stays reserved for conversion.**
- **Reuse, don't rebuild** — §6 lists every existing primitive this sits on, including the PDF engine,
  `CoachEmptyState`, the confirm/unsaved guards, the tag control and the capability model.

### ⚠ Traps already found in planning — do not rediscover

- **D7 — a plan belongs to ONE practice.** Do NOT wire it into the existing recurring-event
  This/This-and-future/All machinery; one careless "all" would wipe eleven weeks of a coach's thinking.
- **D10's re-stamp trap (§10.1).** Readings are date-stamped at entry time. Changing a session's date
  must re-stamp the readings collected in it, behind a confirm naming the count — and **a rescheduled
  practice must NOT move the session's date** (§10.2 ruling 1).
- **D25 — never invent a round or drop a station** to make rotation arithmetic tidy. State the
  mismatch plainly.
- **Storage:** one additive nullable column, the mig-162 `resources` precedent. Reads degrade safely
  pre-migration but **event create/edit WRITES 500 on prod until it is applied** — the migration lands
  on prod before the commit is promoted.
- **Schema = dictionary, same unit of work:** `DATA_DICTIONARY.md` + `refresh:snapshots` +
  `check:dictionary`. Decide current schema from **live snapshots, never migration files.**

### Process (non-negotiable)

Verify ground truth → confirm the plan's §9.2 scope with the owner → **build the whole of 1a in one
pass** → `/simplify` → `/review` (high-risk tier; add the no-ranking audit, the planned-vs-done
vocabulary audit **including the PDF**, client/server capability parity across builder + print, the
D7 recurrence non-application, and timezone-correct clock arithmetic) → `/docs` → Playwright
computed-style probes at **361 / 390 / desktop** → stop server, `rm -rf .next`, restart → owner QA →
commit on `dev` with **explicit per-action OK** and `:(literal)` pathspecs.

**No new mockup round is needed for 1a** — rounds 1–5 cover it. If the build surfaces a screen nobody
drew, stop and draw it before writing it.

### Definition of done

All of 1a built in one pass · `/simplify` + `/review` + `/docs` done · typecheck / `npm test` /
focused lint green · `verify:changed` green with **all colour baselines still ZERO** · dictionary +
snapshots refreshed · probes passing · clean dev restart · owner QA passed · committed on `dev` ·
`memory/design_decisions.md` entry written · `PROGRAM_COACH_PORTAL.md` ledger ticked · the plan doc's
status header updated.

---

## Owner decisions still open (NOT blockers for 1a)

- **Club-wide drill sharing** — the week after Phase 2 ships, a club will ask to share drills across
  its teams. That's a packaging call for `/strategy`, needed **before Phase 2**, not before 1a.
- **Helper privacy sign-off + the verified-family reconcile** (§8.1) — gates Phase 4 only.
