# Plan / Tier Trial — PM Brief

> **Status:** Proposed / deferred (not scheduled) · **Created:** 2026-06-29 · **Plan:** [PLAN_TIER_TRIAL_PLAN.md](PLAN_TIER_TRIAL_PLAN.md)
> **Strategy origin:** `docs/agents/strategy/BUSINESS_DECISIONS.md` → "2026-06-29 — Plan / Tier Trial capability" (Proposed)

**What it does:** Lets a platform operator put an organization onto a *higher plan* for a set window (e.g. "give this club League Plus for 14 days"). The org experiences the full higher tier, and access **automatically drops back** to their real plan when the window ends. No billing is ever touched.

**Why it matters:** Today operators can only switch on one section at a time (the "Feature Access Trial") or force a subscription status — there is no way to let a prospect *try a whole plan* risk-free and time-boxed. A tier trial is a natural sales/conversion lever for the founder-managed League/Club early-access motion, and it removes manual cleanup and the double-billing risk of routing a real subscription change through the wrong path.

**Who benefits:** Platform operators (sales/support) and the orgs they're courting. There is no customer self-serve surface. The grant is access-only — it never creates or changes a Stripe subscription.

**Expected impact:** An operator grants a tier trial from the same Active Overrides surface they already use; the org sees the higher tier's features immediately; access reverts cleanly on expiry with a full audit trail. The operator's plan-of-record, billing, and limits readouts continue to show the org's real (base) plan, with a clear "Trialing <tier> until <date>" signpost.

**Priority:** Low / deferred. Logged as **Proposed**; the owner relabelled the existing surgical grant for clarity now and chose to defer this build. Not yet scheduled.

**Success criteria:**
- Operator grants "trial League Plus, expires in 14 days" on a Tournament-plan org → the org gains League-Plus-gated features (sections AND tier-ranked features) immediately.
- At expiry (no cron job) access reverts to Tournament automatically; revoking early reverts immediately.
- Every grant/revert is audit-logged with the target tier and reason.
- No Stripe object is created or modified at any point; the org's stored plan, billing, and limits-of-record remain the base plan throughout.

**Dependencies / risk:** Builds on the existing timed-grant engine (reuse, not rebuild). The real work is plumbing an *effective plan rank* through plan-feature gating so a trial tier outranks the base plan for the window without mutating the stored plan. This touches shared gating on every authenticated request, so it warrants a `/review` pass and a separate gated `/release` for production (the engine is already enabled locally; production stays behind the `ENTITLEMENT_GRANTS_ENABLED` flag until scheduled).
