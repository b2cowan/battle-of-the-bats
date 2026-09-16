# Kickoff — a team-level progress view for Skills & Goals (walkthrough + mockup only; nothing built)

*(paste everything below the line into a fresh chat)*

---

You are opening a **new, independent project**: whether and how a coach sees "how is my team
trending" for Skills & Goals, at the team level rather than one player at a time. This was deferred
twice in the closed **Development lifecycle** re-evaluation — first as stage 0's **D8** ("Build = not
now — waits for [the refusals question]"), then confirmed still parked at stage 4's **G7** once that
question was answered. Both are ruled; neither is a request to build this a particular way. Read them
as the reason this project exists, not as a spec.

**Your deliverable is a mockup on a Claude Artifact, current state vs. proposed, with lettered
decisions and a paste-back summary for the owner to rule on — plus a plan doc and a short PM brief.
You are not building anything in this chat.** No product code changes. A build happens in a later
session, after the owner rules, from a build prompt you write at the end of this one.

## Step zero — the tension this project exists to resolve

Two standing rulings pull in different directions and you must reconcile them, not pick one and
ignore the other:

1. **The Overview dashboard is state, not analysis** (stage 0, D7 — `docs/projects/archive/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md`
   §17): four count tiles, each a door; a Needs-attention list; no chart, no table, no team average.
   A team-trend tile that shows a number going up or down on the Overview itself would break this on
   its face.
2. **The refusals are a principle, and there is no leaderboard, ever** (stage 4, G7 — plan §21 and
   the Business Decisions Log): "a leaderboard is never drawn on a development report; the Decision
   Board ranks evaluators' scores, never children against each other." Whatever "team trend" means,
   it cannot become a per-player ranking, a best-to-worst list, or anything a parent could read as
   comparing their child to a teammate.

So the real question is narrower than "build a team-trend tile": **what would tell a coach something
true and useful about the team as a whole, that isn't a ranking and isn't a fourth thing squeezed
onto the Overview's dashboard?** It may be that the honest answer is a new report inside
`Insights → Development` (which already holds Coverage and Player progress, each its own tab on one
selector) rather than anything on the Overview at all — read the code before assuming either shape.

## 1. Read first, in this order

1. **Memory** (auto-loaded): `feedback_mockups_as_claude_artifacts`, `feedback_clickable_design_annotations`,
   `feedback_build_to_approved_mockups`, `feedback_project_hub_single_artifact`,
   `feedback_product_owner_summaries`, `decision_playing_time_vocabulary` (a sibling ruling — "never
   'fair'" — from the same no-ranking family; read it for the pattern of how this product talks
   about comparing players without comparing them), `reference_business_decisions_log`,
   `feedback_holistic_reeval_over_item_fixes`, `reference_shared_worktree_stage_race`.
2. **The archived plan** — `docs/projects/archive/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md`:
   - §17, ruling D7 (the Overview's "state not analysis" contract) and D8 (this project's origin)
     in full, including the *"one reader behind every number"* guardrail.
   - §21, ruling G1 (Coverage's shape: one roster table in Insights, `Show` selects **Current
     focus** first, then any metric; the count line's exact wording pattern) and G7 (the refusals
     principle, the Business Decisions Log citation, and the line *"D8's team-trend tile stays
     deferred on its own terms"*).
   - §21's read-from-the-code section on how `Coverage`, `Player progress` and the Overview's rail
     currently share one denominator rule (`developmentReports`) — any new report must fit that same
     rule, not invent a second one.
3. **The Business Decisions Log** (`docs/agents/strategy/BUSINESS_DECISIONS.md`) — find the G7 entry
   and read it in the log's own words, not just the plan's summary of it.
4. **The code** — `Insights → Development`'s Coverage and Player-progress reports (how they share a
   `Show`/report selector on one address), the Overview dashboard's four tiles and Needs-attention
   list, and `lib/insight-findings.ts` (the sentence-generation the reports already use — a team-level
   view should read through the same kind of honest, denominator-stated sentence, not a bare number).

## 2. Method — walk it the way the Development lifecycle project did

That project's assessment (`docs/projects/archive/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` §2–§3) is the
template: **source-based, not a signed-in browser test.** Walk it as the head coach asking "how is my
team doing this season, overall" at a few natural moments — mid-season, before a parent conversation,
deciding what to work on at the next practice — and for each, read what the code can honestly answer
today and what it can't. Tag findings **Code finding**, **UX hypothesis**, or **Proposal**, the same
three categories the original assessment used.

**Concretely work through what "team trend" could mean without becoming a ranking**, for example
(verify each against real data on the UAT fixture before trusting it as a finding, and do not treat
this list as the answer — it's the shape of the question):
- A count: how many players have at least one result recorded on the team's current-focus metric
  this season, and how many of those improved since their first result — a fact about coverage and
  motion, never a sorted list of names.
- A team-wide sentence in the same voice `insight-findings.ts` already writes elsewhere ("8 of 12
  players have a newer result than their first this season").
- Whether this belongs as a fourth `Show` choice inside Coverage, a new tab beside Coverage and
  Player progress, or nothing at all if no honest team-level fact survives the no-ranking
  constraint — that last outcome is a legitimate answer this project can reach.

## 3. Deliverable

Build a Claude Artifact (project-hub pattern: mockup, decisions, plan and — later — QA walk as tabs
on ONE URL). A **true-size before frame** (today's Overview and Insights → Development, exactly as
they render) and a **true-size after frame** for whatever you propose (which may be "the Overview is
unchanged; here is the new Insights tab" — do not force a change onto a screen the ruling above says
should not change). Every callout is clickable, not a hover title. Lettered decisions with a
recommendation on each, and a paste-back block for the owner.

Write the matching **plan doc** (`docs/projects/active/COACH_TEAM_PROGRESS_VIEW_PLAN.md`) and a short
**PM brief** (`COACH_TEAM_PROGRESS_VIEW_PM_BRIEF.md`) — plain language: what a coach can now see about
the team as a whole that they couldn't before, why it matters, and explicitly confirm in the brief
that nothing in the proposal ranks or compares individual players (this is the one thing the owner
will check first).

Add **one summary line to `TODO.md`** linking the new plan (this is a new project — do not touch the
Development lifecycle entry, which is closed and archived).

**End the chat by writing a build-kickoff prompt** for the session that implements whatever the owner
rules — following this same file's own shape.

## 4. Guardrails

- **If the honest answer is "nothing new belongs here," say so.** This project is explicitly allowed
  to conclude that D8 is correctly parked — the deliverable is a considered answer, not a tile.
  Recommend against building it and explain why is an acceptable proposal.
- **No new figure without a reader behind it.** Every number in the mockup must be one a real player
  in the UAT fixture actually produces — no placeholder statistics.
- **This is a shared checkout.** Another session may be mid-edit in any file you read. Re-read before
  trusting a stale view, and build your eventual commit as a private index if anything you touch is
  also in another session's working set (`reference_shared_worktree_stage_race`).
