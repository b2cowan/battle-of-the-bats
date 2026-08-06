# Practice Plans — Phase 2 Build Prompt ("The drill library") — paste into a FRESH chat

> **Created 2026-08-01**, at the end of the slice-1b build session.
> **1a is COMMITTED on `dev` (`c0ecebe2`) and owner-QA PASSED. 1b is BUILT and UNCOMMITTED**, awaiting
> owner QA (ledger §2.5). Together they are the contract Phase 2 builds on.

---

## ⚠ TWO GATES BEFORE ANY CODE. Neither is a screen.

**GATE 1 — 1b MUST BE COMMITTED FIRST. Do not start building until it is.**
This is not process hygiene, it is the specific failure this repo has already paid for twice. The
working copy is shared with other chats; at the end of the 1b session **three files already held
1b's work AND another session's in-flight work** (the schedule page, the coaches help content, and
`TODO.md`), which is why 1b could not be committed on the spot. Phase 2 edits *the same practice-plan
files again* — the station shape especially. A third uncommitted strand in one working copy produces
a diff nobody can separate. **Check `git log --oneline -5` for 1b before you begin; if it isn't
there, say so and stop.**

**GATE 2 — the club-wide drill-sharing question goes to `/strategy` first.**
Carried as an open item since planning: *should a drill library be per-TEAM (as designed) or shared
across a CLUB?* It is a packaging question, not an implementation detail — a club-wide library is a
plausible reason to move Club above League on the ladder, and retro-fitting sharing onto a per-team
table is a migration. **The plan as written is per-team.** Get the ruling recorded in
`BUSINESS_DECISIONS.md` before the table is designed, then build to it.

---

## The prompt

You are building **Phase 2 — "The drill library"** of **Practice Plans** for the Premium Coaches Portal.

**The problem in one line:** a coach retypes the same warm-up every Tuesday, and the product already
knows the shape of it — so authoring should become four taps, and the categories that fall out are
what finally let the focus rail filter itself.

### Read first, in this order

1. **`docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md`** — the whole plan.
   **§9.2 → "Phase 2" is the scope.** D14–D20 are the drill decisions, **D16** is the focus-rail
   filter, **D27** is the station's field-by-field split by source. §4 is the no-ranking rule. §6 is
   the do-not-rebuild list. §8 is the capability model. §11 is the cut list.
   **⚠ §10.4, §10.5 and §10.6 are LATER OWNER REVISIONS AND BUILD RULINGS. They SUPERSEDE earlier
   wording anywhere the two disagree — read them before you trust anything else in the doc.**
2. **`lib/rep-practice-plan.ts`** — the committed model for 1a + 1b. This is the contract.
3. **The mockups — BINDING VISUAL SPEC.** Round 3 is the drill library round:
   - R3 the four doors, the picker, the preview, the full drill record —
     `claude.ai/code/artifact/161e903c-0f82-45bf-868c-635789252d7e`
   - R5 what a station holds and **where each field comes from** (the seam the library lifts out of) —
     `claude.ai/code/artifact/58319358-e3dd-48a6-942b-05ed4d1701df`
   - R4 the rotation, for how a picked drill lands in one —
     `claude.ai/code/artifact/79105552-11b2-4498-b810-fddc88730cac`
   ⚠ **Round 3 predates the 1a QA revisions.** Where it draws "add a rotation" as a block type, that
   is retired (§10.4 item 1). Check every round-3 frame against §10.4 before building it.
4. `memory/design_decisions.md` — the **2026-08-01 Practice Plans 1b** entry (the partition-predicate
   rule, the tie rule, and the vocabulary trap) and the **2026-07-30 ink/lime** ruling.
5. `memory/MEMORY.md` → `project_coach_practice_plans`, `feedback_sport_neutral_no_debt`,
   `reference_supabase_rls_grants`, `feedback_dictionary_adversarial_verify`.

### What Phase 2 ships (§9.2)

- **A per-team drill library** — name, coach-defined **category**, usual duration, description,
  optional goal, **coaching points** (D19), default stations + equipment, and **setup** (D27).
  **Rename/retire** mirroring the measurable-type library idiom: retiring keeps history and every
  plan the drill already sits in.
- **Four doors to a drill** (R3): pick from the library · write a one-off block in place · **promote
  a block to a drill later** (D18 — explicit, never automatic) · manage the library in Development.
- **The picker**, in the block-add sheet: "From your drills" / "Write one", searchable,
  category-chipped, showing each drill's use count — **and a preview before adding**, because a drill
  you can't read is a drill you add and then undo.
- **A picked drill brings the SHAPE, empty of people** (D20). Stations arrive named, kitted and set
  up, asking to be staffed. Everything stays editable in the plan.
- **Categories, and the focus-rail filter they pay for** (D16). A practice's type becomes *derived*
  from the drills in it rather than another field a coach fills in on a couch.
- **An optional category on focus areas** — the one genuinely new thing on the development side.

### ⚠ What 1a and 1b changed that the older prose still describes wrongly

- **DURATION RANGES DO NOT EXIST** (§10.5). A block is one number of minutes, or the single "rest of
  practice". A drill's "usual duration" is therefore ONE number too — do not re-introduce a range
  through the library's back door.
- **There is ONE kind of block** (§10.4 item 1). Rotation is a toggle inside it, defaulting on,
  meaningful only at 2+ stations. Always ask `blockRotates(block)`. **Round 3's "add a rotation" is
  retired.**
- **PEOPLE LIVE AT EXACTLY ONE LEVEL** (§10.4 item 3) — block, or stations, or the rotation's groups.
  A picked drill brings **no people at all** (D20), which is what keeps this invariant intact. Do not
  let a drill carry a roster.
- **"Bring / kit" is "Equipment", as reusable tags** (§10.4 item 2).
- **A station IS the drill** (§10.4 item 6) — that is the seam the library lifts out of.

### ⚠ THE INTEGRATION THAT WILL BITE — read this twice

**Today a station has NO `description` and NO `goal`.** 1a put the teaching on the BLOCK, and 1b's
**"My station"** screen reads *"What you're doing"* from `block.description` and **"What you're
watching for"** from `block.goal`. D27's table says both belong to the **drill**.

So the moment Phase 2 gives a station its own description and goal, **three surfaces must learn to
prefer the station's over the block's, in the same unit of work**:
1. **"My station"** (the run screen's station view) — the whole point of D28's *"what you're watching
   for"* is that it rides the drill and is written once.
2. **The printed sheet** — it renders station lines today and must not go stale.
3. **The run screen's block view** — a rotating block already defers to the stations.

⚠ **Fall back, never replace:** a plan written before the library existed has block-level text and
no station-level text, and it must keep reading correctly for ever. `station.goal ?? block.goal`,
not a migration of old plans. There is no "convert my old plans" story and none is wanted.

### The rules that will bite

- **⚠ A NEW ROOM IN DEVELOPMENT IS A NEW ARCHIVE DOOR.** The library is browsed *in Development*
  (D15's reasoning), and **the archive is OPT-IN** (binding owner ruling, `CLAUDE.md`). A "Drills"
  door added to the hub **fails the build** until `APPROVED_ARCHIVE_DOORS` in
  `tests/unit/coach-season-write-guard.test.ts` is edited — **and that failure is the decision
  point, not an obstacle.** Answer it deliberately: a drill library is a *reusable instrument*, not
  a record of a season, so the default answer is almost certainly **live-season only**. Decide,
  don't discover.
- **Sport-neutral, and the library SHIPS EMPTY.** Category vocabulary ("Hitting / Fielding /
  Pitching" is one sport talking) is **coach-typed**, never seeded, never a fixed list. Seeded
  starter drills are an explicit fast-follow, not this phase. Placeholder text too — a
  baseball-shaped `placeholder=` is the same defect as a baseball-shaped default.
- **The focus-rail filter DIMS, never hides** (§10.4 item 7, confirming D16 and §4). A player whose
  only focus areas are off-type must never vanish from a coverage list — that is precisely the child
  most likely to be overlooked. Uncategorised areas and "nothing set yet" always show.
- **No ranking, anywhere** (§4). Roster order, no sort affordance, no per-player figure beside
  another child's. A drill's **use count** is a fact about the DRILL and is fine; anything that
  counts a *child* is not.
- **Capabilities:** no new key. Reading rides `schedule`; focus text rides `notes`; **writes are
  head-coach-only.** Managing the library is a write. **Probe as the read-only assistant.**
- **Storage:** a new table (+ an optional category column on focus areas). `DATA_DICTIONARY.md` +
  `npm run refresh:snapshots` in the SAME unit of work. **Decide what exists from the live snapshots,
  never from migration files.** ⚠ Migration number = next available **at build time** — dev is at
  **215** and **213 is still dev-only**; verify before numbering, and add the release rider.
- **RLS posture:** a new table needs a deliberate answer (`reference_supabase_rls_grants`), not a
  default.
- **44px tap floor, two breakpoints (900 / 640).** Check the primitives header in
  `coaches.module.css` before writing any new rule.
- **Reuse, don't rebuild** (§6): `CoachEmptyState`, the drill-in + back-link idiom, `useOverlayOpen`
  for any sheet, the tag control, the measurable-type library's rename/retire idiom, the capability
  model.

### ⚠ Traps found in 1a and 1b — do not rediscover them

- **⚠ THE WORKING COPY IS SHARED WITH OTHER CHATS.** See GATE 1. **Before staging, diff every shared
  file for content that isn't yours**, stage explicit `:(literal)` pathspecs, then `git show --stat
  HEAD` and confirm. A file can import a component that isn't committed — that breaks the build for
  everyone.
- **Sub-components go at MODULE level, never inside a render body** — a component declared in a
  render body remounts its subtree every render, which on a form means losing focus every keystroke.
  (Four times now.)
- **Prevent invalid states; don't report them.** Both 1a and 1b shipped corrections that were "the UI
  warned instead of making it impossible". If a control exists only to refuse, remove the control.
- **"Autosave" + "discard incomplete data" is data loss.** The plan builder autosaves ~1s after
  typing stops; a rule that drops "empty" rows deletes the drill a coach just added and was about to
  name. If the library autosaves, the same rule applies.
- **When two branches partition a space, gate them on ONE predicate and its negation.** 1b's run
  screen gated a pair on two predicates that merely *looked* complementary, and a real state fell
  between them and rendered nothing.
- **⚠ Check `error` on every supabase-js select before believing an empty result.** A select naming a
  column that does not exist returns `{data: null}`, and `data?.length ?? 0` reads as "zero rows" —
  this invented a non-existent bug twice during 1b.
- **`<system-reminder>` file snapshots go stale.** Verify from a fresh read or `git show`.

### Process (non-negotiable)

Clear both gates → verify ground truth → **PM UX summary + confirm scope with the owner (blocking)**
→ build the whole of Phase 2 in one pass → `/simplify` → `/review` (high-risk tier; add: the
**no-ranking** audit, the **planned-vs-done** vocabulary audit incl. the PDF, client/server
capability parity probed **as the read-only assistant**, the **archive-door** decision, and **RLS
posture on the new table**) → `/docs` → **Playwright computed-style probes at 361 / 390 / desktop** →
`npm run refresh:snapshots` + `check:dictionary` → stop server, `rm -rf .next`, restart → owner QA →
add a section to `docs/projects/active/OWNER_QA_LEDGER.md` → commit on `dev` with **explicit
per-action OK**.

✅ **The UAT probe harness now WORKS** (fixed during 1b). Run `node scripts/seed-uat-coach-fixture.mjs`
— it is idempotent, repairs the coach fixture, seeds a probe practice and prints the
`PROBE_EVENT_ID`. ⚠ **A coach-portal spec must declare `test.use({ storageState: …/.auth/coach.json })`**
or it silently authenticates as the org owner, who coaches nothing. Existing specs to follow:
`tests/uat/scenarios/practice-run-layout.spec.ts` (18 probes, all green) and `practice-plan-layout.spec.ts`.

**Mockups:** rounds 3 and 5 cover this phase. **If the build surfaces a screen nobody drew — the
library's own room, or the retire flow — stop and draw it before writing it.**

### Definition of done

All of Phase 2 in one pass · `/simplify` + `/review` + `/docs` · typecheck / `npm test` /
focused lint green · `verify:changed` green with **all colour baselines still ZERO** · dictionary +
snapshots refreshed · probes passing · clean dev restart · owner QA passed · committed on `dev` ·
`memory/design_decisions.md` entry · the plan doc's status header updated · a QA-ledger section added.

---

## What is explicitly NOT in Phase 2

The plan library / templates, "how it went", and the coverage answer (**Phase 3**) · Helpers
(**Phase 4**, gated on a privacy sign-off) · drill **videos**, hosted drill **content**, and any
**seeded sport-specific drills** (permanent cut list, §11) · photos or diagrams on a drill (D27 — an
image of a practice contains children; revisiting needs a privacy review, not a file picker) ·
per-block ✓ran ticks · screen wake-lock · family-visible practice plans.
