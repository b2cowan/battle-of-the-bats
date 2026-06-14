# Platform-Admin Support Seam / Feedback Triage (F3) — Implementation Plan

> **Status:** Scoped 2026-06-13. **Priority: P1.** Spun out of the [Platform-Admin Employee Audit](../archive/platform-admin-audit/SYNTHESIS.md) Theme C.
> **Companion:** [PLATFORM_ADMIN_SUPPORT_SEAM_PM_BRIEF.md](PLATFORM_ADMIN_SUPPORT_SEAM_PM_BRIEF.md)
> **Branch:** feat/support-seam-feedback-triage (create from dev)
> **Verification standard:** all findings below were checked first-hand against route and component files during the audit; citations are first-hand.
> **Coordinate with:** F1 (API Hardening — `feedback/export` guard belongs there, not here); F2 (Least-Privilege UX Consistency — Retention + Org Detail silent dead-ends for support are owned by F2; Customer Users menu for product is F2).

---

## Problem

The support loop only closes if a product operator independently finds and acts on an issue. The people who actually talk to customers — the support role (`manage_support`) — can read every feedback item and every error group, but they cannot record a single action against them. The mutation routes for both surfaces gate on `manage_product`, not `manage_support`.

Even for product, who can close the loop, day-to-day friction accumulates: every shift starts with a mixed-status list requiring manual re-filter; the feedback→error-group link is one-directional (there is no reverse); there is no in-console path to hand work off to support or escalate an unresolvable item; and there is no way to notify the customer once the issue is resolved.

**Root cause (code-confirmed, first-hand):**

| File | Line | Current gate | What support needs |
|------|------|-------------|-------------------|
| `app/api/platform-admin/feedback/[id]/status/route.ts` | 19 | `requirePlatformPermission('manage_product')` | `manage_support` OR `manage_feedback` (see policy decision below) |
| `app/api/platform-admin/observability/[groupId]/status/route.ts` | 22 | `requirePlatformPermission('manage_product')` | separate decision — error-group triage may stay product-only |
| `app/platform-admin/feedback/page.tsx` | 116–117 | `readOnly=true` for support → static badge, no dropdown | write access for support on feedback status only |
| `app/platform-admin/feedback/page.tsx` | 133–166 | no default filter — all statuses shown | default to `status=new` |
| `app/platform-admin/observability/[groupId]/page.tsx` | 107–190 | no related-feedback back-link | reverse query by `requestId` |

---

## KEY POLICY DECISION — how to grant support feedback-status write

This is the single decision that controls the shape of every task below. Present both options to the owner before writing any code.

### Option A — Add `manage_support` to the existing feedback status route

**What it means:** `feedback/[id]/status/route.ts:19` changes from `requirePlatformPermission('manage_product')` to `requirePlatformPermission('manage_product', 'manage_support')` (either permission passes). The `observability` area in `lib/platform-areas.ts` also adds support to `writeRoles`, because the feedback page derives its `readOnly` flag from `isPlatformAreaReadOnly(role, 'observability')`.

**Trade-off:** Coupling feedback write to the `observability` area means support gains write-area membership in `observability`. In practice this only affects the feedback status route (the error-group status route remains product-only), but the area membership signal could be read elsewhere in the future. The coupling is implicit; a future developer may not realise that `observability.writeRoles` controls feedback mutation, not error-group mutation.

**When to choose this:** if the support and product feedback-triage workflows are considered the same capability (same actors, same data), and you are confident the area-membership model will not be used to gate other observability writes in the future.

### Option B — Introduce a dedicated `manage_feedback` permission (RECOMMENDED)

**What it means:** Add `manage_feedback` to the permission registry in `lib/platform-areas.ts` (or wherever permissions are defined). Create a new `feedback` area entry with `writeRoles: ['manage_support', 'manage_product']`. Gate `feedback/[id]/status/route.ts` on the new `feedback` area write check. Keep `observability/[groupId]/status/route.ts` gated on `manage_product` only — error-group triage stays product-only. Update `isPlatformAreaReadOnly` so support is write-capable for `feedback` but still read-only for `observability` error groups.

**Trade-off:** One additional permission enum value and one additional area entry. Slightly more code up front. Nav visibility for the "Feedback" link may need updating if it currently derives from the `observability` area (check `lib/platform-areas.ts` `feedback` nav entry).

**Why recommended:** This decouples feedback triage (support + product) from error-group triage (product only) at the permission layer, not just at the route layer. The model is explicit and survives future changes to either area. It also creates a natural extension point: if a future `feedback` area gets its own nav visibility, export guard, or page guard, the permission is already scoped correctly. F1 (API Hardening) already set the `observability` export guard to require `manage_product OR manage_support` — a dedicated `feedback` area would make that consistency declarative rather than hand-coded.

**Owner checkpoint:** decide Option A or B before any code is written. The task list below is written assuming Option B (recommended); items marked [B-only] would be simplified or dropped under Option A.

---

## Scope — what this project fixes

### In scope

1. **Permission fix (Blocker — PAS-001):** Grant support write access to feedback status. Implement via Option A or B per owner decision.
2. **Default actionable filter — Feedback (Medium — PAS-006 / PAP-004):** Default `status=new` when no filter is set. Shared fix; benefits both support and product on every shift.
3. **Default actionable filter — Observability (Medium — PAP-004):** Default `status=open` for the observability error-group list. Same pattern, same session.
4. **Reverse back-link: error group → related feedback (Medium — PAS-007 / PAP-005):** Add a "Related feedback" panel on the error group detail page (`app/platform-admin/observability/[groupId]/page.tsx`) that reverse-queries `feedback_submissions` by `context->>'requestId'` matching events in this group. Show count + link to Feedback list filtered by matching submissions.
5. **"No requestId" disambiguation (Medium — PAS-007):** On feedback rows where no `requestId` was captured (link is absent), show a "No related error captured" note so support knows to search manually by org/timestamp rather than assuming a broken link.
6. **Escalation / assignment affordance (High — PAS-005):** Add a "Flag for product" or "Escalate" action on the feedback item detail (and optionally the error group detail). Minimal viable version: a single API write that sets a `needs_product_review` flag on the feedback submission and writes an audit-log entry. Does not require a change-request; does not require a notification system. The flag should be visible on the feedback list (a badge or column indicator) so product can filter for escalated items.
7. **Feedback HelpCallout — view-only note for support (Low — PAS-012):** When `readOnly=true` for the support role, append "Status changes are available to support operators. Error group status changes require product access." (wording updated once option is chosen).
8. **Audit-log transparency note for product (Low — PAP-013):** Append "Status transitions are audit-logged with your email and timestamp" to the Feedback HelpCallout for write-capable roles.
9. **Optional — customer-notification affordance (exploratory):** No customer notification infrastructure exists today. If the owner wants to add this, the minimal version is a mailto link on the feedback item ("Notify customer") pre-populated with the submitter's email and a response template. This is a UX affordance only; it does not require a sending API. Mark as optional — do not block the above items on this.

### Out of scope

- Retention Queue and Org Detail silent dead-ends for support (PAS-002, PAS-003) — owned by **F2** (Least-Privilege UX Consistency).
- Customer Users Actions menu silently failing for product (PAP-003) — owned by **F2**.
- Delete User permission elevation (PAS-004) — owned by **F1** (API Hardening, owner decision #7).
- `feedback/export` and `observability/issues/export` API guards — owned by **F1** (already scoped to tasks #4 and #5 there).
- Help Hub SOP additions (PAS-008, PAP-010) — owned by **F4** (Operator SOPs + Day-One Orientation). The permission change here (Option B) should be documented in the support SOP, but writing the SOP is F4's task.
- Customer Users menu ordering (PAS-010) — owned by **F5** (operator polish backlog).
- Actions menu on Customer Users for support (already works correctly for support's `manage_support` write access; only the delete elevation question is open in F1).

---

## Task list

### Phase 0 — Owner decision (blocking) ✅ RESOLVED 2026-06-14

- [x] **Option B chosen** (dedicated capability boundary), realized via a **split `feedback` area** gated through the F1 `requirePlatformAreaApi` helper — no redundant `manage_feedback` permission enum, since area membership already expresses the capability and nothing reads a `hasPlatformPermission('manage_feedback')`. **Writers = super_admin + product + support + billing** (billing added per owner; both hold manage_support and do customer-facing work).

### Phase 1 — Permission fix (unblocks the rest) ✅ BUILT 2026-06-14 (dev-only, uncommitted; typecheck + lint clean)

- [x] Added `feedback` area to `lib/platform-areas.ts`: `viewRoles` & `writeRoles` = `['super_admin','product','support','billing']`. `observability` (error groups) unchanged (view super/product/support, write super/product).
- [x] Re-pointed the Feedback nav item (`PlatformAdminNav.tsx`) from `area: 'observability'` → `'feedback'` (so billing now sees Feedback; support stays a viewer and becomes a writer).
- [x] `feedback/[id]/status/route.ts` → `requirePlatformAreaApi('feedback', 'write')` (was `manage_product`). `observability/[groupId]/status` left product-only (error triage stays product).
- [x] `feedback/export/route.ts` → `requirePlatformAreaApi('feedback', 'view')` (was observability view) + comment updated (billing can now export feedback).
- [x] `feedback/page.tsx` → guard + `readOnly` derive from `'feedback'`; StatusControls dropdown now renders for support/billing; callout updated to write-capable guidance ("use the status dropdown… audit-logged… error groups need product access").
- [ ] **Browser smoke-test (owner):** support/billing can move feedback status; both still see disabled error-group triage in Observability. Restart dev server first (shared `lib/platform-areas.ts` changed).

### Phase 2 — Default actionable filters ✅ BUILT 2026-06-14 (dev-only, uncommitted; typecheck + lint clean)

- [x] `feedback/page.tsx` — defaults to `status=new` on a bare visit. Used an explicit **`all` token** for "show everything" (not empty string) so the filter survives `buildHref` (which omits empty params) — otherwise pagination on the All view would silently re-default to New. `getRows` treats `all` as no status filter; "All statuses" `<option value="all">`; Clear → `?status=all`.
- [x] `observability/page.tsx` — same pattern, defaults to `status=open`. `getErrorGroups` is called with `status` mapped `all → ''` (no shared-lib change); `params.status` stays the token for the dropdown/buildHref/export. `hasFilters` reworked so Clear shows whenever the view is narrower than All (incl. the default Open), and hides on the All view.
- [x] Verified: explicit `?status=all` (or any valid status) overrides the default; the default only applies when the `status` param is absent.

### Phase 3 — Reverse back-link (error group → related feedback)

- [ ] `app/platform-admin/observability/[groupId]/page.tsx` — add a "Related feedback" section. Query `feedback_submissions` where `context->>'requestId'` matches any `requestId` value found in this group's `error_events` (join via the group's event sample set or a direct requestId set). Show: count of related submissions, type badges (bug/feature/general), and a link to the Feedback list pre-filtered to those submissions.
- [ ] If the reverse query is expensive (table scan on JSONB context), add a functional index on `feedback_submissions((context->>'requestId'))` — check existing indexes in the dev snapshot before migrating.
- [ ] Add the "No related error captured" note on feedback list rows where `requestId` is absent — `app/platform-admin/feedback/page.tsx:208–212`. Use muted text: "No error event linked — search Observability by org slug and timeframe to correlate manually."

### Phase 4 — Escalation / assignment affordance

- [ ] **Data layer:** Check whether `feedback_submissions` already has a `needs_product_review` (or equivalent escalation flag) column. Check the dev DB snapshot (`docs/agents/db/` snapshot or `information_schema`) — do NOT infer from migration files.
  - If absent: write a migration adding `escalated_at TIMESTAMPTZ` and `escalated_by TEXT` (platform user email) nullable columns to `feedback_submissions`. Update `docs/agents/db/DATA_DICTIONARY.md` for both columns. Run `npm run refresh:snapshots` after applying dev migration.
- [ ] **API route:** Add `app/api/platform-admin/feedback/[id]/escalate/route.ts` — POST, gated on the `feedback` area write check (Option B) or `manage_support OR manage_product` (Option A). Sets `escalated_at = now()`, `escalated_by = auth.email`, writes an audit log entry (`escalate_feedback`, actor, feedback ID). Returns updated feedback row.
- [ ] **UI — feedback list:** Add an "Escalate" button (or action in a row actions menu) on the feedback list page for write-capable roles. Show an "Escalated" badge next to the status badge when `escalated_at` is non-null. Add an "Escalated" filter option to the status filter chip set.
- [ ] **UI — feedback detail / row expansion:** Also expose the Escalate action in the expanded row panel (`app/platform-admin/feedback/page.tsx:182–226`) so it is reachable without navigating to a separate page.
- [ ] No cross-role notification is required in the MVP. The badge + filter is sufficient for product to find escalated items. A future notification pass (F4 or Notifications plan) can build on the `escalated_at` field.

### Phase 5 — Callout and transparency copy

- [ ] `app/platform-admin/feedback/page.tsx:142–145` — update HelpCallout body to include a role-aware note:
  - For support (write-capable after Phase 1): "You can triage feedback items — use the status dropdown to move items from new to triaged, acknowledged, or resolved. Error group status changes require product access."
  - For read-only roles (if any exist with feedback view): "Status changes require support or product access."
- [ ] Append to the same HelpCallout for write-capable roles: "Status transitions are audit-logged with your email and timestamp." (PAP-013)

### Phase 6 — Optional: customer-notification affordance

- [ ] Evaluate whether a mailto link is acceptable UX for the owner. If yes, add a "Notify submitter" link on the feedback row expansion panel, rendered only when the submission has a `user_email` or `context.userEmail` value. Link format: `mailto:{email}?subject=Your+feedback+has+been+reviewed&body=...` with a pre-populated template. No sending API required.
- [ ] This phase is optional and can be deferred without blocking any other phase.

---

## Open decisions for owner

1. **Option A vs. Option B** (permission model — see above). **Blocking.** Recommend Option B.
2. **Escalation data model:** does `escalated_at` / `escalated_by` on `feedback_submissions` fit, or should escalation create a separate `feedback_escalations` join table (to support future multi-step escalation history)? For MVP, nullable columns on the main table are simpler; a join table is better if the owner anticipates a full escalation workflow.
3. **Observability error-group status — should support ever write it?** Currently product-only. The audit confirmed this is a deliberate scope split: support triages feedback, product triages error groups. Confirm this policy is intentional before closing Phase 1.
4. **Customer-notification affordance (Phase 6):** mailto link acceptable, or deferred entirely?

---

## Coordinate with

- **F1 (API Hardening):** `feedback/export` and `observability/issues/export` guards are scoped there. If F1 lands first and adds the `requirePlatformAreaApi` helper, use it in Phase 1 here rather than a hand-rolled check.
- **F2 (Least-Privilege UX Consistency):** Retention and Org Detail silent dead-ends for support are owned there. The Phase 1 permission fix here does not change any Retention or Org Detail behavior.
- **F4 (Operator SOPs):** Phase 1 here changes what support can do. The support SOP in `lib/help-content/platform-admin.tsx` (PAS-008) needs to describe the new feedback-triage workflow once this lands. F4 should wait for F3 Phase 1 to merge before writing that SOP section.
- **Data Dictionary:** any migration in Phase 4 must update `docs/agents/db/DATA_DICTIONARY.md` and trigger `npm run refresh:snapshots`.
