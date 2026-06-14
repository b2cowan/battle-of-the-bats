# Platform-Admin Employee Audit — Cross-Role Synthesis

> Built 2026-06-13 from the six role reports (PA1–PA6) + Stage-A matrix. Evaluation only — no product code changed. The High/Blocker **bug** findings were verified directly against the route files (stronger than subagent re-derivation); citations below are first-hand.
> **Companion reports:** [PA1 super_admin](ROLE_PA1_SUPER_ADMIN.md) · [PA2 support](ROLE_PA2_SUPPORT.md) · [PA3 billing](ROLE_PA3_BILLING.md) · [PA4 product](ROLE_PA4_PRODUCT.md) · [PA5 growth](ROLE_PA5_GROWTH.md) · [PA6 read_only](ROLE_PA6_READ_ONLY.md) · [Stage-A matrix](STAGE_A_ROLE_AREA_MATRIX.md)

## 1. Executive answer to the owner's four questions

- **Navigability:** Good. The role-gated nav (H4, 2026-06-04) genuinely works — every role's sidebar drops what it can't view and eye-marks view-only areas. The IA is logical. This is the console's strongest dimension.
- **Day-one learnability:** **Failing for every role.** All six day-one verdicts came back **No** (billing borderline). Not because the tool lacks capability — because two systemic problems make a new hire unable to trust what they see: (1) **silent role-gated dead-ends** (controls render enabled, then the API 403s with no explanation — "not allowed" is indistinguishable from "broken"), and (2) **zero SOP coverage on the newest, highest-value surfaces** (feedback, observability, change-requests, email templates, email, early access).
- **Set-up-for-success:** Partial. Permissions are *enforced* but not *communicated* — the gold-standard "View-only for your role" note (observability StatusControls) exists in exactly one place and isn't applied anywhere else. SOPs cover the old account-management surfaces well and the new ones not at all.
- **Per-role fit:** Each role's *core* job is doable; the *full* job is not without tribal knowledge. Two roles have a Blocker (support can't triage feedback; read-only sees a fully-interactive Customer Users that 403s on every click).

**The headline:** today, **no platform role can be fully productive on day one from the screens alone.** The fixes are mostly cheap (guard + message + SOP), and one cluster is a real security issue that should be fast-tracked.

## 2. Per-role verdict board

| Role | Findings (Blk·H·M·L) | Day-one | Support-seam | Signature issue |
|------|:---:|:---:|:---:|-----------------|
| PA1 super_admin | 14 (0·2·5·7) | No (borderline) | n/a | Two guard holes + no orientation for the newest surfaces |
| **PA2 support** ⭐ | 12 (1·3·5·3) | **No** | **NO — cannot close loop** | Feedback status write requires `manage_product`; support has only `manage_support` |
| PA3 billing | 12 (0·3·5·4) | No (core: yes) | n/a | Change-Requests buttons 403 silently; no expired-overrides queue |
| PA4 product | 11 (0·3·5·3) | No | **YES — can close loop (with friction)** | Broadest role, almost zero SOPs; Customer Users actions 403 |
| PA5 growth | 11 (0·3·5·3) | No | n/a | Email blast + lead export reachable by any role via API; no growth SOPs |
| PA6 read_only | 8 (1·2·3·2) | No | n/a | Full Customer Users Actions menu renders + 403s on every action |
| **Total** | **68 (2·16·28·22)** | **0 / 6 pass** | support NO / product YES | — |

## 3. Cross-cutting themes (deduped across roles)

### THEME A — API guard gap ⚠️ SECURITY (verified first-hand) → FAST-TRACK
Pages are correctly guarded, but **several API routes gate only on "is there a platform session," not on the role's permission.** Any logged-in platform employee of *any* role (e.g. a growth contractor or a read-only auditor) can hit them directly. Verified against the route files:

| Route | Guard found | Effect | Source |
|-------|-------------|--------|--------|
| `email-templates/[key]` GET + PUT | `getPlatformAuthContext()` (session-only) | **Any role can read AND overwrite production transactional email copy** | `app/api/platform-admin/email-templates/[key]/route.ts:9,25` |
| `email-templates/[key]` page | none | Editor reachable by direct URL (PF-1) | `app/platform-admin/email-templates/[key]/page.tsx` |
| `admin/email/send` | `getPlatformAdminContext()` (session-only) | **Any role can trigger a real mass-email blast** (PAG-002) | `app/api/admin/email/send/route.ts:218` |
| `early-access` list + `early-access/export` | `requirePlatformAdmin()` (session-only) | **Any role can read/export the full lead DB incl. internal notes** (PAG-003) | `early-access/route.ts:13`, `early-access/export/route.ts:37` |
| `feedback/export` | `getPlatformAdminContext()` (session-only) | Any role can export all customer feedback | `feedback/export/route.ts:49` |
| `observability/issues/export` | `requirePlatformAdmin()` (session-only) | Any role can export error data | `observability/issues/export/route.ts:22` |
| `dev-tools` page + seed/wipe APIs | env-flag only; `requireDevToolPlatformAdmin`/`requireDevToolUserAuth` = any platform admin (or any user) + flag, **not super_admin** | When `NEXT_PUBLIC_ENABLE_DEV_TOOLS=true`, any role reaches Dev Tools incl. "Wipe Everything" (PF-2). **Prod-mitigated: flag is off in prod.** | `dev-tools/layout.tsx`, `app/api/dev/seed/*` |
| `users/[id]/delete` | `requirePlatformPermission('manage_support')` | **Support can permanently delete customer auth accounts** (PAS-004) — over-broad grant (design call) | `users/[id]/delete/route.ts:9` |

**Exposure framing:** these are *privilege-escalation-within-staff*, not anonymous holes — they require a logged-in employee with *some* platform role. But least-privilege is the whole point of the H4 matrix, and these routes silently bypass it. The export/email/template-overwrite trio is live in prod; the dev-tools one is prod-gated by the env flag. **→ Route: a dedicated fast-track hardening fix (NOT the UX backlog).**

### THEME B — Silent role-gated dead-ends (the signature systemic UX bug)
The single most-repeated finding, hit by 4 of 6 roles. Controls render **enabled**, the user fills them in and submits, the API 403s, and **nothing explains why.** "I'm not allowed" looks identical to "this is broken."
- PAS-002 (support · retention "+30 days"/"Process expiry"), PAS-003 (support · org-detail Billing/Entitlements forms), PAB-004 (billing · Change-Requests Approve/Reject), PAB-003 (cancel-sub section vanishes with no stub), PAR-003 (read-only · Overview Action Queue cards), PAR-001 (read-only · Customer Users full Actions menu), PAP-003 (product · Customer Users actions).
- **Root causes:** (1) `CustomerUsersClient` takes **no role prop** → renders every action for everyone (root of PAR-001 + PAP-003); (2) action buttons not gated on the caller's actual write capability; (3) the **good** pattern — the "View-only for your role" note on observability StatusControls — exists in one place and is copied nowhere. **→ Route: a "least-privilege UX consistency" pass.** This is the #1 day-one blocker.

### THEME C — The support seam closes for product, not support
PA2 = **NO**, PA4 = **YES**. The write gate on both `feedback/[id]/status` and `observability/[groupId]/status` is `manage_product`; support holds only `manage_support`. So a customer issue can only be triaged/resolved if a **product** operator independently finds it — and even then friction remains for *everyone*: no default "actionable" filter, no feedback↔error reverse back-link, **no escalation/assignment path from support to product** (PAS-005), and no customer-notification affordance. **→ Route: a "support-seam / feedback-triage" fix** (incl. the policy decision: should `support` get feedback-status write, or a dedicated `manage_feedback`?).

### THEME D — Zero SOPs on the net-new surfaces
SOPs cover the old account-management surfaces well; they cover **none** of the new ones — Feedback, Observability, Change Requests, Email Templates, Email, Early Access. PA4 (broadest role) has one 4-bullet SOP for seven write areas; PA5 (growth) has **zero** growth content in the Help Hub. This is a primary contributor to every "No" day-one verdict. **→ Route: Help-content expansion + role-paths.**

### THEME E — No day-one orientation / first-login
The 2026-06-04 eval's M8 ("start here / shift checklist") was never built. There's no first-login orientation, no role-contextual framing of what *you* can do, no signposting from the dashboard's cross-domain Action Queue (which shows every role items it can't act on). **→ Route: an orientation feature (small).**

### THEME F — Minor / per-role polish (backlog)
§13 instrumentation only on the dashboard, not per-org (PF-4/PAS-009); no expired-overrides queue for billing (PAB-002, only a dead count); Action-Queue "dead number" links; Customer Users menu ordering (PAS-010); date-format drift carried from 2026-06-04; growth lacks conversion/churn analytics (locked behind product/billing). **→ Route: backlog.**

## 4. Prioritized fix list (proposed spin-out projects)

| # | Fix project | Priority | Why | Source findings |
|---|-------------|----------|-----|-----------------|
| **F1** | **Platform-Admin API Hardening** | **P0 — fast-track (security)** | Verified least-privilege bypass on live routes (email-copy overwrite, mass-email, lead/feedback/error export) + dev-tools + delete-user grant. Small, surgical (add permission guards), high value. | THEME A: PF-1/PAP-001, PAG-002, PAG-003, feedback/observability export, PF-2, PAS-004 |
| **F2** | **Least-Privilege UX Consistency** | P1 | The #1 day-one blocker. Gate-and-message pass so no role sees enabled controls it can't use; add a role prop to `CustomerUsersClient`; standardize the "Requires X access" note from the observability gold standard. | THEME B: PAS-002/003, PAB-003/004, PAR-001/003, PAP-003 |
| **F3** | **Support Seam / Feedback Triage** | P1 | Makes the support loop actually close. Permission decision for support, escalation/assignment path, feedback↔error reverse link, default `status=new` filter, customer-notify. | THEME C: PAS-001 (Blocker), PAS-005/006/007, PAP-002 |
| **F4** | **Operator SOPs + Day-One Orientation** | P2 | Removes the other half of every "No" day-one verdict. SOPs for the 5 net-new surfaces + growth role-path + first-login "start here." | THEMES D+E: PAS-008, PAP-010, PAG (help), PA1 orientation, M8 |
| **F5** | **Operator polish backlog** | P3 | Lower-impact consistency + per-role nits. | THEME F: PAB-002, PAR/PA1 action-queue, PF-4/PAS-009, PAS-010, date formats, growth analytics |

## 5. Routing notes

- **No findings re-scope owned work.** Comp/trial items route to `existing:TIMED_ENTITLEMENTS_PLAN` (H8) — none re-opened. Shipped H1–H7 not re-litigated.
- **F1 is the only item that shouldn't wait** for the rest of the audit — it's verified, security-adjacent, and surgical. Recommend spinning it out immediately.
- **Stage C (screenshots) + remaining design/visual findings** were not blocking for triage — the code-walk + first-hand guard verification gave enough to prioritize. A screenshot pass can be added if F2's visual consistency work wants reference shots.

## 6. Status & what's next

- **Phases 0–4 complete** (staging, Stage-A matrix, all 6 role walks, this synthesis). Evaluation only; nothing committed.
- **Owner decision:** approve the F1–F5 spin-out breakdown (esp. fast-tracking **F1 hardening**), then I archive this audit + reports per docs convention and open the approved fix projects.
