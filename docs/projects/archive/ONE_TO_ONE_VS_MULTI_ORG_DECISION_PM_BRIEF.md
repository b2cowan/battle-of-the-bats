# PM Brief — One Account = One Org (1:1) vs. Multi-Org

**Date:** 2026-06-19 · **Status:** ✅ DECIDED 2026-06-19 — "single-org by default, multi-membership by deliberate exception" (no hard one-org lock). Build tracked in `IDENTITY_MODEL_CLEANUP_PLAN.md`.
**Full analysis:** `ONE_TO_ONE_VS_MULTI_ORG_DECISION_ANALYSIS.md`

> **Owner answers (2026-06-19):** two-org admins are rare; a connected coach/president network is appealing; a coach who also works in a club should have one login. → We default everyone to one workspace with a clear home, keep multi-membership available only by deliberate invite or purchase (a coach's own portal never counts against them), and add no irreversible lock. The network vision needs cross-org messaging, not multi-org membership, so it stays fully open.

## The decision in one line
Should a FieldLogicHQ account be locked to exactly one organization (strict 1:1), or stay able to belong to several (multi-org)? We're deciding now because we have one customer, so any change is free today — and only gets costlier with every signup.

## Recommendation
**Don't lock it down to strict 1:1 right now. Instead make _one workspace the default experience_, keep the ability to belong to more than one quietly intact, and fix the few places where our rules currently contradict each other.** Confidence ~70%.

This banks almost all of the simplicity we'd get from a hard 1:1 rule — clean signup, one home, less "where's my other org?" confusion — **without** the one move in this whole decision that's genuinely hard to undo, and without ripping out workspace-switching features we deliberately shipped two weeks ago.

## Why it matters
- **The thing that triggered this — cross-org coach messaging — barely benefits from 1:1.** The genuinely hard parts of that feature (privacy law, discovery, moderation, the cross-tenant room itself) are unchanged either way, and it has zero audience today. So it shouldn't drive an identity-model lock-in.
- **Strict 1:1 is a reversal, not a cleanup.** Multi-workspace home, "add another workspace," the workspace switcher, and the delete-safety that protects someone's other accounts are all built and working. Enforcing 1:1 means removing them and committing to never needing them — a product-strategy call, not a tidy-up.
- **It fights our own growth stories.** A person who runs a club and helps coach at another, an operator who grows from tournaments into a league, a contractor who serves two clubs — strict 1:1 tells each of them to "use a second email," which splits their logins, notifications, and billing. In a market of busy volunteers, that's a quiet way to lose people.
- **It keeps every door open.** Default-to-one keeps the multi-org population near zero, so we can _later_ harden all the way to strict 1:1 cheaply **or** open multi-org up fully — whichever real customers turn out to need. Locking 1:1 now closes one of those doors and makes us possibly rebuild it later.

## Customer impact
- **Today:** none. One customer, unaffected by any choice.
- **Under the recommendation:** new users get a simpler, single-workspace onboarding (a visible win). The rare person who genuinely runs two organizations can still be supported instead of being turned away. No one ever has the experience of being told the product is "one org only" and later being told that changed.
- **Two owner constraints already hold and stay safe:** one person can still be admin + tournament organizer + coach inside a single org; and we'll add a guard so one email = one paid Coaches Portal before that checkout goes live.

## Priority
**Medium-high, pre-launch.** The _decision_ should be made before we start onboarding real customers. The supporting cleanup (making our rules consistent, adding the one-portal-per-email guard) should land before launch but is modest in size. None of it blocks cross-org chat.

## Success criteria
- New-user onboarding lands on exactly one workspace with no confusing picker for the 95% who only have one.
- Our entry paths stop contradicting each other (no "blocked here, wide open there").
- A genuine two-org user can be supported without a destructive workaround.
- We retain the ability to choose strict 1:1 later at low cost — i.e., we haven't painted ourselves into a corner.

## What only the owner can decide
1. **How common is it, in our market, for one person to need a real admin role in two separate organizations?** Rare (<~5%) makes strict 1:1 attractive; common (plausibly 20–40% with volunteer overlap) makes it a churn risk.
2. **Do we want to grow into a connected coach/operator network, or stay strictly siloed tenants?**
3. **Should a standalone premium coach who also works inside a club have one login for both, or is "one login = one org" an acceptable simplification we'd enforce?**

If the owner is confident multi-affiliation is rare **and** wants strictly siloed tenants, the call flips toward doing strict 1:1 now while it's free. Absent that signal, defaulting to one-org while keeping the option open is the lower-regret path.
