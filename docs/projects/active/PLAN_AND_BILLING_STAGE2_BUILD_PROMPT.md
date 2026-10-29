# Plan & billing, Stage 2: the Coaches Portal host and the door (build prompt)

> **Written 2026-10-28.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**, then the
> plan. Leads name **files, not lines**; re-verify each. **Gate:** Stage 1 is committed and verified; the Stage A drawings
> (coach host, the rail/sheet row, the wall doors) are ruled; the owner has said "build Stage 2".

## What Stage 2 makes true

A **standalone coach** (the owner of a one-team Premium Coaches Portal workspace) sees **Plan & billing** in their own
navigation — the desktop rail foot beside Help, and the phone More sheet's "You" group — and opens **the same body Stage 1
built, inside the Coaches Portal's look** (`CoachPageHeader`, portal chrome), without ever entering the admin area. It works
with one team, several teams, no team yet, or only closed seasons. Every email, bell row, payment return and plan wall that
mentions billing now sends a person to **their own host** (a coach to the portal page, an admin to the admin page). A lapsed
or free-time-ended **owner** always has a door back to reactivate. Club owners/admins who also coach keep their **Admin**
door (it still means the club's back office). **The Admin door is not removed here** (Stage 3).

## Rulings (do not reopen)

Plan §2. Plus from the plan's findings: the subscription lives on the **org**, so the page is **per workspace**, not per
team; **no `teamId` in the route**; a team-less route skips `CoachTeamSeasonGate`, which is correct.

## Part 1 · The page and the door

- **New page** `app/[orgSlug]/coaches/billing/page.tsx` (sibling of `notifications` and `link-org`, the off-team precedents).
  `CoachPageHeader` with `icon`, `title` (the words-file title), `help` (the "?" renders itself off-team — copy `link-org`).
  It hosts the Stage 1 body, supplying: the header, the dialog/notice host, `onDone`/`returnHref` (coach host), the usage
  counts for a workspace. Add the header site to `tests/unit/coach-page-actions-guard.test.ts` `SITES`.
- **Visibility rule:** show the row only when the viewer is the org **owner** and the org is a standalone workspace
  (`currentOrg.accountKind === 'team_workspace' || planId === 'team'` — the same signal `coaches/page.tsx` and `link-org`
  already use; add **no** new context field). A non-owner who types the URL gets the one locked card.
- **Nav rows** — `components/coaches/CoachesSidebar.tsx` (foot, beside Help/Admin) and `CoachesBottomNav.tsx` (More sheet,
  "You" group; keep order Notifications → tiles → You (account, home, billing, admin) → foot). **Do not** put the row in
  `TEAM_NAV_GROUPS` or `MORE_SECTIONS` (tests `coach-nav-groups`, `nav-standard-guard` pin parity and the closed-season
  gates; a `{ key, icon, label }` literal in the bottom nav feeds `COACH_TEAM_PAGE`). **Check what the foot and the sheet
  show for a team with no live season** (CLAUDE.md: both navs collapse to one entry) and make sure Plan & billing is still
  reachable there — an owner whose season is closed still pays. If the drawings and the closed-season rule conflict, **stop and
  ask**. Icon, size and spacing per `NAV_STANDARD.md`.
- Add the page and the row to the nav/route tests; `layout-screens.mjs` enumerates coach screens — add it there and **report**
  whether an unlisted screen fails (the audit could not confirm).

## Part 2 · What the coaches shell is missing for the body

The coaches layout mounts `OrgProvider` only. Confirm and handle: no `TournamentProvider` and no `ClubBriefProvider`
(Stage 1 should already have removed the body's need; prove it by rendering the page for a workspace with a hosted tournament
and several teams). The body's success window closes to the coach page, never `/admin/tournaments`. Keep Premium / Join a
club / reactivate keep using `lib/coaches-portal-routes.ts` paths.

## Part 3 · One link resolver, every caller

Replace `getBillingHref(orgSlug, planId)` (`lib/billing-urls.ts`) with a **resolver that takes the audience/host** (admin vs
coach portal) — and where only the org is known (emails, bell rows) derive the host from the org (a standalone workspace →
coach host). Keep a thin compatibility export only if a caller cannot move in this stage, and list it. Callers to move (leads):
`AdminChrome` + `CancellationGuard` (a standalone coach hosting a tournament in admin: a cancelled one is sent to billing),
`UpgradeGate`, `PlanPanelDrawer`, `MembersKit`, `tournament-guidance`, `onboarding-plan` route, `lib/user-contexts.ts` →
`/api/me/role-summary` → `/pricing` `ViewerAwarePlans` (a standalone coach on /pricing must land in the portal),
`CoachPlanWall` (club owner only — admin host), `create-checkout`. Hard-coded admin paths to retarget: the billing page's own
`returnTo`, `admin/org/page.tsx`, `org/settings/pdf/page.tsx`, the mock portal, tournament lock lines (`PlanLockLine`,
`?plan=tournament_plus`) — **a standalone coach's tournament lock lines keep the admin plan drawer for now; report what they
do, do not invent a portal drawer.** Update `billing-urls.test` and `plan-panel-host.test`, which pin today's outputs.

- **Stripe and server return URLs:** `api/billing/portal` (return_url, mock too), `setup-payment-method` +
  `lib/billing-setup.ts`, `choose-next-season`, `create-checkout` (**today it silently drops any `returnTo` that does not start
  `/{slug}/admin/`** — allow-list the coach billing path for a standalone workspace), `cancel/confirm`, `downgrade/confirm`,
  `lib/billing-retention.ts`, `lib/online-payment-owner-notices.ts`, the platform-admin cancel route, `api/admin/email/send`,
  `scripts/seed-uat-coach-notifications.mjs`. `create-team-checkout` already returns to `/coaches` — leave it.
- **Bell and emails:** `app/api/billing/webhook` (`payment_failed`, trial-ending) links; in the coach bell an `/admin/` link
  reads "Open in admin" (`lib/notification-view.ts`) — the new link needs its own label ("Open Plan & billing", words file;
  see `notification-reader.test` / `notification-open-in-place-guard.test`). **Rows and emails already sent keep the old URL**;
  Stage 3 makes those redirect.

## Part 4 · Walls: the owner's door back

`app/[orgSlug]/coaches/layout.tsx` gates in order: auth → cancelled org (`SubscriptionEndedWall`, or `FreeTimeEndedWall` for a
workspace) → club plan lacks the portal (`CoachPlanWall`) → zero assignments → shell. The cancelled/free-time walls render
**before** the role read and today offer the owner no billing door (the admin `CancellationGuard` did). Give each wall an
**owner-only** door: cancelled workspace → Reactivate (`teamWorkspaceReactivatePath`, `/coaches/start?reactivateOrgSlug=…`),
free-time-ended → Keep Premium (the existing path); the "Coaches Portal not ready" (zero assignments) wall gets "Plan & billing".
This needs the role earlier than line ~143 — **do it without leaking a non-owner a button and without breaking the pre-role
`initialUserRole={null}` contract**; test both. Tests: `coaches-portal-cancellation-guard`, `org-billing-access-guard`
(add every new file using `allowSuspendedOrg`), UAT `coach-wall-doors.spec`.

## Not Stage 2

Removing the Admin door or redirecting `/admin` (Stage 3); the "Covered by {Club}" line (Stage 4); help rewrite (Stage 5).

## Done when

A standalone coach opens Plan & billing from rail and phone sheet and never sees an admin screen doing it; every Stripe
return (portal, card saved, next-season, checkout, plan move) lands back on the coach page — **say how you exercised each**
(the dev environment mocks the portal; Stripe test mode where you can); a lapsed owner reaches Reactivate from each wall;
`verify:changed` + `typecheck` green. **Owed after:** `/review` (auth/redirect/links: do not skip), `/docs`, the owner walk,
dev-server restart.
