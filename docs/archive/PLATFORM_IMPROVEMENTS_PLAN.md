> **DEPRECATED** — Superseded by [PLATFORM_ROADMAP.md](../../PLATFORM_ROADMAP.md). Phases 1–3 complete; Phase 4 items reconciled in the roadmap. This file is retained for historical context only.

# Platform Improvements Plan

Covers five investigation areas from the May 2026 platform audit. Each section has current state, gaps, implementation tasks, and any business decisions that must be resolved before implementation.

Reference files: `app/api/admin/members/invite/route.ts`, `app/api/admin/members/[memberId]/route.ts`, `app/[orgSlug]/admin/members/page.tsx`, `app/auth/login/page.tsx`, `app/auth/signup/page.tsx`, `lib/api-auth.ts`, `lib/roles.ts`, `lib/plan-config.ts`, `supabase/migrations/001_multi_tenant.sql`, `supabase/migrations/008_role_capabilities_and_tournament_assignments.sql`

---

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked on business decision (see decision table at bottom)

---

## Area 1 — Forgot Password / Password Reset

**Current state:** No "Forgot Password" link on the login page. No reset-flow pages exist. All invited users have passwords (set on first invite-link click). Officials who never clicked their invite have a Supabase auth account with no password set.

### Tasks

- [x] **1.1** Add "Forgot your password?" link to login form  
  File: `app/auth/login/page.tsx`  
  Position: below the password field, above the submit button. Link to `/auth/forgot-password`.

- [x] **1.2** Create Forgot Password page  
  File: `app/auth/forgot-password/page.tsx` (new)  
  - Single email field
  - On submit: call `supabase.auth.resetPasswordForEmail(email, { redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/auth/reset-password' })`
  - Always show "Check your email" — never reveal whether the account exists
  - Add link back to `/auth/login`

- [x] **1.3** Create Reset Password page  
  File: `app/auth/reset-password/page.tsx` (new)  
  - Listen for `PASSWORD_RECOVERY` event via `supabase.auth.onAuthStateChange`
  - Present new-password input (min 8 chars, show/hide toggle — match existing auth styles in `app/auth/auth.module.css`)
  - On submit: call `supabase.auth.updateUser({ password: newPassword })`
  - On success: redirect to `/admin` (middleware handles org-aware routing)
  - On error: show inline error, allow retry
  - Handle case where user arrives without a valid token (show "This link has expired, request a new one" with link to forgot-password page)

- [x] **1.4** Verify Supabase "Reset Password" email template is configured  
  In Supabase dashboard → Auth → Email Templates → Reset Password. Confirm the template exists and the redirect URL domain (`fieldlogichq.ca`) is in the allowed redirect URLs list (Auth → URL Configuration → Redirect URLs).

**Note on officials:** The reset email flow works identically for officials. After reset, the generic `/admin` redirect will show them the access-denied view for admin sections — acceptable friction for a rare event. A role-aware redirect (to `/{orgSlug}/official`) requires knowing the user's org/role after reset, which is possible by checking `organization_members` after the session is established, but adds complexity. Defer this unless officials report confusion. [Business decision: see D-1]

---

## Area 2 — Org-Centric User Lifecycle and Functional-Area Access

**Current state:** 4 roles (`owner/admin/staff/official`), 13 capabilities all tournament-scoped. No module-level gating. No `suspended` state. No onboarding flow post-signup.

### 2A — Module-Level Access Model (additive, no schema change)

- [ ] **2A.1** Add `module_*` capabilities to `lib/roles.ts`  
  Add to the `Capability` union type:
  ```ts
  | 'module_tournaments'
  | 'module_accounting'
  | 'module_public_site'
  | 'module_communications'
  | 'module_members'
  ```
  Add to `ROLE_DEFAULTS`:
  - `owner`: all module capabilities
  - `admin`: `module_tournaments`, `module_communications`, `module_members`
  - `staff`: `module_tournaments`
  - `official`: none

- [ ] **2A.2** Add `module_*` capabilities to `CAPABILITY_LABELS` in `app/[orgSlug]/admin/members/page.tsx`  
  So they appear in the capability override editor with human-readable labels. Group them visually above the action capabilities in the override UI (add a section header row to the cap table).

- [ ] **2A.3** Gate new module route handlers with `requireCapability(ctx, 'module_accounting')` etc.  
  Implement when each new module (accounting, public site, etc.) is built. No changes needed now — this is the pattern to follow.

- [ ] **2A.4** Hide sidebar items for modules the user cannot access  
  When new sidebar sections are added for new modules, check the user's capabilities before rendering the nav item. Use the existing `useOrg()` context plus a capability check helper on the client side.

### 2B — User Suspension

- [x] **2B.1** Migration: add `status` column to `organization_members`  
  New file: `supabase/migrations/010_member_status.sql`
  ```sql
  ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended'));

  -- Backfill: existing rows with no accepted_at are 'invited', rest are 'active'
  UPDATE organization_members SET status = 'invited' WHERE accepted_at IS NULL;
  ```

- [x] **2B.2** Update invite route to set `status = 'invited'` on new pending rows  
  File: `app/api/admin/members/invite/route.ts` line ~117  
  Add `status: 'invited'` to the insert for new users; add `status: 'active'` to the existing-user insert.

- [x] **2B.3** Update `getAuthContext()` to reject suspended members  
  File: `lib/api-auth.ts`  
  In the `organization_members` query, add `.neq('status', 'suspended')` so suspended users get a null auth context and all API routes naturally return 401.

- [x] **2B.4** Add suspend/reinstate PATCH action to `app/api/admin/members/[memberId]/route.ts`  
  Accept `{ status: 'suspended' | 'active' }` in the PATCH body alongside role/capabilities. Owner-only. Cannot suspend the last owner.

- [x] **2B.5** Add suspend/reinstate UI to members page  
  Replace the remove button with a dropdown or context menu per member row: `Suspend | Reinstate | Remove`. Show "Suspended" status badge alongside "Pending / Accepted". Suspended members appear in a distinct row style (muted, strikethrough email, or greyed-out badge).

- [x] **2B.6** Update `Member` interface in `page.tsx` to include `status: string`  
  Update `/api/admin/members` GET route to return the new status field.

### 2C — Self-Serve Onboarding

[! Business decision D-2 and D-3 must be resolved first]

- [x] **2C.1** Add `onboarding_completed_at` column to `organizations`  
  New migration file: `supabase/migrations/011_org_onboarding.sql`
  ```sql
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
  ```

- [x] **2C.2** Create onboarding page  
  File: `app/[orgSlug]/admin/onboarding/page.tsx` (new)  
  Three-step checklist:
  1. "Choose your plan" — link to billing page; check complete if planId != 'starter' OR owner has explicitly clicked "Continue on free plan" (stored as a separate flag or treated as complete after viewing)
  2. "Invite a team member" — check complete if org has > 1 member
  3. "Create your first tournament" — check complete if org has >= 1 tournament
  Each item shows a CTA button and a green checkmark when complete. A "Skip setup" link at the bottom sets `onboarding_completed_at` without completing steps. Page is owner-only.

- [x] **2C.3** Redirect new signups to onboarding  
  File: `app/auth/signup/page.tsx` and/or `app/api/auth/signup/route.ts`  
  After successful signup + auto-sign-in, redirect to `/${orgSlug}/admin/onboarding` instead of `/admin`.

- [x] **2C.4** Skip onboarding for returning owners  
  In the onboarding page, if `org.onboarding_completed_at` is not null, redirect to `/admin` immediately.

- [x] **2C.5** Update `Organization` type and `org-context.tsx` to expose `onboardingCompletedAt`

---

## Area 3 — Invite and Re-Invite Flow

**Current state:** Existing-platform users are fast-added with no email notification. No re-invite mechanism for expired pending invites. Officials have no dashboard. Invite email still says "Battle of the Bats" (live bug).

### Tasks

- [x] **3.1** Fix invite email branding bug (trivial, do first)  
  File: `app/api/admin/members/invite/route.ts`  
  - Line ~139: change `on Battle of the Bats` → `on FieldLogicHQ` in subject
  - Line ~144 (html): same fix in `<strong>` tag
  - Line ~158 (plain text): same fix

- [x] **3.2** Send notification email when adding existing-platform users  
  File: `app/api/admin/members/invite/route.ts`, path B (the `existingUser` branch, ~line 77–92)  
  After the insert succeeds, send a Resend email:
  - Subject: `You've been added to ${org.name} on FieldLogicHQ`
  - Body: informs the user they now have access, includes a sign-in link (`${appUrl}/auth/login`), no action required
  - Use the same Resend pattern already in the file (getResend().emails.send)
  - Use `RESEND_FROM` env var for the from address (not derived from appUrl — see email stack memory)

- [x] **3.3** Add re-invite endpoint  
  File: `app/api/admin/members/[memberId]/reinvite/route.ts` (new) — POST handler  
  - Auth: `requireCapability(ctx, 'manage_members')`
  - Fetch target member; reject if `accepted_at IS NOT NULL` (already accepted)
  - Call `generateLink({ type: 'invite', email: target.email, options: { redirectTo: ... } })`
  - Update `invited_at = now()` on the member row
  - Send invite email (same template as original invite)
  - Return `{ ok: true }`

- [x] **3.4** Add "Resend Invite" button to pending members in Members page  
  File: `app/[orgSlug]/admin/members/page.tsx`  
  For members where `acceptedAt === null`, show "Resend Invite" button alongside the remove button. Calls the new reinvite endpoint. Show success/error via existing FeedbackModal pattern.

- [x] **3.5** Create officials overview page  
  File: `app/[orgSlug]/official/page.tsx` (new)  
  - Authenticated, official-role only (redirect to login if not authenticated)
  - Shows: org name, list of assigned tournaments (from `org_member_tournament_assignments`), "Open Scorekeeper" button per tournament linking to `/{orgSlug}/official/score`
  - If no assignments, show all active tournaments for the org
  - Minimal layout (not the full admin shell) — can reuse the existing scorekeeper page layout
  - Change the invite `redirectTo` for officials from `/{orgSlug}/official/score` to `/{orgSlug}/official` so they land here first

- [x] **3.6** Create invite acceptance page  
  File: `app/auth/accept-invite/page.tsx` (new)  
  New users who click an invite link must set a password before accessing their org. This page is the `redirectTo` destination for all invite links.  
  - Reads `org` query param (the org slug, passed by the invite route)  
  - Detects the Supabase session established by the invite token via `onAuthStateChange` (`SIGNED_IN` event)  
  - Shows a password creation form (min 8 chars, show/hide toggle, matches `app/auth/auth.module.css` styles)  
  - On submit: `supabase.auth.updateUser({ password })`, then POST to `/api/auth/accept-invite`  
  - On success: role-aware redirect — admin/staff/owner → `/${orgSlug}/admin`; official → `/${orgSlug}/official/score` (update to `/${orgSlug}/official` once 3.5 is built)  
  - Handles expired/missing token: show "This invite link has expired. Contact your organization admin." with a link to `/auth/login`  
  - Note: a Supabase auth callback route (`app/auth/callback/route.ts`) may be required to exchange the PKCE code before `onAuthStateChange` fires — investigate during implementation

- [x] **3.7** Add `/api/auth/accept-invite` POST endpoint  
  File: `app/api/auth/accept-invite/route.ts` (new)  
  - Uses the session cookie (anon client) to identify the calling user  
  - Finds their pending `organization_members` row (`accepted_at IS NULL`) using `supabaseAdmin`  
  - Sets `accepted_at = now()`  
  - Returns `{ ok: true, orgSlug: string, role: string }` so the client can perform the role-aware redirect  
  - Returns 404 if no pending row found (already accepted, or not a member)

- [x] **3.8** Update `redirectTo` in invite and reinvite routes  
  Files: `app/api/admin/members/invite/route.ts`, `app/api/admin/members/[memberId]/reinvite/route.ts`  
  Change all `redirectTo` values from `${appUrl}/${org.slug}/admin` and `${appUrl}/${org.slug}/official/score` to `${appUrl}/auth/accept-invite?org=${org.slug}` so every new invitee lands on the password-setup page regardless of role. Role-aware final routing is handled by the accept-invite page after password creation.

- [x] **3.9** Fix invite link redirecting to home page instead of accept-invite page  
  **Root cause (two issues):**  
  1. `https://www.fieldlogichq.ca/auth/accept-invite` is not in Supabase Auth → URL Configuration → Redirect URLs allowlist. When an unlisted URL is used as `redirectTo`, Supabase silently falls back to the configured Site URL (the home page). Fix: add the path to the allowlist in the Supabase dashboard.  
  2. No PKCE callback route exists (`app/auth/callback/route.ts`). With Next.js App Router + `@supabase/ssr`, the recommended practice is a server-side `/auth/callback` route that calls `supabase.auth.exchangeCodeForSession(code)` and then redirects to the final destination, rather than relying on the browser client to auto-exchange the code.  
  **Fix:**  
  - Add `https://www.fieldlogichq.ca/auth/accept-invite` (and a dev wildcard if a dev environment is configured) to Supabase dashboard → Auth → Redirect URLs.  
  - Create `app/auth/callback/route.ts` — GET handler that reads `code` from searchParams, calls `supabase.auth.exchangeCodeForSession(code)`, and redirects to `next` query param (defaulting to `/auth/accept-invite`).  
  - Update `redirectTo` in the invite and reinvite routes to route through the callback: `${appUrl}/auth/callback?next=/auth/accept-invite?org=${org.slug}` — this ensures the PKCE code is exchanged server-side before the client page renders.

---

## Area 4 — Officials and Seat Limits

**Current state:** All members including officials count toward seat limits on all plans. On Pro (5 seats) an org with 4 staff + 3 officials is blocked from adding more staff.

### Tasks

- [x] **4.1** Add `officialsFreeSeats` flag to plan config  
  File: `lib/plan-config.ts`  
  Add to `PlanConfig` interface:
  ```ts
  officialsFreeSeats: boolean;
  ```
  Set values:
  - `starter`: `false` (officials count on free tier)
  - `pro`: `true`
  - `elite`: `true`

- [x] **4.2** Update seat count query in invite route  
  File: `app/api/admin/members/invite/route.ts`  
  Replace the current blanket seat count (~line 24–35) with:
  ```ts
  const planCfg = PLAN_CONFIG[org.planId];
  let seatQuery = supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id);
  if (planCfg.officialsFreeSeats) {
    seatQuery = seatQuery.neq('role', 'official');
  }
  const { count: seatCount } = await seatQuery;
  ```
  Additionally: when the incoming `role === 'official'` and `planCfg.officialsFreeSeats === true`, skip the seat limit check entirely (officials are free, no cap).

- [x] **4.3** Update seat count display in Members page  
  File: `app/[orgSlug]/admin/members/page.tsx`  
  Update the `seatCount` and `atLimit` calculations:
  ```ts
  const planCfg = PLAN_CONFIG[currentOrg.planId];
  const billableMembers = planCfg.officialsFreeSeats
    ? members.filter(m => m.role !== 'official')
    : members;
  const seatCount = billableMembers.length;
  const atLimit = seatCount >= seatLimit;
  ```
  Update the seat banner copy for Pro/Elite to show:
  `X of Y staff seats used · N officials (free on this plan)`

- [x] **4.4** Update "Invite Member" button disabled logic  
  File: `app/[orgSlug]/admin/members/page.tsx`  
  The button is currently `disabled={atLimit}`. On Pro/Elite, it should never be disabled when inviting an official. Either: (a) remove `disabled` from the button and move the limit check to the invite submit handler (where you can inspect the selected role), or (b) split into two conditions. Option (a) is cleaner.

- [x] **4.5** Add seat usage meter to Billing page  
  File: `app/[orgSlug]/admin/billing/page.tsx`  
  Add a second usage card below the tournament meter, showing seat usage (with the same official-exclusion logic). Fetch member count from `/api/admin/members` or add a new lightweight `/api/admin/members/count` endpoint that returns `{ billed: number, officials: number, limit: number }`.

---

## Area 5 — General UX and Business Model Enhancements

### 5A — `listUsers` Scalability Fix

- [x] **5A.1** Replace `listUsers` with `getUserByEmail` in invite route  
  File: `app/api/admin/members/invite/route.ts`  
  Replace the current ~line 47–48 (listing 1000 users, filtering in memory) with:
  ```ts
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  // Replace with:
  const { data: { user: existingUser } } = await supabaseAdmin.auth.admin.getUserByEmail(email);
  ```
  Note: Verify `getUserByEmail` is available in the Supabase JS admin client version in use. If not, use `listUsers` with a targeted filter if available, or keep current approach with a comment raising the page limit and adding pagination.

### 5B — Ownership Transfer

[! Business decision D-4 must be resolved first]

- [ ] **5B.1** Add "Transfer Ownership" action to Org Settings page (owner-only)  
  - Dropdown to select a current admin as the new owner
  - Confirmation modal with consequences explained
  - API: new POST `/api/admin/org/transfer-ownership` — promotes target to `owner`, demotes caller to `admin`. Guards: target must be an existing member, caller must be current owner, cannot transfer to self.

### 5C — Audit Log

- [x] **5C.1** Migration: create `org_audit_log` table  
  File: `supabase/migrations/012_audit_log.sql`
  ```sql
  CREATE TABLE IF NOT EXISTS org_audit_log (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id   uuid,         -- null for system actions
    target_id  uuid,         -- affected user_id (if applicable)
    action     text NOT NULL, -- 'member_invited' | 'member_removed' | 'role_changed' | 'capabilities_changed' | 'member_suspended' | 'member_reinstated'
    payload    jsonb,        -- { before, after } or relevant context
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_org ON org_audit_log(org_id, created_at DESC);
  ```

- [x] **5C.2** Append audit rows in invite route  
  After successful insert in both path A and path B, insert to `org_audit_log`.

- [x] **5C.3** Append audit rows in `[memberId]/route.ts` DELETE and PATCH handlers

- [x] **5C.4** Admin audit log view  
  A read-only table at `/[orgSlug]/admin/members/audit` showing recent member changes for the org. Owner-only. Paginated (25/page). Actor/target email resolution with deleted-user fallback.

### 5D — Pending Invites and Seat Limits

[! Business decision D-5 must be resolved first]

- [ ] **5D.1** (If D-5 resolves to "pending don't count") Update seat count query to add `WHERE accepted_at IS NOT NULL` in both the invite route check and the Members page count.

### 5E — Display Names

- [x] **5E.1** Migration: add `display_name` to `organization_members`  
  File: new migration
  ```sql
  ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS display_name text;
  ```

- [x] **5E.2** Surface `display_name` in the members list — show as primary identifier when set, email as secondary. Allow owner/admin to edit inline.

- [x] **5E.3** Capture display name during invite acceptance — Supabase invite flow can pre-populate `user_metadata.full_name` if passed via `generateLink` options, or collect it on the reset/accept page.

### 5F — Upgrade Prompts at 80% Usage

- [x] **5F.1** Add 80% seat nudge to Members page  
  File: `app/[orgSlug]/admin/members/page.tsx`  
  When `seatCount / seatLimit >= 0.8` and not yet at limit, show a subtle amber info banner below the seat banner: "You're using X of Y seats. [Upgrade to add more →]". Link to billing page.

### 5G — Org Offboarding

[! Business decision D-6 must be resolved first]

- [x] **5G.1** (Minimal path) Add "Request Account Deletion" to Org Settings  
  A form that sends an email to the platform support address. No automated deletion. Satisfies the user expectation that a path exists, even if manual.

- [ ] **5G.2** (Full path, deferred) Automated org deletion  
  Owner-initiated: cancel Stripe subscription → soft-delete org (set `deleted_at`) → queue auth user deletions → send confirmation email. Requires careful sequencing and is a significant engineering effort.

---

## Area 6 — Members Page UX Cleanup

**Current state:** The member table row contains a role dropdown, capability override button, tournament assignment button, resend invite button, and remove button — all inline. This is visually cluttered and scales poorly as more actions are added.

### Tasks

- [x] **6.1** Simplify members table columns  
  File: `app/[orgSlug]/admin/members/page.tsx`  
  Reduce the table to four data columns: **Email**, **Role** (badge only, no dropdown), **Status**, **Last Sign In**. Add a single **Manage** button (or kebab/three-dot icon) at the end of each non-owner row. Remove the Tournaments column from the table view entirely.

- [x] **6.2** Create consolidated "Manage Member" modal  
  File: `app/[orgSlug]/admin/members/page.tsx` (same file — new modal state)  
  Triggered by the Manage button. A wider modal (`styles.modalWide`) with clearly separated sections:  
  - **Role** — dropdown to change role (current inline dropdown behavior, moved here)  
  - **Tournament Access** — assignment checkboxes (current separate assignment modal, merged in)  
  - **Capability Overrides** — override editor (current cap override modal, merged in; owner-only section, hidden for admins)  
  - **Actions** — "Resend Invite" button if `acceptedAt === null`; "Remove Member" button with inline confirmation step  
  Single Save button at the footer that commits role + assignment changes together; capability overrides and remove remain separate actions within the modal (to preserve granularity and avoid accidental bulk saves).

---

## Business Decisions Required

| ID | Decision | Status | Resolution |
|----|----------|--------|------------|
| D-1 | After password reset, redirect officials to generic `/admin` or role-aware `/{orgSlug}/official`? | ✅ Resolved | Role-aware redirect. Create `/api/auth/me` GET endpoint, update reset-password page to call it post-reset. |
| D-2 | Plan selection step during signup, or always start on Starter? | ✅ Resolved | Always Starter. Onboarding Step 1 is informational ("You're on Starter — Upgrade →"), not a picker. |
| D-3 | Track onboarding completion in DB or localStorage? | ✅ Resolved | DB column (`onboarding_completed_at` on `organizations`). Migration 011. |
| D-4 | Ownership transfer: self-serve or support-only? | ✅ Resolved | Support-only. Current "contact support" note in Role Guide stands. 5B.1 deferred. |
| D-5 | Do pending (not yet accepted) invites count toward seat limit? | ✅ Resolved | Yes — keep current behavior. 5D.1 is a no-op. |
| D-6 | Self-serve automated org deletion or manual support-process? | ✅ Resolved | Manual. "Request Account Deletion" form in Org Settings sends email to `fieldlogichq@gmail.com`. |

---

## Suggested Implementation Order

Group by effort and dependency:

**Phase 1 — Quick wins (no decisions needed)**
1. 3.1 — Fix "Battle of the Bats" branding in invite email
2. 5A.1 — Replace `listUsers` with `getUserByEmail`
3. 1.1 + 1.2 + 1.3 + 1.4 — Full forgot/reset password flow
4. 4.1 + 4.2 + 4.3 + 4.4 — Officials excluded from seat limits
5. 3.2 — Notification email for existing-user fast-add
6. 3.3 + 3.4 — Re-invite endpoint + UI

**Phase 2 — UX fixes and member lifecycle**
7. 3.6 + 3.7 + 3.8 — Invite acceptance page + accept-invite API + redirectTo update (fixes pending-state bug and missing password-setup step)
8. 6.1 + 6.2 — Members page table cleanup + consolidated Manage modal
9. 2B.1–2B.6 — Suspension state (migration + API + UI)
10. 3.5 — Officials overview page
11. 4.5 — Seat meter on billing page
12. 5F.1 — 80% upgrade nudge

**Phase 3 — Structural (requires decisions)**
11. 2A.1–2A.4 — Module-level capabilities (implement when first new module is built)
12. 2C.1–2C.5 — Onboarding flow (after D-2 + D-3 decisions)
13. 5C.1–5C.3 — Audit log
14. 5E.1–5E.3 — Display names

**Phase 4 — Deferred / decision-gated**
15. 5B.1 — Ownership transfer (after D-4)
16. 5D.1 — Pending invite seat exclusion (after D-5)
17. 5G — Org offboarding (after D-6)
