# Registration Health Panel

**Status:** BUILT + owner browser-verified + `/review`'d + `/docs`'d on `dev` 2026-07-09 (uncommitted, no migration). Owner-requested via `/ux` after two follow-up rounds on the "missing coach email" dashboard link. Owner reviewed the live panel and requested 3 polish rounds (all applied): move panel below the toolbar + match Schedule Health's exact tile format instead of the initial ad hoc styling; simplify the Teams tile to a plain color-coded count instead of "12/12"; default the panel to collapsed like Schedule Health. Owner confirmed "looks good" after the third round.

`/review` ran a high-risk 4-lens funnel (correctness, security/multi-tenant, data/contract, regression) since the diff touched `lib/registration-attention.ts` and a registration-data API route. Found and fixed 2 real bugs (both applied, typecheck+lint clean):
- "Needs action" tile jumped to an empty filtered view when only missing-required-info teams contributed to the count (fixed: three-way ternary now checks `missingIntake` too).
- The capacity "starts within 3 days" check used raw UTC date-string math instead of `lib/timezone.ts`'s `calendarDaysBetween()`/`tournamentToday()` — the exact pattern that caused a prior production bug (J6-056, the live game ticker vanishing mid-evening). Fixed to use the shared helper.

Two Low/Advisory items documented, not code-fixed: (1) the new `missing_email` bucket count silently excludes any team with no `division_id` assigned — pre-existing shared behavior across every attention bucket, not introduced by this diff, but worth a live-data check (`select count(*) from teams where division_id is null and status is not null and status <> 'rejected'`) before assuming it never matters; (2) an over-100%-capacity division gets no distinct color signal, same neutral tone as any gapless division.

`/docs` synced `lib/help-content/tournaments.tsx`: added a "What does the Registration Health score tell me?" FAQ and a "How do I add or fix a team's email address?" FAQ to the existing "Review and accept teams" section, wired that section into the Teams page's contextual `?` help drawer (it wasn't in `sectionIds` before), and updated the existing chat-adoption FAQ to describe the missing-email flag as a clickable link instead of a dead end. No new help route/page — hot-reload only, no restart needed for the docs change itself.

Not yet committed.

## Why

The tournament dashboard's "Schedule Health" panel (score + 4-tile KPI grid + issue list) gives organizers a single at-a-glance read on schedule risk. Registrations had no equivalent — missing emails, stuck-in-review teams, unpaid/past-due accounts, and under-filled divisions were each visible only if you knew where to look (several different panels/filters), and a couple of them (missing email, in particular) had no visible surface at all until this session's fixes.

## Scope decision (owner, 2026-07-09)

- **Placement:** Registrations page only. The Dashboard's existing "Registration" panel (capacity gauge + "Also needs attention" chips) already covers a lighter version of this and is not being duplicated.
- **Score inputs:** missing coach email, payments (Tournament Plus only), pipeline backlog (pending review + unplaced + missing required intake), **and capacity vs. registration** (owner add-on to the recommended set).
- Waitlist size is explicitly NOT penalized — a full waitlist isn't a problem to fix.

## What was built

1. **`lib/registration-health.ts`** — pure scoring function, same "start at 100, subtract capped weighted penalties" shape as `lib/schedule-metrics.ts`'s `healthScore`. Reads bucket counts off the existing `RegistrationAttentionSummary` (see `lib/registration-attention.ts`) rather than re-deriving team state, so it can never drift from what the filtered views already show.
   - Missing email: up to −25, scaled by share of active (non-rejected) teams.
   - Pending review backlog: up to −10.
   - Unplaced accepted teams: up to −20, scaled against accepted teams.
   - Payments (only counted when the org has Tournament Plus's payment-readiness tools — `commandCenterAvailable`): past due up to −20, unpaid (not past due) up to −10.
   - Missing required intake (Plus only): up to −15.
   - Capacity: −10 if any division is **closed** with open spots left; −5 if a division is still open, unfilled, and the tournament starts within 3 days. (No penalty for simply being early in the registration window — that's normal, not unhealthy.)
   - Tone thresholds mirror Schedule Health: ≥85 good, ≥65 warning, else danger.
2. **`RegistrationHealthPanel.tsx`** (new component under `.../registrations/components/`) — collapsible `<details>` card, score badge, 4-tile KPI grid (Teams / Missing email / Payments / Needs action), and a clickable issues list. Reuses the dormant "Registration Attention Command Center" CSS that already existed in `teams-admin.module.css` (`.attentionBucket`, `.attentionLockLabel`, etc.) but was never wired into any JSX — this build is the first thing to actually use it.
3. Every tile/issue that maps to an attention bucket jumps straight into the existing `focusAttentionBucket()` filtered view (same mechanism the dashboard's deep-links use). Capacity issues jump to that division instead (`jumpToDivision`).
4. Locked (non-Plus) payment tile shows a "Plus" badge and opens the existing upgrade prompt instead of silently omitting the tile.

## Bugs fixed in the same session (prerequisite work)

- `lib/registration-attention.ts` gained a `missing_email` bucket (new `RegistrationAttentionKey`, `email` field on `RegistrationAttentionTeam`) so "teams with no email on file" is a first-class, filterable, countable concept — previously only computed ad hoc inside the tournament-dashboard API route for the Chat panel.
- Fixed a real bug where `app/api/admin/tournament-dashboard/route.ts` built its `RegistrationAttentionTeam` objects without `email`, which would have made the new `missing_email` bucket match **every** non-rejected team on the dashboard's "Also needs attention" chip row (an always-undefined field trivially satisfies "is missing").
- Dashboard's Coach Sign-ups & Chat panel: the "no email on file" warnings are now links to the filtered Registrations view instead of dead-end text; a duplicate "Open Chat" link (header link + body CTA both visible simultaneously) was collapsed to one.
- Registrations page gained a visible "Showing: {bucket} ({count}) · Clear" banner whenever a dashboard deep-link (`?attention=...`) filters the list — previously the filtered view was visually indistinguishable from the unfiltered one.

## Out of scope / explicitly deferred

- No changes to the Dashboard's Registration panel (owner declined a duplicate; opinion offered inline in conversation, not acted on without a separate ask).
- No organizer-configurable score weights (Schedule Health has an editable-rules affordance; Registration Health does not — the inputs aren't really "tunable thresholds" the way max-games/day is).
- Capacity aggregation is per-division only; no tournament-wide capacity rollup tile.

## Verification still needed

- Dev server restart (new files + shared-module changes) before owner browser test.
- Owner to browser-verify: score/tiles render correctly with real data, tile clicks land on the right filtered view, locked payments tile on a non-Plus org opens the upgrade prompt, capacity issue click switches division correctly.
- `/review` offered, not yet run.
