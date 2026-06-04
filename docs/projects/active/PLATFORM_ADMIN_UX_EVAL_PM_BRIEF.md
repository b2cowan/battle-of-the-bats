# PM Brief — Platform Admin Employee UX Evaluation

**Status:** Review complete (2026-06-04). No code changes yet — this is a triage input. Full findings: [PLATFORM_ADMIN_UX_EVAL.md](PLATFORM_ADMIN_UX_EVAL.md).

## What this is
A plain-language assessment of the internal platform-admin tool (`/platform-admin/`) that FieldLogicHQ employees use to support customers — from the perspective of an employee who has never been trained on it. We walked the ten most common support scenarios end to end and audited every screen, label, and help article.

## Why it matters
The tool is powerful and safe (every risky action is confirmed and logged), but a new support, billing, or product employee would hit avoidable friction: actions they can't find, controls that silently vanish when they lack permission, and help docs that point to the wrong place. That translates to slower support calls, mistakes, and over-reliance on a few experienced staff. Most fixes are cheap wording changes.

## What an employee experiences differently after the fixes
- **The "the owner left the company, move ownership to someone else" call** becomes findable and documented — today it's a hidden button with no instructions, and the relevant help article gives outdated steps.
- **Everyone can tell what they're allowed to do.** Today, controls a role can't use simply disappear, so employees can't tell "I'm not allowed" from "this is broken." After: a clear "requires billing access" style message.
- **Common support actions are documented.** Banning a user, forcing a logout, confirming an email, editing a user's email, and adding account notes currently have no written procedure.
- **Less hunting.** From an organization's page you can jump straight to the customer's user record (to reset a password) instead of navigating away and re-searching; dashboard warning numbers ("3 expired overrides") become clickable.
- **Consistent words.** One name for "module access" and for "organization vs account," so the screens and the help guide agree.

## The one bigger bet (billing capability gap)
The biggest finding is not cosmetic. The system that's supposed to let us **comp an account for a period** or **let a customer trial a higher tier/add-on for a while** does not actually enforce time limits or revert automatically. Two concrete asks the business wants:
1. Give an owner free access (extended trial) until a set date, then resume billing.
2. Let a Tournament Plus customer try League for a period while still paying for Tournament Plus, and automatically revert to Tournament-Plus-only if they don't convert.

Neither works today: comps/overrides are recorded but not enforced by the access layer, add-ons have no expiry, and nothing reverts on its own — staff get a "revoke this manually" reminder instead. Delivering this needs real feature work (a "timed grant" model with automatic expiry/revert), and it should be scoped as its own project.

## Priority & sequencing
- **Now (cheap, high value):** copy/label fixes — document the missing procedures, fix the stale ownership guidance, rename the confusing "Team Ownership Transfers," unify vocabulary.
- **Next (medium):** role-aware navigation + "you don't have permission" messaging; org→user cross-link; clickable dashboard alerts; co-locate Delete Organization with Cancel Subscription.
- **Project bet:** time-boxed, auto-reverting comps & trials (billing/entitlements feature work).

## Success criteria
- A new employee can complete all ten core support scenarios without opening the help guide for navigation help.
- No control silently disappears without an explanation of why.
- Every action available in the UI has a matching, accurate SOP; no SOP references a flow that no longer exists.
- Comp/trial requests (extended free period; tier/add-on trial that auto-reverts) are fulfillable in-product without manual cleanup.
