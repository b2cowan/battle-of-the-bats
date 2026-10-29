# Plan & billing, Stage 3: retire the coach's admin view (build prompt)

> **Written 2026-10-28.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**, then the
> plan. Leads name **files, not lines**; re-verify each. **Gate:** Stage 2 is committed, verified and **walked by the owner**;
> the owner has **answered open question A** in plan §6 (where a standalone coach reaches their tournament helpers) — write the
> answer here before you start: `A = ______`; the owner has said "build Stage 3".

## What Stage 3 makes true

A standalone coach **never lands in the admin area by accident again**. The "Admin" door is gone from their portal; the
confusing "Welcome to FieldLogicHQ / Optional: set up a tournament" page cannot be reached from the portal, and a bookmark or old
email to the admin hub or the old billing address **forwards to the Coaches Portal**. A coach who **hosts a tournament** still
manages it exactly as today (those pages stay), reached from the portal's Tournaments section. Club owners/admins who also coach
keep their Admin door unchanged.

## ⚠ What does NOT retire (argue from the code, then confirm)

Hosted tournaments (`CoachHostedTournamentsSection`, `teams/[teamId]/tournaments/page.tsx` → `/admin/org/tournaments?create=1`,
`/admin/tournaments/dashboard`, registrations with their team-workspace branches) have **no portal twin**; the workspace's
staff-helper page (`/admin/org/members`, seat limit 3) is **not** what the portal's Staff page manages (that route never writes
`organization_members`). Audit log, org settings and PDF settings have no portal twin either. **Only** the admin hub / onboarding
bounce, the Admin door, and the admin billing page retire for this audience. **If the code disagrees, stop and report.**

## Part 1 · Redirects (server side; Next 16 docs first)

- `proxy.ts` is org-agnostic (path-only, explicit "no tier bounce") — **do not** add org-kind logic there. Use **server layouts
  or pages**, following the precedent in `admin/{accounting,families,rep-teams}/layout.tsx`
  (`redirect(isTeamWorkspaceOrg ? '/coaches' : '/admin')`).
- `app/[orgSlug]/admin/page.tsx` (and the hub client that bounces to `/admin/onboarding?continueSetup=1`): a team workspace →
  `/{org}/coaches`. Confirm the onboarding page can no longer be reached by a team workspace from anywhere else (sign-in landing,
  `lib/user-contexts.ts` post-login routing, emails).
- **Old billing addresses → the coach page, permanently** (`permanentRedirect` or the Next 16 equivalent — read the docs): the
  org billing page and the tournament-tier `settings/subscription` re-export, for a team workspace only. **Keep
  `allowSuspendedOrg: true`** on every layout in that path (`admin/layout.tsx`, `admin/org/layout.tsx`) — a cancelled org must
  still be able to be sent onward; add any new layout/page file to `org-billing-access-guard.test`.
- A server layout cannot see the pathname, which is why the client `CancellationGuard` exists (it fixed a refresh loop — read its
  header). For a **cancelled team workspace** in the admin shell, send them to `/coaches` (where Stage 2's wall has the
  Reactivate door). **Prove no redirect loop** for: active, cancelled, free-time-ended, no tournament, hosted tournament.
- Notification bell rows and emails already sent keep the old URL: the redirects above are what keep them working. Test them.

## Part 2 · The doors

- Remove the **Admin** door for **standalone** workspaces in `CoachesSidebar.tsx` and `CoachesBottomNav.tsx` (today it shows to
  any org owner/admin): `isOrgAdmin && !standalone`. Club owners/admins keep it. Update `nav-standard-guard` /
  `coach-nav-groups` expectations in the same change.
- **Open question A, as the owner answered it (2026-10-28, plan §9 ruling 4):** a **workspace-level "Tournaments you run" link next
  to Plan & billing, plus the quiet "Tournament helpers" link** (to the members page, which stays in the hosted-tournament shell).
  ⚠ **Not drawn yet:** where these two links sit in the portal needs one small drawing before this part is built. The reason
  it is workspace-level: today "Tournaments you run" lives only inside the team's Tournaments page, which a closed season
  redirects to Season's End, so a coach with only a closed season would lose the hosted-tournament pages once Admin goes.
  Whatever is drawn, a standalone coach
  keeps a way to (a) create and run a hosted tournament and (b) invite its helpers. Say how in the hand-off.
- The admin rail's **Plan & billing** row (`kitOrgLinks`, `lib/admin-kit-nav.ts`) is still shown inside the hosted-tournament
  shell; its href resolves through Stage 2's resolver so a standalone coach lands on the coach page. Hosted-tournament pages that
  mention billing (lock lines, dashboard nudges) follow the resolver.

## Part 3 · Clean-up the retirement leaves behind

Dead branches for "team workspace" inside admin hub/onboarding code that can no longer be reached — remove only what you can
prove unreachable (grep every caller); leave anything shared with Tournament plans. Do **not** touch the tournament-tier
onboarding. `lib/module-entitlements.ts` `isTournamentOnlyWorkspace` still describes `team` — do not change its meaning.

## Not Stage 3

Building any new portal page for tournament hosting or staff helpers; deleting hosted-tournament admin pages; changing what the
`team` plan includes.

## Done when

As a standalone coach: no Admin button; `/{org}/admin`, the old billing URL and the old subscription URL all land in the portal;
hosted-tournament pages still open from the portal's Tournaments section; a cancelled workspace lands on the wall with its
Reactivate door. As a club owner who coaches: Admin door and admin billing unchanged. Redirect behaviour is covered by tests
(add them); `verify:changed` + `typecheck` green. **Owed after:** `/review` (redirects and auth — do not skip), `/docs`, the owner
walk, dev-server restart.
