# User Management UX — Tournament & Tournament Plus

**Scope:** Member management flows for `tournament` and `tournament_plus` plan tiers only.
**Status:** Planning — not started
**Source page:** `app/[orgSlug]/admin/org/members/page.tsx` (re-exported at `app/[orgSlug]/admin/tournaments/settings/members/page.tsx`)

---

## Plan Tier Context

| | Tournament (free) | Tournament Plus ($39/mo) |
|---|---|---|
| `seatLimit` | **3** | **9999 (unlimited)** |
| `officialsFreeSeats` | `false` — scorekeepers count against seats | `true` — scorekeepers are free + unlimited |
| `tournamentLimit` | 1 | unlimited |
| Roles available | Owner, Admin, Staff, Scorekeeper | Same |
| Roles NOT shown | Coach, League Admin, League Registrar, Treasurer | Same |

---

## Role Definitions (Tournament tiers)

| Role | Badge | Access | Seat cost |
|---|---|---|---|
| **Owner** | `badge-primary` | Full access; owns subscription and org settings; cannot be changed via UI | Billable |
| **Admin** | `badge-success` | Co-organizer: create/manage tournaments, members, schedule, registrations, comms. No billing/org-settings access | Billable |
| **Staff** | `badge-neutral` | Day-of operator: update game times/venues, submit scores, post announcements. No create/delete/member-manage | Billable |
| **Scorekeeper** | `badge-warning` | Score submission only via scorekeeper app link. Does not access the admin panel | Billable on Tournament; **Free** on Tournament Plus |

Capability overrides (per-member grants/revocations) are only accessible to owners and let any role be tuned above or below its defaults.

---

## Current Implementation Gaps

### P1 — Upgrade link destination is wrong (High)
- **Where:** `page.tsx` lines 763, 773 — seat limit CTA + near-limit nudge
- **Problem:** Both links hardcode `/${currentOrg?.slug}/admin/org/billing`. For Tournament/Tournament Plus users navigating through `/admin/tournaments/settings/members`, the `/admin/org/` path is not in their sidebar. This sends them to a dead-end.
- **Fix:** Import `getBillingHref(slug, planId)` (already used in `AdminSidebar.tsx`) and use it for both links. This helper already resolves the correct path by plan tier.
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (lines 763, 773); `lib/billing-urls.ts`

### P2 — Audit Log link goes to org path (Medium)
- **Where:** `page.tsx` line 677
- **Problem:** "Audit Log" always links to `/${slug}/admin/org/members/audit`. When reached from `/admin/tournaments/settings/members`, this is outside the expected navigation context for Tournament-tier users.
- **Fix:** Make the audit href context-aware. Options:
  - Pass a prop from the re-export wrapper that sets the base href
  - Or detect the plan tier: Tournament/Tournament Plus → `admin/tournaments/settings/members/audit`; League/Club → `admin/org/members/audit`
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (line 677); `app/[orgSlug]/admin/tournaments/settings/members/page.tsx`

### P3 — Empty state is blank (Medium)
- **Where:** `page.tsx` lines 783–784
- **Problem:** When `members.length === 0` (or just owner), renders `No members yet.` — no CTA, no guidance. First-time Tournament users don't know what to do.
- **Fix:** Replace with a structured empty state:
  - Heading: "Invite your first team member"
  - Body: "Add a Staff member to manage game-day operations, or a Scorekeeper to submit results from the field."
  - CTA: "Invite Member" (same handler as the page-header button)
  - Apply only when `members.length === 0` (owner sees themselves, so use `nonOfficials.length <= 1 && officials.length === 0` as the empty condition)
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (around line 783)

### P4 — Seat banner has no plan context (Medium)
- **Where:** `page.tsx` lines 752–777
- **Problem:** `4 of 3 staff seats used` gives no context on why the limit exists or what plan the user is on. Users who hit the wall are confused about whether it's a setting or a plan limit.
- **Fix:** Add a muted sub-label below the seat count:
  - Tournament: `Tournament plan · upgrade to Tournament Plus for unlimited seats and free scorekeepers`
  - Tournament Plus: `Tournament Plus · scorekeepers are always free`
  - Other tiers: no label (already have unlimited seats)
  - Drive from `planCfg.label` + `planCfg.officialsFreeSeats` + `seatLimit`
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (seat banner section)

### P5 — Page subtitle is org-scoped for tournament-scoped context (Medium)
- **Where:** `page.tsx` line 673
- **Problem:** "Manage who has access to your organization" implies org-wide access (billing, settings) that Tournament users don't have.
- **Fix:** Drive subtitle from plan tier:
  - Tournament / Tournament Plus: `"Manage who has access to your tournaments"`
  - League / Club: keep `"Manage who has access to your organization"`
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (line 673)

### P6 — Role Guide doesn't explain the seat model (Low)
- **Where:** `page.tsx` lines 733–750 (Role Guide panel body)
- **Problem:** The guide explains what each role can do but nothing about seat costs or plan-specific limits. A Tournament Plus user doesn't know scorekeepers are free; a Tournament user doesn't know their limit is 3.
- **Fix:** Add a "Seats & plan limits" paragraph at the bottom of the Role Guide body, above the closing `</div>`:
  - Tournament: "Your Tournament plan includes 3 staff seats. Scorekeepers count toward this limit. Upgrade to Tournament Plus for unlimited seats and free scorekeepers."
  - Tournament Plus: "Your Tournament Plus plan includes unlimited staff seats. Scorekeepers are always free and don't use a seat."
  - League/Club: no copy needed (already unlimited)
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (Role Guide section)

### P7 — Role select in manage modal lacks seat-cost hint (Low)
- **Where:** `page.tsx` lines 878–882 (manage modal role select)
- **Problem:** On Tournament Plus, changing a member from Admin/Staff → Scorekeeper makes them a free seat. There's no indication of this in the UI.
- **Fix:** When `planCfg.officialsFreeSeats` is `true`, add a muted inline note below the role select: `"Scorekeepers are free seats on your plan"`.
  Show only when the role select is present (not for owner).
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (manage modal, role select section)

### P8 — Owner self-manage modal is missing transfer ownership note (Low)
- **Where:** `page.tsx` around line 876 (manage modal, owner path)
- **Problem:** When the owner opens their own "Manage" modal, the role section is silently absent. The Role Guide (collapsed by default) mentions ownership cannot be transferred, but the modal gives no feedback.
- **Fix:** When `manageTarget.role === 'owner'`, render a callout inside the modal in place of the role select: "Ownership cannot be transferred from this page — contact support if you need to change the org owner."
- **Files:** `app/[orgSlug]/admin/org/members/page.tsx` (manage modal, role section)

---

## Implementation Phases

### Phase 1 — Upgrade path & navigation fixes (P1, P2)
Critical correctness issues. Both links send users to wrong destinations.
- Import `getBillingHref` into the members page; apply to both upgrade links
- Make audit log href context-aware by plan tier
- **Estimated effort:** Small (2–4 lines each)

### Phase 2 — Plan context communication (P4, P5, P6)
Helps users understand their plan limits without leaving the page.
- Seat banner sub-label by plan
- Page subtitle by plan  
- Role Guide seat model paragraph
- **Estimated effort:** Small–Medium

### Phase 3 — Empty state & modal clarity (P3, P7, P8)
Onboarding and edge-case clarity.
- Structured empty state with CTA
- Role select seat hint on Tournament Plus
- Owner modal transfer note
- **Estimated effort:** Small

---

## Flow Completeness Checklist

| Flow | Status | Notes |
|---|---|---|
| Happy path: invite → accept → manage | ✅ | Working end-to-end |
| At-limit invite blocked | ✅ | Error shown in modal |
| Upgrade link when at limit | ❌ | Wrong destination — Phase 1 |
| At-limit upgrade link when near (80%) | ❌ | Wrong destination — Phase 1 |
| Audit log access | ⚠️ | Wrong URL context for Tournament tier — Phase 1 |
| Empty state guidance | ❌ | Blank — Phase 3 |
| Plan limit explained | ❌ | Not shown — Phase 2 |
| Scorekeeper free-seat model explained | ❌ | Not shown — Phase 2 |
| Remove confirm step | ✅ | Inline confirm with impact count |
| Reinvite pending members | ✅ | Working |
| Suspend / reinstate | ✅ | Owner-only gate working |
| API error handling | ✅ | FeedbackModal for all error paths |
| Coach / league roles excluded | ✅ | Invite + manage dropdowns both correct |
| Owner self-manage transfer note | ❌ | Silent omission — Phase 3 |

---

## Files Affected

| File | Changes |
|---|---|
| `app/[orgSlug]/admin/org/members/page.tsx` | All 8 fixes |
| `app/[orgSlug]/admin/tournaments/settings/members/page.tsx` | Phase 1: audit href prop or plan detection |
| `lib/billing-urls.ts` | Import only (no changes expected) |

---

## Journey-audit inputs — J10 invited staff admin (2026-06-13, Phase 4)

The J10 walk routes 3 findings here (report = source of truth: [journeys/JOURNEY_J10_INVITED_STAFF_ADMIN.md](journeys/JOURNEY_J10_INVITED_STAFF_ADMIN.md); 0 refuted):

- **J10-003 — P2 scope correction (raise to High):** the Tournament-tier "Audit Log" button is not just a *wrong href* — it's a **hard 404**. `app/[orgSlug]/admin/tournaments/settings/members/` contains only `page.tsx` (the members re-export); there is no `audit/` route, and `proxy.ts:133-147` bounces tournament tiers out of `/admin/org/*` so the org-path fallback would also fail. **P2's fix is incomplete as written** — it must *build* `tournaments/settings/members/audit/page.tsx` (re-export the org audit page, like members does) so the existing owner-gated audit API is reachable, OR hide the button for tournament tiers until that surface exists. The API already works; only the page is missing.
- **J10-017 (Med, NEW — Phase 3 candidate):** the accept-invite flow renders inside the full public-marketing wrapper (nav: Tournaments/Leagues/Clubs/Coaches/Pricing + footer) instead of a clean auth shell, and the card omits the inviting org's name as context. Use a full-bleed onboarding shell (suppress public nav/footer) with the org name above the form.
- **J10-010 (Low, NEW — Phase 3 candidate):** the scorekeeper accept-invite flashes the admin-flavoured title until an async GET resolves `inviteContext`, so an official invitee briefly sees the wrong product identity. Carry the role in the invite link (or render a neutral title until the role resolves).
