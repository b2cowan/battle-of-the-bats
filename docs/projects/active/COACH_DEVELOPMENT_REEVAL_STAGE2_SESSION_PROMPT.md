# Kickoff — development lifecycle re-evaluation, stage 2 · Session (proposal tab only)

Paste everything below the line into a fresh chat. (Rewritten 2026-09-14 late, after the owner's
B10–B12 rulings on the Stage 1 build — the earlier version of this prompt predates them.)

---

You are picking up the **coach development lifecycle re-evaluation** at **stage 2 · Session** —
the walk's stations 2 (start a session with a scope), 3 (record on the field) and 4 (review the
session). Your deliverable is a **proposal tab on the existing walk artifact** — analysis and a
drawn proposal for the owner to rule on. **You are not building anything in this chat.** The owner
rules one stage at a time, on a drawn proposal, and has twice ruled *in chat on the build* after
the proposal (Stage 1's B8 and B10–B12) — so write decisions he can argue with, not a menu.

## Where things stand (read these first, in this order)

1. Your auto-memory file `project_coach_development_lifecycle.md` (loaded for you) — the top block
   is the current state. Stage 0 · Arrive is committed (`f6cdb7ff`). Stage 1 · Define is **built
   on dev and walked** (ledger §187, plan §18) but its commit, `/simplify`, `/review` and `/docs`
   may or may not have happened — check the ledger's §187 "Owed / next" and `git log` before you
   assume either way. If the Stage 1 tree is still uncommitted, it is in the SAME working copy you
   are in: do not touch its files.
2. The artifact — **https://claude.ai/code/artifact/0f62f000-5b68-4923-ad00-9f32fb1fe3ad** — source
   `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_REEVALUATION.html`. Read it with the Artifact
   tool (`action: "read"`, that url) **before** you edit anything. Read the whole of **"The walk"**
   stations 2, 3 and 4 and **Standing back** S3 (is the session the right spine?). Then read the
   **"1 · Define"** tab end to end: it is the template for yours (header · What changes/Why · Before
   with amber markers · After with green markers · On a phone · Where else it touches · Decisions
   with `data-kind="build"` · Build summary). ⚠ The Define tab's **B6** (an unfinished test is a
   to-do) is drawn as ruled-and-built there but was **reversed on the build** (plan §18, B10) —
   the artifact has not been re-marked yet; do not inherit B6 from the drawing.
3. Ledger `docs/projects/active/OWNER_QA_LEDGER.md` **§187** and plan **§18** (Stage 1's rulings —
   B1–B12; read B8–B12 as the binding ones); §185 and plan §17 (Stage 0's).

## What the earlier stages settled that Session inherits

- Overview is the landing; the dashboard's **Needs attention** lists "sessions left unfinished"
  (the DERIVED completeness — in-scope cells with no result, no not-assessed mark, no
  observation). A stored "reviewed" mark was ruled against at station 4 — do not re-propose one.
  ⚠ "Unfinished" now means a SESSION only. An unfinished *test* no longer exists (B10): the
  chip, the Finish → door, the Overview line and the rail count are gone. Do not bring back any
  "this test needs finishing" nudge on the session grid either — a test with no method is a test.
- **The method is a note, not a rule (B10, owner 2026-09-14):** "I don't think we need to force a
  new metric for updates to the method nor require that field … coaches still want to see how
  things like sprint speed change over time." The successor rule is the **unit alone**; a method
  can be written, changed or erased on a live test and the series stays one series; the field is
  labelled **Method** everywhere. The reports no longer say "same method throughout" or "method
  not recorded". If your session screens quote the definition anywhere (a grid header, a review
  line, the scope step), quote the aim and the unit, never the method's presence.
- **A retired metric is a record (B11–B12):** its rows sit in the same Metrics table under
  "Retired (N)", and its sheet shows every field as a value with only the name editable and
  Restore in the footer. A session that already holds a retired test's results keeps showing them
  (F02 — settled in Phase 0); a retired test is never offered for a NEW session's scope.
- A metric's definition is a **sheet** over the screen it was opened from (B8); the session grid's
  "+ New test…" opens it. The one-word ladder is fixed: metric → test | skill → result |
  observation → attempt. Use those words; `tests/unit/development-vocabulary-guard.test.ts` will
  refuse the old ones on any surface you add.
- The grant is the door (D5). No read-only faces on a live season.
- **Stage 1 was NOT the station for the definition's contents** — those were ruled 11 Sep (Q 1.1)
  and re-ruled tonight (B10). Nothing in Stage 2 re-opens what a test *is*; Stage 2 decides where
  its ATTEMPT COUNT lives and how a session is scoped, run and reviewed.

## The ruling you inherit — draw it first (B9, owner 2026-09-14)

**"Attempts per session shouldn't be defined by the metric. The coach may have time to run a test
3 times in a practice and only twice in another; this should be defined in the session instead."**
Today the definition's count is a CEILING: a test that says "2" gives the grid two fields, so a
third sprint cannot be recorded at all (`attemptsPerSession` on `rep_team_measurable_types`,
read by `SessionRecordGrid`, `describeAttempts`, the Review dialog's "fewer than N", the sheet's
Attempts field, the demo seed and the fixture). Where the number lives is YOUR call to draw,
because its natural home is the scope step — and the walk's Q 2.2 asks whether that dialog should
exist at all. Draw the count where the scope lives (per test, in the scope step; "Change scope"
mid-session), with the recommended escape: any row can add one more attempt (up to five), because
on a real evening one kid runs three and another two. Say what happens to sessions recorded
before the count existed (they claim only what was recorded). The definition sheet loses its
Attempts field in this stage's build — but note the **headline** (best · average · last) stays
on the definition: it is how a result is *read*, not how many were run.

Also inherited from Define: a test added mid-session (via "+ New test…") lands OUTSIDE the
session's scope snapshot (`scope_metric_ids`), so the session's "N of M in scope" never counts
it — settle that with the scope's rule.

## What the walk already said (your starting point, not your conclusion)

Station 2: the Sessions list has no visible door (the row is plain text, the × is the only
control); "Choose this session's scope" / "As always: the event pre-fills the date and never owns
it" are the plan's words, not a coach's; the list counts recorded, not planned; the desktop dialog
scrolls inside itself. Q 2.1 (a session — its own thing, or a facet of a practice?) and Q 2.2
(is the scope worth a dialog?). Station 3: on a phone the first field sits ~830px down; the header
is a permanently open form; the chip row shows no done-count; a saved first attempt is text
beside an input; **two counts on one session disagree for a skill** (the grid's footer counts
results only, the Review counts observations — a defect, recorded as seen); "Mark not assessed"
on an observation row is a test's word. Q 3.1–3.3. Station 4: the review is one run-on line per
metric; the policy sentence explains the plan's worry. Q 4.1.

Two things the owner said at Stage 1 that bear on your stations, so you don't re-ask them:
**"why is a metric a page when a player's dues open in a drawer over the list?"** — the portal
opens a record over its list; if the scope step is a dialog, it is a QuestionShell sheet over the
Sessions list, never a page. And **"is this stage evaluating what goes into X, or formatting?"** —
say in one line at the top of your tab which of the two each station's proposal is, so the owner
knows what he is ruling on.

Walk them in the browser as the UAT head coach (`tests/uat/.auth/coach.json`; team "UAT Test
Team"; the 10 Jun session "Phase 2 probe — scoped" holds every state) at 1440 and 390 with a small
Playwright script from inside the repo (`scripts/.tmp-*.mjs`, deleted afterwards). **The dev
server is shared: do not restart it, never run a full `check:layout` sweep or `--prune`.**
Read-only browsing is fine; do not leave a probe session behind. ⚠ The UAT coach fixture DRIFTS
under manual walks (tonight the live 60-yd sprint had been left in "ms" by a successor walk);
if the Metrics tab does not read `60-yd sprint · seconds` / `Throw speed · km/h` / `Changeup
speed · mph` / `Sets feet before throwing · skill` with `Retired (2)` beneath, run
`node scripts/seed-uat-coach-fixture.mjs` (dev only; idempotent) before you screenshot anything.

## The tab you will add — follow the Define tab's conventions exactly

Add a **"2 · Session"** tab button beside "1 · Define" (replace the disabled placeholder
`<span class="tab next">2 · Session…</span>`), wire `session: 'tab-session'` into the `panels` map,
add the `<div class="prop" id="tab-session" role="tabpanel" hidden>` panel after `#tab-define`, add
the next placeholder ("3 · Player", disabled). Decisions are `data-q="C1"`… with
`data-kind="build"`; a Build summary block `#buildSummarySession` / `#summaryOutSession`
(iterate `#tab-session .ask[data-q]`; no walk yet). Frames in the `.pf` classes (the Define tab
draws a sheet with `.scrim`/`.sheet`; the grid needs new `.pf` classes — add only what the
existing frames lack). Markers `.an` + `.mk` + `.pop` INSIDE the element they explain, never in a
`<p>` (a `<div>` inside a `<p>` is ejected by the parser). Pin identities (Devon, Avery, Casey,
the 10 Jun session, 60-yd sprint, Changeup speed, Sets feet before throwing); never invent figures.
Every table you draw follows `docs/agents/design/TABLE_AND_LIST_STANDARD.md` — the owner asked
tonight whether the Metrics tables "adhere to our table formatting standards set out when we
standardized the money section", and the retired list did not; draw the session grid and the
Sessions list to the standard (density by content, the baseline heading, no tinted item rows) and
say so in the tab. Write **"Where I'd push"** honesty into every decision; do not manufacture a
change for a station the walk rated sound. **While you are in the artifact, re-mark the Define
tab's B6 as "Reversed on the build (B10)"** with one sentence and a pointer to plan §18 — that is
the one edit outside your tab you are asked to make.

## Concurrency

Other sessions share this working tree and may hold uncommitted hunks in the artifact HTML and in
the Stage 1 files. Draft in your scratchpad; before splicing, `git status --short` the file; if it
is modified, `ListAgents` + `SendMessage` the peers with your exact anchors. Tonight a peer session
nearly re-instated B6 because it had walked it hours earlier and the reversal happened in another
chat — when a peer tells you a hunk is owner-directed, believe the plan §18 record over the walk.
The file has been rewritten to CRLF by a peer's editor before — normalise to LF when you splice
(the committed blob is LF). Never `git add -A`; never commit without the owner's say-so. Republish
with the Artifact tool passing the `url`; read it first so the publish is accepted; if a newer
version is live, merge onto it.

## Hand-off

Reply in product-owner voice (what changes, why, trade-offs, what to click), link the tab
(`#tab=session`), and record the state at the top of the lifecycle memory file ("STAGE 2 SESSION —
PROPOSAL PUBLISHED <date>, decisions C1–Cn, not built"). Do not update the ledger or TODO yet.
