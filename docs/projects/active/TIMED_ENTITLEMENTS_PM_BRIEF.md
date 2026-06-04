# PM Brief — Timed Entitlement Grants (Comps & Trials)

**Status:** Planned, not started (2026-06-04). Plan: [TIMED_ENTITLEMENTS_PLAN.md](TIMED_ENTITLEMENTS_PLAN.md). Origin: H8 of the [Platform Admin UX Evaluation](PLATFORM_ADMIN_UX_EVAL.md).

## What this is
A way for FieldLogicHQ staff to grant an organization **temporary access that turns itself off** — either a free comp period or a trial of a higher tier / add-on — without permanently changing the customer's plan, and **without anyone having to remember to undo it**.

## Why it matters
Today the tools to "comp this account" or "let them try League for a month" look like they work but don't: the comp is recorded yet never actually changes what the customer can access, add-on grants never expire, and nothing reverts on its own — staff just get a "remember to revoke this" reminder. That means manual cleanup, accounts left on the wrong access, and sales/support promises we can't cleanly deliver. This builds the real capability.

## Two things customers/staff get
- **Free comp until a date** — e.g. an extended free trial or a goodwill credit period. Access is granted now; billing resumes automatically when the period ends.
- **Try a higher tier or add-on, risk-free** — e.g. a Tournament Plus customer trials League features for 30 days while still paying for Tournament Plus. If they don't upgrade, access **automatically drops back** to Tournament Plus only at the deadline. If they do upgrade, it's a normal plan change.

In the platform admin, staff create the grant (what, for how long, why), see a **countdown** on the account, and can revoke early. Everything is audit-logged.

## How we'll deliver it (and why in this order)
- **First: the trial-on-top-of-a-paid-plan case.** It's the lower-risk half — access simply expires on its own, with no billing changes and no new infrastructure. This gets a usable, valuable feature out quickly.
- **Second: the free-comp-with-billing-pause case.** This one has to coordinate with Stripe to stop and restart billing, so it depends on our Stripe billing work and is sequenced after.

## Customer impact
- Sales/support can confidently offer time-boxed trials and comps that "just work" and clean themselves up.
- Customers get a fair trial experience: they see the upgraded features, and if they don't convert, they quietly return to what they pay for — no surprise charges, no lingering free access.

## Priority
Medium-high. It's the last open item from the platform-admin evaluation and unblocks real go-to-market motions (trials, founding/goodwill comps). It's larger than the other fixes because it changes how access is calculated and needs a database change — so it's scoped as its own project with database and billing review before build.

## Risks / dependencies
- Touches the access check that runs on **every** signed-in request — needs careful testing and a controlled rollout.
- The free-comp half depends on the **Stripe billing integration** (not yet built) and a decision on scheduled jobs.
- Needs database-architecture review (how grants are stored and kept fast) and billing review (how Stripe pauses/resumes).

## Success criteria
- Staff can grant a time-boxed add-on/tier trial; the customer gains access immediately and **loses it automatically at the deadline** with no manual step and no data change.
- Staff can grant a free comp period; billing **resumes on its own** when it ends.
- Active grants are visible with a countdown and are fully audit-logged.
- Accounts with no grants are completely unaffected (no performance or behavior change).
