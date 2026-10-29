# Plan & billing, Stage 2: the Coaches Portal host and the door (build prompt)

> **Written 2026-10-28.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**, then the
> plan. Leads name **files, not lines**; re-verify each. **Gate:** Stage 1 is committed and verified; the Stage A drawings
> (coach host, the rail/sheet row, the wall doors) are ruled; the owner has said "build Stage 2".
>
> **Revised 2026-10-29 — read "Revision 2026-10-29" below before the rest; where it disagrees with an older line, it wins.**

## Revision 2026-10-29 (binding; supersedes anything below it contradicts)

**Where the code stands.** Stage 1 is committed and the owner walked it (PASS). Relevant commits on `dev`: `8d579da29`
(Plan & billing is the **owner's alone**), `f4433d76d` (a stale grant no longer blocks Manage → Save), `55676abd3` (Upgrade
asks how to pay first in a small window, the cancelled page settles before it shows, "Reduce or cancel" ends the page).
Re-read the current code; the paths below are leads.

1. **Owner-only, no delegates (owner ruling 2026-10-29, reversing the 2026-10-28 delegation).** `hasCapability` returns false
   for `billing` and `org_settings` for every role but owner. Use `hasBillingAccess(role, capabilities)` (`lib/roles.ts`) for
   every new gate. **Do not read `capabilities.billing` anywhere, do not add a delegate case, and do not rebuild delegation.**
   An admin or staff helper in a standalone workspace sees **no** Plan & billing row; one who types the URL gets the body's
   own locked card. Ask 13 still stands: a new **"owner of a standalone Coaches Portal"** predicate, used for the row now
   and for removing the Admin door in Stage 3. Standalone = `isTeamWorkspaceOrg(org)` (`lib/team-workspace-kind.ts`); the
   nav components do not use it today (`CoachesSidebar` reads only `userRole`; `CoachesBottomNav` already has `currentOrg`).
2. **Demo sandbox shows no Plan & billing row** (Part 3 ruling; `lib/sandbox-curation.ts`: billing entry points are hidden in
   the demos). The coach demo is `riverdale-ridge`; `CoachesBottomNav` already has `useIsSandbox()`. Mirror `kitBillingLink`'s
   sandbox handling (`lib/admin-kit-nav.ts`) and **test it**.
3. **The body now has the pay step.** Upgrade opens `PlanCycleDialog` (Monthly / Yearly side by side); the details panel has
   its own switch. Both ride `KitDialog`, which needs only the dialog-floor and overlay hooks that the coaches layout already
   mounts. Exercise an Upgrade **from the coach host** and say so. The body no longer has any `canCancel`/delegate plumbing.
4. **Stripe's customer portal has cancel and plan-change switched OFF** (owner ruling; the setup guide was corrected). Do not
   build anything that assumes a customer can cancel or switch plans inside Stripe.
5. **Entry gate — honest status.** `npm run verify:changed` is **not green on `dev` today and was not green before this
   stage**: ESLint stops on three errors in another session's `app/dev/crash-test/page.tsx`, ~23 committed tests fail on a
   clean checkout because they read other sessions' uncommitted files, and `tsc` reports errors from other sessions'
   committed code (`publicGameState`, `moveDirection`). **Treat these as baseline: record them first, list what is yours vs
   not, never hide a file, change a check, or repair unrelated work.** Your work must add **no** new failure. Typecheck needs
   `NODE_OPTIONS=--max-old-space-size=8192` on this machine.
6. **Corrections to the recon the older text relied on** (verified in code 2026-10-29):
   - `BillingBody` calls only `useOrg`, `useRouter`, `useSearchParams`, a local notice hook and `KitDialog`. It needs **no**
     `TournamentProvider` or club-brief provider. Only `PlanPanelDrawer` (via `PlanPanelHost`, admin layout only) calls
     `useTournament`. The coach host does **not** need `PlanPanelHost`; the `?plan=` details panel is the body's own state.
   - **The coaches layout returns its walls before `children`** (cancelled ≈ lines 120–147, plan wall ≈ 196–231, zero-team
     ≈ 233–293). A new page under `coaches/` never renders in those states unless you change that. See the design point
     added to Part 4.
   - There is **no workspace teams-list page** (`coaches/page.tsx` is a client redirector into a team). The closest
     precedents for a team-less page are `coaches/link-org/page.tsx` (standalone-only; best fit) and
     `coaches/notifications/page.tsx`. Outside the team layout `CoachPageHeader` draws its own "?".
   - `create-checkout` is the **only** route that reads `returnTo` (admin-prefix check only). `portal`, `setup-payment-method`
     and `choose-next-season` **ignore** `returnTo` and use `getBillingHref`, so those three need the coach-aware resolver,
     not just the allow-list.
   - The More tab on the phone lights only through `isOnTeamMore`; Notifications is special-cased. A new `${base}/billing`
     page needs the same special case or **nothing lights**.
   - `/api/me/role-summary` → `lib/user-contexts.ts` builds `billingHref` and parses the slug from it
     (`billingHref.split('/')[1]`); keep that working when the href changes shape.
   - `app/api/admin/email/send/route.ts` puts the org **UUID** where the slug goes (pre-existing bug). Report it; fix it only
     if you are already touching that line for the resolver.

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
  already use; add **no** new context field). A non-owner who types the URL gets the one locked card. Write the combined
  "owner of a standalone Coaches Portal" test once, in a shared module, and test it (owner/admin/staff × standalone/club-owned).
  The row is also **absent in the demo sandbox** (Revision item 2).
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

The coaches layout's final branch mounts `OrgProvider > CoachesProvider > HelpDrawerProvider > CoachesOverlayProvider >
ConfirmProvider`; the three wall branches mount `OrgProvider` only. Per the Revision, the body needs none of the missing
providers — **prove it** by rendering the page for a workspace with a hosted tournament and several teams, and again with
no team. The body's success line closes to the coach page, never `/admin/tournaments`. Keep Premium / Join a club /
reactivate keep using `lib/coaches-portal-routes.ts` paths. Add the new file to `plan-billing-source-guard`'s `screenFiles()`
so it stays under the no-hand-typed-plan-facts rule.

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
do, do not invent a portal drawer.** Update `billing-urls.test` and `plan-panel-host.test`, which pin today's outputs. Other
guards that pin today's links and will fail until you move them deliberately: `plan-billing-delegate-and-links.test` (the
"every billing link resolves the tier" list), `plan-billing-admin-host.test`, `plan-reader-door-guard.test` (expects
`getBillingHref(auth.org.slug, auth.org.planId)` as the destination — keep the own-plan rule), `admin-kit-nav.test`,
`notification-reader.test`, `org-billing-access-guard.test`, UAT `coach-wall-doors.spec` and `marketing-seam.spec`. Update the
test to the new truth; never loosen an assertion to make it pass.

- **Lapsed workspaces and the emails (decide, state, test).** The coach layout blocks a cancelled or free-time-ended workspace
  before any page renders, so a cancelled standalone owner who clicks an email link to the new coach billing page lands on the
  wall. For each emailed/bell link, state which URL a **cancelled** standalone workspace gets (default: its existing reactivate
  path, `teamWorkspaceReactivatePath`) and which an active / trialing / past-due one gets (the coach billing page). One
  resolver, one table of cases in its test.

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

**Design point to settle before building the zero-team door (the layout returns every wall before `children`).** A wall
cannot link to a page that the same layout then refuses to render. Choose the smallest of: (a) the zero-team wall's owner door
goes to the page and the layout lets that one path (and only for the owner) through the zero-assignment wall — `proxy.ts`
already sets an `x-pathname` request header and `app/platform-admin/layout.tsx` reads it, which is the precedent for a
path-aware server layout; (b) the door goes to an existing destination that already works while lapsed. Whichever you choose,
`club-stage1-server-guard.test` pins the wall order (`isOrgBillingSuspended` before the plan wall before not-assigned before
`<CoachesChrome`) — update it to the new truth rather than weakening it, and keep `getCoachPortalAuth` allow-suspended.
**If the only workable option reorders the cancelled or plan walls, stop and report with the options; do not decide it silently.**

## Not Stage 2

Removing the Admin door or redirecting `/admin` (Stage 3); the "Covered by {Club}" line (Stage 4); help rewrite (Stage 5).

## Done when

A standalone coach opens Plan & billing from rail and phone sheet and never sees an admin screen doing it; every Stripe
return (portal, card saved, next-season, checkout, plan move) lands back on the coach page — **say how you exercised each**
(the dev environment mocks the portal; Stripe test mode where you can); a lapsed owner reaches Reactivate from each wall;
your changes add **no** failure beyond the baseline you recorded (Revision item 5) — `typecheck`, the unit suite and the focused
lint on your files are clean; the coach Plan & billing row is absent for an admin helper, for a club-owned coach and in the
demo sandbox; and the `payment_failed` bell row a standalone owner receives opens the coach page with its own label.
**Owed after:** `/review` (auth/redirect/links: do not skip), `/docs`, the owner walk, dev-server restart (new files).
Do not commit; leave other sessions' edits alone.
