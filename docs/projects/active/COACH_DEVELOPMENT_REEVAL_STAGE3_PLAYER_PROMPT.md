# Kickoff — development lifecycle re-evaluation, stage 3 · Player (proposal tab only)

Paste everything below the line into a fresh chat. (Written 2026-09-15 at the end of the stage 2
QA session — after C1–C10 were built on dev, ledger §189, and while a stage 2 "round 2" — C11 and
the Sessions-list redraw — was still open in another chat.)

---

You are picking up the **coach development lifecycle re-evaluation** at **stage 3 · Player** —
the walk's stations 5 (the player's record — Goals · Results · Observations · Previous seasons)
and 6 (review a goal), plus the two Standing-back questions that land on the player (S2, S3) and
the roster rebuild's **Q7**, which was deferred to this re-evaluation *by name*. Your deliverable
is a **proposal tab on the existing walk artifact** — analysis and a drawn proposal for the owner
to rule on. **You are not building anything in this chat.** The owner rules one stage at a time,
on a drawn proposal, and has ruled *in chat on the build* at every stage so far (B8, B10–B12,
C11, the list's round 2) — so write decisions he can argue with, not a menu.

## Where things stand (read these first, in this order)

1. Your auto-memory file `project_coach_development_lifecycle.md` (loaded for you) — the top block
   is the current state. Stage 0 · Arrive committed (`f6cdb7ff`), stage 1 · Define committed
   (`210333ae`), stage 2 · Session **built on dev 2026-09-15 (ledger §189, plan §19)** with its
   walk owed and its commit owed — and a **round 2 open** (C11: "What are we running?" at
   twenty-four metrics as a list you build; the Sessions list redrawn from the owner's read of the
   build). Check ledger §189's "Owed / next", the artifact's "2 · Session" tab and `git log`
   before you assume what has been built, walked or committed. If stage 2 is still uncommitted it
   is in the SAME working copy you are in: do not touch its files. Migration 298 is dev-only and
   PROD-OWED, order-critical after 297 — not your concern except that nothing you propose may
   need a migration *before* it.
2. The artifact — **https://claude.ai/code/artifact/0f62f000-5b68-4923-ad00-9f32fb1fe3ad** — source
   `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_REEVALUATION.html`. Read it with the Artifact
   tool (`action: "read"`, that url) **before** you edit anything — ⚠ it was republished from TWO
   chats on 2026-09-15 and the on-disk file has been ahead of the live version; build your splice
   on whichever is newer and say which. Read the whole of **"The walk"** stations 5 and 6,
   **Standing back** S2 (how many doors to one figure) and S3 (is the session the right spine),
   and the roster rebuild's Q7 as quoted under station 5. Then read the **"2 · Session"** tab end
   to end: it is the template for yours (header · Ruled-and-built block · What changes/Why ·
   Before with amber markers · After with green markers · On a phone · Where else it touches ·
   Decisions with `data-kind="build"` · Build summary · the walk block, which you do NOT write yet).
3. Ledger **§189** and plan **§19** (stage 2's rulings C1–C10 and the build calls); §187 / §18
   (stage 1, B1–B12 — read B8–B12 as the binding ones); §185 / §17 (stage 0). The **roster +
   player page review** — ledger §182 (passed 40/40) and hub artifact `b6e9645a` — settled the
   player page's five tabs (Details · This season · Skills & Goals · Notes · Family), the Notes
   timeline (one place notes are read; written once) and left **Q7 (drop the Observations view)**
   to you. Plan `COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` §15 holds the round-2 findings the walk grew
   from.

## What the earlier stages settled that Player inherits

- **The words are fixed and build-enforced:** metric → test | skill → result | observation →
  attempt; a goal, a review, a focus area. `tests/unit/development-vocabulary-guard.test.ts`
  refuses "reading", "measurable", "Measured test" on every listed surface — the player's record
  is one of them. Quote the aim and the unit, never the method's presence (B10: the method is a
  note, never a rule; the series never forks on it).
- **A record's facts open in a sheet over the screen; work happens on a page.** The owner's own
  question ("why is a metric a page when a player's dues open in a drawer?") became B8, and stage
  2 applied the test that settles the shape: *if the coach fills it in and closes it, a sheet; if
  the coach works in it, a page.* A goal's review, an observation, a new goal, "Record a result"
  are sheets (`QuestionShell`); the player's record is the page they open over; the handout is a
  page. Do not draw a page for a form or a sheet for a grid.
- **"Record a result" on the player already opens the SAME definition sheet** for "+ New test…"
  (B8) and records a single dated result outside any session — the one place a result's date is
  typed by hand. Stage 2 made the session the spine for everything recorded on the field (a
  session at a practice takes the practice's date — C10; every result in it moves with it). **S3
  is yours:** is the bench-side "Record a result" the right second door, or should every result
  have a session, even a session of one? Argue from what the reader does with a result that has
  no session (the trend line, Coverage, the review's counts, the handout) — not from tidiness.
- **ONE counting rule** (stage 2): a cell is recorded with a result or an observation, accounted
  for with a not-assessed mark too; the grid's foot, the chips, the review and the Sessions list
  all read it. If the player's Results view says how many attempts a session held, it says the
  same number the session says. A dropped skill keeps its observations, always (plan §19) — an
  observation is a written note about a child and may be evidence on a goal.
- **The grant is the door (D5)** and **Internal notes gates the words:** goals, observations and
  reviews are behind Internal notes; results are on any record duty. No read-only faces on a live
  season. Q 5.3 (coach's record or the family's) sits on that gate — do not re-cut the gate; rule
  what it means for what an observation may say and what the handout prints.
- **Every table follows `docs/agents/design/TABLE_AND_LIST_STANDARD.md`** (density by content,
  the baseline heading, no tinted item rows, the row is the door, a chevron last, no ×). The
  Sessions list went to it in stage 2 and the owner is redrawing it again in round 2 — read that
  redraw before you draw the Results or Goals list, so the player's lists and the team's lists
  are one recipe.
- **"A fold inside a tab is a second click"** is the roster rebuild's own finding and the reason
  the record's tabs have addresses. The Skills & Goals tab as built is five tabs → four views →
  a list → a "Selected goal" panel → the history; the walk called that depth the thing to spend
  this stage on.
- **Previous seasons is the archive (Phase 3, 3D):** it reads the directly-linked prior season's
  record through the continuity link and offers the one-time carry-forward — it is NOT a year
  parameter, and the closed-season ruling (a finished season is ONE PAGE; `HISTORY_ENDPOINTS` in
  `tests/unit/coach-history-endpoint-guard.test.ts` is the whole look-back layer) is not yours to
  re-open. You may move or fold the view; you may not add a way to read another year.

## The questions this stage rules (the walk already asked them — answer, don't re-ask)

- **Q 5.1 — four views inside a tab: one screen too many?** Goals and Results are two kinds of
  record; Observations is evidence for the first; Previous seasons is archive. The walk's lean:
  two views (Goals · Results), observations read in the goal's history and in Notes, the archive
  folded under Results or under its own quiet heading. Draw it and say what the coach loses.
- **Q 5.2 / rebuild Q7 — where does an observation live?** Today it is read in three places from
  one record (the Observations view by skill; the goal's history as evidence; the Notes timeline
  in the season's order). Rule which is the home and which are doors. Whatever you rule, the two
  ways to WRITE one stay: the skill chip on the session grid and "Record an observation" on the
  goal — stage 2 left the skill chip's observation for you on purpose.
- **Q 5.3 — the coach's record or the family's?** A goal is internal to read and public to print
  (the handout, station 8 — a later tab; say where your ruling pushes on it, do not draw it).
- **Q 6.1 — is a status change a review?** The pill on the list appends a status-only review;
  the panel's Status row is a second control for the same fact 200px apart. The walk's lean: keep
  the append-only history, keep the pill, show status-only rows collapsed; one status control.
- **Q 6.2 — set → observed → reviewed: the shape, or the ceiling?** A goal carries five facts
  beyond its focus (success sentence, review date, origin, tag, status). Say which are the
  record and which are optional folds — the reports and the handout lean on them.
- **S2 as it touches the player:** Devon's latest sprint headline reads in six places. On HIS
  record, which reading is the home (Results) and which lines are doors that should say so?
- **The walk's "What I'd change" list, each as a build call or a decision:** a goal shown once
  (the list row IS the panel, expanded in place, a chevron on expandable rows); the handout door
  up beside the view switch (it is why a coach opens this tab before a meeting); the Metrics
  door out of the player's section; the notebook sentence beside its button, not under the
  heading; "How it's going" (or "Your note") instead of "What did you observe?" on the review;
  Next review pre-filled as a FUTURE date on the goal's cadence, never the past one; dates read
  "24 Jun", never `2026-06-24`, and every clock through `formatTime()`; prose after data on every
  view (the explanation lines into the "?" help, one sentence at most on screen).

Two things the owner has said at every stage, so you don't re-ask them: **"is this stage
evaluating what goes into X, or formatting?"** — say in one line at the top of the tab which of
the two each station's proposal is; and the sheet/page test above. A third from stage 2's walk
(§189, "For the owner"): a past session still opens today's grid — the record's face after the
season is a LATER stage, not this one; a player's *previous* seasons are the archive view, ruled
in Phase 3.

## Walk it before you draw it

Walk the player's record in the browser as the UAT head coach (`tests/uat/.auth/coach.json`;
team "UAT Test Team"; **Devon Test** — `…/roster/{devon}?tab=skills` — holds every state: the
goal "First-step quickness off the bag" (set with the player, reviewed 10 Jun, observed 10 Jun),
sprint results across the 10 Jun and 27 May sessions with a correction, an observation on "Sets
feet before throwing" taken in the 10 Jun session, and a linked previous season) at 1440 and 390
with a small Playwright script from inside the repo (`scripts/.tmp-*.mjs`, deleted afterwards;
name yours `.tmp-s3-*` — the `.tmp-s2-*` files belong to the practices session). **The dev
server is shared: do not restart it, never run a full `check:layout` sweep or `--prune`.**
Read-only browsing is fine; do not leave a goal, a review or a result behind. ⚠ The UAT coach
fixture DRIFTS under manual walks: if Metrics does not read `60-yd sprint · seconds` / `Throw
speed · km/h` / `Changeup speed · mph` / `Sets feet before throwing · skill` with `Retired (2)`
beneath, or the 10 Jun session's plan is not sprint × 2 · throw × 1 · changeup × 3, run
`node scripts/seed-uat-coach-fixture.mjs` (dev only; idempotent) before you screenshot anything.
Also open the **Notes** tab beside Skills & Goals and the **Insights → Player progress** report
for Devon — Q 5.2 and S2 are ruled across those three readings, not on one screen.

## The tab you will add — follow the Session tab's conventions exactly

Replace the disabled placeholder `<span class="tab next" aria-disabled="true">3 · Player<span
class="st">next</span></span>` with a **"3 · Player"** tab button, wire `player: 'tab-player'`
into the `panels` map, add the `<div class="prop" id="tab-player" role="tabpanel" hidden>` panel
after `#tab-session`, add the next placeholder ("4 · Reports & handout", disabled — stations 7–8;
station 9, who sees what, closes the project unless the owner names it otherwise). Decisions are
`data-q="E1"`… with `data-kind="build"` — **E, not D:** stage 0 · Arrive took D1–D8 (plan §17),
stage 1 B, stage 2 C, and A is the walk's part letters. A Build summary block
`#buildSummaryPlayer` / `#summaryOutPlayer` (iterate `#tab-player .ask[data-q]`; no walk yet).
Frames in the `.pf` classes (the Session tab draws the sheet, the grid, the review table and the
list recipe; the player's record needs a tabbed page frame, a goal row that opens in place and a
history list — add only what the existing frames lack). Markers `.an` + `.mk` + `.pop` INSIDE the
element they explain, never in a `<p>` (a `<div>` inside a `<p>` is ejected by the parser). Pin
identities (Devon, Avery, Casey, the goal's wording, 60-yd sprint, Sets feet before throwing, the
10 Jun session); **never invent a figure** — every number on a frame is one the fixture holds,
and a demo/help sentence carries a number only if the seed computes it. Draw every list to the
table standard and say so in the tab. Write **"Where I'd push"** honesty into every decision; do
not manufacture a change for a station the walk rated sound (the goal's history and the Results
view were rated the calmest reading in the lifecycle — keep what works and say so).

Note for the build stage, not for you to do: the help sub-topic "A player's record — goals,
results, observations, previous seasons" already measures 382 words against the 350-word
standard; whoever builds this stage converts it in the same unit of work.

## Concurrency

Other sessions share this working tree and may hold uncommitted hunks in the artifact HTML (the
stage 2 round-2 chat) and in the stage 2 files. Draft in your scratchpad — and ⚠ the scratchpad
has VANISHED mid-session once (a ledger draft and a helper were lost); keep anything you cannot
re-derive in the repo file itself, early. Before splicing, `git status --short` the artifact
file; if it is modified, `ListAgents` + `SendMessage` the peers with your exact anchors. The file
must stay LF (a peer's editor has rewritten it to CRLF before). Never `git add -A`; never `git
stash`; never commit without the owner's say-so. Republish with the Artifact tool passing the
`url`; read it first so the publish is accepted; if a newer version is live, merge onto it and
say so. Do not `watch` the artifact — the round-2 chat republishes it often.

## Hand-off

Reply in product-owner voice (what changes, why, trade-offs, what to click), link the tab
(`#tab=player`), and record the state at the top of the lifecycle memory file ("STAGE 3 PLAYER —
PROPOSAL PUBLISHED <date>, decisions E1–En, not built"). Do not update the ledger or TODO yet.
