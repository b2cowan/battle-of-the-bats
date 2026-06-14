# Admin Role Parity — "Admin = Owner minus Billing & User Management"

**Status:** Phase 1 + Phase 2 BUILT (2026-06-09) on branch `feat/free-tier-coaches`; awaiting browser verification. (Phase 1 = commit `ec64b17`; Phase 2 = follow-up commit.)
**Owner decision (2026-06-09):** Tournament `admin` should do basically everything `owner` can **except billing and user/member management.**

---

## Policy (confirmed)

The capability model in `lib/roles.ts` already encodes this: `owner` has all capabilities; `admin` has everything **except** `org_settings` and `billing`. The defect was a handful of pages/routes that bypassed the capability system with **raw `role === 'owner'` checks** for tournament-operational features — most visibly the tournament branding page.

Three policy points were confirmed with the owner before changes:

| Decision point | Choice |
|---|---|
| **Tournament branding** (logo, hero banner, theme/colours/font/card style, public-page visibility) | **All → admin.** Reverses the prior "visual identity = owner-only" design intent, per the stated policy (branding is neither billing nor user management). |
| **Member/user management** (admins currently CAN invite/role-change/remove; owner keeps suspend, capability overrides, audit log, ownership) | **Keep current split.** No change. |
| **Org-level settings** (org name, public URL slug, org-wide identity, /discover listing, account-deletion request) | **Keep owner-only.** No change. |

---

## What was built (Phase 1)

New capability **`manage_branding`** (owner + admin by default) — plugs into the existing per-member override system instead of another raw role check.

| File | Change |
|---|---|
| `lib/roles.ts` | Added `manage_branding` to the `Capability` union, `owner` + `admin` `ROLE_DEFAULTS`, and `ALL_CAPABILITY_KEYS`. |
| `app/[orgSlug]/admin/org/members/page.tsx` | Added `manage_branding` label to `CAPABILITY_LABELS` and to `ACTION_CAP_KEYS` (shows in the per-member override editor). |
| `app/[orgSlug]/admin/tournaments/branding/page.tsx` | Replaced the whole-page `userRole !== 'owner'` wall with `hasCapability(userRole, userCapabilities, 'manage_branding')`. Now renders for owner + admin. |
| `app/api/admin/tournament-branding/route.ts` | Branding-field write gate changed from `ctx.role !== 'owner'` to `hasCapability(ctx.role, ctx.capabilities, 'manage_branding')`. (`requireScoreFinalization` unchanged — not a branding field.) |
| `app/api/admin/tournament-logo/route.ts` | POST + DELETE owner-only → `manage_branding` capability. |
| `app/api/admin/tournament-hero-banner/route.ts` | POST + DELETE owner-only → `manage_branding` capability. |
| `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` | Archive Tournament button: `userRole === 'owner'` → `hasCapability(..., 'create_tournaments')` — matches what the set-status API already enforces (admins could already archive via API; the button just hid it). |

### Companion security fix (billing was not actually owner-only)

The billing **page** hides controls from non-owners, but the **APIs had no server-side role check** (bare `getAuthContext()`), so any authenticated member could trigger Stripe via a direct request. Since "billing = owner-only" is policy, this was closed:

| File | Change |
|---|---|
| `app/api/billing/portal/route.ts` | Added `requireCapability(auth, 'billing')` (owner-only). |
| `app/api/billing/create-checkout/route.ts` | Added `requireCapability(auth, 'billing')` (owner-only). |

⚠️ **Verify in browser:** confirm the normal owner upgrade/checkout and "Manage billing" portal flows still work (incl. add-workspace and onboarding plan selection), since these routes now enforce the `billing` capability server-side.

Plan gating (Tournament Plus for advanced branding) is orthogonal and unchanged — it still applies to everyone.

---

## Audit provenance

Findings came from a multi-agent audit (49 agents) that mapped **95 authorization gates** across pages + API routes + nav, then adversarially verified the 45 consequential ones. The verification corrected several over-claims (e.g. the branding page↔API mismatch was real but narrower than first stated; the logo/banner routes agreed with the page rather than conflicting).

---

## Phase 2 — billing/ownership leaking to admin (BUILT 2026-06-09)

These let **admins** perform billing or ownership actions, contradicting the policy. Now fixed at both layers (API is the boundary; page mirrors it):

1. ✅ **`app/api/admin/org/team-links/route.ts`** (POST) — the single owner+admin gate fronted `invite_billing`/`approve_billing` (org-billed Premium → real Stripe checkout) and `invite_ownership`/ownership-transfer. Added an owner-reserved guard after action parsing: `invite_billing`/`approve_billing` require `hasCapability(ctx.role, ctx.capabilities, 'billing')`; `invite_ownership` requires `ctx.role === 'owner'`. Operational actions (target invite, `approve`/`decline` of a basic link, `decline_billing`, `decline_ownership`) stay owner+admin.
2. ✅ **`app/[orgSlug]/admin/org/coaches-portal-links/page.tsx`** — added `canManageBilling = hasCapability(userRole, userCapabilities, 'billing')` and `canTransferOwnership = userRole === 'owner'`; gated the Invite/Approve Billing buttons and the Invite/Approve Ownership buttons on those, leaving Decline buttons open to admins (mirrors the API).

## Deferred follow-ups (NOT built)

3. **Consistency (low priority):** org-level routes (`org-settings`, `org-logo`, `org-logo-stock`, `org-hero-banner`) gate on a raw `membership.role !== 'owner'` lookup that bypasses the capability system — they stay owner-only (per decision), but migrating them to `hasCapability(role, caps, 'org_settings')` would let per-member overrides actually work.
4. **Tournament public URL slug** (Event Settings) — page hides the field from admins, but the `action:'update'` API accepts it from anyone with `create_tournaments` (admins). Reconcile: either show the field to admins, or add a server-side owner check on the `slug` field.

---

## Verification notes

- `npm run typecheck`: all changed files type-clean. (One pre-existing error remains in the **untracked** `lib/observability/with-observability.ts`, unrelated to this work.)
- Shared module `lib/roles.ts` changed → **restart the dev server** before browser testing (`rm -rf .next && npm run dev` after stopping the server).
- Browser checks: (a) sign in as an **admin**, open a tournament's **Public Site** page — should render and save logo/banner/theme/public-page changes (subject to plan); (b) admin sees **Archive Tournament** on a completed event and it works; (c) **owner** billing upgrade + portal still work; (d) a **staff** member still cannot reach branding.

---

## Journey-audit inputs — J10 invited staff admin (2026-06-13, Phase 4)

The J10 checklist walk confirmed the parity **policy** is sound and the access-control gates largely hold for the `admin` role, but surfaced the *experience* gaps the build deferred. 8 findings route here (report = source of truth: [journeys/JOURNEY_J10_INVITED_STAFF_ADMIN.md](journeys/JOURNEY_J10_INVITED_STAFF_ADMIN.md); 0 refuted). The single theme: **the boundaries are real but never communicated**, and the walls are built from inconsistent materials.

**Experience gaps (deferred follow-ups):**
- **J10-015 (Med)** no day-one role orientation anywhere — `AdminChrome` has no first-session surface, no "you joined as an admin" banner, no role badge; the role descriptions exist (`members/page.tsx:82-91`) but are owner-only. Without orientation, a correctly-scoped sparse tile set is indistinguishable from a broken feature. Add a dismissible first-session "You're an admin of {org}" card reusing the role descriptions.
- **J10-013 (Low) + J10-016 (Low, the model)** owner-only walls use inconsistent styles: org-settings + audit are *hard walls* (hidden + Access Denied panel), billing is *read-only* (visible + disabled + explained), and the settings-hub "Plan & subscription — Owner only" **locked card** (visible + lock icon + meta label + prevented click, `settings/page.tsx:42-49`) is the one graceful boundary. Standardize on the locked card; retire the bare-AccessDenied and silent-403 variants.
- **J10-004 (Med, copy regression the Phase-1 work introduced)** the Role Guide matrix still marks "Org settings & branding" `admin:false`, but `manage_branding` is now admin-default — the matrix *understates* the grant (the inverse of J4-040's tooltip overstatement). Split the row: "Public Site branding" (admin:true) and "Org settings / subscription" (owner-only); keep the matrix in sync with ROLE_DEFAULTS.
- **J10-022 (Med, already noted in deferred item 3)** `org_settings` and `billing` appear as *grantable* in the override editor (`ACTION_CAP_KEYS`) but policy reserves them owner-only; some server checks honour a grant (`create-checkout`), others ignore it (raw `role==='owner'`) — false delegation confidence. Remove both from `ACTION_CAP_KEYS` so they never appear in the editor (any future billing delegation should be a deliberate, tested addition — the resolution direction differs from item 3's "migrate to hasCapability," which would *enable* delegation; pick one).
- **Invite/lifecycle correctness:** **J10-001 (High)** an existing multi-org user is 409-blocked from invite with a blame-shaped error — the platform's own coach-portal funnel creates exactly this multi-workspace human, so the one-org constraint fights the multi-workspace architecture; allow a second org membership (the model + `/home` already support it) or at minimum a non-blaming pre-send explanation. **J10-006 (High)** acceptance is *advisory* — `getAuthContext` excludes only `suspended`, so an `invited` member with a session reaches `/admin` before completing the accept form; gate the admin layout on `accepted_at`. **J10-011 (Med)** the accept-invite success redirect hardcodes `/{slug}/admin` instead of the destination resolver, landing a fresh admin one hop short of the J10-014 onboarding loop.

(J10's own in-report items — the ungated members API J10-002, the redirect loop J10-014, the failed-accept password trap J10-007/008, the league-role silent-403 J10-012 — stay in the report; the member-lifecycle visibility items J10-018/019/020 went to backlog. The Tournament-tier Audit Log 404 J10-003 + accept-invite shell J10-017 + scorekeeper title flash J10-010 route to USER_MANAGEMENT_TOURNAMENT_UX_PLAN.)
