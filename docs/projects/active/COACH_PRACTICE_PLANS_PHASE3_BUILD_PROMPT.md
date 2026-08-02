# Practice Plans — Phase 3 Build Prompt ("The plan library & looking back") — paste into a FRESH chat

> **Created 2026-08-01**, at the end of the Phase 2 build session.
> **1a is COMMITTED (`c0ecebe2`) and owner-QA PASSED. 1b is COMMITTED (`ebd29c7f`), owner QA pending
> (ledger §2.5). Phase 2 (the drill library) is BUILT and UNCOMMITTED**, owner QA pending
> (ledger §1.8 + §2.6). Together they are the contract Phase 3 builds on.

---

## ⚠ ONE GATE BEFORE ANY CODE, AND IT IS THE SAME ONE THAT HAS BITTEN TWICE

**Phase 2 MUST BE COMMITTED FIRST. Do not start building until it is.**
This working copy is shared with other chats. During the Phase 2 session **another session was
actively editing it** — it added migrations 219 and 220 and left two files that did not compile
(a season-recap module and its test), while a third had already forced a `git reset --soft` in an
earlier session. Phase 3 edits *the same practice-plan files again* — the builder, the editor, the
plan model. A third uncommitted strand in one working copy produces a diff nobody can separate.

**Check `git log --oneline -5` for the Phase 2 commit before you begin; if it isn't there, say so and
stop.** Then, before staging anything of your own, **diff every shared file for content that isn't
yours**, stage explicit `:(literal)` pathspecs, and run `git show --stat HEAD` to confirm.

There is **no `/strategy` gate this time.** Phase 3 introduces no packaging question: templates and
the coverage answer both ride the Premium entitlement that already gates the whole coaches portal.
⚠ If the build surfaces one anyway — most likely *"should templates be shareable club-wide like
drills are?"* — **stop and route it, don't decide it.** The club-wide answer for drills is logged in
`BUSINESS_DECISIONS.md` (2026-08-01) and would be the obvious precedent, but it is the owner's call.

---

## The prompt

You are building **Phase 3 — "The plan library & looking back"** of **Practice Plans** for the
Premium Coaches Portal.

**The problem in one line:** a coach has a standard Tuesday and wants it back without rebuilding it,
wants an honest record of how it actually went the last eight times, and needs to know whether
anyone is quietly being missed — without the product ever ranking a child.

### Read first, in this order

1. **`docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md`** — the whole plan.
   **§9.2 → "Phase 3" is the scope.** D14 is template semantics, D15 the room, D17 "how it went",
   §4 the no-ranking rule and the planned-vs-done vocabulary, §6 the do-not-rebuild list, §8 the
   capability model, §11 the cut list.
   **⚠ §10.4, §10.5, §10.6 and §10.7 are LATER OWNER REVISIONS AND BUILD RULINGS. They SUPERSEDE
   earlier wording anywhere the two disagree — read them before you trust anything else in the doc.**
   §10.7 is Phase 2's and is the one you will lean on most.
2. **`lib/rep-practice-plan.ts`** and **`lib/rep-drills.ts`** — the committed model. The plan shape
   you are about to save as a template, and the library idiom you are about to mirror.
3. **`memory/design_decisions.md`** — the **2026-08-01 drill library** entry (identity vs
   scaffolding, dim-never-hide, counts must name what they counted, probe scoping) and the
   **2026-08-01 Practice Plans 1a** entry (compute don't ask, state a mismatch, module-level
   sub-components).
4. `memory/MEMORY.md` → `project_coach_practice_plans`, `feedback_sport_neutral_no_debt`,
   `reference_supabase_rls_grants`, `feedback_dictionary_adversarial_verify`.
5. **Mockups: there is no round covering this phase.** Round 3 drew drills, rounds 4–5 the rotation
   and the station. **The template room, the "how it went" recap and the coverage section have never
   been drawn.** See the mockup gate below — this is not optional.

### What Phase 3 ships (§9.2)

- **Named plan templates**, grouped by category, in **their own room inside Development** (D15) —
  beside Your drills. A library is browsed and read back, which is a different animal from the plan
  editor D1 correctly kept on the practice.
- **One picker, two sources** (D14): load a **template** or pull from a **previous practice**. The
  "copy from a previous practice" half already exists and ships in 1a — you are adding the other
  source to the same control, not building a second picker.
- **Usage history** — how many plans a template has produced, and a per-use list linking to each
  practice's plan as it was written.
- **"How it went" (D17)** — one free-text recap per practice, written afterwards, at home.
- **The coverage answer**, folded into the **existing** `/history/development` report: which players
  have never been named in any plan, and which active focus areas have never appeared.

### ⚠ THE TRAP THAT WILL BITE — two opposite rules now live one screen apart

**Phase 2 made a loaded DRILL read-only. D14 makes a loaded TEMPLATE fully editable. Both are
correct, and a build session that "makes them consistent" will break one of them.**

The distinguishing question is **whether the thing's name is a claim about what happened**:

| | A **template** | A **drill** |
|---|---|---|
| What it is | **Scaffolding** — a starting point for a practice | An **identity** — a named thing you say you ran |
| On load | **Copy-on-load. Every edit is that practice's** (D14, owner-ruled) | **Read-only.** Editing DETACHES it (owner, 2026-08-01, §10.7) |
| Its count means | "this template started 8 plans" | "these 8 plans contain *this same drill*" |
| Why | Of course you adapt a practice. Adapting it is the point. | If the words can change, the count counts eight different things |

**Do not unify these.** Do not make templates read-only for symmetry, and do not "fix" the drill
rule because a template next to it behaves differently. Both are logged as binding in
`memory/design_decisions.md` — the entry states the rule and the boundary explicitly.

⚠ **A template contains drill-backed stations.** Loading one must preserve each station's drill
provenance so those stations arrive read-only *inside* an otherwise fully-editable plan. That is
correct and is the seam where a careless implementation will silently strip provenance and quietly
break every drill's count.

### ⚠ THE VOCABULARY SEAM — "how it went" is the FIRST honest "done" in this feature

Everything so far records **what was PLANNED**. Nothing records what was done (D4), and §4 makes
that a hard copy rule. **"How it went" is the first surface allowed to describe reality** — and it
earns that because a coach sat down afterwards and deliberately wrote it.

Three consequences, all load-bearing:

1. **It does NOT reopen D4.** An unhurried note at home is a different act from an abandoned tick-box
   mid-drill. Nothing at the field starts recording. Do not add per-block ✓ran ticks.
2. **The coverage answer must STILL say "planned"** — *"appeared in a plan"*, never *"worked on"*,
   *"covered"* or *"did"*. A recap existing on some practices does not license the report to claim
   the plan happened. The §10.2 "Recorded here" section is the precedent: **two sections, two truth
   statuses, deliberately kept apart on one screen.**
3. **A practice with no recap says so honestly** rather than rendering blank or implying nothing
   happened.

⚠ **D17's hard guardrail: the recap is about the PRACTICE, never about a child.** *"Tees were too
crowded, run four next time"* is the whole value. Per-player commentary would drift into behavioural
profiling on minors, and it is a `/review` checklist item.

### ⚠ Phase 2 corrected the wording the plan doc still uses for THIS phase

§9.2 describes usage history as **"Used 8× · last Aug 4"**. **That wording is retired.** The
planned-vs-done audit in Phase 2 established that *"used"* is a claim the data cannot support — a
coach may have planned something and skipped it in the rain. Phase 2 ships **"In 8 plans" / "Not in
a plan yet" / "last planned"**, and named the field `planCount` so the honest word is in the type as
well as on screen. **Match it.** A template's count is *"Started 8 plans"* or similar — never
"used", unless the recap genuinely proves otherwise for that specific use.

### ⚠ THE ARCHIVE DECISION IS GENUINELY HARD THIS TIME — this phase STRADDLES the line

The archive is **OPT-IN** (binding owner ruling, `CLAUDE.md`), and the test for what belongs there is
**record or instrument?** Phase 3 is the first slice of this project that contains **both**:

- **Templates are an INSTRUMENT** — a reusable tool, like drills. The drill ruling (live-season only,
  door hidden in a finished season) is the obvious precedent, and a team is PERMANENT so a
  team-scoped template library carries across seasons on its own with nothing to migrate.
- **"How it went" and the coverage answer are RECORDS.** *"What did we actually work on last
  spring"* is exactly the question the archive exists to answer, and the coverage report already
  lives at `/history/development`, which **is already season-aware** (`development/board` and
  `development/sessions` are both on the approved list).

**So the two halves plausibly get DIFFERENT answers, and that is fine — but it must be DECIDED, not
discovered.** Take it to the owner with the record/instrument framing before you design the room.
Then:

- `tests/unit/coach-season-write-guard.test.ts` holds **two build-enforced lists**
  (`APPROVED_ARCHIVE_DOORS`, `APPROVED_SEASON_AWARE_ROUTES`) plus a **Phase-2-specific test** that
  asserts the drill library stays OFF the season rail. **Adding a door or a season-aware route fails
  the build until the list is edited — and that failure IS the decision point.**
- ⚠ **An archive is a container.** The unit of work is every page reachable from the door, not the
  door. Chunk F's expensive defects were all one level down.
- **If a surface is not archive-ready, hide its entry point** rather than letting it dead-end.

### The rules that will bite

- **⚠ NO RANKING, AND THIS PHASE IS WHERE IT IS SHARPEST (§4).** The coverage answer is the single
  most dangerous surface in the whole project, because it is the one that names children who have
  been missed. Binding, by construction:
  - **Roster order only.** No sort affordance of any kind, ever. Not "least covered first".
  - **A flag or a blank, never a comparable number.** *"— not in a plan yet"* vs nothing. No counts,
    percentages, streaks or averages beside a child's name.
  - **No team average, percentile or "N% of the roster"** next to an individual row.
  - **No deficit language about a child.** The vocabulary is coverage of the *coach's attention*,
    not assessment of the *player*.
  - **The findings rule stays COUNT-ONLY AND NAMELESS**, and silent until real usage exists —
    `lib/insight-findings.ts` already does exactly this and is the model to copy.
- **Reuse, don't rebuild (§6 + everything Phase 2 just built).** The drill library room is your
  template for the template room: the same **retire/restore** idiom, the same **picker + preview**
  sheet, the same **filter/search** helper (`filterDrills` — generalise it rather than copying it),
  the same **import-from-past-seasons** shape if the owner rules that way. Also `CoachEmptyState`,
  the drill-in + back-link idiom, `useOverlayOpen`, `ConfirmProvider`, the capability model.
  ⚠ **The coverage answer goes into the EXISTING `/history/development` report — no new report page
  and NO SEVENTH INSIGHTS TILE** (the sixth was a logged ceiling exception).
- **Capabilities: no new key.** Templates ride `schedule` to read, head-coach-only to write (a
  template is a plan). The coverage answer rides `notes`, because it renders focus areas. **Probe as
  the read-only assistant** — this leak class has bitten four chunks running.
- **Sport-neutral.** Template categories are coach-typed, never seeded, never a fixed list — and the
  rule binds `placeholder=` text as much as data.
- **Storage:** a new table (`rep_team_practice_plan_templates`, mirroring `rep_team_lineup_templates`
  — §7 says the V1 shape lifts into it unchanged) plus wherever the recap lives. **Decide what
  exists from the live snapshots, never from migration files.** ⚠ **Migration number = next
  available AT BUILD TIME — dev reached 220 during the Phase 2 session and 213, 214–220 are
  dev-only.** Verify before numbering, and add the release rider.
- **RLS posture needs a deliberate answer**, not a default (`reference_supabase_rls_grants`). Mig 218
  is the freshest worked example, including the split between team-owned and org-shared rows.
- **`DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the SAME unit of work.**
- **44px tap floor, two breakpoints (900 / 640).** Check the primitives header in
  `coaches.module.css` first. ⚠ The portal's **shared button primitives render 31–41px product-wide**
  and the team nav 38.5px — that is a pre-existing baseline. **Do not change a shared primitive to
  satisfy a probe**; state the floor locally on the controls you add, as the drill CSS does.

### ⚠ Traps found in 1a, 1b and Phase 2 — do not rediscover them

- **⚠ THE WORKING COPY IS SHARED WITH OTHER CHATS.** See the gate. Assume a file you touch has
  someone else's work in it.
- **Sub-components go at MODULE level, never inside a render body** — a component declared in a
  render body remounts its subtree every render, so a form loses focus every keystroke. **Five times
  now.**
- **A CSS-module import path is invisible to TypeScript.** Phase 2 shipped a wrong relative depth
  that typechecked cleanly and rendered the entire new room as a build error — **only the Playwright
  probe caught it.** Copy the path from a sibling page at the same depth and verify in a browser.
- **A layout probe must assert what the product actually holds.** Phase 2's first probe asserted a
  blanket 44px floor across the document and failed on the portal's own chrome. **Narrow the probe;
  never widen a shared primitive to make a test pass.**
- **Prevent invalid states; don't report them.** If a control exists only to refuse, remove it.
- **"Autosave" + "discard incomplete data" is data loss.** The plan builder autosaves ~1s after
  typing stops. ⚠ Note the deliberate asymmetry Phase 2 established: the **plan** sanitiser never
  discards a row for being empty, but a **library item** created by an explicit submit *does* reject
  an empty name. Same codebase, opposite rules, both right.
- **When two branches partition a space, gate them on ONE predicate and its negation.** 1b's run
  screen gated a pair on two predicates that merely *looked* complementary and a real state rendered
  nothing.
- **⚠ Check `error` on every supabase-js select before believing an empty result.** A select naming a
  column that does not exist returns `{data: null}`, and `data?.length ?? 0` reads as "zero rows" —
  this invented a non-existent bug twice during 1b.
- **⚠ Never interpolate an id into a PostgREST `.or()` string** without proving it is a uuid — it is
  parsed as filter syntax. See `getDrillsForTeam`.
- **`<system-reminder>` file snapshots go stale.** Verify from a fresh read or `git show`.

### Process (non-negotiable)

Clear the gate → verify ground truth → **get the ARCHIVE decision from the owner (record vs
instrument, both halves)** → **DRAW THE MOCKUPS AND GET SIGN-OFF (blocking — nothing here has been
drawn)** → **PM UX summary + confirm scope** → build the whole of Phase 3 in one pass → `/simplify`
→ `/review` (high-risk tier; add: the **no-ranking audit** — this is the phase it exists for — the
**planned-vs-done vocabulary audit incl. the PDF and the new recap**, the **template-vs-drill
editability seam**, client/server capability parity probed **as the read-only assistant**, the
**archive-door decision**, and **RLS posture on the new table**) → `/docs` → **Playwright
computed-style probes at 361 / 390 / desktop** → `npm run refresh:snapshots` + `check:dictionary` →
stop server, `rm -rf .next`, restart → owner QA → add a section to
`docs/projects/active/OWNER_QA_LEDGER.md` → commit on `dev` with **explicit per-action OK**.

**Mockups — minimum frames, none of which exist yet:**
the template room (desktop + 390) · its empty state · **"Save as template…"** · the one-picker-two-
sources load, including the provenance line D14 requires · a loaded template containing a
**read-only drill-backed station** (the seam above, drawn) · **"How it went"** — where it is written
and where it is read back · the **coverage section inside the existing report**, drawn at roster
order with the flag-or-blank treatment · a practice with **no recap**.

✅ **The UAT probe harness WORKS.** Run `node scripts/seed-uat-coach-fixture.mjs` — idempotent,
repairs the coach fixture, seeds a probe practice and prints `PROBE_EVENT_ID`.
⚠ **A coach-portal spec must declare `test.use({ storageState: …/.auth/coach.json })`** or it
silently authenticates as the org owner, who coaches nothing.
⚠ **Run a new spec by FILE PATH, not `-g`** — several unrelated specs fail at collection with
`Cannot find module 'server-only'`, which will drown your run. Existing specs to follow:
`tests/uat/scenarios/drill-library-layout.spec.ts` (12 probes, green — includes a DOM-level assertion
that a drill's words are text and not inputs) and `practice-run-layout.spec.ts` (18 probes, green).

### Definition of done

All of Phase 3 in one pass · `/simplify` + `/review` + `/docs` · typecheck / `npm test` / focused
lint green · `verify:changed` green with **all colour baselines still ZERO** · dictionary + snapshots
refreshed · probes passing · clean dev restart · owner QA passed · committed on `dev` ·
`memory/design_decisions.md` entry · the plan doc's status header + §9.2 updated · a QA-ledger
section added.

---

## What is explicitly NOT in Phase 3

Helpers (**Phase 4**, gated on a privacy sign-off **and** a reconcile against the 2026-07-11
verified-family decision, so a parent never gets two doors into a team's practice) · drill **videos**,
hosted drill **content**, and any **seeded sport-specific drills** (permanent cut list, §11) · photos
or diagrams on a drill (an image of a practice contains children) · **per-block ✓ran ticks** (see the
vocabulary seam — the recap does NOT reopen this) · screen wake-lock · family-visible practice plans
(**blocked** on the PIPEDA/CASL work — do not scope it here) · **per-child commentary in the recap**
(D17's hard guardrail) · auto-generated plans, and any "these N kids need the most work" surface
(**cut forever**) · a seventh Insights tile.
