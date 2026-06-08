# Customer User Management Actions — Implementation Plan

> **Status:** Complete
> **Created:** 2026-05-29
> **Branch:** dev

## Goal

Extend the platform-admin Customer Users page with two new support actions: **Ban/Unban** (toggle a user's auth status between `active` and `banned`) and **Confirm Email** (manually verify an unconfirmed account). Both actions must be logged in `platform_audit_log`. The single "Reset" button in the actions cell is replaced with a contextual dropdown menu whose options vary by the user's current `authStatus`.

## PM Brief

**What it does:** Gives platform admins two new one-click tools on the Customer Users page — the ability to ban or unban any user account, and the ability to manually confirm an unverified email address without requiring the user to click a link.

**Why it matters:** Today, every ban or stuck-confirmation case requires direct Supabase dashboard access, which bypasses the audit log and requires elevated credentials. This brings those actions into the platform admin UI where they belong.

**Who benefits:** Platform admins with the `manage_support` permission (support, billing, super_admin roles). No org-level users are affected.

**Expected impact:** Support staff can ban a bad actor or unblock a stuck user in under 30 seconds without leaving the platform admin UI.

**Priority:** High — these are the two most common support escalations.

**Success criteria:** All three new actions work, update the user's status on screen, and appear in the audit log.

---

## Phases

### Phase 1 — API Routes

- [ ] Create `app/api/platform-admin/users/[id]/ban/route.ts`
  - `POST` handler, requires `manage_support` permission
  - Body: `{ action: 'ban' | 'unban' }`
  - Ban: `supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '87600h' })`
  - Unban: `supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' })`
  - Audit log: `ban_user` or `unban_user` action, field `user_id`, new_value = target user's email
- [ ] Create `app/api/platform-admin/users/[id]/confirm-email/route.ts`
  - `POST` handler, requires `manage_support` permission
  - Calls `supabaseAdmin.auth.admin.updateUserById(id, { email_confirm: true })`
  - Audit log: `confirm_email` action, field `user_id`, new_value = target user's email

### Phase 2 — UI: Actions Dropdown + Confirmation Modal

- [ ] Update `app/platform-admin/customer-users/CustomerUsersClient.tsx`
  - Add `useRouter` from `next/navigation` for `router.refresh()` after successful actions
  - Add `openMenuId` state (`string | null`) to track which row has its dropdown open
  - Add `confirmModal` state for ban/unban: `{ userId: string; email: string; action: 'ban' | 'unban' } | null`
  - Replace the single Reset `<button>` in the actions cell with a dropdown trigger + popover menu
  - Dropdown options vary by `row.authStatus`:
    - `active`: "Reset Password", "Ban User" (destructive, opens confirm modal)
    - `banned`: "Unban User" (opens confirm modal), "Reset Password"
    - `unconfirmed`: "Confirm Email" (fires immediately, no modal), "Reset Password"
  - `handleBanToggle(action, userId, email)` — POST to `/api/platform-admin/users/{id}/ban`, then `router.refresh()`
  - `handleConfirmEmail(userId, email)` — POST to `/api/platform-admin/users/{id}/confirm-email`, then `router.refresh()`
  - Confirmation modal (inline, no separate component needed): "Ban [email]?" with a confirm + cancel button
  - Close dropdown on outside click (attach a `useEffect` with a `mousedown` listener)
- [ ] Update `app/platform-admin/customer-users/customer-users.module.css`
  - Add styles for: `.actionsMenu` (dropdown wrapper), `.menuBtn` (trigger), `.menuList` (popover), `.menuItem`, `.menuItemDanger`, `.menuDivider`
  - Modal overlay/dialog reuses existing `.modal*` patterns from admin-common if available, otherwise add minimal styles

---

### Phase 3 — Edit User Info

- [x] Create `app/api/platform-admin/users/[id]/update/route.ts`
  - `PATCH` handler, requires `manage_support`
  - Body: `{ email?, displayName?, currentEmail? }`
  - `updateUserById` with `email_confirm: true` when email changes; `user_metadata: { display_name }` for name
  - Audit log: `update_user`

### Phase 4 — Revoke Sessions + Delete User

- [x] Create `app/api/platform-admin/users/[id]/revoke-sessions/route.ts`
  - `POST` handler — calls GoTrue `DELETE /auth/v1/admin/users/{id}/sessions` directly via fetch
  - Audit log: `revoke_sessions`
- [x] Create `app/api/platform-admin/users/[id]/delete/route.ts`
  - `DELETE` handler — calls `supabaseAdmin.auth.admin.deleteUser(id)`
  - Audit log: `delete_user`
  - UI requires typing the user's email to confirm (hard delete gate)

### Phase 5 — Support Notes

- [x] Migration 103: `platform_user_notes` table (`id`, `user_id → auth.users CASCADE`, `body`, `created_by_email`, `created_at`)
- [x] Create `app/api/platform-admin/users/[id]/notes/route.ts` — GET (list) + POST (create)
- [x] Create `app/api/platform-admin/users/[id]/notes/[noteId]/route.ts` — DELETE

### Phase 6 — UI: Extended Actions Dropdown + New Modals

- [x] Update `app/platform-admin/customer-users/CustomerUsersClient.tsx`
  - Notes modal: list + add + delete; loaded lazily on open
  - Edit Info modal: email + display name inputs; `router.refresh()` on save
  - Revoke Sessions: reuses `confirmModal` pattern (action: `'revoke-sessions'`)
  - Delete User modal: type email to confirm gate; `router.refresh()` on success
  - Actions dropdown expanded: Notes / Edit Info / Reset Password / [Confirm Email if unconfirmed] / Revoke Sessions / Ban|Unban / Delete User
- [x] Update `customer-users.module.css` — form fields, notes list, wide modal variant

### Deferred — Session / Login History

Not implemented. Supabase's admin API only exposes `last_sign_in_at`; a full login history requires a custom GoTrue trigger or webhook, which is out of scope.

## Architectural Decisions

- **Route param is `[id]`** (not `[userId]`) — matches the existing `reset` route at `users/[id]/reset/route.ts`.
- **Ban duration `87600h`** (10 years) is used as a permanent ban. Supabase does not expose a "permanent" flag; a distant future date is the recommended pattern. The `authStatusFor()` helper in `page.tsx` already checks `banned_until > now`, so this works correctly.
- **No separate modal component** — the confirmation dialog is rendered inline in `CustomerUsersClient.tsx` as a conditional overlay. It's a one-off pattern and doesn't warrant a shared component.
- **`router.refresh()` over optimistic updates** — the `authStatus` is derived server-side from the Supabase auth user object. Client-side optimistic update would require duplicating that derivation logic. A server refresh is cleaner and guarantees accuracy.
- **Permission level: `manage_support`** — consistent with the existing reset route. Billing and super_admin roles inherit this permission automatically via `ROLE_PERMISSIONS` in `platform-auth.ts`.

## Open Questions

- [ ] Should banned users receive an automated email notification? (Deferred — no email infrastructure decision yet for punitive actions.)
- [ ] Should there be a "reason" field on bans stored in the audit log? (Nice-to-have; can be added to the confirm modal in a future pass.)
