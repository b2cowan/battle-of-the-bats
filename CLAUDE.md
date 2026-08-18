@AGENTS.md
@AGENCY_RULES.md

# Coaches Portal — A SEASON IS LIVE UNTIL IT IS CLOSED, AND A CLOSED SEASON IS ONE PAGE (owner ruling 2026-08-18, binding)

**Two states, and the middle one does not exist.** A season stays **completely live** — every screen,
every tool, nothing taken away — until the coach closes it. The last game does not end it: money
settlement, awards, documents, family emails and next year's tryout all happen afterwards. When it is
closed it becomes **ONE PAGE** (`/teams/{id}/season-end`): Season Wrapped, four collapsed shelves
(results, roster, practices, money) and the compare door. The same page whether it closed yesterday
or three years ago. Plan of record:
`docs/projects/active/COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md`.

⚠⚠ **THIS REPLACED "history is delivered in place" (2026-08-16), which is now WRONG where it says a
finished season renders through the ordinary screens.** That ruling's real target survives and is
strengthened: **no season dial, no second nav, no thirty screens learning a year.** What changed is
the answer to *"what does a finished season look like?"* — it was "all of it, read-only", and it is
now "one page". Seventeen `isReadOnly`/`isRecord` branches, twelve "comes back next season" notices
and `page.canWrite()` were all deleted with it.

**⚠ A team with no live season has ONE DOOR, and this is the load-bearing part.** The live tools are
not rendered at all rather than rendered read-only — `components/coaches/CoachTeamSeasonGate.tsx`
(mounted by the team layout, decided SERVER-side) sends the coach to that team's closed-season page
before any live screen mounts, and both navs collapse to that single entry (desktop sidebar, phone
bar **and the phone More sheet** — the sheet was nearly missed once). Removing a read-only branch
while leaving its screen reachable is not a tidy-up; it shows write controls the server refuses.
**Do not add a thirtieth finished-season branch. If a closed season needs to show something, it
needs a SHELF on that page.**

**Two doors out of a season, both head-coach-and-standalone-only:** *Start next season* (rolls
forward, closes this one) and *Close the season* (ends it, starts nothing — for the aged-out team).
**⚖ Unsettled money WARNS, never blocks.** *Reopen* is offered only while the team has no live
season; undoing an accidental **rollover** is deliberately **not built** (plan §3.4 holds its rule —
do not implement it on the way past).

**A year parameter is a DECISION.** `HISTORY_ENDPOINTS` in
`tests/unit/coach-history-endpoint-guard.test.ts` is the whole look-back layer — the closed-season
page and the routes it calls, and nowhere else. The build fails when a route or a page learns to read
a year, which is the decision point. Before proposing an addition, answer three questions:
1. **Record or instrument?** Anything that moves money, runs a tryout, messages families, or
   configures the team stays on the working season.
2. **Does the whole subtree carry the year?** The unit of work is every page reachable from the
   door, not the door. Chunk F's expensive defects were all one level down.
3. **Could the coach tell which season they are reading?** The page-title season chip is gone; a
   surface that can show two different years needs its own answer to that. (The closed-season page
   answers it by titling itself with the season's NAME — "2025 Season".)

**⚠ Every history shelf gets its own owner mockup session before it is built** (P3 practice plans,
P4 the money book, and anything after them). Binding design constraint for those sessions: **the
current season is always the primary focus** — the historical layer must be quiet (below the live
content, collapsed/on-demand, never default-open). A shelf that makes the live screen noisier is a
failed design regardless of how useful the history is.

**If a surface cannot honestly serve a finished season, hide its entry point** rather than letting it
dead-end — a link that 404s is the same bug wearing a politer face. Standing examples, both
build-enforced: playing-time analytics (recomputed figures, live-season-only PERMANENTLY) and the
opponent scouting book (an instrument — today's book, not a snapshot). ⚠ Both are now guarded on the
**closed-season page**, which is the only surface a finished season is read on; the Insights-hub
assertions that used to hold them moved there when the hub stopped rendering for a finished season.

# Post-edit review

After completing a **substantive** code change (new logic, API/DB/auth/shared-module edits, anything beyond copy/CSS/docs/config tweaks), proactively offer to run `/review` — the token-tiered adversarial funnel in `.claude/commands/review.md` — before treating the work as done. Offer once per logical chunk of work; don't nag on trivial diffs, and skip the offer if the user has already asked for a review or said to skip it. `/review` runs the deterministic gate first, so it's cheap on clean diffs.

# Post-edit simplify

After a substantive code change that also **adds a new abstraction** — a new shared helper/module, a new component prop/pattern, or logic that duplicates/touches something similar elsewhere — proactively offer to run `/simplify` (reuse/simplification/efficiency/altitude cleanup — a built-in Claude Code skill; it has no repo command file), ideally **before** `/review` so correctness review runs on the cleaned-up version. Don't offer it for every substantive change — only when the diff shape suggests overcomplication risk (new duplication, a new special case layered on shared infra, etc.); a straightforward change with no new abstraction doesn't need it. Offer once per logical chunk; skip if the user already asked for it or declined.

# Help-docs sync

When a change alters a **user-facing flow** (admin/coaches UI behavior, a screen/step a customer follows, plan-gating of a visible feature, or new/renamed terminology), proactively offer to run `/docs` — the help-system agent in `.claude/commands/docs.md` — so the in-app guides don't drift. In-app help content is the single source of truth in `lib/help-content/*.tsx` (indexed by the hub arrays in the `help/page.tsx` shells); keeping it current is a code-time task, not a periodic manual sweep. Offer once per logical chunk; skip for purely internal changes (refactors, platform-admin-only ops, DB plumbing with no UI change) and skip if the user already updated docs or declined.

# Demo sandboxes — the shop window drifts silently

Two no-login demos run the **real** product on fictional clubs: the tournament sandbox
(`riverdale-minor-ball`) and the coach sandbox (`riverdale-ridge`). Because they are the live
product rather than a recording, a product change reaches them the instant it ships — but **the
story the demo tells over the top of it does not follow.** That story is a set of hand-written
sentences (the moments dock's arrival lines and the guided tours' step narration) plus a seeded
world, and both can quietly stop being true while every page still renders perfectly.

This is not hypothetical: three pieces of demo copy were found in 2026-08-05 pointing at things
the product no longer shows, each having survived a build, a `/simplify` pass and a `/review` pass.

**So: when a change alters a user-facing coach or tournament flow, ask two questions in the same
breath as the help-docs one above** — *should a demo moment show this?* and *are the demo's
existing sentences about this screen still true?* Adjust the seed, the dock copy or the tour steps
in the same unit of work. `npm run check:demos` (part of `verify:changed`) proves both worlds are
still in the state a prospect should find them in, but **it can only catch breakage — it cannot
tell you the demo is missing something the product gained.** That judgement is the reason this
paragraph exists. Skip for purely internal changes; skip if the demos were already considered.

Plan: `docs/projects/active/DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md` (two further measures approved,
not built).

**⚠ BOTH DEMOS ARE FULLY PUBLIC ON PRODUCTION as of 2026-08-10** (every claim here verified
against the live prod database/site, never a plan — this paragraph has been wrong in both
directions before): both `riverdale-*` organizations are seeded on prod (2026-08-08 02:14 UTC),
the re-anchor schedules are **active on BOTH databases** (tournament every 2 minutes, coach
nightly — confirmed in `cron.job` on each), and **the doors are OPEN** — owner-directed
2026-08-10, via `NEXT_PUBLIC_SEE_IT_LIVE_DOORS=true` set as a **master-branch-scoped** Amplify
variable + rebuild (job 250, code unchanged at `201ec1bd`). Prod code moved to `ebdf02ea` in the
2026-08-10 13:37 release push (Amplify job 251 SUCCEED, 13:43 ET), which carries the Sunday
roll-forward reconcile fix (`853a4df2`; the weekly re-break risk is CLOSED) and the coach demo's
marketing doors: "See it live" verified rendering live post-251 on the homepage hero (both demos),
both pricing cards, and `/for-coaches` (`/for-clubs` carries one in code); both door routes 307
into their worlds. **Prod HEAD is now `5ae39f10` (2026-08-17, Amplify job 257 SUCCEED — 72 commits: the Money
redesign P1–P4, budget item integrity, membership + history-in-place, tryout scorecard weights and
setup checklist; **migrations 236–250 all applied to prod** that session, leaving the queue empty
and the two schemas byte-identical; both doors re-verified 307ing into their worlds post-257, and
`check:demos` reports both worlds presentable). ⚠ This release CHANGED THE COACH DEMO'S STORY —
the coach sandbox now shows what its club bills it and what it asks back, and the whole money
vocabulary a coach reads (categories + items, Transactions vs Payables) is new; the dock copy and
tour narration were adjusted with it, but this is exactly the surface where the demo's sentences go
quietly stale, so re-read them on the next coach-money change.** The preceding prod HEAD was
`8fe59ded` (2026-08-14, Amplify job 256 SUCCEED 18:01 ET — the Money quarter + the help guide's
menu-of-answers format; migrations 230–235 applied to prod that day). The preceding prod HEAD was
`396bd7cc` (2026-08-12 — two promotes that day: the morning feature release, job 253, then the
**Next 16.3.0 framework upgrade**, job 254). The three-part go-public decision (`BUSINESS_DECISIONS.md`
2026-08-07) is fully executed and **the coach door is no longer route-only**. `npm run
tick:demos` remains the manual repair on dev; `check:demos` self-heals on dev only and **never
writes to prod** — production freshness rides the cron alone, so a reconcile bug fixed on dev is
NOT fixed on prod until it reaches the deployed build (learned 2026-08-10 with the Sunday
roll-forward attendance defect — found, fixed and shipped the same day in job 251).

# Business-decision logging

When a **durable business decision** is reached or changed — pricing, packaging/plan structure, what's gated, positioning, segment/GTM focus, monetization model, or commercially-driven roadmap sequencing — proactively offer to run `/strategy` (the steward agent in `.claude/commands/strategy.md`) to record it in the binding Business Decisions Log at `docs/agents/strategy/BUSINESS_DECISIONS.md`. `/strategy` decides the *what* and routes the follow-through (copy → `/marketing`, gates → `/billing`, plan → `/plan`); it never writes customer copy itself, so logging a decision there keeps it consistent and discoverable across all chats. Offer once per decision; log only what the user has actually accepted (record exploratory direction as **Proposed**, not Decided), and skip the offer for pure execution detail, for decisions already logged, or if the user declined.

# Plan & pricing — single source of truth

`docs/agents/strategy/PLAN_PRICING_FACTS.md` is the **canonical** record of plan names, prices, capacity bands, gating, and inclusions (kept matched to `lib/plan-config.ts`). **Never restate a plan price/name/gate as a fresh copy in another doc** — brand strategy, the pricing-copy appendix, and the pricing memory file **point at** the Facts doc. Before changing or asserting any pricing/packaging fact (in copy, gates, plans, or docs), **reconcile against the Facts doc; if they disagree, that's drift — flag it to `/strategy` rather than silently writing a new number.** Any pricing/packaging change updates the Facts doc + `lib/plan-config.ts` in the same unit of work, and `/strategy` runs a drift check (the checklist at the bottom of the Facts doc) on every such change and before any billing release.
