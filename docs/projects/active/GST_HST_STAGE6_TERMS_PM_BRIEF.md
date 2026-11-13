# GST/HST Stage 6 — Terms, privacy policy and "I agree": PM brief

Plan: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) · Written 2026-11-08 · Status: planned, owner decisions owed.

## What changes for people
- **Everyone who makes an account ticks one box**: "I agree to the Terms of Service and have read the Privacy policy" (plus
  "I'm 18 or older", ruled 2026-11-08). That covers the club sign-up, the coach sign-up, a staff invitation, the account a tournament
  registration makes, and the "follow this tournament" account.
- **People who already have an account** see one short screen on their next sign-in: "We've published our Terms", with the same
  tick. One tick and they carry on.
- **Terms and Privacy are one click away everywhere**: the site footer, the account menu on every portal, the account page, and
  under the sign-in and sign-up forms. Club and tournament public sites stay the club's own pages. Our own emails stay without a
  footer (ruled 2026-11-08); the purchase confirmation carries the Terms link in its body.
- **Every version we publish stays readable at its own address**, so we can always show someone exactly what they agreed to. A
  page shows its effective date and nothing else above the text; an older version says it is older and links to the current one.

## Step 6.2 — the pages, built dark (planned 2026-11-08)
- **Ruled:** the pages are built hidden behind a switch. On our test site they show the current drafts, with every note to the
  owner taken out and a "Draft" banner, so the owner can read the real text in place before approving it. Production shows
  nothing until publication.
- The drafts stay the only copy of the words until publication; then the approved text is saved once per version and can never
  be edited (the build refuses).
- The product's contact address stays hello@ until support@ is confirmed to receive mail; then support@ becomes the one public
  address.
- A short drawing round comes first (the page, and where the links sit in the account menu and under sign-in).
- Success: with the switch on in the test site, every surface links the pages; with it off, nothing shows anywhere.
- **Anyone who buys or changes a paid plan gets a confirmation email** with what they bought, the price and tax, the renewal date,
  how to cancel, and a copy of the Terms they agreed to.
- If ruled: **a reminder email 30 days before a yearly plan renews**, and **checkout politely declines a Québec address** until a
  French version exists.

## Step 6.3 — "I agree" at every door, built dark (planned 2026-11-09)
- **Ruled (all as recommended):** one box at every door that makes an account, nine doors in all, including the four
  invitations and the family accept page (there it is a third box, shown only to someone who hasn't agreed yet). Everyone
  else meets one full screen before their portal opens, in six places: the family app, the club and tournament admin, both
  coach portals, and the scorekeeper and check-in screens. FieldLogicHQ staff and the two demo accounts never see it.
- **Nobody starts an organization or a paid plan without agreeing.** If the Terms changed while a purchase page was open, a
  small window asks for the tick and the purchase carries on with the same choices. **Cancelling is never blocked.**
- **What we keep:** who, their email, which versions, the exact sentence they ticked, which door, when. No IP address.
- **Known limit, accepted:** a phone app left open across the switch-over shows the screen at its next full load, not
  mid-use. Purchases and new organizations check for themselves, so nobody becomes a customer in that gap.
- Order: a short drawing round (with `/legal`'s few extra lines), then three builds. The first build has no visible change
  and can start now. Then the walk.
- Success: the build fails if a new account, organization or plan door is added without the check; with the switch off,
  nothing changes anywhere.

## Step 6.4 — the purchase email, the yearly reminder, Québec (planned 2026-11-13)
- **Ruled: live with the next release, not hidden.** Only the email's "Terms you accepted" line waits for the pages to publish.
- **"The details of your purchase."** One email, a minute after a payment goes through:
  - **When:** on a first plan, a free trial starting, an upgrade, a next-season choice, and coming back after cancelling.
  - **What it shows:** the plan, the price, each tax by name and rate, the total, the dates, how to cancel, a link to the
    invoice, our GST/HST number.
  - **The figures** come from the same record our books keep.
  - **Not sent for** renewals, fee invoices, free Founding accounts, demos or test purchases.
- **Coming back after cancelling** gets one email, which opens "Welcome back", instead of two. A coach buying Premium still
  gets "Your portal is ready" as well.
- **The yearly reminder:** about 30 days before a yearly plan charges again, the date and the amount with its tax.
- **Every owner gets these**, and the same build fixes today's billing emails, which send nothing when a club has two owners.
- **Québec:** every way to buy or upgrade politely says "We're not selling in Québec yet." An account with a Québec address
  on file keeps renewing, moving down, cancelling and taking payouts.
- **Success:**
  - every purchase gets exactly one email, with the same figures as its invoice;
  - a replayed payment sends nothing;
  - no yearly plan renews without 30 days' notice;
  - no Québec address can start a purchase;
  - nothing a Québec account already has changes.
- Order: two builds (the email first; then the reminder and Québec), then the walk.

## Why it matters
- Today the Terms bind nobody: nothing records that anyone agreed to them, and they aren't published.
- A coach buying a yearly Coaches Portal is a consumer under Ontario law, which requires a copy of the agreement within 15 days.
  Without it, that coach can cancel within 30 days. The confirmation email closes that exposure.
- Our privacy policy has to tell the truth about what the product does now, including one child record per club across seasons,
  the tax records and staff billing lists.

## What the audit found
- **Good news:** cancelling already keeps the plan to the end of the paid period in production (since the 2026-11-05 release). The
  Terms' biggest promise is already true. Three live-Stripe settings still need reading.
- **Wider than expected:** accounts are created through about eight doors, and two of them never show a sign-up page. The Terms
  were written only for buyers, so invited coaches, volunteers and parents need a short section of their own.
- **One defect worth fixing first:** deleting an organization leaves its uploaded files behind, including signed medical and waiver
  forms.

## Priority
Gates the first paid subscription of any plan not yet on sale (parent plan). It is the visible change for every new customer,
so it should be done before Club goes on sale.

## Success looks like
- No door creates an account, an organization or a plan without a recorded acceptance of the current version, and the build fails
  if one is added without it.
- We can show any customer the exact version they agreed to, and when.
- Every sentence in the published Terms and privacy policy is true of production on the day it is published.
- The demos are not affected.

## Tradeoffs
- One tick for everyone, rather than separate terms for parents and staff: simpler, and keeps the acceptable-use rules binding on
  everyone.
- No IP address recorded with acceptance: the account and time are enough, and we collect less.
- Automatic data purge, a club deleting a child's record, and two-step sign-in stay as follow-up items. The policy says so honestly
  in the meantime.
