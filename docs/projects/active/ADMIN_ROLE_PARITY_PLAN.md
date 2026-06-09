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
