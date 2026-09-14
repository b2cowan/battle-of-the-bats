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

# Demo sandboxes — they follow the product; they never gate it

Two no-login demos run the **real** product on fictional clubs (tournament `riverdale-minor-ball`,
coach `riverdale-ridge`), fully public on production. Owner ruling 2026-09-13: **the demos are
not a step in development or release.**

- **The live demo rebuilds itself.** The master build re-seeds a demo whose world (seed + imports
  + migrations) changed since its last seed. Never re-seed prod by hand except as the fallback in
  the plan. `check:demos:prod` is a morning-after monitor, not a promote gate.
- **Per commit, ask nothing.** The build fails if a tour destination or anchor stops existing;
  that is the only per-commit demo signal. Do not add "re-read" notes to the demo files.
- **The story is curated per release cycle** with `/demos` (checklist in
  `.claude/commands/demos.md`) — that session decides what a release earns in the shop window.
- **A number in a demo sentence is computed from the seed or it is not in the sentence.**

Plan: `docs/projects/active/DEMO_PROCESS_DECOUPLING_PLAN.md`. Release/prod state lives in the
release-history record, not here.

# Business-decision logging

When a **durable business decision** is reached or changed — pricing, packaging/plan structure, what's gated, positioning, segment/GTM focus, monetization model, or commercially-driven roadmap sequencing — proactively offer to run `/strategy` (the steward agent in `.claude/commands/strategy.md`) to record it in the binding Business Decisions Log at `docs/agents/strategy/BUSINESS_DECISIONS.md`. `/strategy` decides the *what* and routes the follow-through (copy → `/marketing`, gates → `/billing`, plan → `/plan`); it never writes customer copy itself, so logging a decision there keeps it consistent and discoverable across all chats. Offer once per decision; log only what the user has actually accepted (record exploratory direction as **Proposed**, not Decided), and skip the offer for pure execution detail, for decisions already logged, or if the user declined.

# Plan & pricing — single source of truth

`docs/agents/strategy/PLAN_PRICING_FACTS.md` is the **canonical** record of plan names, prices, capacity bands, gating, and inclusions (kept matched to `lib/plan-config.ts`). **Never restate a plan price/name/gate as a fresh copy in another doc** — brand strategy, the pricing-copy appendix, and the pricing memory file **point at** the Facts doc. Before changing or asserting any pricing/packaging fact (in copy, gates, plans, or docs), **reconcile against the Facts doc; if they disagree, that's drift — flag it to `/strategy` rather than silently writing a new number.** Any pricing/packaging change updates the Facts doc + `lib/plan-config.ts` in the same unit of work, and `/strategy` runs a drift check (the checklist at the bottom of the Facts doc) on every such change and before any billing release.
