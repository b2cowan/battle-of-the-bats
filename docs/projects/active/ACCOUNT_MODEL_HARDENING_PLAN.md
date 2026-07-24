# Account-Model Hardening — Implementation Plan

> **Status:** Planning
> **Created:** 2026-07-24
> **Branch:** dev
> **Parent decision:** 2026-07-24 "Verified Network" account-model decision (`docs/agents/strategy/BUSINESS_DECISIONS.md`); full analysis `docs/projects/active/ACCOUNT_MODEL_FREEDOM_ANALYSIS.md` §9 (fix-regardless-of-package list) + §12 (owner decisions 6–8).

## Goal

Ship the **do-now** tier of the account-model decision: seven confirmed defects/security gaps plus the watch-only build of the parked one-portal safeguard. Every item here is a current bug or exposure that stands on its own — none depends on the "Verified Network" verification/billing feature being designed. Shipping this bundle makes the product more correct and safer **regardless** of how the freedom feature eventually looks, and clears the security/correctness debt before any multi-org growth arrives.

**This bundle deliberately excludes** (they belong to a later, pre-January "Verified Network gate" plan): the verification form/approval UX, funnel-to-Club-first, distinguishable receipts, refund audit trail, coach-digest bundling, the pricing-FAQ billing-disclosure copy, and the safeguard's hard-enforce flip (the partial unique index). Those are referenced below as downstream dependencies only.

## PM Brief

**What it does:** Fixes a set of account-and-billing defects and closes two support-tool security holes — including a live customer signup dead-end, a "cancel the wrong organization" billing risk, and a support action that can currently sign in as any customer.

**Why it matters:** These are already-live problems, not hypotheticals. A coach who owns a free Coaches Portal is currently blocked from creating their first real organization (a broken front door at the exact moment we want signups). A person who ends up with two organizations can cancel the wrong one's subscription from the wrong billing page. And on the support side, the "reset password" tool hands the operator a link that logs them straight in as the customer, while a "complete transfer" action can cancel a *different* organization's subscription with only a generic confirmation. None of this needs the bigger multi-organization feature to be worth fixing.

**Who benefits:** Coaches signing up (the blocked-first-org fix), any future multi-organization owner (the billing-scope and one-org-rule fixes), and the platform's own security/support posture (the two support-tool fixes). No plan-tier gating — these are correctness and safety fixes across all tiers.

**Expected impact:** After this ships: a portal-owning coach can create their first real org with no dead-end; billing cancel/downgrade always act on the organization you're actually looking at; the handful of ways one person could silently end up in or own two organizations by accident are closed; support can no longer inadvertently (or deliberately) log in as a customer through the reset tool; and the platform quietly starts recording any case where one person holds two live Premium Portals, which pre-builds the January cleanup list. No visible change at all for the ordinary single-organization user.

**Priority:** High. Two items are security; two are live customer/financial defects; the rest close known leaks in a policy the platform already relies on. The one previously-parked database safeguard has been blocking a decision — this unblocks it in its safe watch-only form.

**Success criteria:** (1) A coach who owns a Premium Portal can self-serve-create a real org. (2) Cancel/downgrade act only on the invoking org for a multi-org owner. (3) The three accidental second-org paths (league-create, reinstate, cross-org head-coach promotion) are closed while intended guest coaching still works. (4) The reset tool no longer exposes a usable customer session to the operator. (5) The complete-transfer action names the counterpart org before firing. (6) An owner holding two live Premium Portals is detectable in the operator console, and the two accidental double-portal paths (race + reactivation) are closed.

---

## Phases

Each phase is independently shippable with its own owner-QA checkpoint. Recommended order = highest risk/urgency first.

### Phase 1 — Support-tool security (ship first)

**1.1 — Reset-password impersonation vector** (`app/api/platform-admin/users/[id]/reset/route.ts`, `app/platform-admin/customer-users/CustomerUsersClient.tsx`)
- [ ] Stop returning the raw recovery `action_link` in the route's JSON response. Instead **email the recovery link directly to the customer** (reuse the existing forgot-password / transactional-email path) so the operator never holds a live session token.
- [ ] Update the operator UI: replace the "copy this link" affordance with a confirmation that a reset email was sent to the customer (no link surfaced).
- [ ] Keep the existing `generate_reset_link` audit line; consider tightening it to record that a reset was *sent* (not that a link was handed to the operator). *(Confirm current audit call at route.ts:38.)*
- [ ] **Open question for build:** is there any legitimate operator workflow that needs the raw link (e.g. reading it to a customer on the phone who has no email access)? If yes, gate that behind a higher permission tier + an explicit "link shown" audit event, rather than defaulting to exposing it. Default recommendation: email-only.
- **Touches:** platform-admin route + email infra → typecheck. **No migration.**
- **Verify:** as a support-tier operator, trigger a reset for a test customer → confirm the customer receives the email and the operator UI shows no usable login link.

**1.2 — "Complete Transfer" cross-org write blast radius** (`app/platform-admin/orgs/[id]/OrgDetailClient.tsx`, `app/api/platform-admin/team-ownership-transfers/[linkId]/complete/route.ts`, `lib/team-ownership-transfer.ts`)
- [ ] Add an explicit confirmation step before Complete Transfer fires that **names the counterpart organization** and states plainly what will happen to it (subscription cancelled, Stripe IDs cleared, members suspended, data reassigned).
- [ ] Keep the transfer feature itself intact — this is a guard, not a removal.
- [ ] Confirm the confirmation is enforced server-side too (a typed confirmation token or the counterpart org id echoed back), not client-only, so it can't be skipped.
- **Touches:** platform-admin UI + route. **No migration.**
- **Verify:** attempt a Complete Transfer → confirm the confirmation names the counterpart org and the action can't proceed without it.

### Phase 2 — Live correctness/financial bugs

**2.1 — Org-create wrongly blocks a portal-owning coach** (`app/api/org/create/route.ts:58-68`)
- [ ] Replace the inline all-active-memberships COUNT with the exemption-aware `userBelongsToOtherRealOrg(user.id)` helper (which correctly excludes the user's own `team_workspace` Coaches Portal), matching the accept-invite path.
- [ ] Preserve the separate pending-invite guard (lines 70-83) unchanged.
- [ ] **Check for the same pattern on the page guard** at `app/(consumer)/start/tournament/page.tsx` (the finding cited a mirror inline count there) — align it to the same exemption-aware check so the page and the route agree.
- **Touches:** org-create route + shared policy helper + a consumer page guard → typecheck. **No migration.**
- **Verify:** signed in as a coach who owns a Premium Portal (and nothing else), go to /start/tournament → confirm you can create a real Tournament org (no 403). Confirm a coach who already owns a *real* org is still blocked.

**2.2 — Billing cancel/downgrade default to the wrong org** (`app/api/billing/cancel/confirm/route.ts:18`, `cancel/preflight/route.ts`, `downgrade/preflight/route.ts`, `downgrade/confirm/route.ts`)
- [ ] Scope all four routes to the **invoking org's slug** (accept `orgSlug` from the caller and pass it to `getAuthContextWithRole`, membership-verified — mirror the correctly-scoped `app/api/billing/portal/route.ts`), instead of resolving to the caller's home org.
- [ ] Confirm the client billing page passes its current org slug to these routes; fix the caller if it doesn't.
- [ ] Extend the fail-closed lint/scope guard (the one that currently covers admin + coaches routes) to also cover `app/api/billing/*` so this class of bug can't silently recur.
- **Touches:** billing routes (money-touching, high-risk) → typecheck + treat as a review-before-release change. **No migration.**
- **Verify:** requires a **multi-org owner test account** (flag: needs setup). Viewing Org B's billing page, click Cancel/Downgrade → confirm it acts on Org B, not the home org. Single-org owners unaffected.

### Phase 3 — Close the one-org-rule leaks

**3.1 — Ungated `/api/league/create` second-org path** (`app/api/league/create/route.ts:96-133`, `app/(consumer)/start/league/page.tsx`)
- [ ] Add the same exemption-aware one-org guard used by org-create (`userBelongsToOtherRealOrg`) so an existing org owner can't self-serve a second real org via the league path. (Currently the only thing stopping it in prod is the `LEAGUE_STARTER_BETA` flag being off — must be closed before League Starter launches.)
- [ ] Align the `/start/league` page guard to match.
- **Touches:** league-create route + policy helper + page guard → typecheck. **No migration.**
- **Verify:** in dev (flag on), as an existing org owner, attempt /start/league → confirm blocked with the same message org-create gives.

**3.2 — Reinstate-after-suspend loophole** (`app/api/admin/members/[memberId]/route.ts:298-303`)
- [ ] On the suspended→active reinstate transition, call `userBelongsToOtherRealOrg` (excluding this org) and block/flag if the user has since become active in another real org — closing the suspend-in-A → join-B → reinstate-in-A double-membership path.
- [ ] **Decide the failure UX:** hard-block the reinstate with a clear message, vs. allow-but-warn (consistent with the soft-gate posture elsewhere). Recommendation: block, since reinstate is an intentional admin action with a clear alternative (the person can be re-invited if they truly left the other org).
- **Touches:** admin members route + policy helper → typecheck. **No migration.**
- **Verify:** suspend a member, have them join another org, attempt reinstate → confirm handled per the chosen UX.

**3.3 — Cross-org head-coach promotion loophole** (`app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts:95-106`)
- [ ] Block promoting an **existing cross-org guest assistant** into a head-coach seat when that person's only membership in this org came from the guest-invite bypass (i.e. they hold an active membership in another *real* org). Keep normal head-coach assignment for genuine same-org members intact.
- [ ] **Preserve the intended freedom:** assistant guest-coaching across orgs stays open (that's the ratified "cheap axis" freedom) — this closes only the *silent escalation to head coach*, not the guest membership itself.
- [ ] **Open question for build:** the cleanest signal for "this is a cross-org guest" — reuse `userBelongsToOtherRealOrg`, or check how the membership was created. Resolve during build.
- **Touches:** rep-teams coaches route + policy helper → typecheck. **No migration.**
- **Verify:** create a cross-org guest assistant, then attempt to promote them to head coach → confirm blocked; confirm a normal same-org member can still be made head coach.

### Phase 4 — One-Premium-portal safeguard (watch-only) + close accidental-double paths

**4.1 — Close the reactivation-branch gap** (`lib/team-checkout.ts:545-556` paid, `:825-833` comp)
- [ ] Move/duplicate the `getActiveOwnedTeamWorkspace` owner check so it runs **before the reactivation branch returns**, not only on the fresh-provision path — so a coach with 2+ canceled workspaces can't start two reactivation checkouts into two live portals. (Reactivating your *only* canceled portal must still work — gate on "another live portal already exists," not "any portal exists.")
- **Touches:** billing/team-checkout (money-touching) → typecheck + review-before-release.

**4.2 — Close the TOCTOU double-provision race** (`lib/team-checkout.ts:825-833`, `lib/team-workspace-provisioning.ts`)
- [ ] Add a serialization guard around per-owner provisioning so two simultaneous comp checkouts can't both pass the read-then-write check. Recommended approach: a **Postgres transaction-scoped advisory lock keyed on the owner's user id** around the guard+provision sequence (no schema change). Confirm the provisioning insert sequence's transaction boundary during build; if it isn't a single transaction, wrap the guard+first-insert.
- [ ] This closes the **accidental** double (a race) without hard-capping a **deliberate** second portal — deliberate seconds are already blocked at fresh checkout and will be governed by the January verification gate.
- **Touches:** billing/provisioning → typecheck + review-before-release.

**4.3 — Watch-only detection** (new helper + `app/platform-admin/customer-users/*`)
- [ ] Add a detection helper that flags any owner holding **2+ live Premium Portals** (by owner user id, live subscription statuses), and surface it in the platform-admin per-user view (an "owns N portals" indicator/flag). This is the "watch-only" mode — **detect and record, never block** — which also **pre-builds the January conversion cleanup list**.
- [ ] **No hard DB uniqueness constraint in this phase.** The partial unique index on the portal owner (the true hard-enforce backstop) is the **deferred January enforce-flip**, planned separately — adding it now would contradict the watch-only decision and could error on promo-era edge cases.
- **Touches:** platform-admin console + a shared entitlements query → typecheck.
- **Verify (Phase 4 overall):** reactivation double blocked when a live portal exists; the race is hard to browser-test (note: verify by code review + the advisory-lock behavior, not a manual race); the watch-only flag appears in the operator console for any 2-portal owner.

---

## Architectural Decisions

- **Decision:** No migration in this bundle. **Rationale:** the watch-only safeguard is detection-only (a query + console surfacing), the TOCTOU fix uses an advisory lock (no schema change), and every other item is route/UI logic. The one schema change the broader initiative needs — the partial unique index that *hard-enforces* one portal per owner — is deliberately the **deferred January enforce-flip**, out of scope here. *(Confirm during build that no persisted flag column is wanted for watch-only; if the owner wants a durable flag rather than a live query, that would add one additive migration + the data-dictionary/snapshot update per the schema-change rule.)*
- **Decision:** Route org-create, league-create, and reinstate through the single shared `userBelongsToOtherRealOrg` helper rather than bespoke inline counts. **Rationale:** the root cause of items 2.1/3.1 is *divergent copies* of the one-org check; consolidating on the one exemption-aware helper is what prevents the drift from recurring (same principle as the platform's single-source-of-truth governance).
- **Decision:** Fixes preserve the ratified freedoms. **Rationale:** the account-model decision keeps the "cheap axis" (guest coaching, multi-membership) open — so 3.3 closes only the silent head-coach escalation, and 4.x closes only *accidental* doubles, never a deliberate future verified second portal.
- **Decision:** Phase order = security → live bugs → policy leaks → safeguard. **Rationale:** blast radius and how-live-it-is-today; each phase ships and QAs independently.

## Downstream dependencies (NOT in this plan — the later "Verified Network gate" plan)

- The verification form/approval UX (promo lead-gen → paid-period approval-unlocks-checkout), funnel-to-Club-first at a 2nd-portal attempt.
- Distinguishable Stripe receipts, refund audit trail, coach-digest bundling (prerequisites before *opening* portal multiplicity).
- The pricing-FAQ billing-disclosure copy (route to `/marketing`).
- The safeguard **hard-enforce flip** (partial unique index + enforcement semantics) — the January action that builds on Phase 4's watch-only foundation.

## Open Questions

- [ ] **2.2 / 4.x testing:** verifying the multi-org billing-scope fix and the watch-only detection needs a multi-org / multi-portal test account — set one up on dev, or verify by targeted code review where a live race can't be reproduced manually.
- [ ] **3.2 reinstate UX:** hard-block vs allow-but-warn (recommendation: block).
- [ ] **1.1 reset:** keep an operator-visible raw link behind a higher tier for the no-customer-email case, or email-only (recommendation: email-only).
- [ ] **4.3 watch-only:** live query vs a persisted flag column (the latter adds a migration).
