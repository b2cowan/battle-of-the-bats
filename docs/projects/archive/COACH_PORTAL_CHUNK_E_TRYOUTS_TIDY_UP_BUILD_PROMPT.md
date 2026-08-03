# Coach Portal — Chunk E: "Tryouts & Development tidy-up" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-30, at the close of the Chunk H session (H1 `ee46bf89` — the month view;
> H2 `f483405a` — the spreadsheet importer). Chunk E was picked as the next build because it is
> **small and collision-free** while a concurrent session works on portal chrome and the Overview
> (Chunk I). **Nothing in E is pre-decided beyond the four inherited items below** — the owner
> explicitly asked this chat to *"explore further ways we can improve the tryout section"*, so the
> discovery half is real work, not a formality. This prompt is self-contained.

---

## The prompt

You are planning and building **Chunk E — Tryouts & Development tidy-up** for the premium Coaches
Portal, **and running a fresh discovery pass over the whole tryouts experience** (owner-requested).

**The problem in one line:** the Tryouts flow is one of the best things in this product — a
four-stage walkthrough the readiness review called a reference pattern — but the coach who runs the
tryout can't easily score at it, the setup forms can lose typed work, and the Development hub it
sits beside offers two doors to the same question plus a permanent "coming later" placeholder.

Follow the full house process: **discovery pass → implementation plan + PM brief → mockups as an
artifact (owner approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions →
build the whole approved chunk in one pass → `/simplify` → `/review` → `/docs` → owner QA → commit
only with explicit per-action OK.**

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the ledger**; chunk E is defined in
   "What's left, grouped into pickable chunks". §0 = release state. **Rule: tick absorbed review
   items in §1.1 in the same unit of work.**
2. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the source of the findings.
   Tryouts appear in it **twice as a strength** (the 4-stage flow and the field check-in screen are
   named as the reference pattern for "explaining yourself to a first-timer") and **once as a
   failure** (f3-4, the scoring detour). Read both halves — the strengths are the house style you
   must not damage while fixing the gap.
3. `memory/design_decisions.md` → the **2026-07-30 Chunk A** entry (list-vs-grid, `CoachScrollX`,
   `useDiscardGuard`, layout primitives), the **Chunk G** entry (education-vs-write gating split),
   and the **Chunk H / H2** entries (a grid navigates rather than edits; preview-first with a
   verdict per row). Also check for a **Chunk I** entry — a concurrent session is building the
   Overview's "one prose card" rule and it may have landed by the time you start.
4. `docs/agents/strategy/BUSINESS_DECISIONS.md` → the 2026-07-30 **D-G1** entry. It binds all of
   Money and, by extension, any place you'd be tempted to suggest a figure. Tryouts has its own
   version of the same trap — see landmines.

### The four items you inherit (scope floor — the discovery pass may add to this)

1. **P1 #16 / f3-4 — the tryout scoring detour.** Tryout Day promises "score them", but the
   scoring tool is reached by going to **Setup → Evaluators → generate a link**, which reads as a
   tool for handing off to somebody else. A head coach who wants to score candidates themselves has
   to issue themselves an "evaluator" invitation. The review's recommendation: **a "score as
   yourself" shortcut directly on the Tryout Day tab.**
2. **P1 #5 remainder — the unsaved-changes guard on tryout SETUP forms.** Chunk A shipped
   `useDiscardGuard` and covered every Money modal; the tryout-setup modals were deliberately
   deferred here by owner ruling D3. A half-built rubric is exactly the kind of typed work the
   guard exists for.
3. **f9-2 remainder — the Depth Chart's desktop width.** Chunk A took the shipped `.pageWide`
   opt-in for Budget vs. Actual and left the Depth Chart half open. Same question, different
   surface: a structured grid capped to the portal's reading column and scrolling internally.
4. **Development-hub polish.** Verified by direct read 2026-07-30:
   - **Two doors, one question.** "How's everyone developing?" (→ the team board) and "Is everyone
     getting attention?" (→ the Insights coverage report) sit adjacent, and BOTH describe
     themselves as a coverage view. A coach cannot tell which one to press.
   - **A permanent "coming later" placeholder.** The Practice plans slot renders "Coming in a later
     phase" on every team, forever. The portal's own standard (Batch 3, the closed-season nav) is
     that a dead tab is dishonest — decide whether this earns its space.
   - **A blank award picker** on brand-new teams.

### Ground truth — VERIFIED 2026-07-30 by direct read. Re-confirm what you build on; do not re-derive.

- **The tryouts hub is one page with four tabs** (`tryouts/page.tsx`, ~172 lines) composed of
  cards: `TryoutDayCard`, `TryoutRubricCard`, `TryoutEvaluatorsCard`, `TryoutScoreboardCard`,
  `TryoutDecisionBoard`, under a shared `TryoutFlowHeader` that owns the four-stage tab strip and a
  "do this next" prompt. The active tab **auto-selects from the season's phase on first load and
  then never yanks the coach off a tab they chose** — preserve that.
- **Scoring already exists and is good.** `/tryout-score/{token}` is a token-authenticated,
  field-ready page: per-category scores with weights, optional blind mode, per-category in-flight
  saving so tapping a second category doesn't wait on the first, and a lock state. The token is
  minted by the Evaluators card (`/tryout-score/${token}` built from a create-link response).
  **The scoring UI is not the problem — the way a coach REACHES it is.** Reuse it; do not build a
  second scorer.
- **There is a check-in sub-page** (`tryouts/check-in`) the review praised for sunlight legibility
  and forgiving tap targets. It is the tone to match.
- **Capability gate:** `canManageTryouts(assignment.capabilities)`. The hub fails OPEN while
  assignments resolve (so a real coach never flickers into a "no access" wall) and the server is the
  real gate. **Any new door must follow the same pattern** — and the read-only probe sweep is
  standing (this leak class bit Chunk A with 5 findings).
- **Seven tryout APIs exist** — candidates, decisions, evaluators, overview, rubric, scoreboard,
  sessions — plus the public `tryout-score/[token]`. **Expect NO migration.** If a schema change
  appears, stop and re-scope.
- **The Development hub** (`development/page.tsx`) holds: sessions list, the two competing doors
  above, a Test types manager, and the Practice plans placeholder. The board is at
  `development/board`; the coverage report is under `history/development`.

### The discovery pass (owner-requested — do this BEFORE writing the plan)

Walk the tryouts experience end to end as three different people and write up what you find. Bring
findings to the plan round as **recommendations with a clear v1 / later split** — the owner will
choose. Do not silently expand the build.

- **The head coach running the tryout.** Setup → tryout day → decisions → roster. Where do they
  stall? What do they have to leave the flow to do? What do they have to remember that the product
  could remember for them?
- **The volunteer evaluator handed a link.** They arrive cold, possibly on a phone, in sunlight,
  with no account. Is the link honest about what it is and how long it lives? What happens when
  they lose it, or open it after scoring closes?
- **The parent/candidate.** Registration, check-in, and — the sharp end — **being told no.**
  What does a declined candidate currently experience?

Questions explicitly worth exploring (the owner named the tryout section as the target — these are
starters, not a checklist, and some may be bad ideas you should argue against):
- Does the four-stage flow survive a coach who runs **two tryout days**, or a second session?
- Is there anything useful to say to a coach **after** decisions — the tryout is the front door to
  the roster, and Chunk G/H made the money side name its next action every time.
- The scoreboard already flags an **evaluator whose average is out of line with the group**. Is
  that surfaced where a coach would act on it, and is the language fair to the volunteer?
- What does a **second-season** coach get from last year's tryout? (Rollover carries budget lines —
  see chunk H — but what carries here?)
- Anything in the tryout flow that assumes a diamond sport (⚠ see landmines).

### Landmines & contracts (hard-won — respect, don't relearn)

- **⚠ The tryout equivalent of D-G1: never let the product appear to make the CUT.** Ranking,
  composite scores and bias flags are decision *support*. A coach chooses; the product must not
  imply the list is the answer, and must not manufacture confidence from thin data (the Season
  Wrapped "earned-it threshold" rule is the precedent: a sparse season renders fewer tiles, never
  padded superlatives). If you propose any auto-suggested cut line, expect it to be refused —
  raise it as a decision, don't build it.
- **⚠ Sport-neutrality.** Tryout scoring categories are coach-authored, but check nothing in the
  flow hard-codes diamond vocabulary. `lib/sports.ts` is the Sport Pack; §1.7 of the program doc
  records that parts of the LINEUP surface still assume diamond sports — do not add a new instance.
- **Education vs. write** (Chunk G rule 4): a read-only assistant may see; only a write-capable
  coach is offered an action. Probe as the read-only assistant.
- **A LIST becomes cards; a COMPARISON stays a grid** (Chunk A D1) — the scoreboard is a
  comparison. `CoachScrollX` owns the scroller AND its swipe hint together; never a bare `.scrollX`.
- **Two breakpoints only** (900 shell / 640 content). **Check the primitives header at the top of
  `coaches.module.css` BEFORE writing any new @640 rule** — Chunk A shipped three page-level rules
  that duplicated primitives added in the same commit. `.modalFlushFooter` (chunk H) is the
  standing fix for a tall modal whose last inch hides under its sticky footer.
- **Warm rules:** no raw lime fills; lime-as-TEXT/border only (it remaps to olive under the warm
  gate — E3); **all six colour baselines stay unchanged** and any new CSS module joins the
  guardrail at zero literals.
- **Dates:** never raw UTC date math for "today" / "days until" — use `lib/timezone.ts`
  (`tournamentToday()`, `calendarDaysBetween()`). The date-correctness guardrail is at ZERO.
- **Git: ONE shared `dev`, and the tree is genuinely busy.** A concurrent session is building
  **Chunk I** (Overview) plus Footer/public work. Diff every shared file, stage explicit
  `:(literal)` pathspecs (bracket dirs stage NOTHING bare), and **check `git status` for foreign
  files before committing**. ⚠ `memory/design_decisions.md` and `TODO.md` are shared append-only
  files that BOTH sessions edit — the H2 commit had to stage only its own hunk of the decisions log
  (write HEAD's version + your entry, `git add`, then restore the working copy). Audit
  `git show --stat` after. Never commit/push without explicit per-action owner OK. TODO.md: edit
  the file, leave it out of the commit.
- **Dev server:** a supervisor may auto-respawn port 3000; verify health (login 200, no `EACCES`)
  rather than fighting it. New files ⇒ **stop the server → `rm -rf .next` → restart** before
  handoff (deleting `.next` while it runs corrupts the cache and 500s every route).
- **Probes:** there is no tryout probe suite yet. The Money suite
  (`tests/uat/scenarios/coach-money-mobile-smoke.spec.ts`, **26 tests**) is the pattern to copy —
  self-provisioning via service-role with a marker prefix, asserting its own teardown, computed
  styles never screenshots, text assertions scoped to `main[class*="coachesMain"]`, and an
  error-check on **every** provisioning insert (a silently-failed one reads downstream as "the
  feature doesn't work" and costs a whole run). Creds pattern: `{marker}-head@dev.local` /
  `{marker}-assistant@dev.local`, `devpass123`, org `dev-club-org`.

### Owner decisions to bring to the mockup round

- **Where "score as yourself" lives and what it does** (recommend: a door on the Tryout Day tab
  that puts the coach straight into the existing scoring surface as themselves — decide whether
  that means minting a self-token behind the scenes or an authenticated route, and say which and
  why, with the security implication of each stated plainly).
- **The two Development doors** — merge into one, or differentiate them so the difference is
  obvious? (Recommend one; say which one survives and what happens to the other's audience.)
- **The Practice plans placeholder** — keep as an honest roadmap slot, or remove until built?
- **Anything the discovery pass surfaces**, each with a v1 / fast-follow recommendation and an
  explicit cost. Expect the owner to say "I agree with all of your recommendations" if they are
  well-reasoned — so make the recommendation, don't hedge.

### Definition of done

Plan + PM brief (`docs/projects/active/COACH_PORTAL_CHUNK_E_*`), approved mockups, built in one
pass + `/simplify` + `/review` + `/docs`, typecheck / `npm test` / focused lint green,
`verify:changed` fully green with **colour baselines unchanged**, a **new tryouts probe spec** (the
scoring door at 360 + desktop, the read-only sweep, the discard guard on a dirty setup form) and
passing, fresh dev restart, owner QA, committed on `dev` with per-action OK, `PROGRAM_COACH_PORTAL.md`
§1.1 + `memory/design_decisions.md` + help content updated in the same unit of work.

---

## Program state at handoff (2026-07-30, end of the Chunk H session)

- **Prod:** `cf90d626` (2026-07-29 launch release). **Dev is well ahead** and the queue is now
  large: free-portal welcome (**dev-only migration 211 — FUNCTION-only; the drift gate CANNOT see
  it; apply to prod BEFORE promoting**) · Chunk A `a737acbf` · Chunk G `06f77442` · **Chunk H1
  `ee46bf89`** · **Chunk H2 `f483405a`** · a concurrent session's desktop-chrome work (`9f1a605e`,
  `90dc58cc`, `471ddb55`) and Chunk I in flight. **A release conversation is overdue** — raise it
  if the owner hasn't.
- **Chunks:** A ✅ · G ✅ · **H ✅ (both halves)** · B (chrome — colliding with the concurrent
  stream, avoid) · C (schedule intelligence, unblocked) · D (parent-facing — needs the
  retention-vs-acquisition ruling) · **E = this** · F (frozen past season — decided, unbuilt) ·
  I (Overview — IN FLIGHT in another session).
- **CP-7 CLOSED 2026-07-30:** the guardian model stays one guardian per player; §1.4 shrinks to
  the name-split work.
