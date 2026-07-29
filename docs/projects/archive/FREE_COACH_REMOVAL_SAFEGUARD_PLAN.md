# Free-Coach Removal Safeguard — Implementation Plan

> **Status:** Built (dev, unpushed) 2026-06-28 — typecheck + focused lint green; pending `/review` + browser verification
> **Created:** 2026-06-27
> **Branch:** dev
> **Source:** /helpdesk ticket → gap logged in docs/projects/active/HELPDESK_GAPS.md ("Removing an org admin who is ALSO a free coach…")

## Build notes (2026-06-28)
- **Phase 1–3 (org Members removal):** `lib/basic-coach-teams.ts` gained `countActiveBasicCoachTeamMembershipsForUser`, `getSoleOwnedActiveBasicCoachTeamIds` (extracted from cleanup so the "will-delete"/"is-deleted" sets share one source of truth), and `getBasicCoachTeamDeletionImpactForUser`. `cleanupBasicCoachTeamsForUserDeletion` refactored onto the shared resolver. DELETE now treats an active free portal as off-org presence (`hasOtherOrg || hasFreeCoachPortal` → membership-only). New `memberRemovedHtml` email fires best-effort on the membership-only path only. Impact GET returns `basicCoachTeamCount`; the members confirmation copy switched to account-kept + reassurance line.
- **Phase 4 (platform-admin delete):** added a super-admin GET impact handler to the delete route; the customer-users delete modal lazily fetches it and shows a "runs N free coaching teams; M sole-owned will be permanently deleted" warning. Behavior unchanged on confirm (still a deliberate hard delete).
- ⚠ **Dev server restart required before browser testing** — shared modules (`lib/email.ts`, `lib/basic-coach-teams.ts`) changed.

## Goal

Close a confirmed, irreversible data-loss footgun: removing an organization admin (org Members page → Remove) who is **also** a free (Basic) coach silently hard-deletes their entire free Coaches Portal — every Basic coach team they solely own (roster, players, registrations, fees, announcements) plus their auth account — with no warning to the admin and no notice to the coach.

The root cause is that the existing "preserve the account, remove membership only" safeguard (J4-036) only recognizes presence in **other organizations** (`organization_members` rows). A free Coaches Portal is org-less (`basic_coach_teams` / `basic_coach_team_users` — not an organization), so a free-only coach reads as "sole membership" and falls into the hard-delete branch. This plan broadens the safeguard to treat an active free Coaches Portal as off-org presence (preserving the account), and makes the pre-removal warning honest.

## PM Brief

See `FREE_COACH_REMOVAL_SAFEGUARD_PM_BRIEF.md`.

## Confirmed root cause (code-traced 2026-06-27)

- `app/api/admin/members/[memberId]/route.ts` → `DELETE`:
  - Lines 129–133: `otherMembershipCount` counts only `organization_members` in **other** orgs.
  - Lines 135–162: if `> 0` → **membership-only** removal (drops this org's member row + scope rows; account + everything else preserved).
  - Lines 164–189: else (sole membership) → calls `cleanupBasicCoachTeamsForUserDeletion(user_id)` (deletes every Basic team the user is the **sole active member** of — child rows cascade) then `auth.admin.deleteUser(user_id)` (cascades `basic_coach_team_users`). Net: free portal + account destroyed.
  - No email is sent on either branch (only `PATCH status=suspended` emails, lines ~363–378 via `memberSuspendedHtml`).
- `app/api/admin/members/[memberId]/route.ts` → `GET` (impact, lines 28–81): returns `coachingAssignmentCount` = count of **`rep_team_coaches`** (PAID coaching) only; `otherOrgCount` = `organization_members` in other orgs only. **Neither counts `basic_coach_team_users`.** So a free-only coach: `otherOrgCount = 0` (→ "permanently delete" copy) AND `coachingAssignmentCount = 0` (→ no amber coaching warning).
- UI: `app/[orgSlug]/admin/org/members/page.tsx` lines 626–649 (copy) + 672–680 (impact fetch). `app/[orgSlug]/admin/tournaments/settings/members/page.tsx` just re-exports this page, so one fix covers both routes.

## Architectural Decisions

- **Decision:** Treat an active free Coaches Portal (≥1 active `basic_coach_team_users` row) as "off-org presence" that forces the **membership-only** removal path. **Rationale:** Mirrors the J4-036 intent exactly — never destroy a person's whole account/data as a side effect of removing them from one org. A free portal is a first-class standalone presence even though it isn't an organization.
- **Decision:** The membership-only path already does **not** call `cleanupBasicCoachTeamsForUserDeletion` or `deleteUser`, so simply routing free coaches there preserves their teams with **no new deletion logic**. The fix is a broadened branch condition, not new cleanup code.
- **Decision:** Add a dedicated lightweight existence/count helper rather than reusing `getBasicCoachTeamsForUser` (which hydrates full team + registration rows). A head-count on `basic_coach_team_users (user_id, status='active')` is enough for both the safeguard (existence) and the warning (count). **Rationale:** keeps the hot removal path cheap.
- **Decision:** Send the optional courtesy email (Phase 3) **only on the membership-only path** (access removed, account intact). On a true hard-delete the account no longer exists, so a "you were removed" email is low-value/odd. **Rationale:** notification is meaningful only when there's a surviving account to inform.
- **Decision:** Sport-neutral — no score/period/label vocab touched; nothing routes through sport packs. No new migration (logic + UI + reused email infra only).

## Phases

### Phase 1 — Server safeguard (the data-loss fix) ⚠ ships first, independently correct
- [ ] Add `countActiveBasicCoachTeamMembershipsForUser(userId: string): Promise<number>` to `lib/basic-coach-teams.ts` — head-count of `basic_coach_team_users` where `user_id = userId AND status = 'active'`. (Existence = `> 0`; same value reused as the warning's team count since there is one membership row per team per user.)
- [ ] In `app/api/admin/members/[memberId]/route.ts` `DELETE`: compute an `offOrgPresence` condition = `(otherMembershipCount ?? 0) > 0 || basicCoachTeamCount > 0`, and branch the membership-only path on `offOrgPresence` instead of `otherMembershipCount > 0`.
- [ ] Extend the membership-only audit-log payload to record why the account was preserved (e.g. `preservedReason: otherMembershipCount > 0 ? 'other_org' : 'basic_coach_portal'`, plus `basicCoachTeams: basicCoachTeamCount`) for observability.
- [ ] Confirm the sole-membership hard-delete branch is now reached **only** when the user has neither another org membership nor an active Basic coach team (true junk/admin-only account) — preserves original J5-012 cleanup intent for genuine orphans.

### Phase 2 — Honest removal warning (UI) — ships with Phase 1
- [ ] In `GET` (impact) of `app/api/admin/members/[memberId]/route.ts`: add `basicCoachTeamCount` to the parallel counts (reuse the new helper) and to the JSON response.
- [ ] In `app/[orgSlug]/admin/org/members/page.tsx`:
  - [ ] Extend the `removeImpact` type + fetch parse (lines ~214, ~677) with `basicCoachTeamCount`.
  - [ ] Update the headline copy condition (lines 629–639): show "remove them from this organization — account kept" when `otherOrgCount > 0 **OR** basicCoachTeamCount > 0`; reserve the "permanently delete their account" copy for the genuine sole-presence case (both zero).
  - [ ] **No coach-specific disclosure to the org admin** (owner decision 2026-06-28): do NOT surface the free-team count or the existence of a coaching portal here. The org president may not know the person coaches elsewhere (free or paid), and it has no value at the removal decision — it's a privacy leak. The generic account-kept headline ("Their account is kept") is the only reassurance shown when the person is a free-only coach. `basicCoachTeamCount` is still used server-side + in the impact payload to *drive* the account-kept branch; it is just not displayed as a line item.
- [ ] Verify the re-exported `app/[orgSlug]/admin/tournaments/settings/members/page.tsx` inherits the change (no separate edit needed).

### Phase 3 — Removal notice email ✅ confirmed (owner approved 2026-06-27)
- [ ] Add `memberRemovedHtml({ orgName })` to `lib/email.ts` (sibling of `memberSuspendedHtml`): plain "your access to {org} was removed; any other organizations/workspaces on your account are unaffected" notice.
- [ ] Fire it best-effort on the **membership-only** branch only (account survives ⇒ a notice is meaningful). Email already captured at line 121 before the member-row delete. Do **not** send on the hard-delete branch (no surviving account).

### Phase 4 — Platform-admin delete: informed (not silent) ✅ confirmed (owner approved 2026-06-27)
Scope decision: the platform-admin customer-user delete (`/platform-admin/customer-users` → `app/api/platform-admin/users/[id]/delete/route.ts`) is an **intentional, deliberate account deletion** (super_admin only, type-email-to-confirm). It should stay a hard delete — but the operator must be **warned** what a free coaching portal deletion entails, mirroring the existing "Owner of N organizations" warning block in the modal. This is an informed-consent warning, NOT the auto-preserve behavior of Phases 1–2 (those are about removing from one org, a different intent).
- [ ] Surface the deleting user's free-coach impact in the delete modal of `app/platform-admin/customer-users/CustomerUsersClient.tsx`: count of active Basic coach teams + how many they're the **sole owner** of (the ones that will be permanently deleted). Source via the new `lib/basic-coach-teams.ts` helper(s) — either added to the customer-users list data (where `memberships`/`ownedOrgs` already come from) or a small per-user impact fetch on modal open.
- [ ] Render a warning block beside the existing `ownedOrgs` block (modal lines ~745–759): e.g. "Runs N free coaching team(s); M will be permanently deleted (sole owner) — roster, players, fees, and history included."
- [ ] Behavior unchanged on confirm (still hard-deletes; `cleanupBasicCoachTeamsForUserDeletion` already runs). Audit-log payload already records `cleanedBasicCoachTeams` count — keep.
- [ ] (Optional consistency) consider the same warning on any other operator delete surface that calls `auth.admin.deleteUser` (`app/platform-admin/company-users/[id]/route.ts`, dev-tools) — flag, lower priority.

## Edge cases to honor (flag during build)
- **Sole owner of a free team:** preserved under the new safeguard (account not deleted ⇒ no `cleanupBasicCoachTeamsForUserDeletion`) — the desired outcome.
- **Free team with other active members:** unchanged. The leaving user isn't deleted, so nothing cascades; the team and co-members are untouched either way.
- **Inactive/removed Basic membership (`status != 'active'`):** does not count as presence (grants no portal access) — consistent with `getBasicCoachTeamsForUser`/cleanup, which both filter `status='active'`. Such a user with no other presence still hard-deletes.
- **True junk account (admin-invited, never accepted, no other org, no coach team):** still hard-deletes — original intent preserved.
- **Concurrent removals (two admins, same member):** not made worse. Membership-only delete-by-id is idempotent; double hard-delete second call 404s. Note but no new guard required.
- **Out of scope (flag as related):** the platform-admin user-delete path (`/platform-admin/customer-users` / dev-tools) is a separate, intentional destructive surface. It is **not** covered by this fix; consider a follow-up so a platform operator gets the same "this user runs a free coaching portal" warning before deleting.

## Verification (owner runs browser tests)
- [ ] `npm run lint:focused -- app/api/admin/members/[memberId]/route.ts lib/basic-coach-teams.ts app/[orgSlug]/admin/org/members/page.tsx`
- [ ] `npm run typecheck` (touches a shared lib + an API data contract).
- [ ] Manual: admin who is ALSO a free coach (no other org) → Remove → confirm dialog shows "account kept / coaching portal intact" copy; after removal, the coach can still sign in and their portal/teams are intact; org access is gone.
- [ ] Manual: admin-only junk account (no other org, no coach team) → Remove → "permanently delete" copy → account hard-deleted as before.
- [ ] Manual: admin in a second org → Remove → existing multi-org copy + behavior unchanged.

## Open Questions
- [x] Phase 3: send a removal courtesy email on membership-only removals? → **YES** (owner approved 2026-06-27).
- [x] Should the platform-admin customer-user delete path get the same free-coach treatment? → **YES** (owner approved 2026-06-27) — scoped as Phase 4: an informed-consent **warning** in the delete modal (stays a hard delete, since deleting the account is the explicit intent there).
