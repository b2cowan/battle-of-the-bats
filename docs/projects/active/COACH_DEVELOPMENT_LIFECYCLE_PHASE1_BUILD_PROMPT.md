# Kickoff prompt — Development lifecycle: the Development grant, then Phase 1 (find and define)

*(paste into a fresh chat)*

**Build two things from `COACH_DEVELOPMENT_LIFECYCLE_PLAN.md`, in this order, and only these:**
**(A) the Development grant** (ruling 9 of the original build prompt, §2) and **(B) Phase 1 — find and
define** (mockup screens 1 and 2). Phase 0 is **closed**: built `340dca2a`, simplified `ea2de010`,
reviewed `6f3422ea`, documented `b5f37207`, owner walk **PASSED 14/14 on 2026-09-12** (ledger §172,
ruling `7d54fe7d`). Phases 2–3 are later chats. Phase 4 is out of scope.

The mockup was approved by the owner on 2026-09-11 with rulings that this build inherits verbatim
(plan §16; hub Decisions tab). Do not re-litigate the model.

---

## 1. Read first, in this order

1. **The binding hub:** https://claude.ai/code/artifact/23bbc89a-f0b5-46e3-b5e5-1b7f9268517c —
   **Mockup tab, screens 1 (Workspace) and 2 (Define) are the spec; screen 0 (Today) is the
   before.** Every element carries NEW / RESTYLED / UNCHANGED and the tag is the scope. The Decisions
   tab now carries sixteen rulings (the newest, 2026-09-12: a past plan with no recap reads one
   sentence). Where this prompt and the mockup disagree, the mockup wins.
2. **`docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_BUILD_PROMPT.md`** — the original Phases 0–3
   prompt. §2 (rulings assumed — all ten stand; **ruling 9 is what part A builds**), §4 Phase 1,
   §5 (data), §6 (rules that bite), §7 (funnel), §8 (do not).
3. **`COACH_DEVELOPMENT_LIFECYCLE_PLAN.md`** §6 (information architecture), §7 (definition
   contracts: kind · unit · aim incl. range From/To · method · attempts per session · headline ·
   descriptors), §9 (who writes — the grant), §16 (the four rulings).
4. **Owner QA ledger §172** (`docs/projects/active/OWNER_QA_LEDGER.md`) — what Phase 0 shipped and
   the six `/review` fixes, so you do not undo them. In particular: a session opens on the first
   test it already holds rows for; a vanished selection shows nothing selected, never a silent jump;
   the practice read's cap lives in the shared read and returns `{ rows, truncated }`.
5. **Staff-access pass 2 as COMMITTED** (`a312c7a2`, ledger §169): `lib/coach-capabilities.ts`
   (`STAFF_PRESETS`, `STAFF_KIND_COPY`, `staffKindLabel`, `ASSISTANT_DEFAULTS`, `HEAD_COACH_ALL`,
   `canWriteDevelopment` at ~430 — still `c.isHeadCoach` — and `canWritePracticePlans`, the seam pass 2
   drew between plan/drill/template writes and Skills & Goals writes), `components/coaches/
   CoachStaffSheet.tsx` (`grantsFrom()` — **must enumerate EVERY grant or a PATCH drops it**), the
   staff routes under `app/api/coaches/[orgSlug]/teams/[teamId]/staff/**`, and mig 288. Read these
   files as they are; the Phase 0 chat deliberately did not touch them while pass 2 was in flight.
6. `memory/design_decisions.md` entries 2026-07-17, 2026-07-31, 2026-08-26 (three tabs, not nine
   drawers), 2026-09-11.

---

## 2. Part A — the Development grant (ruling 9, owner 2026-09-11)

**What the coach sees:** on the Staff page, a person's sheet gains one more switch beside attendance,
lineups, notes, money, documents, tryouts and schedule — **Development** — with a sub-line: *Define
tests, run sessions, record results, write goals and observations.* The head coach's own row shows it
on and not switchable. A new assistant has it **off**. The four kind presets (assistant, manager,
treasurer, helper) all carry it **off**. Every "Only the head coach can…" refusal in development
(32 strings in `app/api` today) either goes away or becomes "You don't have the Development grant".

**Build:**
- `AssistantCapabilityGrants.development?: boolean` and `CoachCapabilities.development: boolean`;
  `ASSISTANT_DEFAULTS.development = false`, `HEAD_COACH_ALL.development = true`; every
  `STAFF_PRESETS` entry `development: false`; `canWriteDevelopment = c => c.isHeadCoach ||
  c.development`. `canWritePracticePlans` is **not** touched (pass 2's seam holds: plans, drills and
  templates ride schedule edit, not this grant).
- `grantsFrom()` in `CoachStaffSheet.tsx` enumerates the new key; the sheet renders the switch with the
  sub-line, in the position the mockup's Record screen note draws it (beside the others); the head
  coach's row shows it locked on. `STAFF_KIND_COPY.emailWhat` sentences do NOT promise it (presets are
  off) — re-read them anyway; copy describing a bundle drifts.
- The staff PATCH/invite routes accept the key (they should already round-trip whatever
  `grantsFrom` sends — verify, do not assume).
- **Migration** (next free number — the tail on 2026-09-12 was **290**; `ls supabase/migrations |
  tail` before naming): rewrite the write policies on `rep_team_measurable_types`,
  `rep_team_evaluation_sessions`, `rep_player_measurables`, `rep_player_development_goals` (head-only
  from birth — mig 189/190/191 are the shape to copy, NOT the predicate) to pass when the caller is
  the head coach **or** holds `development` in their season assignment's capabilities. Read how mig
  288 / the staff routes store capabilities (JSON on `rep_team_coaches.capabilities`; NULL for the
  head coach) before writing the predicate. `/dba` reviews the migration before it is applied to
  dev. Dictionary + `npm run refresh:snapshots` in the same commit; `check:dictionary` and
  `check:schema-parity` are gates (⚠ parity runs on master too — a rule-adding migration must be on
  prod before the master build goes green; say so in the hand-off, do not apply it to prod).
- Tests: `tests/unit/coach-helper-preset.test.ts` and the staff-routes guard pin the preset shapes —
  extend them; add a unit test that every preset carries `development: false` and the head coach
  bundle `true`; a source guard that no development route still says "Only the head coach".
- **Attribution starts here:** every development write already stores `created_by`. Part A does not
  add "entered by" to the screens (that is Phase 2's), but the grant makes it necessary, so leave the
  data in place and say so.

**Exit A:** an assistant with the switch on can define a test, start a session and record a reading
on the UAT team; with it off the same assistant gets a clear refusal and read-only screens; the head
coach cannot switch it off for themselves. Commit A on its own, on the owner's OK.

---

## 3. Part B — Phase 1, find and define (mockup screens 1 and 2)

- **Skills & Goals → three tabs: Sessions · Players · Metrics** (`data-sandbox-tour="development-
  sessions"` MUST survive on the sessions card — the demo tour anchors on it; `npm run check:demos`
  proves the world, not the anchor — grep `lib/sandbox-chrome.ts`). Sessions: list = "date — note",
  a search box, one primary **+ Start session** (Phase 1 keeps today's create-then-open behaviour;
  the scope step is Phase 2). Players: the team board's job in place, roster order, with the
  **metric selector** — the coach picks the metric and the row shows THAT metric's latest value and
  ITS date (no more usage-chosen columns, no single "last eval"). The board's own page redirects into
  the Players tab (keep its route for old links; `coach-page-actions-guard.test.ts` and
  `layout-screens.mjs` know the board page — update both). The drills / templates / practice-plan
  doors stay as quiet links, gated exactly as today.
- **Metrics tab + editor (screen 2):** kind (measured test · observed skill) · name · unit · aim
  (lower · higher · within a range → From/To in the unit · record only) · method · attempts per
  session (1–5) · headline (best in the aim's direction — default · average · last; a range test
  offers "attempts in range" instead of best) · descriptors (skills). Retire / Restore move into the
  editor; the retired list is a disclosure on the tab. **"Changing a definition later" (ruling 3):
  rename keeps the series; a unit or method change on a test that HAS readings starts a new
  definition and retires the old one — the editor says so and offers the choice; the server enforces
  it** (a PATCH that changes unit/method on a type with readings is refused with the offer, and a
  dedicated action creates the successor + retires the predecessor). Extend `readMeasurableTypeInput`
  in `lib/development-input.ts` (the pure reader Phase 0 made; its create/patch overloads) — do not
  re-type validation in the routes. Observed skills are DEFINITIONS in Phase 1; recording an
  observation is Phase 2 — the editor must save a skill definition that nothing yet records against,
  and say so on the tab.
- **The goal form exposes the existing focus tag** (F11) — the same picker the tryout hand-off uses;
  `verifyFocusTag` already proves ownership on both goal routes.
- **Exact addresses:** the profile answers `?section=development` today; extend it to carry the view
  (`goals|results`, the other two are Phase 2), the metric or goal, and a safe internal return to the
  report and its filters. Insights keeps `?section=` and gains report/player/metric state on the same
  convention. Never a new mechanism; never a year parameter (`HISTORY_ENDPOINTS` fails the build).
- **Migration for the definitions** (one, after A's): `rep_team_measurable_types` gains kind · aim ·
  range_from · range_to · method · attempts_per_session · headline · descriptors (+ a successor link
  for the new-definition rule). Decide columns from `schema-dump-columns-dev.json`, not migration
  prose. Existing rows: kind = test, aim = record only, attempts = 1, headline = last — **never
  backfill a method or an aim as fact** (plan §10: "no unknown meaning is backfilled").
- **Counts stay per player.** Attempts land in Phase 2, but the readers Phase 0 wrote
  (`sessionEnteredCount`, `sessionRows`) already count players, not rows — keep it that way.

**Exit B (plan §10):** a coach can define a test with its aim and method, define a skill, find a
less-used metric on the Players tab, and reach a named player's Goals or Results view from a link
that returns them to where they were. Legacy records read honestly ("method not recorded").

---

## 4. ⚠ Verify before building — the tree is shared and the lessons are paid for

- **Three to four peer sessions work in this tree.** `ListAgents` first. `git status` shows ~60
  modified files that are not yours; **never** `git add -A`. **Build every commit in a PRIVATE index**
  (`GIT_INDEX_FILE=<scratch>/x.index git read-tree HEAD`, then `git add -- ":(literal)<path>"` per
  file; for a file a peer also holds edits in — TODO.md, OWNER_QA_LEDGER.md, lib/help-content/
  coaches.tsx, coaches.module.css, lib/db.ts are the usual four — derive HEAD + your hunks with a
  script and `git update-index --cacheinfo`). After committing, `git reset -q -- <your paths>` so
  the shared index reads HEAD for them, and TELL the peers (SendMessage) which shared files moved.
  ⚠ A peer's later commit derived from an older HEAD dropped Phase 0's ledger anchor once
  (`98236c3b` → re-applied in `f5cbc594`): after any peer commit to a shared file, re-check your
  lines in it.
- Bracket directories need `:(literal)` pathspecs. Several files are CRLF (`file <path>`); a
  multi-line edit script must split/join on the file's own line ending. Shell here-strings mangle
  backslashes and `$` — write edit scripts to the scratchpad as `.cjs` files, never inline.
- **`npm run verify:changed` once BEFORE you change anything.** On 2026-09-12 `npm test` was red only
  on the budget-periods session's in-flight files; the chain stops at `npm test`, so run the later
  gates individually (`node scripts/<gate>.mjs`) and say which you ran.
- **Dev server:** shared with the peers; `npm run dev` only. ⚠ If every route 500s, read
  `.next/dev/logs/next-development.log` before touching `.next` — a parse error in YOUR file (a JSX
  comment between siblings in a `.map()` did it once) looks exactly like a stale cache and a wipe
  does not fix it. Restart (stop → `rm -rf .next` → start) only after new files/shared modules, and
  message the peers first.
- **The UAT fixture (`scripts/seed-uat-coach-fixture.mjs` section 16) now carries development
  records:** three tests (Shuttle run retired), Devon Test's readings incl. a unit change, inactive
  "Morgan Left", three practice-review states (recap practice on **May 14**), prior-season records on
  "Avery Prior". Extend that section for Part A (an assistant with the grant: `uat-asst-*` personas
  exist — check `QA_PEOPLE`) and Part B (an observed skill definition, a range test). **A green
  `check:layout` over an empty fixture proves nothing** — populate first, then sweep
  (`--only=<ids>` with the EQUALS; `npm run check:layout -- --list` for ids). Populating surfaced 63
  pre-existing touch findings on 2026-09-11, recorded DEFERRED with a reason in
  `scripts/.layout-baseline.json` — **Phase 2 rebuilds those rows; do not fix them one at a time**,
  and record any new fixture-driven keys the same way (copy a sibling's reason).
- Rendered probes: `innerText` applies `text-transform` — lower-case both sides. The session chips
  render UPPERCASE.
- `lib/marketing-shots.ts` waits for **"Log a measurable"** on the demo profile — Phase 1 does NOT
  rename that button (it is Phase 2's "Record a result"); if the three-tab restructure changes the
  shot's route or ready selector, `npm run check:marketing-shots` must pass in the same commit.

---

## 5. Funnel, gates and hand-off — per part

1. Unit tests first for every rule (the reader, the successor rule, the preset shapes, the address
   parser), then the change, then `npm run typecheck` (shared modules), `npm run lint:focused`,
   the `verify:changed` gates, `check:layout --only=` on every touched screen at 361/390/768/1440,
   `check:demos`, `check:marketing-shots`, `check:dictionary`, `check:schema-parity`. Cold-restart
   the dev server before the browser hand-off; login 200; EACCES 0.
2. **Owner browser pass** (hub → QA Walk → **Part B**, new; write it against the fixture as seeded,
   pin identities not figures, one checkbox per option on a ruling step), then `/simplify` (the
   headline computation — best/average/last/in-range — must have ONE home the rows, the editor
   preview and later the chart and handout read; Phase 0 left `lib/measurable-series.ts` shaped for
   it), then `/review` (high-risk: RLS predicate, the successor rule, grant round-trip through the
   sheet, the redirect), then `/docs` (the help label pass: "Your test list" → "Metrics", the layout
   article that narrates the band stack, "who can do what" for the grant, the "Your drills" rename
   — ruling 3 of the open calls; keywords keep the old terms).
3. **Commit only on the owner's OK**, private index, `git show --stat HEAD` to confirm the file set.
   Never `master`.
4. **Hub bookkeeping in the same commit:** stage strip (`current` → Build with the anchored fact —
   the strip is at QA for Phase 0 now; the honest reading is "Phase 1 building" once B starts),
   Decisions row for any mid-build ruling, **QA Walk tab: add Part B** (the `QA_PARTS` array; Part A
   stays), re-embed the two `.md` files between the `<script type="text/markdown">` markers if they
   changed, republish with the Artifact tool **passing the hub URL as `url`** (read the live version
   first — the tool refuses otherwise). Ledger: next § number, never renumber. TODO line, memory file
   `project_coach_development_lifecycle` — anchored facts, never "uncommitted".
5. Hand-off in the owner's voice: what changed on screen, which part, what is prod-owed (the
   migration numbers — both are prod-owed until the release manager promotes; the parity gate
   makes the order binding), and the QA walk link.

---

## 6. Do not

- Do not build attempts, observations, goal reviews, session scope or the handout (Phase 2/3).
- Do not rename "Log a measurable" (Phase 2, with the marketing-shot change).
- Do not touch `canWritePracticePlans`, the drill/template rooms, the practice planner or the
  tryout scorecard.
- Do not add a development shelf to the season-end page or a year parameter anywhere.
- Do not seed sport packs, benchmarks or default tests. Do not backfill a method or an aim.
- Do not change the Insights hub's seven tabs or the profile's three tabs.
