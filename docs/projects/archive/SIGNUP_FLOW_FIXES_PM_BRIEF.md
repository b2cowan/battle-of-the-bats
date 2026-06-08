# PM Brief — Sign-up Flow Fixes

**Date:** 2026-06-04
**Priority:** High (affects every new organization sign-up)

## What's changing, in plain language

A review of the live sign-up flow turned up two problems and one polish opportunity:

1. **New customers got a confusing second email.** Right after signing up — before they'd even
   verified their email or picked a plan — they received a "Tournament Plus is free" email. That
   contradicts the next screen, which asks them to *choose* a plan. We're removing that email from
   the sign-up moment. Sign-up now sends **only** the "verify your email" message.

2. **On phones, customers couldn't pick a plan.** The plan-selection screen couldn't scroll on
   mobile, so the plan cards (and their buttons) below the first screen were unreachable — a hard
   block on completing sign-up from a phone. This is fixed; the page now scrolls normally.

3. **We now lead with our best offer.** On the plan-selection screen, **Tournament Plus is shown
   first and highlighted as free through December 31, 2026**, instead of being buried mid-list.

## New email behaviour (smarter, better-timed)

Instead of one premature email, the right message now follows the customer's actual choice:

- **Chose Tournament Plus** → a friendly welcome email arrives **about a day later**. It confirms
  they're set up and free through Dec 31. It intentionally does **not** say "set up your first
  tournament," because the setup wizard already runs immediately after they pick the plan.
- **Chose the free Tournament plan** → about **a week later** they get a gentle nudge: Tournament
  Plus is free this season, here's what you're currently missing. This promotes the upgrade only
  *after* they've had a chance to use the free tier.

## Why it matters

- Removes a contradiction that made the product feel broken at the very first touchpoint.
- Unblocks mobile sign-ups entirely (a meaningful share of traffic).
- Leads with the founding-season offer, improving the odds new orgs land on Tournament Plus.
- Replaces a one-size email with a choice-aware sequence that should lift free→paid conversion
  without nagging people who already upgraded.

## Access / roles

No role changes. This affects the public sign-up + first-run onboarding (org owners only). Existing
orgs are unaffected.

## Success criteria

- Sign-up produces exactly one email (verification).
- Mobile users can scroll and select any plan.
- Tournament Plus appears first and visibly highlighted on plan select.
- Welcome email lands ~1 day after choosing Plus; upsell ~1 week after choosing Free.

## Open follow-up

- If a Free-tier customer upgrades to Plus within the first week, suppress/cancel the pending
  upsell email (cancel-on-upgrade). Tracked as a fast-follow.
