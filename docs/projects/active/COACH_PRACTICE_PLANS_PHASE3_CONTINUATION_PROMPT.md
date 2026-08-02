# Practice Plans — Phase 3 CONTINUATION Prompt ("the visible half") — paste into a FRESH chat

> **Created 2026-08-01**, at the end of the Phase 3 *foundation* session.
> **The foundation is COMMITTED (`18f05650`). The mockups are SIGNED OFF. Five owner rulings are
> recorded and binding. Nothing a coach can SEE has been built yet — that is your job.**
>
> ⚠ This supersedes `COACH_PRACTICE_PLANS_PHASE3_BUILD_PROMPT.md` wherever the two disagree. That
> document was written *before* the owner ruled on tags, and several of its assumptions are now
> wrong (see "What the earlier prompt gets wrong" below). Read this one.

---

## Where things actually stand

**Committed and green** (`18f05650`, on `dev`; 861/861 unit tests, typecheck clean, colour baselines
ZERO, dictionary + snapshots in sync):

- **Migration 221, applied to DEV.** It already contains **everything the rest of Phase 3 needs to
  store**: the plan-template table and its tag join, the drill tag join, the focus-area tag FK, and
  `rep_team_events.practice_recap`. ⚠ **Do not add a migration for templates or the recap — the
  tables are there and empty.** The next free number is **222**, and you may well not need it.
- **The shared `kind='focus'` tag vocabulary**, end to end: model, data layer, drill room, plan
  editor, focus rail, the club shared-library screen, the goals routes, and tests.
- **`components/coaches/TagPicker.tsx`** — the one picker (multi, or `single` for a focus area).
- **`/api/coaches/[orgSlug]/teams/[teamId]/focus-tags`** — GET the vocabulary, POST to mint one.
- **`filterTagged` / `collectTags` / `UNTAGGED_FILTER`** in `lib/rep-drills.ts` — already
  generalised past drills. **Reuse them for templates and for the looking-back list. Do not copy.**

**⚠ Migrations 213, 218 and 221 are ALL DEV-ONLY.** Every one must reach prod before any of this
promotes.

---

## THE MOCKUPS ARE THE SPEC, AND THEY ARE SIGNED OFF

**https://claude.ai/code/artifact/7ac29440-1e16-4b0e-a22b-9e0093470107** — 12 frames, owner-approved
2026-08-01 ("these all look good, I agree with your recommendations").

They are drawn in the portal's own warm palette and type scale, so they are a real visual spec, not
a wireframe. **Build to them.** Where a frame shows an existing element, that element is part of the
spec too. Frames 01–06 and 10–11 include annotation rails stating the rule each one encodes — those
notes are binding, not commentary.

**Do not re-open the design.** If something genuinely cannot be built as drawn, say so and route it;
do not quietly redraw it.

---

## What you are building (nothing here exists yet)

| Frame | Surface |
|---|---|
| 01–03 | **The plan template room** — one flat list, tag filter chips, rename/retire, "Add from a past season", and its **empty state** |
| 04 | **"Save as template…"** — one optional question (tags), from the plan |
| 05 | **One picker, two sources** — a template *or* a previous practice, in the control 1a already ships, plus the provenance line |
| 06 | **The seam** — a fully editable loaded template containing a **read-only drill-backed station** |
| 07 | **"How it went"** — written on the practice; and a practice with **no recap**, said honestly |
| 08–09 | **The Development report gains three sections** — coverage, uncovered focus areas, and the **tag-filtered list of practices you've run** |
| 11 | **Tag management** — rename, and the **merge** (the RPC already re-points everything) |
| 12 | **A past plan, read-only**, reached only from the looking-back list |

⚠ **Frame 03's ruling has a cost you must absorb:** "New template" is offered at **zero** as well as
at one, which means **the template room owns a full block-and-station editor**, not a rename box. A
template built from scratch has no practice to inherit a shape from. Reuse the plan editor rather
than writing a second one — that is the single biggest reuse decision in this phase, and getting it
wrong doubles the work and splits the behaviour.

---

## The five owner rulings — `COACH_PRACTICE_PLANS_PLAN.md` §10.8 is the record. READ IT FIRST.

1. **Templates are an INSTRUMENT → live-season only**, door hidden in a finished season, **scoped to
   the TEAM not the program year** (so they survive a rollover with nothing to import). ⚠ Do NOT
   copy `rep_team_lineup_templates` (mig 159), which is year-keyed and would strand them each autumn.
2. **Looking back is a RECORD, and it opens further than first ruled:** a past plan is readable
   **READ-ONLY in any season**, reached *only* from the looking-back list. ⚠ **This is a NEW ARCHIVE
   DOOR, ruled explicitly.** The schedule's practice-plan section **stays hidden** in a completed
   season — 1b's §11.1 ruling is NOT reversed.
3. **Categories became TAGS** — done, committed. A **focus area is FREE TEXT FIRST, tagged second**;
   drills/templates/plans carry several tags, a focus area carries one. **Do not unify.**
4. **Plans carry tags**, and that is what makes the recap worth writing: a coach filters past
   practices to "Hitting" and gets every one they have run, what was in it, and what they said
   afterwards. ⚠ **Reuse `rep_team_event_tags`** — a practice event carrying a `focus` tag IS a
   tagged plan. No new join table.
5. **"New template" at zero** — see the cost above.

---

## ⚠ THE TRAP THAT WILL BITE — two opposite rules, one screen apart

**A loaded TEMPLATE is fully editable. A loaded DRILL inside it stays READ-ONLY.** Both are correct.
A session that "makes them consistent" breaks one of them.

| | A **template** | A **drill** |
|---|---|---|
| What it is | **Scaffolding** for a practice | An **identity** — a named thing you say you ran |
| On load | **Copy-on-load, fully editable** (D14) | **Read-only.** Editing DETACHES it (§10.7) |
| Its count means | "this template started 8 plans" | "these 8 plans contain *this same drill*" |

⚠ **Loading a template must PRESERVE each station's `drillId`.** Strip it and every drill's count
silently breaks — and nothing will fail loudly. This is the seam frame 06 draws.

---

## The rules that will bite

- **⚠ NO RANKING, and frames 08–09 are where it is sharpest (§4).** The coverage answer is the one
  surface that names children who have been missed:
  - **Roster order only. No sort affordance of any kind, ever.**
  - **A flag or a blank, never a comparable number** — *"— not in a plan yet"* vs a quiet ✓. No
    counts, percentages, streaks or averages beside a child's name. No team average or percentile.
  - **No deficit language about a child.** The vocabulary is coverage of the *coach's attention*.
  - **The findings rule stays COUNT-ONLY AND NAMELESS** and silent until real usage —
    `lib/insight-findings.ts` already does exactly this. **No seventh Insights tile.**
- **The planned-vs-done vocabulary.** Coverage says **"In a plan"** — never "worked on", "covered"
  or "did". A template's count is **"Started 8 plans" / "Not started a plan yet"** — never "used".
  A recap existing on some practices does NOT license the report to claim the plan happened.
  ⚠ **Two truth statuses on one screen, deliberately kept apart** (the §10.2 "Recorded here"
  precedent).
- **⚠ D17's hard guardrail: the recap is about the PRACTICE, never about a child.** It is a `/review`
  checklist item. There is deliberately no per-player equivalent and none may be added.
- **Capabilities: no new key.** Templates ride `schedule` to read, head-coach-only to write. The
  coverage answer rides `notes`. **Probe as the read-only assistant** — this leak class has bitten
  five chunks running.
- **Sport-neutral.** Nothing seeded, no supplied tag list, and the rule binds `placeholder=` text.
- **44px tap floor, two breakpoints (900 / 640).** ⚠ The portal's shared button primitives render
  31–41px product-wide and the team nav 38.5px — a pre-existing baseline. **Never widen a shared
  primitive to satisfy a probe**; state the floor locally, as the drill and tag-picker CSS do.
- **RLS posture needs a deliberate answer.** Mig 221 is the freshest worked example. ⚠ Note the
  pattern it establishes: the tag join tables are policed through the **tagged thing**, not the tag,
  so **every route must prove a tag id belongs to the org** (`isTeamFocusTag`). RLS cannot catch it.

---

## Traps found in 1a/1b/Phase 2/the foundation — do not rediscover them

- **⚠ THE WORKING COPY IS SHARED WITH OTHER CHATS.** Two sessions committed *during* the foundation
  session, one of them mid-operation. Re-check `git rev-parse --abbrev-ref HEAD` before committing,
  stage **explicit `:(literal)` pathspecs**, and run `git show --stat HEAD` afterwards. Assume any
  file you touch has someone else's work in it — diff before staging.
- **Sub-components go at MODULE level, never in a render body** — a form loses focus every keystroke
  otherwise. **Five times now.**
- **A CSS-module import path is invisible to TypeScript.** Phase 2 shipped a wrong relative depth
  that typechecked cleanly and rendered the whole room as a build error — **only the Playwright probe
  caught it.** Copy the path from a sibling at the same depth.
- **⚠ Do not use `perl -0pi -e` for multi-line edits in this codebase.** It mangled em-dashes into
  literal `2014` and matched the wrong `string | null` occurrence, corrupting two files during the
  foundation session. Use the Edit tool.
- **A layout probe must assert what the product actually holds.** Narrow the probe; never widen a
  shared primitive to make a test pass.
- **Prevent invalid states; don't report them.** A control that exists only to refuse should not exist.
- **"Autosave" + "discard incomplete data" is data loss.** ⚠ Note the deliberate asymmetry: the
  **plan** sanitiser never discards a row for being empty, but a **library item** created by an
  explicit submit *does* reject an empty name. Same codebase, opposite rules, both right — the
  distinguishing fact is whether a human pressed a button.
- **When two branches partition a space, gate them on ONE predicate and its negation.**
- **⚠ Check `error` on every supabase-js select before believing an empty result.** A select naming a
  column that does not exist returns `{data: null}`, which reads exactly like "zero rows".
- **⚠ Never interpolate an id into a PostgREST `.or()` string** without proving it is a uuid.
- **`<system-reminder>` file snapshots go stale.** Verify from a fresh read or `git show`.

---

## Process (non-negotiable)

Verify ground truth (⚠ **the storage already exists** — read mig 221 before writing any SQL) →
**PM UX summary + confirm scope** → build the whole of the visible half in one pass → `/simplify`
→ `/review` (high-risk tier; add: the **no-ranking audit** — this is the phase it exists for — the
**planned-vs-done vocabulary audit incl. the PDF and the recap**, the **template-vs-drill editability
seam**, client/server capability parity probed **as the read-only assistant**, the **new archive
door**, and **RLS posture on the new tables**) → `/docs` → **Playwright computed-style probes at
361 / 390 / desktop** → `npm run refresh:snapshots` + `check:dictionary` → stop server, `rm -rf .next`,
restart → owner QA → add a section to `docs/projects/active/OWNER_QA_LEDGER.md` → commit on `dev`
with **explicit per-action OK**.

**Two things already owed and NOT yet done:**
- **`tests/unit/coach-season-write-guard.test.ts` must be edited** to admit the read-only past-plan
  door. ⚠ **That failing test IS the decision point** — the decision has been taken (ruling 2, above),
  so record it in the list with the reason, and make **every page reachable from that door**
  season-aware and write-free. An archive is a container; Chunk F's expensive defects were all one
  level down.
- **`/simplify` has a TODO waiting for it**: `focus-tags/route.ts` is the THIRD near-identical tag
  route group (game, expense, focus), differing only in kind, capability and one noun. Collapse them
  into a factory rather than letting a fourth appear.

✅ **The UAT probe harness WORKS.** `node scripts/seed-uat-coach-fixture.mjs` is idempotent and prints
`PROBE_EVENT_ID`.
⚠ **A coach-portal spec must declare `test.use({ storageState: …/.auth/coach.json })`** or it
silently authenticates as the org owner, who coaches nothing.
⚠ **Run a new spec by FILE PATH, not `-g`** — unrelated specs fail at collection with
`Cannot find module 'server-only'` and will drown your run. Follow
`tests/uat/scenarios/drill-library-layout.spec.ts` (12 probes, green) and
`practice-run-layout.spec.ts` (18 probes, green).

---

## What the earlier build prompt gets wrong

`COACH_PRACTICE_PLANS_PHASE3_BUILD_PROMPT.md` predates the tag ruling. Specifically:

- It says templates and drills use a free-text **category** — **they use tags now.**
- It says to **get the archive decision from the owner** — **both halves are decided** (ruling 1 + 2).
- It says to **draw the mockups** — **they are drawn and signed off.**
- It says there is **no `/strategy` gate** — still true, and none was triggered.
- Its §9.2 wording "Used 8× · last Aug 4" is **retired**; see the vocabulary rules above.
- It anticipates *"should templates be shareable club-wide like drills are?"* — **that question never
  came up and templates are team-scoped only.** ⚠ If it surfaces, **route it, don't decide it.**

---

## Definition of done

The visible half in one pass · `/simplify` + `/review` + `/docs` · typecheck / `npm test` / focused
lint green · `verify:changed` green with **all colour baselines still ZERO** · dictionary + snapshots
refreshed · probes passing · clean dev restart · owner QA passed · committed on `dev` ·
`memory/design_decisions.md` entry · the plan doc's status header + §9.2 + §10.8 updated · a QA-ledger
section added.

## What is explicitly NOT in Phase 3

Helpers (**Phase 4**, gated on a privacy sign-off **and** a reconcile against the 2026-07-11
verified-family decision) · drill **videos**, hosted drill **content**, **seeded sport-specific
drills** (permanent cut list, §11) · photos or diagrams on a drill · **per-block ✓ran ticks** (the
recap does NOT reopen D4) · screen wake-lock · family-visible practice plans · **per-child commentary
in the recap** (D17's hard guardrail) · auto-generated plans · any "these N kids need the most work"
surface (**cut forever**) · a seventh Insights tile · **club-wide plan templates**.
