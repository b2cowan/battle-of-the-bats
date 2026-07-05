# Live Tournament — Playoff Moment + Home/Standings Polish

**Status:** BUILT on `dev` 2026-07-04 (unpushed code). Typecheck + verify:changed green. **Mig 175 applied to DEV + PROD 2026-07-04 (schema-only, ahead of code; drift gate GREEN).** `/review` done (3 fixes folded). `/docs` done. Pending: owner browser test → promote code to master.

Owner-requested batch (5 items) tested against the mirrored prod **Battle of the Bats** tournament in dev. Items 2–4 are clear polish; items 1 + 5 combine into one "wow" centrepiece: **the Playoff Moment**.

---

## 1 + 5 — The Playoff Moment (announcement + Playoff Picture)

**Trigger (owner decision):** auto, the first time a playoff bracket is materialized.
**Audience (owner decision):** fans following a team (score alerts) **and** org staff.
**Summary (owner decision):** data-driven "Playoff Picture" now; optional AI polish later.
**Home treatment (owner decision):** hero **takeover** with a countdown to the first playoff game.

### What ships
- **`tournaments.playoffs_published_at`** (mig 175, timestamptz nullable) — one-time idempotency guard for the announcement only. Set by an atomic `NULL → now()` claim in the games route's `bulk-save` + `save-bracket` handlers, so editing/regenerating a bracket never re-blasts. Backfilled to `now()` for tournaments that already had playoff games (prevents a false blast when an old bracket is first edited post-deploy).
- **Notification event `playoffs_set`** — new `NotificationEventType`; label/description/`PUSH_DEFAULT_ON_EVENTS`/`TOURNAMENT_EVENT_TYPES`/Tournaments section all wired (`lib/notification-labels.ts`). Staff reach via `notify()` (bell + push, default ON). Fans reach via new `notifyFansForPlayoff(tournamentId)` in `lib/fan-notify.ts` (pushes every fan following any team in the tournament; gated Tournament Plus+ via `fan_score_alerts`). Both deep-link to `/{org}/{tournament}/playoffs`.
- **Home hero takeover** (`TournamentHomeContent.tsx` + `Home.module.css`) — when the tournament has `is_playoff` games and isn't completed, the hero flips to a Playoffs theme: "Playoffs" badge, "The Bracket Is Set", countdown to the first knockout game, CTAs → Playoff Picture + Bracket. Derives from the presence of playoff games (always accurate), NOT the timestamp.
- **Playoff Picture page** — new public route `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx` (+ `components/public/PlayoffPicture.module.css`, pure builder `lib/playoff-picture.ts`). A shareable, article-style seeding summary per division: template narrative (no AI), key-stat callouts (top seed / best offense / stingiest defense / best differential), the full seed list with the qualifying cut marked, and opening matchups with `Seed #N` resolved to real team names. Share button + links to the full bracket/schedule. Not a bottom-nav tab — reached from the hero CTA, the fan push, and (future) a standings link.

### Key mechanics / gotchas
- Seeding order = standings tie-breaker order (`lib/tie-breakers.ts`); `Seed #N` resolves against the combined division order (how the wizard + tiers assign seeds).
- The announcement fires from `bulk-save` (playoff wizard) and `save-bracket` (bracket editor). Manual single-game `create` intentionally does NOT fire (avoids premature blasts).
- Hero + Playoff Picture render for ANY tournament with playoff games — including placeholder brackets built ahead of pool-play completion (matches the "auto on creation" decision).

---

## 2 — Home: drop "Today's Games", lead with "Upcoming Games" + "Latest Results"
Removed the redundant small "Today's Games" quick-card from the in-progress home day panel (`TournamentHomeContent.tsx`). The nicer full-width "Upcoming Games" section (already rendered right below during the event) now carries the schedule look-ahead; "Latest Finals" stays. Field Shortcuts + Event Snapshot cards retained. (Removed the now-unused `isGameLive`/`DEFAULT_GAME_DURATION_MINUTES` import.)

## 3 — Standings mobile: scroll all columns, pin only the team name
`StandingsContent.tsx` + `standings.module.css`. Mobile previously hid W/L/T/RF/RA (showed only a REC pill + RD) and pinned both Team and PTS. Now: the REC pill column is dropped, all stat columns (W/L/T/RF/RA/RD/PTS) show and scroll horizontally, and **only the Team column is pinned** (PTS unpinned). The diverging RD bar stays desktop-only.

## 4 — Run differential shown two ways: true (seeding-capped)
`StandingsContent.tsx` + `standings.module.css`. **Correction to the ask:** the number shown today was already the seeding-capped one; the true differential was hidden. Now the RD cell shows the **true** differential as the headline with the **seeding-capped** value in brackets — e.g. `+10 (+7)` — only when a per-game cap is set and the two differ (via `rdRaw` + `runDiffCap`, already computed on every standings row). The bar + colour track the true value; the footer note explains that seeding uses the capped figure. Battle of the Bats has no cap set, so it shows a single number until an organizer sets a max in tie-breaker settings.

---

## Verification
- `npm run typecheck` ✅ · `npm run verify:changed` ✅ (0 errors; public-token ratchet clean; snapshot freshness #175; dictionary coverage OK; org-context guard clean).
- Mig 175 applied to **dev** + snapshots refreshed (#175) + DATA_DICTIONARY updated (`tournaments.playoffs_published_at`).
- ✅ **Mig 175 applied to DEV + PROD 2026-07-04** (schema-only, ahead of code; snapshots #175, drift gate GREEN). Prod code doesn't read the column until the feature promote.
- ⚠ Dev-server **restart required** before browser test (new files + new route + shared-module/type changes + migration).

## To test the announcement moment in dev
The mirror backfilled `playoffs_published_at` for Battle of the Bats, so the announcement won't re-fire. To exercise it: clear that field for the dev tournament, then re-generate/save the bracket → staff bell/push + fan push fire once. The hero takeover + Playoff Picture already show without this (they derive from playoff-game presence).

## Follow-ups (not blocking)
- Optional AI-written narrative layer on the Playoff Picture (owner chose "template now, AI later").
- Consider a standings → Playoff Picture link once live.
- `/docs` pass (new user-facing surface + standings behaviour changes).
