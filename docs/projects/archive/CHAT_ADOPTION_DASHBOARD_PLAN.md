# Tournament Chat — Adoption Dashboard Module (Implementation Plan)

**Status:** In progress (dev) · 2026-07-06
**Owner ask:** Tournament Chat is under-known/under-adopted. Add something to the admin
tournament dashboard that (a) informs the organizer, (b) shows adoption metrics — teams
with a coach email, of those how many created an account, how many are in chat — and (c)
encourages coaches to sign up (with a message about what they unlock).

## Why (root-cause of quiet adoption)

Tournament Chat only becomes real for a coach once **that coach has claimed their team
portal** (created their free login). There is no separate "join chat" step — a signed-up
coach auto-heals into the "All coaches" room on their next portal load. So the true
adoption bottleneck is **coaches signing up for their portal**, and the room being opened
by the organizer at all. The dashboard module targets both.

Two hard constraints:
- **Tournament Chat is gated to Tournament Plus+** (`tournament_chat` feature, host-org
  only; coaches never pay). A free-tier organizer has no room. → module is tier-aware.
- The **"All coaches" room is created when the organizer opens the admin Chat page**
  (`ensureTournamentChatRoom`). If they never open it, coaches see an empty state.

## Metrics feasibility (verified against code)

Reuse the canonical resolver `resolveTournamentChatParticipants(tournamentId)`
(`lib/chat-resolvers.ts`) — single source of truth with chat itself. It returns
`{ userIds, pending }` where `pending` = non-rejected teams with **no** signed-up coach
(carrying each team's contact email + claim state).

| Metric | Source | Notes |
|---|---|---|
| Teams (non-rejected) | `teamPayments` (already fetched) | denominator |
| Teams with a coach email | `teamPayments.email` non-empty | flags teams that can't be invited |
| Coaches signed up (teams) | `teamsTotal − pending.length` | headline gap |
| Not yet joined | `pending.length` | the chase list |
| …remindable (have email) | `pending.filter(email)` | reminder target count |
| In chat room (coaches) | `getTournamentChatRoom` → `getActiveMemberUserIds ∩ userIds` | excludes org moderators; best-effort |

Chat-table reads (`getTournamentChatRoom`/`getActiveMemberUserIds`) are wrapped in a
try/catch so a missing/degraded chat surface degrades to `roomOpen=false, inChat=0` without
failing the funnel (funnel tables are all prod-live). Chat tables are on prod (mig 141,
2026-06-22) — the live prod Chat nav confirms it — but the defensive read keeps it safe.

## Panel state machine

1. **Not eligible (free/team plan)** → LOCKED upsell: `requiresPlanCopy('tournament_chat')`
   + link to the admin Chat page (which hosts the real UpgradeGate/upgrade CTA).
2. **Eligible, room not opened** → primary CTA "Open Tournament Chat" (creates the room) +
   funnel context ("X of Y coaches signed up — they'll join automatically once you open chat").
3. **Eligible, room open** → funnel (progress bar "X of Y coaches signed up"), sub-stats
   ("N in chat · M not yet joined"), a coach-email warning if some teams have no contact,
   **one-click "Remind teams to sign up"**, and "Open Chat →".

## Placement

New `'tournamentChat'` panel in `DEFAULT_LAYOUT.panels` (pre/post-event analytics grid via
`renderPanelZone`), draggable/hideable like Registration/Payments/Communications. Owner
chose pre-event + post-event (matches the panel zone). `mergeBy` auto-adds it to existing
saved layouts (visible by default) — no version bump.

## One-click reminder (owner-chosen)

New route `POST /api/admin/tournaments/[tournamentId]/chat/remind-signups`. Reuses the
**existing, proven** per-team access-link email (`coachAccessReminderHtml` + the
`/coaches/join?registrationId&email` funnel used by the single-team `resend-access` route).
Batches over the not-yet-joined teams **that have an email**, `Promise.allSettled`, capped
for safety, returns `{ sent, failed, skipped }`. Same auth as `resend-access`
(`module_tournaments` + `manage_registrations`|`create_tournaments`) + a
`tournament_chat` plan gate (defense in depth).

## Files

- `app/api/admin/tournament-dashboard/route.ts` — add `chatAdoption` to `DashboardStats`
  payload (plan-gated compute + defensive chat read); add `email` to the teams select.
- `app/api/admin/tournaments/[tournamentId]/chat/remind-signups/route.ts` — **new** batch
  reminder route.
- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` — `ChatAdoptionStats` type + field on
  `DashboardStats`/`EMPTY_STATS`; `'tournamentChat'` in `PanelId` + `DEFAULT_LAYOUT.panels`;
  `renderTournamentChatPanel()` + `panelNode` case; page-level reminder button state.
- `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — a few panel classes.

## Risks / open items

- Panel appears pre/post-event only (not game day) — owner choice; revisit if game-day
  demand shows.
- Reminder has no server-side cooldown in V1 (parity with single `resend-access`); the
  button disables after a send and shows the result. Note for `/review`.
- Extra ~6 indexed queries per dashboard poll for eligible orgs only (skipped for free).
- No migration. New route file ⇒ **dev restart required** before browser testing.

## Verification

- `npm run verify:changed` / `typecheck` (API data contract touched).
- Owner browser test on a Tournament Plus event (Milton "Battle of the…"): eligible funnel,
  reminder send, locked state on a free event.
