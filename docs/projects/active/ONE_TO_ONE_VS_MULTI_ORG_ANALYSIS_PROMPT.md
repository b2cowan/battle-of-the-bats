# Kickoff Prompt — "One User = One Org" vs. Multi-Org Decision Analysis

> **How to use this file:** Open a fresh chat in this repo and paste everything below the line into it. It is written to be self-contained. The goal is a rigorous, independent decision analysis — not a rubber-stamp of any prior conclusion.

---

You are analyzing a high-stakes, hard-to-reverse architecture **and** product decision for **FieldLogicHQ** — a multi-tenant Canadian sports club / league / tournament management SaaS. Each organization lives at `/{orgSlug}/`. Tiers: Tournament, Tournament Plus, League, Club, plus a standalone Coaches Portal ("Team") plan for individual coaches.

## The decision

Should FieldLogicHQ **enforce that one user account belongs to exactly one organization** (strict **1:1**), or **keep the current model where a single account can be an active member of multiple organizations** (**multi-org**)?

## Why this is being decided NOW (the timing is the entire point)

- The platform is effectively **pre-launch**: there is currently **exactly one real production user, just getting started, and they belong to only one org**. Enforcing 1:1 (or doubling down on multi-org) today touches **no live customer**.
- Changing this *after* sign-ups scale would mean changing functionality out from under real users and running a risky data migration to resolve people who already span multiple orgs. **Right now that migration cost is effectively zero.** This is the cheapest moment this decision will ever be — and it gets monotonically more expensive from here.
- Therefore this must be a **deliberate decision made before launch**, not something that hardens by drift.

## What triggered it

The owner wants to enable **cross-org coach-to-coach messaging** — e.g., a coach at Club 1 messages a standalone coach (a different org) to arrange a scrimmage — and asked whether collapsing to strict 1:1 would *both* simplify user management *and* make that cross-org chat cleaner.

A prior multi-agent investigation (whose conclusions you should **re-derive independently, not assume**) found: 1:1 simplifies only the *identity* side of cross-org chat (which org a person "is"), but the cross-org **room model, discovery, consent, and moderation are hard regardless** of the identity model; and today's multi-org support was **deliberately built and recently shipped**, so 1:1 is a *reversal*, not a *cleanup*. Test this. It may be right; it may be incomplete.

## You MUST verify against the live code, not docs or memory alone

This repo's database has drifted from its migration files before, and several memory notes are weeks old. Confirm each of these against the actual current code/schema before relying on it:

1. How the user↔org relationship is modeled today, and whether a single account can currently hold active membership in more than one org.
2. What product features currently **depend on** multi-org: the cross-workspace home/landing experience, the "add another workspace / start something new" flow, the workspace switcher, and the account-deletion safety behavior that avoids destroying a person's *other*-org account when they're removed from one org.
3. Whether any constraint (application-layer or database-layer) currently restricts a person to one org, and where the invite-acceptance path can still create multi-org state.
4. How **standalone coaches** are represented (the lightweight auto-created org per coach) and whether that representation collides with a strict one-org rule.
5. The current launch status of the standalone Coaches Portal ("Team" plan) — is self-serve checkout live, and do any paying standalone coaches exist yet?
6. Any in-flight work (e.g., invite reconciliation) that assumes, or has explicitly deferred, the one-org question.

## Constraints that must remain TRUE under whichever model wins

1. A single user must be able to wear **multiple hats inside their ONE org** — run the org portal, run tournaments, *and* be a coach with a coach portal — all within the same organization. Confirm this already works today without any multi-org membership.
2. Standalone coaches should be limited to **one premium Coaches Portal per email** (wanting another = use a different email). Assess how enforceable this is today and what, if anything, is missing.

## Dimensions to analyze — give pros & cons of EACH model on EACH

1. **User-management & support burden** — account recovery, "I can't find my other team/org," and the risk of destructive account deletion.
2. **Signup / onboarding clarity** — which model is simpler to explain and to get right on day one.
3. **Real multi-org personas** — enumerate the concrete people who would legitimately need to belong to 2+ orgs (e.g., someone who runs a club *and* coaches a rep team at a different club; a tournament operator who also runs a league; a coach for two different clubs; a contractor/admin serving multiple orgs; a parent who is also a coach). For each: does "use a second email" actually work under 1:1, and what does that cost them (split logins, split notifications, split billing, fragmented identity)?
4. **Cross-org coach chat enablement** — re-verify exactly how much 1:1 helps vs. what stays hard regardless.
5. **Standalone coach model fit** — how each model interacts with the per-coach stub-org representation.
6. **Billing & entitlements** — implications of each model for who pays and what they unlock.
7. **Data integrity & security** — including the account-deletion safety case above.
8. **Engineering complexity carried** — the latent risk/maintenance of multi-org (ambiguous "current org" fallbacks, the home switcher, context resolution) vs. the complexity of building and policing strict 1:1.
9. **Migration & blast radius** — what enforcing 1:1 now requires (data resolution + code/feature removal) and what it permanently gives up; vs. the ongoing cost of keeping multi-org.
10. **Reversibility / optionality** — which choice is cheaper to undo later? (If we pick 1:1 now and later want multi-org, we must rebuild it. If we keep multi-org and later want 1:1, we must migrate users mid-flight.) Weigh which decision preserves the most future freedom.
11. **Product strategy / identity** — does FieldLogicHQ want to be strictly siloed tenants, or grow into a connected network (coaches discovering and messaging each other across orgs)? How does each model serve the 3–5 year vision?

## Deliverables

Produce a written decision analysis and save it to `docs/projects/active/ONE_TO_ONE_VS_MULTI_ORG_DECISION_ANALYSIS.md` (and a short companion PM brief per this repo's planning rules). It must include:

- A side-by-side **pros/cons table** (1:1 vs. multi-org) across the dimensions above.
- The **real multi-org personas** and the true cost of the "second email" workaround for each.
- **What enforcing 1:1 now would require** (the migration + the specific features/flows that get removed) and **what it permanently forecloses**.
- **What keeping multi-org costs** (complexity, support, latent bugs) if those are left in place.
- A **reversibility analysis** — which path is cheaper to change course on later, and the cost of being wrong each way.
- A **clear recommendation with a stated confidence level**, plus the **2–3 questions only the product owner can answer** to finalize it.
- **Rigor bar:** investigate exhaustively across the codebase, verify every load-bearing claim against the live code, and adversarially stress-test your own recommendation (argue the opposite case) before presenting it.

Lead the written analysis and any owner-facing summary in **plain product-owner language** (what changes for users, why it matters, the trade-offs) — keep file paths, schema, and implementation mechanics in the body/appendix, not the summary.
