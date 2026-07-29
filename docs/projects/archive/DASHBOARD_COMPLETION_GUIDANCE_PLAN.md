# Dashboard Completion Guidance — "Ready to Finalize" state — Implementation Plan

> **Status:** BUILT on dev (Phases 1–3) — 2026-07-06, unpushed. Typecheck + focused-lint clean. **`/review` DONE** (high-risk funnel; 2 findings fixed: complete-confirm now only promises the results email when it will actually send — mirrors all 4 server suppressions incl. reopen→re-complete; + summary champion-id type nit coalesced to null). **`/docs` DONE** (close-out recipe `recipe-closeout-tournament` now documents the dashboard "ready to finalize" prompt + one-click Mark complete; new `faq-where-mark-complete`; search terms added). Awaiting owner browser verification, then release.
> **Created:** 2026-07-06
> **Branch:** dev
> **Migration:** none (all inputs already exist: `games.status`, the dashboard API's `gameDay` completion counts + `champions`, and the existing `set-status` action)
> **Gating:** none — the tournament admin dashboard is available to every tier that has tournaments (Tournament / Tournament Plus / League / Club). No plan-gated behaviour. (Plus/Free only differ in the *post-complete* hand-off copy, which already exists.)

## Locked decisions (owner, 2026-07-06)
1. **One-click complete** — build the confirm inline on the dashboard (no deep-link to Settings). Verified safe: the results-summary email + read-only lock fire **server-side** in the shared `set-status` action, so a dashboard-triggered complete is identical to Settings (`app/api/admin/tournaments/route.ts` §set-status).
2. **Suppress until bracket exists** — "ready to finalize" only trips when a playoff bracket exists AND every game is resolved. Implemented as `readyToFinalize = active && allGamesResolved && playoffGamesTotal > 0`. (Data model has only `round_robin_playoffs` / `playoff_only` formats — both bracketed — so this is safe; a legit no-bracket round-robin, e.g. `crossover:'none'`, is the documented accepted under-prompt, and the organizer can still complete from Settings.)
3. **Copy via `/marketing`, visual via `/design`** — both passes done; strings + treatment approved and logged (design decision 2026-07-06 in `memory/design_decisions.md`).

## What shipped (dev)
- **API** (`app/api/admin/tournament-dashboard/route.ts`): `gameDay.resolved` (completed+forfeit) + `gameDay.playoffResolved` + top-level `notifyTeamsOnComplete`.
- **Guidance** (`lib/tournament-guidance.ts`): new `'ready'` stage (headline "Every game's in — ready to finalize"), a CTA `actionId:'complete'`, `readyToFinalize` input on `resolveGuidanceStage`, shared closeout shortcuts.
- **Rail** (`components/admin/tournament/GuidanceRail.tsx` + `.module.css`): `ready` tone (lime `.railReady`, non-collapsing) + `onAction` so the CTA fires an in-page confirm.
- **Dashboard** (`app/[orgSlug]/admin/tournaments/dashboard/page.tsx`): `readyToFinalize`/`playoffsAllDone` derivations, stage picks `'ready'` over `'live'`, one-click **Mark Complete** confirm (lime, mirrors Settings warning, honest notify line), retired the contradictory `isPostEventActive` banner when ready, By-Division footer → "Playoffs complete" (`--success`).

### Champion-detection bug fix (folded in — surfaced during owner testing 2026-07-06)
Owner saw the admin crown **Kawartha Lakers** (U13 **Tier 2 consolation** winner) while the public page correctly showed **Brampton Blazers Gold** (U13 **Tier 1** champion). Root cause: two admin surfaces (dashboard API + post-event summary API) each carried their own **naive** champion logic — `bracket_code === 'FIN'` + latest-`game_date` — which is **not tier-aware**, so when a division has Tier 1 + Tier 2 brackets sharing final codes it picked whichever FIN sorted later. The public surfaces already used the canonical **tier-aware** `lib/champions.ts` (`decidedFinalFor` → top bracket group via `groupGamesByBracketId`/`tierRank`, GF2 → GF → FIN priority).
- **Fix:** consolidated both admin surfaces onto `lib/champions.ts`. Added a minimal `ChampionGameInput` shape so snake-case admin rows map in without building a full `Game`; `decidedFinalFor`/`decidedFinalOfGroup` made generic (public `Game[]` callers unchanged). Summary API now also **selects** `bracket_id`/`bracket_label` (previously omitted, so it *couldn't* tell tiers apart). Now dashboard By-Division, summary Champions band + Division Recap, wrap-up card, and the public page all agree on the true top-tier champion.
- Also improves the double-elim case: the admin previously ignored `GF`/`GF2` grand finals (only read `FIN`); now honored via the shared priority.
- Typecheck + focused-lint clean. No migration (columns already exist).

## Problem (verified from live code + a real screenshot)

On the **final calendar day** of a tournament whose games are all finished (25/25 complete, playoffs 7/7, champion crowned), the dashboard still shows the live **"It's game day — here's your live view / Enter & review scores"** guidance card and gives no hint that the event is over or that it's time to mark the tournament complete.

Root cause — the guidance card is **calendar-driven, not completion-driven**, and the "event is over" signal it *does* have is effectively unreachable:

- The top "what's next" card is chosen by `guidanceStage` in
  [dashboard/page.tsx:925-929](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L925-L929):
  `isActive ? (isGameDay ? 'live' : isPreEvent ? 'pre' : 'post') : …`
- `isGameDay` comes from the API in
  [tournament-dashboard/route.ts:246-261](../../../app/api/admin/tournament-dashboard/route.ts#L246-L261):
  `isGameDay = isTournamentDay || firstGameStarted`, where
  `isTournamentDay = today ∈ [start_date, end_date]` and
  `firstGameStarted = any game submitted/completed/past its start time`.
- Because `firstGameStarted` is **true forever once any game has been played**, `isGameDay` never returns to false for a real tournament. So the rail stays `'live'` permanently and **never advances to `'post'`** — the "Your event has wrapped up — confirm your final scores, then mark the tournament complete" card in [tournament-guidance.ts:174-194](../../../lib/tournament-guidance.ts#L174-L194) is dead code for any tournament that actually played games. The only way out of `'live'` is to manually mark the tournament Completed (→ `'done'`).
- Completion is *known* to the dashboard but unused by the stage machine: `gd.completed`, `gd.totalGames`, `gd.playoffGamesCompleted/Total`, and the resolved `champions[]` are all already on the payload.

Two secondary inconsistencies fall out of the same root cause:

- **Contradictory day-after messaging.** A *separate* bottom-of-page nudge, `isPostEventActive` in [dashboard/page.tsx:919](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L919) + [2076-2081](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L2076-L2081), keys off `!isTournamentDay` (the **calendar**). So the day after the event, the same screen shows **both** the live "It's game day" rail **and** "The tournament dates have passed… you can mark this complete."
- **"Playoffs underway" while a champion is shown.** The By-Division panel footer at [dashboard/page.tsx:1742-1746](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L1742-L1746) is gated only on `gd.playoffStarted` (= any playoff game *exists*), so it reads "🏆 Playoffs underway" even when every playoff final is scored and champions are crowned in the rows directly above it.

## Goal

Make the dashboard recognize a **finished-but-not-yet-finalized** tournament and steer the organizer to the one action that's actually outstanding — **mark the tournament complete** — while removing the contradictory "game day / dates passed / playoffs underway" copy for that state. No behaviour change for tournaments still in progress.

## What "outstanding" means here (canonical trigger)

A tournament is **ready to finalize** when it is `active` and **every non-cancelled game is resolved**:

```
allGamesResolved = gameDay.totalGames > 0
  && (gameDay.completed + <forfeited count>) === gameDay.totalGames
```

Notes / decisions baked in:
- **Count forfeits as resolved.** The board's `completed` counts `status === 'completed'` only; a tournament ending on a forfeit would otherwise never hit "resolved". The API must expose a forfeit count (or a single `resolvedGames`/`unresolvedGames` number) so the trigger is honest. *(Small additive field on the `gameDay` payload — no migration.)*
- **Gate on `isGameDay` too** (`allGamesResolved && isGameDay`) so the state only appears at the genuine end of an event, never pre-event when zero games exist.
- **Champions are a *display* signal, not the trigger.** Pool-only tournaments have no champions but can still be "ready to finalize", so the trigger is all-games-resolved, not champions-resolved.
- **Open question — playoffs not yet generated** (see Open Questions): pool 100% done but bracket games not created yet would trip "ready" prematurely. Recommended V1 guard below.

## Architectural decisions

- **Decision:** Add the completion signal to the shared guidance module ([lib/tournament-guidance.ts](../../../lib/tournament-guidance.ts)), not ad-hoc in the page. **Rationale:** `resolveGuidanceStage()` is shared by other tournament surfaces; keeping the state machine in one tested place prevents the dashboard and those surfaces from drifting (the exact class of bug we're fixing).
- **Decision:** Represent "ready to finalize" as its **own guidance treatment**, not by silently reusing `'post'`. **Rationale:** `'post'`'s CTA is "Review & finalize scores → Results"; the user's ask is specifically a **Mark-complete** call-to-action. A dedicated card lets the primary action be "Mark tournament complete" with "Review scores" as the secondary. (Implementation may still internally key off the existing `'post'` copy for the body text — TBD in Phase 1 — but the CTA must be the complete action.)
- **Decision:** Keep rendering the live game-day **board** (Now Playing / Games Progress / By Division / champions) in this state — only the **top guidance card** changes. **Rationale:** The board at 100% with champions is genuinely useful; the board vs. rail are already decoupled ([dashboard/page.tsx:2073](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L2073) renders the board on `isGameDay`, independent of `guidanceStage`).
- **Decision:** The "Mark tournament complete" action must go through the **same server `set-status` path** the Settings → Event status control uses, so the results-summary email (`notify_teams_on_complete`) and the read-only/lock behaviour are identical no matter where completion is triggered. **Rationale:** Completion is a destructive, one-way-ish, side-effecting transition (locks data, can email every team). It must not have two divergent implementations. See Phase-0 verification.

## Phases

Each phase is independently shippable. Phase 1 is the high-value fix; 2–4 remove the contradictions.

### Phase 0 — Verify the completion side-effects (no code)
- [ ] Confirm **where** the results-summary email fires on first transition to `completed` (server-side in the `set-status` action, or client-orchestrated only from the Settings page). This decides whether a dashboard-initiated complete is automatically consistent (server-side) or must replicate the notify step.
- [ ] Confirm the Settings "Mark as Completed?" confirm copy + the `notify_teams_on_complete` note ([settings/event/page.tsx:763](../../../app/[orgSlug]/admin/tournaments/settings/event/page.tsx#L763)) so the dashboard confirm can mirror it exactly.

### Phase 1 — "Ready to finalize" guidance card (the core fix)
- [ ] API: add a `resolvedGames` (or `forfeited`) count to the `gameDay` payload in [tournament-dashboard/route.ts](../../../app/api/admin/tournament-dashboard/route.ts) so the client can compute `allGamesResolved` honestly (completed **+** forfeited === total). Additive; old client ignores it.
- [ ] Guidance module: add an `allGamesResolved` input (or a `'ready'` stage) so the state machine can return a **finalize-oriented** card: headline e.g. *"All games are in — you're ready to finalize"*, one context line, primary action **"Mark tournament complete"**, secondary/nudge **"Review scores"** → Results. Keep it pure/testable.
- [ ] Dashboard: compute `allGamesResolved` from the payload and feed it into the `guidanceStage` derivation ([dashboard/page.tsx:925-929](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L925-L929)) so the rail switches to the finalize card when `isActive && isGameDay && allGamesResolved`.
- [ ] Wire the primary CTA to the **complete** action. Two options — **recommend V1 = (a)** for lowest risk, promote to (b) if owner wants true one-click:
  - **(a) Deep-link** to the audited Settings complete control (opens its existing confirm + notify): `…/settings/event?section=overview` (optionally auto-open the confirm via a query flag).
  - **(b) Inline confirm on the dashboard** mirroring Settings' "Mark as Completed?" warning, calling the same `set-status: completed` server action (a `handleComplete` alongside the existing `handleActivate`/`handleArchive`). Only if Phase 0 confirms the email fires server-side.
- [ ] `npm run typecheck` (touches the shared guidance module + API contract).

### Phase 2 — Retire the contradictory day-after banner
- [ ] Make the bottom `isPostEventActive` "dates have passed" nudge ([dashboard/page.tsx:2076-2081](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L2076-L2081)) defer to the same completion logic: when the rail is already showing "ready to finalize" (or the calendar-past state), **do not** also show the redundant/contradictory banner. Single source of truth for "the event is over."
- [ ] Confirm no active tournament can show two different "event over" messages at once (final day, and day-after).

### Phase 3 — Fix "Playoffs underway" vs. champion
- [ ] In `renderByDivisionPanel()` ([dashboard/page.tsx:1742-1746](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L1742-L1746)), make the footer completion-aware: show "🏆 Playoffs underway" only while playoff games remain unresolved; once `playoffGamesCompleted === playoffGamesTotal` (and > 0) show "Playoffs complete" or suppress the footer. Never contradict a crowned champion in the rows above.
- [ ] Focused lint + typecheck.

### Phase 4 — (optional polish) "All games scored ✓" confirmation
- [ ] Consider a small positive confirmation on the game-day board when `allGamesResolved` (e.g. Games Progress reads "All games in") to reinforce the finalize card. Deferred; not required to close the finding.

## Empty / edge states
- **In progress (any unresolved game):** unchanged — live "It's game day" rail + board.
- **Ready to finalize (all resolved, still active):** finalize card + board (this plan).
- **Already completed:** unchanged — existing Tournament-Complete wrap-up card ([dashboard/page.tsx:2090+](../../../app/[orgSlug]/admin/tournaments/dashboard/page.tsx#L2090)).
- **Pool-only tournament (no playoffs):** trips "ready to finalize" on all pool games resolved — correct (no champions shown, which is fine).

## Open questions
- [ ] **Playoffs not yet generated.** If pool play is 100% resolved but the organizer hasn't created the bracket yet, `totalGames` counts only pool games → trips "ready to finalize" prematurely. **Recommended V1 guard:** only trip "ready" when there is **no** division whose pool is complete but is configured for playoffs with zero playoff games created; if that's too much for V1, accept the minor false-positive (organizer can still generate the bracket) and revisit. Confirm with owner.
- [ ] **CTA behaviour:** deep-link to Settings (a) vs. inline dashboard confirm (b) for "Mark tournament complete." Recommend (a) for V1.
- [ ] **Headline wording** for the finalize card — `/design` + `/marketing` to confirm voice ("All games are in — you're ready to finalize" vs. alternatives).

## Verification checklist (before owner hand-off)
- [ ] `npm run typecheck` (Phase 1 touches the shared guidance module + API contract).
- [ ] `npm run lint:focused -- <changed files>` (Phases 2–3).
- [ ] Dev-server **restart** before browser test (Phase 1 edits the shared `lib/tournament-guidance.ts` module) — per the restart rule for shared modules.
- [ ] Manual check on a seeded finished tournament (all resolved, still `active`, on the last day) that the rail shows the finalize card, the "dates passed" banner does not double up, and By-Division reads "Playoffs complete."
- [ ] Offer **/review** on the guidance-module + API change and the complete-action wiring (destructive transition).
- [ ] Offer **/docs** — the tournament help "close-out" recipe may want a line about the new dashboard finalize prompt.
