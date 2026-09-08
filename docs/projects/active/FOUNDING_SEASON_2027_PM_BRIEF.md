# Founding Season 2027 — PM brief

**Plan:** `FOUNDING_SEASON_2027_PLAN.md` · **Copy:** `FOUNDING_SEASON_2027_OFFER_COPY.md` · **Mockups:** artifact `61a78f09`
**Status:** Phase 0 built on dev 2026-09-07, owner QA §150 ✅ passed 73/73. **Phase 1 built 2026-09-07; owner QA §154 owed.** Migrations 279 and 284 prod-owed (both data-only).

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
  checkout must be live — and it is: Stripe is live in production and smoke-tested (owner-confirmed
  2026-09-07).
- On a phone the homepage panel pushes the first persona card down by about 210 px; its action link
  sits just below the fold. Accepted.
- Coaches who do not continue still lose the portal at once under the standing cancellation rule; the
  read-only window that softens this is agreed in principle and not yet built, so the coach copy makes
  no promise about it yet.
- The campaign emails were rewritten in Phase 1 (below). They are sent by hand, and the two that
  described the January cliff have moved to next summer, so neither can be sent early by mistake.

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

---

## Phase 1 — the send book (built 2026-09-07)

**What changed.** Ten campaign emails became **eight**, all rewritten for the summer-2027 calendar.
Nothing has been sent, and nothing sends by itself.

| When | Campaign | What it does |
|---|---|---|
| At signup | Welcome | confirms the free season, now through September 30, 2027 |
| ~Day 60 | Season check-in | how it is going, plus what happens after |
| Oct 1, 2026 | Coaches Portal → organizations | the offer, while the signup window is open |
| Oct 1, 2026 | Coaches Portal → coaches | the same, to coaches |
| Nov 15, 2026 | Where we're headed | founding-season note, forwardable |
| **Jun 1, 2027** | **Choose your 2028 plan** | the card ask opens the same day; annual first |
| **Aug 1, 2027** | **Plan reminder** *(new)* | short, assumes nothing |
| **Sep 15, 2027** | **Final notice** | last note; the do-nothing path gets equal room |

**Retired:** the Club spotlight, the House League spotlight and "Club, last call" — we do not sell
parked products. Their copy is kept, not deleted, so a campaign can be revived the day a product
un-parks; they simply leave the operator's board and can no longer be sent.

**Why it mattered now.** Two of these were scheduled to go out **within weeks** (November 1 and
December 15, 2026) still describing the January 1, 2027 cliff, and two more were sitting on the board
marked *past due* pitching parked products. The board was the only thing telling us what needed
sending, and it was wrong in four places at once.

**Two defects found while reading, both now fixed.**
- The live welcome email — the one every new organization gets today — promised "up to 3 active
  tournaments at once". Tournament Plus is **unlimited**, and three is not even the free plan's limit.
  We had been understating the paid product to every customer at the moment they arrived.
- The **Confirm Send** dialog, the last thing read before real mail goes out, quoted its own stale copy
  of each subject line. It would have shown a December 31 subject while sending a September 30 email.
  The campaign list now lives in one place, and a build check fails if the copies ever disagree again.

**The most serious thing the review caught.** Every one of these emails was about to be sent to **coaches** as well as organizations — telling a coach that Tournament Plus was free, quoting them $39/month for a product they never bought, and pointing them at an organization billing page their account does not have. A comped coach portal is recorded in a way the audience query could not tell apart from a real organization. It had not happened yet only because no coach has taken the free season, and the two Coaches Portal emails on this board exist to change exactly that. Fixed, and the count you are shown before pressing Send now matches who actually receives it.

**Open, and it needs a decision.** The three summer emails now reach **organizations only** — a coach on a
standalone Premium Coaches Portal is in none of their audiences, so a coach's free season would end on
September 30, 2027 with no email ever having warned them. It was not papered over with one
product-neutral email because the honest sentence differs: an organization drops to the free plan and
keeps everything, while a coach's portal closes. Phase 2 builds the audience; these three then want
coach-facing twins. Separately: the demos never mention the offer at all, so a prospect can walk a
sandbox, be sold, and never learn a whole season is free — flagged for an owner ruling rather than
changed, because it is persistent demo chrome.

**How to test:** Owner QA §154 — a checkable walk covering the board, every rewritten email against
what the product actually renders, the confirm dialog, the retired three, and the offer bar walked into
both demos. Copy was approved before anything was seeded.
