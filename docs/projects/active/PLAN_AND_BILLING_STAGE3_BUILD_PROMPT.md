# Plan & billing, Stage 3: retire the coach's admin view (build prompt)

> **Written 2026-10-28; revised 2026-10-29/30.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**,
> then the plan (§9, "Stage 3 doors rulings"), then the drawing `PLAN_AND_BILLING_STAGE3_DOORS_DRAWINGS.html` (open it in a
> browser: its Asks tab is the ruled list). Leads name **files, not lines**; re-verify each. **Gate:** Stage 2 is committed
> (`8ec937555`) and the owner walked it (ledger §427, no defect); open question A is **answered** (below); the owner asked for
> this prompt to be handed to Codex on 2026-10-30.
>
> **Revised — read "Revision 2026-10-29" below before the rest; where it disagrees with an older line, it wins.**

## Revision 2026-10-29 (binding; doors rulings given by the owner 2026-10-30; supersedes anything below it contradicts)

**Where the code stands.** Stage 1 and Stage 2 are committed. A standalone owner opens Plan & billing at `/{org}/coaches/billing`
from the rail foot and the phone More → You group (`isStandaloneCoachOwner`, `coachBillingLink` in `lib/coach-billing-access.ts`;
the resolver is `getBillingHref` in `lib/billing-urls.ts`). Plan & billing is the **owner's alone** (`hasBillingAccess`). Re-read
the current code; the paths below are leads.

**What the coach sees after Stage 3.**
- A standalone coach never lands in the admin area by accident. The Admin door is gone from their rail and phone sheet.
- One new row, **"Tournaments you run"** (trophy), sits in the rail foot after Plan & billing and in the phone More → You group
  after Plan & billing. It opens the workspace's tournaments list (`/{org}/admin/org/tournaments`, the page the existing
  "Set up a tournament" button opens). It works with a closed season, with no team, and with several teams.
- Helpers are **not** a portal link. The coach Staff page keeps the coaching staff; the owner reaches tournament staff inside the
  tournament pages (computer: the menu row; phone: More → Settings & access → "Staff & access" card). The head coach owns both.
- A bookmark or old email to the admin hub, the old billing address or the old subscription address forwards to the Coaches Portal.

**The 13 rulings, in build terms** (plan §9 has the owner's words; the drawing shows every state):
1. Label **"Tournaments you run"**. 2. Rail foot order **Help, Plan & billing, Tournaments you run, Collapse sidebar**.
3. Phone You group **Account, Home, Plan & billing, Tournaments you run**. 4. Same wording for a coach who has never hosted.
5. Shown to **whoever can run tournaments**, in a **standalone (one-team) workspace** only: `isTeamWorkspaceOrg(org)`, the plan
   carries `module_tournaments` (`hasModuleEntitlement`), and the person holds `create_tournaments` (`TOURNAMENT_GRANT_KEY`,
   `lib/coach-tournament-grant.ts`; owners pass `hasCapability`). Build it as **one pure gate function** (like `coachBillingLink`)
   that returns the href or `null`, used by the rail, the sheet and the wall. **Do not reuse** the hosted-tournaments API route's
   `canRun`: it is coupled to a team assignment, and this row must work with none.
6. **No "Tournament helpers" link anywhere.** 7. In a one-team workspace the menu row **"Members"** and the Members page heading
   read **"Staff & access"** (the Settings & access card already uses that title). Other plans keep "Members".
8. Trophy icon: 14px in the rail foot, 17px in the sheet. 9. The admin shell's **"Coaches Portal"** way-back row keeps its name
   and place, and now also shows to the **owner of a one-team workspace who has no team**. 10. The zero-team wall gets one more
   owner-only door. 11. The demo sandbox hides the new row **by name**. 12. A board admin with no team lands on the tournaments
   list. 13. The Admin door leaves **every role** in a one-team workspace.

**Traps found while drawing (all verified in code 2026-10-29; re-verify):**
- ⚠ **`isStandaloneCoachOwner` is owner-only (it is the billing test).** Do **not** use it to remove the Admin door. The older
  text below said `isOrgAdmin && !standalone`; that would leave a board admin an Admin door that forwards back to the portal.
  Use **`!isTeamWorkspaceOrg(currentOrg)`** for the Admin door. A club owner or admin who coaches keeps Admin.
- ⚠ **A board admin with no team** (role `admin`, invited on the staff page, uses a seat) opens the portal and meets "Coaches
  Portal not ready". Part 1's `/admin` redirect must not send them there (ruling 12).
- ⚠ **The phone menu inside a one-team workspace's tournament pages has no Members row** (its "tournament bar" branch lists the
  tournament's own groups: Operations, Setup, Admin, where Admin holds Settings & access). **Do not add one**; the phone's door
  is Settings & access → Staff & access.
- The rail foot is outside the "live season" gate, and the phone sheet's You group renders for a closed season, so the new row
  survives a closed season **without** touching `CoachTeamSeasonGate`. **Do not add a read-only or finished-season branch.**
  These links are workspace-level, like Plan & billing, not season tools.
- The shipped coach rail is **220px** wide, its foot is 12px type with 14px icons; sheet rows are 16px with 17px icons and wrap in
  their half-width column ("the column gives, never the word"). A two-line label is expected and fine; do not shorten the word.
- Chat is paused (`CHAT_PAUSED`); do not touch it.

**Baseline honesty.** `npm run verify:changed` and `tsc` were **not green** on `dev` at Stage 2 for reasons in other sessions'
files. **Record the baseline first, list what is yours and what is not, never hide a file, change a check or repair unrelated
work.** Your work must add **no** new failure. Typecheck needs `NODE_OPTIONS=--max-old-space-size=8192` on this machine. Stage
**explicit pathspecs only**; the tree holds other sessions' changes.

## What Stage 3 makes true

A standalone coach **never lands in the admin area by accident again**. The "Admin" door is gone from their portal; the
confusing "Welcome to FieldLogicHQ / Optional: set up a tournament" page cannot be reached from the portal, and a bookmark or old
email to the admin hub or the old billing address **forwards to the Coaches Portal**. A coach who **hosts a tournament** still
manages it exactly as today (those pages stay), now reached from the new foot row. Club owners/admins who also coach keep their
Admin door unchanged.

## ⚠ What does NOT retire (argue from the code, then confirm)

Hosted tournaments (`CoachHostedTournamentsSection`, `teams/[teamId]/tournaments/page.tsx` → `/admin/org/tournaments?create=1`,
`/admin/tournaments/dashboard`, registrations with their team-workspace branches) have **no portal twin**; the workspace's
staff page (`/admin/org/members`, seat limit from `PLAN_CONFIG.team.seatLimit`) is **not** what the portal's Staff page manages
(that route never writes `organization_members`). Audit log, org settings and PDF settings have no portal twin either. **Only** the
admin hub / onboarding bounce, the Admin door, and the admin billing page retire for this audience. The "Tournaments you run"
section on the team's Tournaments page **stays unchanged** (the live-season way in). **If the code disagrees, stop and report.**

## Part 1 · Redirects (server side; Next 16 docs first)

- `proxy.ts` is org-agnostic (path-only, explicit "no tier bounce") — **do not** add org-kind logic there. Use **server layouts
  or pages**, following the precedent in `admin/{accounting,families,rep-teams}/layout.tsx`
  (`redirect(isTeamWorkspaceOrg ? '/coaches' : '/admin')`).
- `app/[orgSlug]/admin/page.tsx` (it renders `AdminHub`, which bounces to `/admin/onboarding?continueSetup=1`): for a team
  workspace decide server-side, **by who is asking** (ruling 12):
  - the owner, or anyone with a live or closed team assignment in this workspace → `/{org}/coaches`;
  - a member with **no team** who can run tournaments → `/{org}/admin/org/tournaments`;
  - anyone else → `/{org}/coaches` (the portal's own wall answers them).
  Assignment reads are request-cached in `lib/coach-portal-request.ts` (`getCoachPortalAssignments`,
  `getCoachPortalClosedAssignments`). Confirm the onboarding page can no longer be reached by a team workspace from anywhere else
  (sign-in landing, `lib/user-contexts.ts` post-login routing, emails) **and that sign-in does not send a board admin with no
  team through `/admin` → `/coaches` → the "not ready" screen.**
- **Do not redirect** `/admin/org/tournaments`, `/admin/tournaments/**`, `/admin/org/members`, the audit log, org settings or
  PDF settings for a team workspace: they are the hosted-tournament shell, now reached from the portal.
- **Old billing addresses → the coach page, permanently** (`permanentRedirect` or the Next 16 equivalent — read the docs): the
  org billing page (`admin/org/billing`, which just renders `BillingKit`) and the tournament-tier `settings/subscription`
  re-export, for a team workspace only. **Keep `allowSuspendedOrg: true`** on every layout in that path (`admin/layout.tsx`,
  `admin/org/layout.tsx`); add any new layout/page file to `org-billing-access-guard.test`.
- A server layout cannot see the pathname, which is why the client `CancellationGuard` exists (it fixed a refresh loop — read its
  header; Stage 2 changed its target for a cancelled standalone workspace to `teamWorkspaceReactivatePath`, so re-read it).
  **Prove no redirect loop** for: active, cancelled, free-time-ended, no tournament, hosted tournament, board admin with no team.
- Notification bell rows and emails already sent keep the old URL: the redirects above are what keep them working. Test them.

## Part 2 · The doors

1. **The gate (ruling 5).** One pure function, e.g. `coachHostedTournamentsLink(org, role, capabilities, inSandbox)` beside
   `coachBillingLink`, returning `/{slug}/admin/org/tournaments` or `null`: null in the sandbox, with no org, for a non-team
   workspace, for a cancelled org, and for anyone who cannot run tournaments. Unit-test the matrix: owner, admin, coach with the
   grant, coach without it, club owner who coaches, sandbox, cancelled.
2. **Rail (`CoachesSidebar.tsx`).** Foot order Help, Plan & billing, **Tournaments you run** (`Trophy` size 14, foot styling, an
   `id` like `coaches-tournaments`), Collapse sidebar last. Active state: the row is a door out of the portal, so it has none.
   Replace the Admin row's condition with `isOrgAdmin && !isTeamWorkspaceOrg(currentOrg)`.
3. **Phone (`CoachesBottomNav.tsx`).** You group order Account, Home, Plan & billing, **Tournaments you run** (`Trophy` size 17,
   `id` like `coaches-mob-tournaments`), then Admin (club only). The group's render condition today is
   `(!inSandbox || isOrgAdmin)`; make it "any row to show". Keep the closed-season behaviour: the group stays.
4. **Way back (ruling 9).** The admin shell's "Coaches Portal" row comes from `coachDoorFor(useCurrentOrgCoachAccess(...))`
   (`lib/use-current-org-coach-access.ts`, read by `useAdminKitNav.ts`, drawn by `AdminKitRail.tsx` and `AdminKitBottomNav.tsx`).
   Today it needs a rep/closed assignment or a Basic team. Also show it when `isStandaloneCoachOwner(org, role, caps)`, href
   `/{slug}/coaches`. Everyone else keeps today's rule. Same name; **no "Back to…" wording.**
5. **"Coaches Portal not ready" (ruling 10).** In `app/[orgSlug]/coaches/layout.tsx`, beside the owner's Plan & billing door, add a
   plain door **"Tournaments you run"** from the same gate (owner only). It is a plain door (the layout's `notAssignedDoor`
   style), not a second lime button. Keep the cancelled, free-time-ended and plan walls as they are: nothing new there. Do not
   rename the existing "Back to Coaches Portal home" door (found, not in scope).
6. **One name (ruling 7).** For a team workspace, `kitOrgLinks` in `lib/admin-kit-nav.ts` labels the Members row **"Staff & access"**
   and `MembersKit` headings its page **"Staff & access"**. Update `admin-kit-nav` tests and any help article that names the row
   for a one-team workspace (offer `/docs`). The seat line ("N of 3 staff seats used") and everything else on the page stay.
7. The admin rail's **Plan & billing** row (`kitOrgLinks`, `lib/admin-kit-nav.ts`) is still shown inside the hosted-tournament
   shell; its href resolves through Stage 2's resolver so a standalone coach lands on the coach page. Hosted-tournament pages
   that mention billing (lock lines, dashboard nudges) follow the resolver.
8. Update the pins in the same change: `plan-billing-coach-host.test` (rail foot order, sheet order, closed-owner and
   zero-team-owner scenarios, helper/club/sandbox absence), `nav-standard-guard.test` (the Premium coach sheet order list names
   `coaches-mob-back-to-admin` after billing — the team workspace now has the new id there, the club keeps Admin),
   `coach-nav-groups.test` if labels move, and the `coach-wall-doors` UAT scenario for the wall door.

## Part 3 · Clean-up the retirement leaves behind

Dead branches for "team workspace" inside admin hub/onboarding code that can no longer be reached — remove only what you can
prove unreachable (grep every caller); leave anything shared with Tournament plans. Do **not** touch the tournament-tier
onboarding. `lib/module-entitlements.ts` `isTournamentOnlyWorkspace` still describes `team` — do not change its meaning.

## Not Stage 3

Any new portal page for tournament hosting or staff; a "Tournament helpers" link or any helpers door in the portal; a Members
row in the phone's tournament menu; deleting hosted-tournament admin pages; changing what the `team` plan includes; the
"Back to Coaches Portal home" wording; the Admin door's lack of a sandbox hide (moot once it leaves team workspaces); any
finished-season branch or year parameter (the history endpoint guard stays untouched).

## Done when

As a standalone owner: no Admin button on a computer or a phone; **Tournaments you run** in the foot and the You group, including
in a closed season, with several teams, and on the zero-team screen; `/{org}/admin`, the old billing URL and the old subscription
URL all land in the portal; the row opens the tournaments list, and the Staff & access page is reachable from there; a cancelled
workspace lands on the wall with its Reactivate door. As a coach with the "Run tournaments" grant: the row shows and opens the
list. As a board admin with no team: `/admin` lands on the tournaments list, not the "not ready" screen. As a club owner who coaches:
Admin door and admin billing unchanged, no new row. Demo: no new row. Redirect behaviour and the gate matrix are covered by tests;
`verify:changed` + `typecheck` add no failure beyond the recorded baseline. **Owed after:** `/review` (redirects and auth — do
not skip), `/docs` (the Members → Staff & access rename; the portal's Tournaments help), the owner walk, dev-server restart.
