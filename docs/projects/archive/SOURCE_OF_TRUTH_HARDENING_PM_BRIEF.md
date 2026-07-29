# PM Brief — Single Source of Truth (SoT) Hardening

**Created:** 2026-06-29 · Companion to `SOURCE_OF_TRUTH_HARDENING_PLAN.md`

## What this is
A focused initiative to stop the same product fact (a price, a plan limit, an availability toggle, a date, a label, "what a plan includes") from living in several places that drift apart. It was triggered when a platform-admin screen showed plan limits that disagreed with what the system actually enforces — and a codebase audit found the same pattern in about a dozen spots, **several already wrong on customer-facing surfaces**.

## Why it matters
Every duplicated fact is a future incident waiting to happen — and some are happening now (a public page that contradicts itself on what Club includes; a paying customer who can't see a feature in their menu; emails that will quote a stale price the next time we change one). Left alone, the risk grows every time we add a plan, change a price, or run a promotion. The payoff: change a fact in **one** place and every screen, email, and doc updates itself — with an automatic build check that refuses to ship a mismatch.

## What changes for users
- **Customers** stop seeing contradictory prices/inclusions, and paying customers see every feature they're entitled to.
- **Operators** stop editing controls that silently do nothing, and the console stops showing numbers that don't match reality.
- **Internally**, changing a price or launching a plan becomes a one-touch, low-risk action instead of a hunt-and-replace across many files.

## Proposed functionality (outcomes, not mechanics)
1. One owner per fact; everything else reads it.
2. No hand-typed prices/dates/limits in copy or emails — they derive from the source.
3. Operator controls enforce what they display, or are removed.
4. A build check blocks any new duplicate from being merged.

## Priority & sequencing
- **Now (P0):** the handful already wrong on customer surfaces — the Venue Library menu fix is **done**; the stale Club copy + email naming go to `/marketing`; two "ghost control" editors get a keep-or-remove decision.
- **Next (P1):** retire hardcoded prices and the founding-season date so the next price change / promotion can't go stale.
- **Then (P2):** the subscription-vs-Stripe reconciliation and the internal label/feature-list cleanups, plus the CI drift guard.

## Success criteria
- No customer-facing surface disagrees with the canonical pricing facts.
- A price/limit/date/label change touches one place; CI blocks duplicates.
- No operator control shows a value it doesn't actually enforce.

## Customer impact
Fewer "your site says X but you charged me Y" moments, fewer "I'm paying for this but can't find it" tickets, and a materially lower chance of a pricing/packaging mistake reaching a customer at launch or reprice time.
