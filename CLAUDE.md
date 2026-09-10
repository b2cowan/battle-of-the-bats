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
the re-anchor schedules are **active on BOTH databases** and **BOTH are now NIGHTLY**
(tournament 08:10 UTC, coach 08:20 UTC — migration 273 moved the tournament tick off its old
2-minute live cycle on 2026-09-08; re-confirmed in `cron.job` on each that day. ⚠ The old
"every 2 minutes" claim stood here for a month after the daily-snapshot redesign was written), and **the doors are OPEN** — owner-directed
2026-08-10, via `NEXT_PUBLIC_SEE_IT_LIVE_DOORS=true` set as a **master-branch-scoped** Amplify
variable + rebuild (job 250, code unchanged at `201ec1bd`). Prod code moved to `ebdf02ea` in the
2026-08-10 13:37 release push (Amplify job 251 SUCCEED, 13:43 ET), which carries the Sunday
roll-forward reconcile fix (`853a4df2`; the weekly re-break risk is CLOSED) and the coach demo's
marketing doors: "See it live" verified rendering live post-251 on the homepage hero (both demos),
both pricing cards, and `/for-coaches` (`/for-clubs` carries one in code); both door routes 307
into their worlds. **Prod HEAD is now `ebcb2d52` (2026-09-10, Amplify master job 264 SUCCEED — 30
commits, tag `release/2026-09-10`: the categories & items door, one word one line, the By-period
grid's doors, a player handing in more than once, the Escape/accessibility floor, and lime-as-TEXT
darkening on paper. **Migrations 286 + 287 applied to prod that day and the manual queue is now
EMPTY — 14 applied, 0 held, 0 outstanding, DRIFT 0, parity 0 accepted.**
⚠⚠ **JOB 263 FAILED FIRST, AND THE REASON IS A STANDING RULE: `check-schema-parity` runs ONLY on
master, so it is the master build that ENFORCES migration order.** It failed on mig 286's index
being on dev and not prod. "Apply the migration after the build goes green" therefore cannot ever
complete — the build is not green until it is applied. This holds for every rule-ADDING migration.
The price is one rebuild's worth of window where prod serves OLD code against the new rule, and it
is unavoidable in the other direction.
⚠⚠ **THE MANUAL REGISTER WAS STALE IN THE SAFE-LOOKING DIRECTION: 12 entries read "outstanding or
unverified" and TEN WERE ALREADY ON PROD** (verified by querying production directly, incl. 264
yet again). Bookkeeping drift is not database drift — an alarming register is no more trustworthy
than a green gate. Ask the database.
⚠ **STILL OWED FROM THAT RELEASE: the prod COACH demo re-seed.** `check:demos:prod` is RED with 4
failures, one of which is that **no player hands in twice** — this release's own headline moment,
absent from the public shop window. Preconditions were verified (working copy 0 ahead of
`origin/master`, demo files clean); the run itself was left to the owner.
The preceding prod HEAD was `2e7ef905` (2026-09-08, Amplify master job 262 SUCCEED first time — 119
commits, tag `release/2026-09-08`: the coach money quarter (the dues ladder, the budget plan’s
subtotals, credits and paybacks, fundraising’s one way in), Founding Season 2027 Phases 0–2, the
notifications redraw, one table standard + its exception register, and the pricing comparison table’s
removal. **Migrations 273–285 ALL applied to prod that day** — the two schemas are byte-identical
(DRIFT 0) and the schema-parity ratchet reached **zero accepted divergences** for the first time.
⚠ FIVE of the thirteen are DATA-ONLY and invisible to every gate, so each was verified by querying
production directly: the demo tick went nightly, “Other Income” exists with its four words, the
founding-season end date moved off the January cliff with none left behind, the campaign templates
match dev at 11, and Grant moved to Sponsorship WITH its one referencing record re-pointed. Live-
verified post-262 on **www.fieldlogichq.ca**: `/`, `/changelog` and `/pricing` 200, both doors 307
into their worlds, master stream 0 ERROR, and the new changelog entry rendering. The prior prod HEAD
was `bf1efee6` (2026-09-02, job 261). Before that, `7f21df47` (2026-08-27, Amplify master job 260 —
52 commits, tag `release/2026-08-27`: coach money P4, tryout decisions as one tap, the platform no longer
writing the offer letter, the Add player form at parity with the public form, the roster rework, practice
staff/equipment libraries, printed posters/cards/brackets, the 641–768 tablet band and "8:00 a.m."
everywhere; **migrations 262, 263, 265, 266 and 267 applied to prod** that day. ⚠⚠ **264 WAS DESCRIBED HERE FOR
WEEKS AS “held pending owner approval” AND IT HAD IN FACT RUN** — re-verified 2026-09-08 by querying
production directly: all three keys it deletes (`tryout_offer_extended`, `tryout_declined`,
`tryout_offer_accepted`) are absent, and migration 083 had seeded them there, so they were deleted.
The correction is the point: it is a data-only DELETE, and **NO GATE CAN EVER SEE ONE** — both drift
checks compare schema, so a deleted ROW is invisible by construction and `check:migrations` reported
“in sync” throughout, which is evidence of nothing in either direction. **A data-only migration’s
state is knowable only by asking the database for the rows.** Both doors re-verified
307ing into their worlds post-260 on **www.fieldlogichq.ca**, `/` and `/changelog` 200, master stream
0 ERROR). ⚠⚠ **THIS RELEASE CHANGED THE COACH DEMO'S STORY AGAIN AND THE NARRATION HAS NOT BEEN FOLLOWED
UP AT ALL.** The money vocabulary moved a third time: a family can now pay ONE PIECE of a bill directly
and be credited for it, one bill can hold both a team payment and a family-fronted one, and undo /
schedule-edit / delete now REFUSE rather than strand a repayment. The dock lines and tour steps were
already written against the old six-doors-to-record world and were only partly trued up in the 08-25
release; nothing was adjusted for P4. **Re-read the whole coach-money narration before the next demo
change** — this surface has now gone stale across FIVE consecutive releases (09-08 and 09-10 both
added to the pile), which is the strongest evidence yet for the rule that says it does. ⚠⚠ **AND
09-10 MADE IT WORSE IN A NEW WAY: the demo world is now missing a MOMENT, not just a sentence.** A
player can hand money in to a drive more than once, and the live demo has nobody doing it — so the
release's headline feature is invisible on the page a prospect reads. `check:demos:prod` names it
outright. **The prod re-seed that fixes it is OWED.** ⚠ `check:demos` self-heals on dev only and never
writes to prod — production freshness rides the cron alone, so a green local run is NOT evidence about
the live demos. The preceding prod HEAD was `5ae39f10` (2026-08-17, Amplify job 257 SUCCEED — 72 commits: the Money
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
