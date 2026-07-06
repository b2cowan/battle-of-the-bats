# Champions Crowned — the tournament-complete "moment"

**Status:** BUILT on `dev` 2026-07-05 (unpushed; mig 176 DEV-only, prod-pending) — pending owner browser test → `/review` + `/docs` → promote · **Owner ask:** 2026-07-05
**Mirrors:** the Playoffs-Set "moment" (`playoffs_published_at` + `playoffs_set` push + `/playoffs` Playoff Picture + home hero takeover). See `TournamentHomeContent.tsx` playoff hero, `lib/fan-notify.ts::notifyFansForPlayoff`, `app/api/admin/games/route.ts::announcePlayoffsIfFirstTime`, `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx`.

## Goal

Give the **end** of a tournament the same treatment the **start of playoffs** already gets: when the whole tournament's playoffs finish and the champion(s) are crowned, automatically
1. send a one-time notification (staff bell/push + fan push),
2. flip the public home hero to a Champions celebration, and
3. publish a shareable recap page.

The manual "close out / mark completed" action stays separate and can happen later; the champion moment fires off the game data itself.

## Trigger — "the whole tournament's playoffs are complete"

Definition (robust, no bracket-graph reachability math needed):

> The tournament has ≥1 playoff game, **every** playoff game is in a terminal state (`completed` / `forfeit` / `cancelled`), and at least one **championship final is decided** (a top-tier final with a clear winner).

Why this is clean:
- The if-necessary double-elim reset (`GF2`) is auto-**cancelled** by `advancePlayoffs` when the winners-bracket team wins `GF` → counts as terminal, never blocks completion.
- A tie-stalled elimination game stays `scheduled` → correctly blocks completion until resolved.
- Unplayed 3rd-place / consolation / other-division games stay `scheduled` → correctly blocks completion until the WHOLE tournament's bracket is done (matches "for the whole tournament").

**Hook point:** the shared scoring chokepoint `deps.onScored` in `lib/tournament-scoring-service.ts` (already fires on every terminal transition from admin, scorekeeper, and forfeit-finalize paths). Add an `onGameFinalized`/completion check alongside the existing `notifyFansForGame`, evaluated only when `status ∈ {completed, forfeit}`.

**One-time guard (mirror `playoffs_published_at`):** new column `tournaments.champions_crowned_at` (nullable timestamptz). Atomically claim `NULL → now()`; only the write that wins the flip sends the notifications. A later re-score / revert-and-re-complete never re-blasts.

## Deliverables

### 1. Migration (schema = dictionary, same unit of work)
- `tournaments.champions_crowned_at timestamptz null` — additive, `IF NOT EXISTS`. **Notify-guard ONLY** (like `playoffs_published_at`): the hero + recap page derive from live game state, never from this column.
- Update `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`.
- Thread through `lib/db.ts` (`championsCrownedAt`) + `lib/types.ts`.

### 2. Tier-aware champion detection (fixes an existing latent bug, same unit of work)
- `lib/champions.ts::decidedFinalFor` currently picks the **first** decided `FIN` in a division — with tiered brackets (e.g. Tier 1 championship + Tier 2 consolation sharing the `FIN` code) it can crown the wrong (consolation) team.
- Fix: among a division's decided finals, pick the **top tier's** final, using the existing `groupGamesByBracketId` ordering (Tier 1 < Tier 2, Gold < Silver; top-seed range = championship). Keep `GF2 → GF → FIN` priority **within** the chosen tier.
- This corrects every consumer: home completed banner, `/champions` page, and the team-profile OG image.

### 3. Completion detection + notifications
- New helper (pure) `isTournamentPlayoffsComplete(games, divisions)` → boolean, per the trigger definition above. Reusable by the server hook and the home page.
- New server hook `announceChampionsIfComplete(tournamentId, actorUserId?)` — atomic claim on `champions_crowned_at`; on win:
  - `notify({ eventType: 'champions_crowned', title: '🏆 Champions crowned', body: '<winner(s)> — see the final results', link: '/<org>/<t>/champions', … })` (staff bell/push).
  - `notifyFansForChampions(tournamentId)` — new fan-push fan-out mirroring `notifyFansForPlayoff` (Tournament Plus+ via `fan_score_alerts`, deep-link to `/champions`).
- New `NotificationEventType 'champions_crowned'`: add label + description; add to the **Tournaments** section, `PUSH_DEFAULT_ON_EVENTS`, and `TOURNAMENT_EVENT_TYPES`.

### 4. Home hero takeover (`TournamentHomeContent.tsx`)
- Derive `championsDecided = isTournamentPlayoffsComplete(allGames, divisions)` (live; independent of the manual `completed` flag and the guard column).
- Hero state machine (highest priority first):
  1. `championsDecided` (playoffs done, not yet manually completed) → **Champions celebration** takeover — trophy eyebrow, champion name(s) (tier-aware, one per division), runner-up, share button, links to `/champions` + final standings.
  2. `playoffsSet && !championsDecided` → existing "The Bracket Is Set" takeover.
  3. `isCompletedTournament` (manual) → existing full archive treatment (champion banner + final record panel), unchanged.
- Ensure states are mutually exclusive so two heroes never render. `playoffsSet` becomes `… && !championsDecided`.

### 5. Shareable recap page — `/<org>/<t>/champions` (mirror `/playoffs`)
- New route + a pure builder (parallel to `lib/playoff-picture.ts`) producing: champion(s) per division (tier-aware) with runner-up + final score, final standings snapshot, a short template narrative + stat callouts (champion record, run diff, best offense/defense), share button.
- Follows **Standings** visibility, exactly like `/playoffs` (no seeding/results leak when hidden).
- Empty-state when playoffs aren't complete yet ("Champions will be crowned here once the bracket is decided" + link to `/playoffs`).
- Linked contextually (home hero + fan push), no permanent nav tab — same as `/playoffs`.

### 6. Help + release notes (follow-through, via `/docs` + `/marketing`)
- Help: extend the "playoff moment" help entry with the completion-moment counterpart.
- Release notes: a marketing-reviewed line (required before any promote).

## Plan gating (mirror playoffs_set exactly)
- Staff bell/push: **all tiers**.
- Fan push: **Tournament Plus+** (`fan_score_alerts`).
- `/champions` page content: **all tiers** (like `/playoffs`).

## Edge cases / decisions
- **Re-score after completion:** guard already fired → no re-blast (matches `playoffs_set`). Hero/page stay correct (live-derived).
- **Revert the deciding game:** hero reverts to "bracket set" live; guard stays set (no second blast if re-completed). Accepted, matches playoff behavior.
- **Multi-division:** fires only when **every** division's playoffs are terminal (whole-tournament completion), per owner.
- **Pool-play-only tournaments (no bracket):** no champions moment (no bracket final). Out of scope; possible follow-up for pool-winner events.
- **Tiered single division:** all tiers must be terminal to complete; the celebrated champion is the **Tier 1** winner (tier-aware fix).
  - **DECISION (owner, 2026-07-05): "Both, Tier 1 leads."** Every tier crowns a winner, but the **top tier (Tier 1)** is THE champion. Hero + staff/fan alert **headline the Tier-1 champion**; the `/champions` recap page lists **all tier winners** (Tier 1 marked as the championship, lower tiers as crowned tier winners beneath). So `deriveChampions` must return a **winner per tier** (per bracket group), ordered top-tier-first, each tagged with its tier label + an `isTopTier` flag — not just one row per division.

## Verification
- `npm run typecheck` (touches shared modules: types, db, notify, scoring service).
- `npm run check:dictionary` + `refresh:snapshots` (schema change).
- Manual (owner, on the BOTB dev mirror): score the last playoff game → expect staff bell + (Plus) fan push, home hero flips to Champions (Brampton Blazers Gold, the Tier 1 winner — **not** the Tier 2 Kawartha Lakers), `/champions` recap renders, and the admin close-out nudge remains available.
- `/review` adversarial funnel before treating done.

## Out of scope (explicit)
- Auto-setting `tournament.status='completed'` (stays a manual close-out).
- A champion OG social image redesign (the tier-aware fix already flows into the existing team-profile OG path).
- Pool-play-only "division winner" moments.
