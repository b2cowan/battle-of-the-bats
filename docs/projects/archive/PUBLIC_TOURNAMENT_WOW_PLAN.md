# Public Tournament Experience — "Wow" Upgrade — Implementation Plan

> Status: **Phases 1, 1.5 & 2 built 2026-06-02** (awaiting browser verification + DB migration 107 apply). Migration `107_fan_push_subscriptions.sql` must be applied to dev (and prod when shipping). VAPID env vars must be set for fan push to actually send.
> Origin: full functionality + design review of the public tournament offering.
> Decisions: **Hybrid tiering** (polished core for all tiers; signature features gated to Tournament Plus), deliver **vision + buildable Phase 1**, priorities = **premium visual redesign → personalization/following → live game-day**, enablers funded now = **real-time refresh + fan push/PWA** (photos + player-stats deferred).

## Context

The public tournament page is FieldLogicHQ's best-selling feature — what an organizer hands to coaches, parents, players, and fans. Goal: make that audience think *"this was the best tournament experience I have ever had."* Public tournament pages are intentionally **un-gated** today (every tier gets them); hybrid tiering keeps the core free and reserves only the signature halo feature (fan score alerts) for Plus.

## Architecture facts (traced)

- Public pages render via **client** components fed by a client fetch: `app/[orgSlug]/[tournamentSlug]/{schedule,standings,teams}/page.tsx` are thin `'use client'` wrappers passing **no `initialData`**, so `components/public/{Schedule,Standings,Teams}Content.tsx` always fetch `fetchPublicTournamentData()` (`lib/public-tournament-client.ts` → `GET /api/public/tournament-data`, `force-dynamic`). **Real-time = re-invoke that fetch on an interval.**
- `isInProgress` logic exists in `TournamentHomeContent.tsx` (`startDate <= today <= endDate`).
- LIVE detection exists in `ScheduleContent.tsx` (`status==='submitted' && date===today`).
- Follow = localStorage, no account; helpers are **duplicated** across the three content components. Key: `fl_follow_team_${orgSlug}_${tournamentSlug}` → `{id,name,divisionId}`.
- `downloadICS()` (`lib/export/ics.ts`) is real and **free on all plans** (`ical_export`), but only wired into admin/coach surfaces.
- Design is token-driven: `app/globals.css` has `--radius-*`, `--shadow-*`, `--glow`/`--glow-sm`, `--transition`, keyframes `fadeIn`/`slideUp`/`fadeInUp`/`pulse-glow`/`pulse-lime`. Per-tournament theme + light mode injected in `app/[orgSlug]/[tournamentSlug]/layout.tsx`.

## Phase 1 — Smallest shippable "wow" (free tier, zero migrations)

1. **`lib/follow.ts`** — single source for follow helpers (`followKey`, `readFollowedTeam`, `readFollowedTeamId`, `saveFollowedTeam`, `clearFollowedTeam`), `useFollowedTeam()` hook (hydrate-in-effect + cross-tab `storage` sync), and `isTournamentInProgress(tournament)`.
2. **`lib/team-calendar.ts`** — `downloadTeamScheduleICS({team, games, teams, divisions, venues, tournamentName})` building `ICSEventInput[]` and calling `downloadICS()`. First public/fan use of the free exporter.
3. **`lib/hooks/usePublicTournamentLive.ts`** — interval re-fetch of a section, gated on `enabled` (isInProgress), paused when `document.visibilityState==='hidden'`, refresh on `visibilitychange`, never toggles `loading`. Calls `onData(data)`; each component merges into its own state by `id`.
4. **Wire live + de-dupe follow** into `ScheduleContent.tsx`, `StandingsContent.tsx`, `TeamsContent.tsx` (import from `lib/follow.ts`). Add score-flip detection (prev-score ref) in Schedule + a calendar button in the rail/follow surfaces.
5. **Score-flip + brighter LIVE** in `app/[orgSlug]/schedule/schedule.module.css` (`.scoreFlip` reusing `pulse-glow`/`--glow`; stronger `.liveBadge`/`.liveDot`).
6. **`components/public/MyTournamentCard.tsx`** — countdown to next game, live score, record, standings position, calendar add, profile/schedule links. Rendered on the Home page (upgrades the existing `TournamentHomeFollowedTeamCard`).
7. **Premium pass, slice 1** — `schedule.module.css` + `app/Home.module.css` cards/radii/shadows/entrance using existing tokens only.

## Phase 1.5 fast-follow
Live refresh on the single-game detail page `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx` (server component → needs a small client score-refresher).

## Phase 2 — Fan push + PWA (gated signature) + redesign completion
- `supabase/migrations/107_fan_push_subscriptions.sql` (anonymous endpoint → tournament_id + team_id; service-role RLS). *(106 was taken by the bulk importer.)*
- `lib/fan-notify.ts::notifyFansForGame()` triggered from `lib/tournament-scoring-service.ts::submitTournamentScore()` (covers scorekeeper/official/admin paths); reuse `sendWebPush()` + 410-cleanup.
- `app/api/public/fan-push/subscribe|unsubscribe/route.ts` (no auth; validate team∈tournament).
- `lib/push-client.ts` (extract subscribe core from `components/notifications/PushPermissionPrompt.tsx`) + `components/public/FollowAlertsToggle.tsx` inside `MyTournamentCard`.
- Extend `components/IOSInstallBanner.tsx` (+ Android `beforeinstallprompt`) into a follow-tied install/alerts prompt.
- `lib/plan-features.ts` — add `live_score_refresh` (free), `fan_following` (free), `pwa_install` (free), **`fan_score_alerts` (tournament_plus)** + copy; enforce the gate in fan-notify + subscribe route + client.
- Finish premium pass: `standings.module.css`, `teams.module.css`, team-profile module, `globals.css`; verify light-mode + branded-org parity.

## Per-tournament branded PWA — SHIPPED 2026-06-02
- `app/[orgSlug]/[tournamentSlug]/manifest.webmanifest/route.ts` — tournament-scoped manifest (`id`/`scope`/`start_url` = the tournament; `name` = tournament name; org logo icon when advanced branding; platform icons kept for installability).
- `generateMetadata` in `app/[orgSlug]/[tournamentSlug]/layout.tsx` overrides `<link rel="manifest">` + `apple-mobile-web-app-title` (iOS home-screen label = event name).
- Effect: Android install → opens to the tournament, named/branded as the event; iOS Add-to-Home-Screen → label = event name, opens the tournament page. Notifications were already deep-linked per tournament.
- **V1 limitation:** the iOS apple-touch-icon *image* stays the platform icon (root hardcodes it as a raw `<head>` tag, not metadata). Branded iOS icon = a later enhancement (move root apple-touch-icon into metadata so it can be overridden per tournament).

## Two-app PWA model — SHIPPED 2026-06-02
Install prompts removed from the marketing root; split into two installable apps:
- **Fan app** (anonymous): per-tournament manifest; prompt in the tournament layout; opens to that tournament.
- **Member app** (account holders): `public/manifest.json` retargeted to `start_url: /home` (neutral FieldLogicHQ). `/home` already routes authed→context / unauthed→login→context. Prompt mounted in authenticated shells (`admin`, `coaches`, `scorekeeper` layouts + `/home`), shared `dismissKey` `flhq-install-member`. `official` is a pass-through alias (skipped).
- Reusable `components/InstallAppPrompt.tsx` (props: appName/subtitle/dismissKey) replaced the deleted `IOSInstallBanner`.
- Platform caveats: iOS can only show *instructions* (no install API); iOS standalone PWAs may need a fresh login on first open (`/home` handles that path).

## Phase 3 — Deferred
"Game starting in 30 min" fan-reminder cron (mirror `registration_deadline_approaching`). Photo/media + player stats out of scope.

## Verification
- Run `npm run dev` (network-enabled). On an in-progress tournament, submit a score in admin → confirm schedule/standings/home update within one poll with no skeleton flash; confirm polling stops off-event-day and pauses on a hidden tab.
- Follow a team → confirm MyTournamentCard countdown/live/record/standings render and the calendar button downloads a valid `.ics` of only that team's games.
- Verify redesigned pages under `data-color-mode="light"` and on an advanced-branding org; check mobile bottom-nav/scorebug spacing.
- Restart rule: new files + shared-module changes require stopping the server, `rm -rf .next`, then `npm run dev`.
