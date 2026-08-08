# Plan — make platform-admin actions do what they say

**Audit:** `PLATFORM_ADMIN_ACTION_ENFORCEMENT_AUDIT_FINDINGS.md` (evidence for every claim)
**PM brief:** `PLATFORM_ADMIN_ACTION_ENFORCEMENT_AUDIT_PM_BRIEF.md`
**Ruling:** owner, 2026-08-06 — **hard-block immediately** (option A), plus all four secondary fixes.
**Status:** ✅ BUILT on `dev`, UNCOMMITTED. Owner QA = ledger §1.19. **No migration.**

---

## The ruling

> A cancelled subscription stops working **immediately**. Data is retained untouched; resubscribing
> restores everything intact.

Chosen over a grace period because the platform-admin cancel dialog **already promises exactly
this**, and because the dunning path supplies a grace window for free (below). Log via `/strategy`.

### The safety question that had to be answered first

Option A is only safe if cancellation is always deliberate — if a failed payment could auto-cancel,
an immediate hard-block would lock out a customer whose card merely expired. **Verified in code
before building:**

- `invoice.payment_failed` → writes `subscription_status: 'past_due'`, never `canceled`, and
  notifies the org ([webhook/route.ts:589-617](../../../app/api/billing/webhook/route.ts#L589-L617)).
- Only Stripe **giving up** after its full retry window produces `canceled`.

So the dunning path already gets a real grace period at `past_due`, then hard-blocks. That is the
behaviour option C would have built by hand. `past_due` never suspends, and a unit test pins that —
see the load-bearing assertion in the guard test.

**One residual, outside the code:** if Stripe's dunning is ever configured to cancel on first
failure with no retries, that grace window disappears. Worth a glance at the Stripe dashboard
retry settings; not something this repo can assert.

---

## Architecture — one chokepoint, fails closed

The defect was never "a missing check on route X." It was that ~190 routes each decided access for
themselves and none of them asked about billing. Patching them one by one would leave the same shape
behind. So the question is asked **once**, where every authenticated org route already passes:

```
getAuthContext()  ──→ applyEntitlementGrants()  ──→ isOrgBillingSuspended()?
   (lib/api-auth)         (override can rescue)        throw OrgBillingSuspendedError
                                                              │
withObservability ────────────────────────────────────────────┘  →  HTTP 402
   (wraps 100% of them — verified: zero unwrapped)
```

**Why a throw, not a `null` return:** `null` is the existing "not signed in" signal, and all ~242
call sites turn it into a 401 — which reads to a client as a dead session and can bounce a signed-in
person into a sign-in loop. Throwing lets the one wrapper answer **402 Payment Required** in a single
place, with no per-route edits and no chance of a route forgetting. Verified beforehand that every
route calling `getAuthContext` is wrapped in `withObservability`, and that only one call site wraps
it in `.catch()` (feedback — exempt anyway).

**Why grants run first:** a platform-admin `subscription_status: 'active'` override still rescues an
account without touching Stripe. That operator escape hatch is deliberate and preserved.

### New files
| File | Role |
|---|---|
| `lib/org-billing-access.ts` | The predicate, the typed error, the 402 response. One place. |
| `components/billing/SubscriptionEndedWall.tsx` (+ `.module.css`) | The human half — built on the same tokens as the coaches portal's existing "not assigned" wall. |
| `tests/unit/org-billing-access-guard.test.ts` | The build-enforced allow-list + 4 supporting rules. |

### The exemption list — and why each earns it
Staying reachable while cancelled requires `allowSuspendedOrg: true`, and the guard test pins the
exact file set. Adding one **fails the build** until the list is edited. Three groups:

1. **The comeback path** — all of `/api/billing`, plus the two reads the billing *page* itself makes
   (`admin/members/count`, `admin/org/founding-season-status`). Without these a cancelled org can
   never pay us again.
2. **Identity/nav** — `/api/auth/me`, `/api/org-context`. The app shell cannot render without them,
   *including the shell that hosts the billing page*. Neither returns org data.
3. **Page layers** — the coaches / scorekeeper / check-in / admin layouts resolve the org so a server
   component can render the cancelled state instead of a 500. **They grant no data**: the API rail
   stays closed underneath.

⚠ **`app/[orgSlug]/admin/layout.tsx` and `admin/org/layout.tsx` are load-bearing exemptions** — the
resubscribe page is a child of both. If either ever throws, a cancelled org is stranded with no way
to pay. The comment says so in-file; QA step 7 exists to catch it.

### What the guard test actually asserts
1. Suspends on `canceled` and **never** on `active`/`trialing`/`past_due` *(load-bearing — see above)*.
2. The error carries the org slug so 402s are attributable.
3. **No unapproved file opts out** (scans `app`, `lib`, `components`).
4. **No stale allow-list entries** — a stale path silently pre-approves a future file there.
5. **Every org-scoped coach route rides the rail.** Six accepted rails; the five shared resolvers
   were each verified file:line to reach `getAuthContext`. Explicit scope limit stated in-file: the
   free (Basic) coach portal is user-scoped, has no org subscription, and is correctly excluded.

*This assertion earned its keep during the build — the first version was wrong, and finding out why
is what proved all 150 coach routes are genuinely covered rather than assumed to be.*

---

## The secondary fixes

**Downgrade archives over-cap tournaments** — new shared
`archiveOverCapTournamentsForPlanChange` in `lib/billing-retention.ts`, called from both the
single-org plan route and Bulk Operations. Writes the *same* `billing_retention_intents` +
`billing_retained_records` rows as the customer's own downgrade, so `restoreRetainedDowngradeTournaments`
brings them back on re-upgrade. Keeps the most recent N (year DESC), archives the rest. A failure is
surfaced to the operator, never swallowed — an org silently over its cap is the exact failure mode
this audit was about.

**Feature matrix tells the truth** — the owner's stated alternative was taken, and here is the
honest reason: `hasModuleEntitlement` is **synchronous**, sits on every request's hot path, and is
called from client components (~85 call sites incl. `AdminSidebar`). Making plan→module mapping
dynamic needs an async cached lookup threaded through all of them, with an invalidation design where
being wrong means wrong entitlements platform-wide. That is a project with its own plan, not an
audit fix. So: new `getPlanModuleEntitlementDrift()`, a permanent banner stating publishing does not
change customer access, a live list of "published but NOT live" rows, and a success message that no
longer implies the packaging change took effect.

**Bulk comp-period copy** — the single-org warning ("a billing tag only, grants no access") carried
over to Bulk Operations, which said only "Grant a comp period."

---

## What `/simplify` and `/review` changed (2026-08-06)

Both ran after the build. Between them they found **three defects in this work** and **three
pre-existing holes of the same class the rail was built to close**. All fixed.

**Defects in this work**
1. The feature-matrix honesty banner referenced CSS classes that don't exist in that stylesheet —
   it shipped completely unstyled. (`/simplify`; own class added.)
2. `lib/tournament-preview.ts` opted out of the rail to avoid an error boundary and then rendered
   admin-only tournament data (service-role reads) into SSR HTML for a cancelled org. The
   client-side `CancellationGuard` fires after mount and never fires at all without JS. Now does a
   **server-side** `notFound()`. (`/review`; my own `/simplify` fix caused it.)
3. Re-ordering the archive writes accidentally **deleted the archive step**, so the downgrade fix
   would have silently done nothing. Caught by lint's unused-variable warning.

**Pre-existing holes of the same class — the rail's own claim was overstated without these**
4. **The family/guardian portal never consulted billing at all** — its org gate didn't even select
   `subscription_status`. A cancelled club's families kept the team page, schedule, calendar feed
   and join/claim links forever. Closed at `getOrgForGate`, the one chokepoint all six family
   surfaces share.
5. **Rep-team tryout registration** accepted player DOB + guardian contact details for a cancelled
   org indefinitely. The house-league sibling has refused this since audit J3-068; tryouts never got
   the same treatment.
6. **The nightly dues-reminder sweep** kept emailing families about money on behalf of cancelled
   clubs. Runs from `pg_cron` with no session, so the rail never saw it.

**Also hardened**
- Downgrade keep-order: the old rule kept the first N of a *display* sort (year DESC, name ASC), so
  within one year it was pure alphabet — "April Open" (finished) kept over "Summer Showdown"
  running today, which 404s a live event's public site mid-tournament. Now ranked by what the org is
  actually using, extracted to a pure, testable module with 6 assertions pinning it.
- Archive writes reordered: the restore ticket is written **before** anything is taken away, so a
  partial failure can never strand tournaments archived with no way back.
- `archiveWarning` now actually reaches the operator — the screen ignored it, so a half-applied
  downgrade read as plain success.
- Two new guard assertions: an **inverse guard** (every SSR-reachable caller must survive the throw
  — this is what caught #2), and one that a page-layer opt-out must actually *stop* a cancelled org
  rather than merely avoid the throw.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm test` | ✅ **1439/1439** (1426 baseline + 13 new) |
| `npm run lint:focused` (all touched files) | ✅ 0 errors |
| Token / contrast / **date-correctness** / dictionary guardrails | ✅ pass |
| `check-admin-org-context` | ✅ 297 route files clean |
| `check-observability-coverage`, `check-demos` | ✅ pass |

⚠ `npm run verify:changed` exits 1 at **check-schema-parity**, on `rep_team_game_moments` —
**migration 228 from the Game-Day Mode P2 session, dev-only, not this work.** This change adds no
migration. The three checks that run behind schema-parity were run individually (above) so nothing
is claimed unverified.

**Not run:** rendered `check:layout` (needs a dev server + a seeded cancelled org). Stated, not passed.

---

## Owed

- [ ] Owner QA — ledger **§1.19** (built as a before/after; a cancelled org that still works is
      indistinguishable from a working one by clicking)
- [x] `/strategy` — logged 2026-08-06 (Decided). Option D (read-only goodbye) logged separately as
      **Proposed**, unratified. No pricing fact changed, so `PLAN_PRICING_FACTS.md` is untouched.
- [x] `/simplify` → `/review` → `/docs` — all three run. See the section above for what they found.
- [x] Help content — the org guide gained an **"If your subscription ends"** section
      (`#subscription-ends`, linked from the Owner/Org Admin role path) leading with *nothing is
      deleted*; the coaches guide gained a coach-facing answer for hitting the wall; and the
      operator runbook was **corrected** — it told support a status override was "display only",
      which since this change would have locked a paying customer out of the entire product while
      Stripe kept charging them.
- [ ] Commit — owner's explicit per-action OK required; ~65 files from four other sessions are in
      the tree, so **explicit pathspecs only**
- [ ] One-minute owner check: `ENTITLEMENT_GRANTS_ENABLED` in the Amplify env — if unset, every
      timed override is inert in production (audit finding F5, unresolvable from here)
