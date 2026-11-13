# Raising a plan's price — the notice procedure (internal)

> Version 0.1 · drafted 2026-11-13 by the Stage 6 step 6.4 planning session, from `/legal`'s steps that day. **Owner approval
> owed**, with the rest of Stage 6 (6.6). Not customer-facing.
> It makes true the Terms draft §8 "Price changes": *"If the price of your plan is going up, we will email the account owner at
> least 30 days before the renewal at which the new price applies."* There is no build; this is done by hand.
> - **Who:** `/strategy` decides the new price and its date, and logs it in `BUSINESS_DECISIONS.md` (the Plan & Pricing Facts
>   and `lib/plan-config.ts` change in the same unit of work). The **owner** runs these steps. `/legal` owns this file.

## When this applies
- **It applies when** a paid plan's price goes up for people already on it.
- **It does not apply to:**
  - a change in a tax rate (Terms §6: not a price change);
  - a price that only new buyers pay;
  - free, comped and Founding Season accounts. Founding comps are honoured on the terms they were sold.

## The steps
1. **Fix the first affected renewal date.** It must be **at least 35 days after the notice is sent**: 30 days is the
   promise, and 5 days covers a bounce and a re-send. Every renewal before that date keeps the old price.
2. **List the people to tell:** every active owner of each affected paid organization, plus the coach for a Premium portal.
   Leave out free, comped and Founding accounts, and the demo accounts.
3. **Send the notice.** It names:
   - the plan;
   - the old and the new price, each "plus applicable taxes";
   - the first renewal date the new price applies to;
   - "If you don't want to continue at the new price, cancel from your billing page before {date}";
   - "Nothing changes before that date."
   
   Plain and factual, with no upsell (it is a transactional email under CASL).
4. **Keep the record:** the date sent, every recipient, and each delivery result. Re-send or phone anyone whose email
   bounced. **Nobody moves to the new price without a delivered notice** (`BUSINESS_DECISIONS.md`, 2026-10-31, item 3).
5. **Only then change the price** in Stripe and in the product. After the first affected renewal, check that the invoice
   shows the new price, and that the yearly reminder (Stage 6 step 6.4) showed it too.

## Notes
- A yearly plan's 30-day reminder reads Stripe's preview of the next invoice. Once the price is changed in Stripe, the reminder
  shows the new amount. So step 5 must come **after** step 3, or the reminder would announce the rise before the notice did.
- A price rise that is significant (Terms §18) may also need the Terms re-accepted. That is the §18 path, not this one.
