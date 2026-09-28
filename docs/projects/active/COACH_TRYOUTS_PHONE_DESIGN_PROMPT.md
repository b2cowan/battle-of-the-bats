# Prompt — Tryouts from a phone · analysis and design phase

> Paste everything below the line into a fresh Claude Code session on `dev`. Written 2026-09-25 from
> a portal-wide survey (three explorers over every coach screen, every open plan and the cross-cutting
> gaps). **Design only: no product code until the owner rules.**

---

You are opening a NEW project: **"Tryouts from a phone"** — the analysis and DESIGN phase for the
tryouts room, the evaluator's scoring link and the tryout history, read and used on a phone. Your
deliverable is measurements, true-size drawings on a new project hub, and a short list of decisions
for the owner to rule on. You build nothing in this session.

## Why this project exists (the finding it answers)

Two phone projects — "Coaching from a phone" (stages 0–6) and "Practice plans on a phone" — redrew the
shell, the Overview, the Schedule, the lineup builder, the practice plan, Skills & Goals, the player
page, chat ordering and the Insights reports. **Neither plan ever listed tryouts**, not in a stage and
not in its out-of-scope section. Tryouts One Room (built 2026-08-23, QA §81 passed) gave the two field
tools a desktop layout and kept the phone "field flow byte-for-byte" — which is to say nobody has
measured or drawn the phone since the room was assembled. The layout sweep has exactly one tryouts
entry, the landing (`coach-tryouts`), and its accepted phone-width findings were never worked. Tryout
day is the most phone-bound day of a coach's year — check-in at a gate, scoring on a diamond, helpers
on cold links — and the fall tryout window is open now.

## Read first (in this order, and only these)

1. `docs/projects/active/COACH_TRYOUTS_ONE_ROOM_PLAN.md` — the three findings and "The build"
   (URL-backed stages `?stage=setup|tryout-day|decide|build`, faces `?view=board|check-in|score`,
   faces stay mounted, tabs are links). Mockups (the spec) at
   https://claude.ai/code/artifact/f3cefd79-fe56-40e8-85cf-5c9ec14553c4. Its PM brief beside it.
2. `docs/projects/active/COACH_MOBILE_EXPERIENCE_PLAN.md` — §2 (the seven standing rules; **S.5 the
   field floor** is the one this project applies most: check-in and scoring are screens read standing
   up), §4 (stage 0 — the shell, the field floor A4, the More sheet), §13 (the two drawer layers). The
   hub https://claude.ai/artifact/WqHGTXUmrns81UN6e2PJvC — match the visual identity of its stage
   drawings; you are starting a new hub, not adding a tab to this one.
3. `docs/projects/active/OWNER_QA_LEDGER.md` §81 (the One Room walk) and §108 (tryout decision emails
   removed). Skim §48 (tryouts one checklist) and §1.11 (Tryout Insights) for what they settled.
4. The surfaces (read the components, not just the pages):
   - the coach's room `app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx` (337 lines) and its
     parts under `components/rep-teams/`: `TryoutFlowHeader` (stage tabs + the face row),
     `TryoutSetupChecklist`, `TryoutCheckIn` (718), `TryoutScorerSurface` (318 — **one scorer, two
     doors**: the coach's embedded face and the evaluator's cold link render the same component),
     `TryoutScoreboardCard` (the live board), `TryoutDecisionBoard` (667), `TryoutRubricCard` (602),
     `TryoutDayCard` (425 — its stylesheet is shared by four components), `TryoutReportCard` (394),
     `TryoutBaselineCard` (304), `TryoutEvaluatorsCard` (301), `TryoutMemoryStrip` (returning
     candidates), `TryoutNamesSwitch` (hide/show names on THIS tryout, mounted at four places);
   - the evaluator's door `app/tryout-score/[token]/page.tsx` — the URL token is the only credential,
     no portal chrome, phone by construction;
   - the family's door `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx` and
     `.../register/page.tsx` + `TryoutRegisterForm` (377) — public, server-rendered, styled inline on
     the dark ground (`--pitch-black`), NOT the warm portal;
   - the history `app/[orgSlug]/coaches/teams/[teamId]/tryouts/history/page.tsx` (240);
   - tryout sessions are projected read-only onto the Schedule (see `schedule/page.tsx` around the
     "tryout session projected onto the calendar" comment) — note it, don't redraw the Schedule.
5. Help: `lib/help-content/coaches.tsx` sections `recipe-run-tryouts` and `premium-tryout-history`.
6. The sweep entry and the specs: `scripts/layout-screens.mjs` (`coach-tryouts`),
   `tests/uat/scenarios/coach-tryouts-smoke.spec.ts` (self-provisions a tryout with the `captryout-`
   marker, pre-cleans, tears down and ASSERTS the teardown — the pattern to copy if you need one) and
   `tests/uat/scenarios/tryout-blindfold-boundary.spec.ts` (the names switch's boundary).

## What is known before you measure

- **No tryout component uses the ≤640 hook** (`useIsPhone` appears nowhere under the tryout
  components), and their own stylesheets carry few narrow rules: the names switch 0, the baseline
  card 1, the report card 1, the setup checklist 1, the memory strip 1, the scorer 4, check-in 6, the
  rubric card 6, the day card 8. Whatever the phone gets today, it gets by accident of the desktop.
- **The room's header is two rows** (stage tabs, then the face row on Tryout day). S.2 says one
  identity line at rest; measure what a coach on Tryout day actually sees before the first row of
  content at 390×844.
- **The scorer's phone flow is shared with the cold link.** A change to the scorer changes both
  doors. Decide, and say, whether that is one drawing or two.
- **The family's register page is a public dark surface**, not the portal. Whether it belongs in this
  project is a decision for the owner (below), not an assumption.
- **The UAT team has no tryout.** The seeder (`scripts/seed-uat-coach-fixture.mjs`) writes a program
  year, players and events only. Two specimens exist: the coach demo sandbox's **11U team frozen at
  Tryout day** (`lib/demo-coach.ts` — sessions today, three evaluators, scores as integers; the
  sandbox is write-blocked, so it is a READ specimen, and leaving the sandbox path ends the session)
  and a tryout you provision yourself on the UAT team the way the smoke spec does (marker-named rows,
  pre-clean, teardown asserted — **never leave it behind**; the fixture is shared with the owner's
  own walks). Say in the plan which specimen each number came from.

## Rulings to build ON, not reopen

- **One Room (§81).** Stages and faces are URL-backed links; faces stay mounted; the two navigate-away
  buttons are gone. A phone drawing rearranges what the room shows, not where it lives.
- **FieldLogicHQ sends a tryout family NOTHING as a consequence of a coach's decision** (owner,
  2026-08-26, binding; §108). Nothing on the decision board may mail a family; do not draw a send,
  a switch, or a reply. Off-by-default is not an answer to this — the capability was the problem.
- **The product never appears to make the cut.** Ranking and bias flags are decision support, not the
  answer. A phone board that puts a sorted list first has to earn that order; say why.
- **Names are baseline** (2026-08-03): everyone with portal access sees names and numbers. **The names
  switch (2026-08-25)** hides or shows names on THIS tryout for everyone — helpers' phones and the
  printed check-in sheet follow it — and it is mounted wherever the state is shown. Keep both.
- **Scores are integers 1..scaleMax**; the scorecard weights, the setup checklist and Tryout Insights
  are settled — their walks may be owed, but their shapes are not yours to redraw.
- **The returning-candidate match's `high` tier admits twins** (same birthday, shared guardian
  email). If a drawing shows a confidence chip on the memory strip, it may not read as certainty.
- **Standing phone rules:** the field floor (S.5: nothing under 12px, the looked-for value at 14 or
  above, on screens read standing up); the 44px tap floor; one identity line at rest (S.2); a table
  whose columns fit stays a table (S.7); the drawer rule (a FORM covers the nav, a MENU sits on top of
  it); header glyphs borderless on a phone; mobile actions icon-only; the transient Saved pill; every
  delete asks first; back goes up one level inside every sheet; **"8:00 a.m."** and one spelling
  everywhere a customer reads it; every highlight on a drawing is clickable.
- **The Draft Brief** (split-opinion flag + a synthesized paragraph per prospect) is a shortlisted
  idea, not a ruling. It is OUT of this project unless the owner brings it in. If the measurement
  shows that evaluators disagreeing is invisible on a phone board, name it as a finding and stop there.
- **Money, the club-admin tryouts screen, and the Schedule's own drawing** are out of scope.

## What to produce

1. **Measure before drawing.** A Playwright probe in the gitignored `.probe/` folder (never
   `test-results/`; a plain `npm test` wipes it), signed in with `tests/uat/.auth/coach.json` for the
   coach's room and history, and with NO session for the cold link and the register page, at
   **390×844 and 360×780**, plus **768×1024** (a tablet is a touch device — the 641–768 band ruling)
   and 1440×900 as the reference the One Room desktop set. Read every number from the browser's own
   geometry, never from a screenshot. Record, per screen: page height; what a coach sees before the
   first row of content; every control under 44px (count them, list the worst); every word under 12px
   and every looked-for value under 14px on check-in and the scorer; the columns of the live board
   and the decision board and whether they fit at 360 (measure the table's natural width); the
   scorer's taps from "open the link" to "first score saved"; the check-in taps from "open the face"
   to "first player checked in" and to "add a walk-up". ⚠ If you provision a tryout, the smoke spec
   is the pattern: marker-named rows, pre-clean, teardown asserted. Report which specimen each number
   came from, and say where a real tryout (60 candidates, three evaluators, two sessions) would change
   the answer — seed nothing that size without asking.
2. **Open the project hub.** Copy `docs/agents/design/PROJECT_HUB_TEMPLATE.html` to
   `docs/projects/active/COACH_TRYOUTS_PHONE_HUB.html`, read its instructional comment block, fill
   the placeholders, load the `artifact-design` skill and publish it with the Artifact tool. One URL
   for the project's whole life; republish the SAME path to stack a version. Tabs: Mockup (with the
   numbered walk sub-nav, one section per screen) · PM Brief · Full Plan · Decisions (driven by the
   DECISIONS array — append a row per ruling as it happens) · QA Walk (hidden until a walk exists).
   The stage strip at the top carries anchored positives only (never "not built").
3. **Draw at true size** — 390px frames that do not reflow, a **whole-screen before/after** per screen
   that changes, the phone/desktop toggle wired, every finding flag and every fix chip clickable with
   its per-instance explanation, every element tagged NEW / RESTYLED / UNCHANGED. Say which "before"
   frames are captures and which are drawn. Match the visual identity of the coaching-from-a-phone
   stage drawings. Screens to draw, at minimum:
   - **the room on Tryout day** (the header at rest, the face row, the live board);
   - **check-in at the gate** (the row, the search, a walk-up, the names switch where it sits);
   - **the scorer** (one player, the 1–5 controls at 44, the way to the next player, the "(you)" chip);
     draw it once and say whether the cold link is the same frame;
   - **Decide** on a phone (the board, a decision, the memory strip on a returning candidate);
   - **Set up** and **Build team** on a phone (the checklist, the report) — measured; drawn only if
     the measurement says they need it;
   - **the history** (one tryout's row and what it opens).
4. **Decisions**, each with options, a recommendation and its tradeoff, and a paste-back box with one
   checkbox per option. At minimum:
   - **T1 · the room's head on a phone.** What a coach on Tryout day sees at rest: stage tabs and the
     face row as today, or the stage folded into the title with the faces as the one row, or the
     faces as the More sheet's idiom. Argue it from S.2 and the measured first content row.
   - **T2 · check-in at the gate.** The row's shape, the search, walk-ups, the field floor.
   - **T3 · scoring on the field.** One player at a time vs a list; the control sizes; the tap count
     to the first saved score; one drawing for both doors or two.
   - **T4 · the boards.** Live board and decision board: table or cards at 360, by S.7's test; what
     the board puts first without appearing to make the cut.
   - **T5 · the family's register page.** In this project (it is where a family first meets the club,
     on a phone, on a dark public ground) or its own — recommend, don't assume.
   - **T6 · the sweep.** Which screen entries to add (faces, stages, the cold link, history) so the
     phone stays measured after the build.
   - Anything the measurement shows that this list misses: say so, don't force-fit.
5. **Write the plan and the PM brief** — `docs/projects/active/COACH_TRYOUTS_PHONE_PLAN.md` (the
   findings with their measurements, the rulings above as "not reopened", the decisions, a stage
   ladder if the work wants stages, verification at build, no migrations expected — say so if one
   appears) and `COACH_TRYOUTS_PHONE_PM_BRIEF.md` (plain language: what a coach and an evaluator do
   differently on tryout day, why it matters, success criteria). Render both on the hub's tabs. Add
   ONE summary line to `TODO.md` under Active Tasks linking the plan. No ledger § until something is
   built; a planning entry is not a §.

## Working rules for this owner

- **Push back out loud** when a premise is wrong — argue from what the code does, not from what a plan
  says. Don't manufacture disagreement. If the measurement says the phone is already fine somewhere,
  say that and draw nothing there.
- **Product-owner voice** in every reply: what a coach or an evaluator sees and does differently, and
  the tradeoffs. File paths and code stay out of chat; they belong in the plan.
- **Mockups are Claude Artifacts, on the project's ONE hub.** Before every publish, read the live
  version, merge, then publish from your file — never overwrite a newer version.
- **Stage only your own files**, on `dev`, in a private index. Other sessions have uncommitted work in
  the same working copy (the portal stylesheet, the ledger, TODO, the help content, the billing
  files) and may have STAGED files in the shared index. Don't commit without the owner's say-so.
- **Don't launch a full layout sweep.** The owner tests on the shared dev server. Scope it with
  `--only=` (with the equals sign); an abort on the memory floor is a failure, not a pass.
- **Never touch prod, and never a prod account in an artifact.** The QA walk's sign-in card, when it
  exists, names the dev UAT coach and reads the password from `.env.local`.
- **No code** until the owner pastes back the rulings.
