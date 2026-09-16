# Kickoff prompt — Development lifecycle: define, record every attempt, review the goal, explain progress

*(paste into a fresh chat)*

**Build `COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` Phases 0–3, in that order, and only that.** The design
was assessed on 2026-09-11, walked against the code the same day (plan §15), drawn as a project hub,
and **the mockup was approved by the owner on 2026-09-11 ("looks good") with four rulings made during
review (plan §16) and the nine open calls carried at their recommendations** (§2 below). Carry it
verbatim; do not re-litigate the model. Phase 4 is not in scope.

---

## 1. Read first, in this order

1. **The binding hub:** https://claude.ai/code/artifact/23bbc89a-f0b5-46e3-b5e5-1b7f9268517c
   — the **Mockup tab is the spec**. Screen 0 (Today) is the before, drawn from the code; screens 1–6
   are the after. **Every element carries a NEW / RESTYLED / UNCHANGED tag, and the tag is the scope:**
   UNCHANGED means you do not touch it; RESTYLED means the existing thing changes shape or wording as
   drawn; NEW means it does not exist. Click every red finding chip and every green "fixes" chip — each
   opens the finding, where you are looking, and what the proposal does. Where this prompt and the
   mockup disagree, the mockup wins.
2. **`COACH_DEVELOPMENT_LIFECYCLE_PLAN.md`** — §4–§5 (the findings; §15.1 corrects F09), §7 (the
   recording contracts), §8 (chart rules 1–10), §10 (phases and the technical constraints), §15 (what
   round 1 missed and the surfaces it did not look at), **§16 (the four rulings made in review:
   "Metrics", every attempt is recorded, the range aim kept, every coach records results)**.
3. **`COACH_DEVELOPMENT_LIFECYCLE_PM_BRIEF.md`** — the outcome in the owner's terms.
4. The hub's **Decisions tab** — fourteen settled rulings this build inherits. Read every one before
   you write a line; three of them (roster order, head-coach-only writes for goals and observations, one-page closed season) are
   the reasons several things below are shaped the way they are.
5. The build these findings sit on: `docs/projects/archive/COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md`
   and `memory/design_decisions.md` entries dated 2026-07-17 and 2026-07-31.

---

## 2. ⚖ Rulings assumed — the owner approved the mockup with these carried at their recommendation

If any of these is struck by the owner at kickoff, stop and re-plan that item before building it.
Otherwise they are decided:

1. **Three tabs replace the 31 July band stack** on Skills & Goals: Sessions · Players · Metrics. The
   drills, templates and practice-plan doors stay as quiet links, gated exactly as today.
2. **The library is called "Metrics"** (owner ruling). Apply the same "no your" rule to the existing
   **"Your drills"** door and its help articles in the same label pass.
3. **No version table.** Rename keeps the series. A unit or method change on a test that has readings
   **starts a new definition and retires the old one**; the editor says so and offers the choice.
   Mixed-unit series are split on screen regardless (F01).
4. **A goal review needs a status, not prose.** Status required; note, next review date and evidence
   optional. Every review is a dated event; nothing is overwritten.
5. **"Not assessed" is a link on blank rows only**, never a control on every row.
6. **Every attempt is recorded** (owner ruling). A test declares attempts per session (1–5) and its
   headline (best in the aim's direction · average · last; for a range test: attempts in range ·
   average · last). **Headline defaults to best**, per test, changeable.
7. **The range aim stays, drawn properly** (owner ruling): From/To in the unit; each attempt reads
   in / +n / −n; the headline is never "best"; the chart shades the band.
8. **A finished season's development record is OUT of scope.** Do not add a shelf to the season-end
   page, and do not add a year parameter to any development or Insights route (the
   `HISTORY_ENDPOINTS` guard will fail the build if you do — that failure is the decision point).
9. **One "Development" grant on the staff card covers every development write (owner ruling
   2026-09-11, superseding a results-only widening the same day).** Always on for the head coach
   (cannot be removed from themselves); **off by default for an assistant**; switched on per
   assistant from the staff card, beside attendance / lineups / notes / money / documents / tryouts /
   schedule. On = define and retire tests, start sessions, record results and attempts, goals,
   observations, reviews. Off = read only, gated exactly as today (goals + observations ride `notes`,
   results ride record access). Every record names who wrote it. Build: a new capability key
   (`development`) on the assignment with `canWriteDevelopment = isHeadCoach || c.development`; the
   staff card toggle + its sub-line; the staff-access presets (manager, treasurer, helper, …) carry
   it **false**; the development write RLS policies — head-coach-only from birth (mig 189/190/191) —
   rewritten to check the grant. A migration, coordinated with staff-access pass 2 (mig 288 is its
   number in prose only). Delete every "Only the head coach can…" error string and help sentence
   that this makes untrue.
10. **The four player views live INSIDE the Development section on the record's "This season" tab**
    as one segmented control — the record's three tabs (owner ruling 26 Aug, "three tabs, not nine
    drawers") are untouched.

---

## 3. ⚠ Verify before building — the working copy is shared and it is DIRTY

- ⚠⚠ **The tree carries at least three other chunks of uncommitted work**: staff-access pass 1
  (`development/board/page.tsx` is one of its files — a `CoachNotGranted` gate added 2026-09-10),
  the Categories & Items door, and the budget-import band work. **Run `git status` first, then
  `git diff` on every file you intend to touch**, and never assume a diff in those files is yours.
- **Stage explicit pathspecs; run `git diff --cached --stat` before every commit.** Bracket directories
  (`[teamId]`, `[orgSlug]`, `[playerId]`, `[sessionId]`) need `:(literal)` pathspecs or they stage
  **nothing**. Build the commit in a private index if another session is active.
- ⚠ **`ls supabase/migrations | tail` before naming yours.** The tail on 2026-09-11 was **287**
  (dev-only, prod-owed). The staff-access plan names 288 for its pass 2 **in prose only — it is not
  started**; take the next free number and say which in the commit.
- ⚠ **Run `npm run verify:changed` once BEFORE you change anything** and record what is already red.
  A red gate is not evidence about your change until you know which file it names.
- **Dev server:** start only with `npm run dev`; this build adds files and shared modules, so
  **restart before every browser hand-off** (stop → `rm -rf .next` → start → wait for Ready).

---

## 4. What this builds, in phase order — each phase ends green and committed

### Phase 0 — Trust in existing records (F01–F05, F21). No new screens.

Write the failing unit test FIRST for each; there are none today (F21). Then:

- **F01** — split a player's series wherever the recorded unit changes; never draw two units as one
  line; say why beneath the row; every reading stays listed.
- **F02** — the session screen shows every test and every player that has a saved record in it,
  labelled *retired* / *inactive*, read-only. New entry still starts from the current active list.
- **F03** — "Practices you've run" becomes the three-state list drawn on the Practice review screen:
  *Upcoming plan* / *Past plan · no recap* / *Recap recorded*. Only a recap may describe what happened.
- **F04** — goal edit/delete and reading delete refuse a past-season roster row with the same 409
  the creates use. Test the old-season request directly.
- **F05** — the report carries per-section state (available · empty · incomplete · failed); the
  practice read's cap is either lifted for the season or stated on screen; a gap is never reported
  from an input that did not load.

Exit: tests green, the owner walks the non-empty histories and the failure states (QA part A).

### Phase 1 — Find and define (screens 1, 2)

- **Skills & Goals → three tabs.** Sessions (list = "date — note", search, `+ Start session` opens the
  scope step), Players (the team board's job, in place, with the **metric selector** — the coach
  picks the metric; columns are no longer chosen by usage; the date shown is that metric's), Metrics.
  The board's separate page redirects into the Players tab. ⚠ The demo tour anchor
  `data-sandbox-tour="development-sessions"` **must survive on the sessions card**.
- **Metrics editor (screen 2).** Kind (measured test · observed skill) · name · unit · aim (lower ·
  higher · within a range → From/To · record only) · method · attempts per session · headline ·
  descriptors (skills). The "changing a definition later" rule is enforced server-side (ruling 3).
  Retire/Restore move into the editor; the retired list is a disclosure on the Metrics tab.
- **The goal form exposes the existing focus tag** (F11) — the same picker the tryout hand-off uses.
- **Exact addresses.** The profile already answers `?section=development`; extend it to carry the
  view, the metric or goal, and a safe internal return to the report and its filters. Insights keeps
  `?section=` and gains the report/player/metric state on the same convention. Never a new mechanism.

### Phase 2 — Record and review both kinds (screens 3, 4)

- **Session scope** (date · optional "Taken at" · which metrics · who is here) recorded with the
  session; counts are measured against it. Legacy sessions with no scope claim only what they hold.
- **The grid takes one field per attempt** (ruling 6). Enter → next attempt → next player. Per-row
  states: Saved · Saving · Not saved — retry · Not recorded · Not assessed (link on blank rows only,
  with a neutral reason). Edit on a saved row keeps the original in the record's history. A review
  step counts the scope and never creates a zero or marks "complete" for the coach.
- **Attribution** — "entered by" on every reading and "written by" on every goal, observation and
  review, since a delegated assistant can write any of them; the demo seed gives the assistant the
  grant and one reading entered by them, and the demo check asserts it.
- **Observations** — a dated record: skill definition (or free text), descriptor (optional), what
  happened, context, author, optional goal link. Notes gate. "Not observed" is an evidence state.
- **Goal reviews** — an appended dated event: status (required), note, next review date, evidence
  links. The goal's first event names its origin (set with the player · carried from a season ·
  seeded from the tryout). Existing `updated_at` is never reinterpreted as "reviewed on".
- **Player record → Development section → four views** (ruling 10): Goals (tryout snapshot on top,
  UNCHANGED; goal list; selected goal's facts and history), Results (headline + every attempt;
  **"Record a result"** keeps the single-reading path), Observations, Previous seasons (the existing
  archive, RESTYLED into a view). The continuity card and carry-forward offer stay above the views,
  UNCHANGED. **The Context lines leave this section** — attendance and playing time have their own homes.
- ⚠⚠ **Removing the one-reading-per-(session, player, test) rule means re-deriving EVERY count that
  today reads rows as players** before this ships: the session's "N of M entered", the board's
  latest-per-type, the coverage counts and the count-only finding, the Insights digest rule, the
  PDF's rows, and `scripts/check-demo-coach.mjs`'s N-of-M and "got faster" assertions. The
  fundraising release hit exactly this on 2026-09-10; find every reader first.
- **Same unit of work — the shop window and the gates that watch it:**
  - `lib/marketing-shots.ts` `coach-development` waits for the literal button text
    **"Log a measurable"** (F20); it becomes "Record a result" in the same commit, and
    `npm run check:marketing-shots` must pass.
  - Demo seed (`scripts/seed-demo-coach.mjs`, `lib/demo-coach.ts`): the showcase player gets **three
    sprints on each testing day**, one observed skill and one goal review; guided-tour step 2 ("Find
    the two blanks", `lib/sandbox-chrome.ts`) is **re-narrated** for the new row states and the
    attempts; `check-demo-coach.mjs` asserts the new shape. `npm run check:demos` green on dev. ⚠ The
    prod re-seed is owner-run and owed — say so in the hand-off, do not do it.
  - Help (`lib/help-content/coaches.tsx`, seventeen articles — plan §15.3): "Your test list" →
    "Metrics", "Log a measurable" → "Record a result", the layout article, the retire promise under
    F02, "who can do what", the "Your drills" rename, new articles for observations, goal reviews
    and attempts. Keywords keep the old terms. `/docs` runs this; you run `/docs`.

### Phase 3 — Explain progress (screens 5, 6)

- **Insights → Development → Report selector** (Coverage · Player progress · Practice review) under the
  existing seven tabs — a labelled dropdown row, never a third row of tabs. **Player is a dropdown in
  that row, roster order.** Coverage keeps every existing column and section ("In a plan", the
  count-only finding, uncovered tags, "Returning player") and gains the selected metric with its own
  date. Player progress: real-date axis, labelled unit, headline per session with **every attempt as a
  small mark**, the shaded band for a range test, best/average switch, exact readings in a table,
  observation timeline for a skill. Practice review = the Phase 0 three-state list with the tag
  filter. Chart rules 1–10 in plan §8 are binding; the "options I would not prioritise" list is a
  do-not-build list.
- **Handout preview** replaces "Print summary (PDF)": chosen goal, chosen observation, chosen result
  with attempts, a written next step, optional full log; same boundary as today (no tryout material,
  no peer figures, no link); long content paginates.
- Invalidate mounted Insights panels after development mutations (plan §10).

---

## 5. Data — decide from the snapshots, not the migration prose

- Read `docs/agents/db/schema-snapshots/schema-dump-columns-dev.json` for the four development tables
  (plan §15.3 lists their columns as of 2026-09-11). Additive, one migration per phase that needs one:
  - test definitions gain kind · aim · range from/to · method · attempts per session · headline ·
    descriptors (skills); a reading gains an **attempt number** and the partial unique becomes
    (session, player, type, attempt); new tables for **observations**, **goal reviews**, and **session
    scope/participants** (with the not-assessed state and reason).
  - Write policies on every development table (new and existing) check the **Development grant**
    (ruling 9) — the head coach always passes; the 3A RLS rewrite (mig 189) is the model for shape,
    not for its head-coach-only predicate;
    org-member reads follow the `rep_*` family posture; composite (id, team_id) FKs where a row could
    otherwise be attached across teams (the mig 190/191 lesson).
- **`/dba` reviews the migration before it is applied** (new FK tables; the 3C precedent).
- Dictionary + `npm run refresh:snapshots` in the same commit; `npm run check:dictionary` is a gate.
- Apply to dev only. Prod promotion is the release manager's; note the migration as prod-owed in the
  hand-off with its number.

---

## 6. Rules that bite on this surface

- **Roster order only. No ranking, no team average beside a child, no composite, no "consistency
  score".** Spread is a number in the unit, shown on request. Coverage vocabulary is the coach's
  attention, never the player's performance.
- **One word, one spelling** (`npm run check:spelling`): *Metrics*, *Record a result*, *Record an
  observation*, *Add goal*, *Not assessed*, *Not recorded*. Times, if any, are "8:00 a.m." via
  `formatTime()`. Dates via `formatStoredDate()`; never raw UTC for "today".
- **Tokens only** in CSS; the token-debt ratchet is a gate. Shared component over shared class.
- **Every tile or door that renders a read must be gated the way the read is** — the staff-access
  pass 1 lesson (a tile stuck on "…").
- **`npm run check:layout`** sweeps coach screens; run it with `--only=` (with the equals) for every
  screen you touch, at 361/390/641–768/desktop, both themes.
- **A `[data-sandbox-tour]` anchor is a contract with the demo tour.** Keep it on the element the
  narration describes.

---

## 7. Funnel, gates and hand-off — per phase

1. Unit tests first (F21), then the change, then `npm run typecheck` (shared modules change),
   `npm run lint:focused`, `npm run verify:changed`, `check:layout` on touched screens, `check:demos`
   (Phase 2+), `check:marketing-shots` (Phase 2+). Cold-restart the dev server; login 200; EACCES 0.
2. **Owner browser pass** on the phase's screens, then `/simplify` (new shared modules — the attempt
   headline computation must have ONE home used by rows, charts, handout and export), then `/review`
   (high-risk: RLS, counts-as-people, re-stamp, archive guards), then `/docs`.
3. **Commit only on the owner's OK**, explicit pathspecs, `git show --stat HEAD` to confirm no foreign
   files. Never `master`.
4. **Hub bookkeeping in the same commit** (the hub is the project's record — one file, one URL):
   - `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_HUB.html` — move the stage strip's `current`
     class to Build and set its `title` to the anchored fact ("Phase 0 built `<hash>` <date>");
     append a Decisions row for any ruling the owner makes mid-build; **unhide the QA Walk tab and
     fill `QA_PARTS`** for the phase (plan §11's walkthrough is the base; write each step against the
     stage the fixture is in, pin identities not figures, one checkbox per option on a ruling step;
     the Sign-in card is already there — verify the UAT credentials against `.env.local`).
   - Republish with the Artifact tool **passing the hub URL as `url`** (this chat did not publish it;
     without `url` you would mint a second artifact). Re-embed the two `.md` files between the
     `<script type="text/markdown">` markers first if they changed.
   - Ledger section in `OWNER_QA_LEDGER.md` (next § number — never renumber), TODO.md line, memory
     file `project_coach_development_lifecycle` (anchored facts, never "uncommitted").
5. Hand-off message in the owner's voice: what changed on screen, which phase, what is prod-owed
   (migration number, demo re-seed), and the QA walk link.

---

## 8. Do not

- Do not build Phase 4 (coverage matrix, small multiples, templates, import, offline drafts).
- Do not add a development shelf to the season-end page or a year parameter anywhere.
- Do not touch the drill or plan-template rooms, the practice planner, or the tryout scorecard.
- Do not seed sport packs, benchmarks, age norms or default tests.
- Do not build "undo a rollover", attendance-vs-improvement, leaderboards, or AI summaries.
- Do not change the closed-season page, the Insights hub's seven tabs, or the profile's three tabs.
