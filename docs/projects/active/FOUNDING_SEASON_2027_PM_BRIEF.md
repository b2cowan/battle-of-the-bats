# Founding Season 2027 — PM brief

**Plan:** `FOUNDING_SEASON_2027_PLAN.md` · **Copy:** `FOUNDING_SEASON_2027_OFFER_COPY.md` · **Mockups:** artifact `61a78f09`
**Status:** Phase 0 built on dev 2026-09-07; owner QA §150 owed; migration 279 prod-owed.

## What changes for the customer

**The offer.** Anyone who signs up by **December 31, 2026** gets Tournament Plus or the Premium Coaches
Portal **free through September 30, 2027** — their whole 2027 season — with no credit card. In September
2027 they choose a plan for their 2028 season. Nothing is charged before then, and there is nothing to
cancel. Before this change the free period ended on December 31, 2026, before a ball organization would
have run a single game on it.

**What they see.** The offer is front and centre instead of a footnote:
- a one-line **offer bar** at the very top of every marketing page — the demo and changelog pages
  included — with the promise, the deadline and one link;
- an **offer panel** on the homepage directly under the headline: "Your 2027 season, free.", the one
  offer sentence, the two prices being waived, and what happens after;
- the two persona pages lead with the season, not the permanent free plan; the pricing cards show
  **"$0 through September 30, 2027"** with the normal price beneath; the get-started chooser's two
  offer doors say "2027 season free";
- the coach door on the get-started chooser now opens the **Premium** portal being advertised (it used
  to create the free Basic team), with a quiet line beneath for coaches who only enter tournaments.

**Everywhere else the date appears** — the coach signup and welcome screens, the organization
onboarding and billing pages, the in-portal Premium notes, the welcome emails — it now says
September 30, 2027, and the billing page no longer asks for a card in October 2026 (the card ask opens
June 1, 2027).

**The day the window closes.** On January 1, 2027 every offer element disappears on its own and the
pages read as the normal prices with the free floors. There is no second promotion; the pricing FAQ
already carries the post-window answer.

## Why it matters

Customer acquisition for the 2027 season is the priority. A free season that ends before the season
starts converts nobody; a free season that ends after the last game, when a coach is running next
year's tryouts and an organizer has just finished a successful summer, is the moment a customer decides
to keep the tool. The deadline turns fall browsers into accounts now, at no cost to them.

## Trade-offs made

- One more free month (September) than first proposed, so coaches are not cut off mid wrap-up.
- The deadline is only as good as the door behind it: because there is no second offer, the paid
  checkout must be live and smoke-tested by December 31, 2026.
- On a phone the homepage panel pushes the first persona card down by about 210 px; its action link
  sits just below the fold. Accepted.
- Coaches who do not continue still lose the portal at once under the standing cancellation rule; the
  read-only window that softens this is agreed in principle and not yet built, so the coach copy makes
  no promise about it yet.
- The ten campaign emails still describe the January cliff and are rewritten in the autumn pass; they
  are sent by hand, so nothing wrong fires on its own.

## How to test (owner QA §150)

Open the homepage, `/pricing`, `/for-tournament-organizers`, `/for-coaches` and `/start` on a laptop
and a phone; read every Founding Season sentence against the copy canon; sign up as a new organization
and as a new coach and check the welcome and billing screens; confirm a customer's public pages and the
demo carry no offer bar. Full checklist in `OWNER_QA_LEDGER.md` §150.

## Success criteria

- Every surface states the same offer in the same words, and none states a date by hand.
- A new organization and a new coach created before December 31, 2026 carry a comp that ends
  September 30, 2027; one created after carries none and meets the list price.
- The billing page never asks for a card before June 1, 2027.
- Signups of tournament organizers and coaches rise through the fall — the measure is accounts created
  by December 31, 2026 (there are three real accounts today).
