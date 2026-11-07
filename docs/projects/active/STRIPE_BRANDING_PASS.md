# Stripe branding pass — owner checklist

**Opened 2026-11-06.** One pass over every page, email and document that Stripe shows a FieldLogicHQ customer, so it
matches the warm brand (live since commit `a9f154e8f`, 2026-10-23). Reviewed in this order: `/design` → `/marketing` →
`/accounting` → `/legal`. Each agent wrote its own rows below and signed them.

**How to use it.** Work down the list in **live mode** first, then repeat it in the **test sandbox**. Tick the box once
you have looked at the result on screen (a screenshot is the proof). Claude never changes Stripe settings; every click
below is yours. Rows marked **CODE** are not in the dashboard at all. Our app sets them, so they ship through a code
change and a promote, not a click.

Row legend: **Where** = the path in the Stripe dashboard · **Enter** = the exact value or words · **Ruled by** = which
agent decided it · **Live** / **Test** = verified by screenshot.

---

## Open owner questions — answer these first

<!-- Each agent appends its questions here as Q-<agent letter><n>: D = design, M = marketing, A = accounting, L = legal.
     A question blocks only the rows that name it. -->

### Answer in this order (consolidated by /legal, the last agent, 2026-11-06)

**Before the first live sale** (each one fixes something that is hard to undo, or that a customer sees on day one):
1. **Q-L1, Q-L2, Q-L3 together** (publish Terms and Privacy, give them a phone and a mailing address, register the name). Every
   link and checkbox in this pass waits on the pages, and Q-M9, Q-M10 and Q-A2 (phone and address) must be answered the same way.
2. **Q-A1**, same errand as Q-L3 (CRA operating name plus ServiceOntario).
3. **Q-M7 (statement name), Q-M8 (support email), Q-A3 (invoice prefix), Q-M12 (one failure email)**: all permanent or customer-visible from the first charge.
4. **Q-M1 to Q-M6** (product names and descriptions): Checkout shows them to the first buyer.
5. **Q-L4 and Q-M11/Q-L5** (Checkout tick-box words; renewal reminder days): one decision each, shared across agents.

**Polish, any time after** (none blocks a sale): Q-D1 (decide from the real Pay button in the sandbox), Q-D2, Q-D3, Q-D4, Q-M13,
Q-M14, Q-A4/Q-A5 (needed before the first fee invoice, not the first plan sale), Q-A6, and Q-L6 (the club payments terms are a
placeholder; needed before a club takes real online payments, not before a plan sale).

**Contradictions between agents (flagged, nothing deleted):** (a) **Q-M9/M18, Q-M10/M20, Q-A2/A14 say leave phone and address
off every Stripe page; Ontario's online-sale rules for a coach buying as an individual ask the seller to disclose a phone number
and a business address.** Both can be true only if the Terms page and the purchase email carry them (Q-L2); they are not
required on Stripe's pages. (b) **Q-M11/M14 say remind 7 days before renewal; the Terms draft (section 8) promises 30 days for
yearly plans.** The Terms must say what is actually sent (Q-L5). (c) Q-A4 versus M8 (footer) is /accounting's disagreement with
/marketing; /legal has no objection to either sentence.

- **Q-S2 — Which emails does Stripe send while ours are not built? ✅ RULED by the owner 2026-11-06: receipts and
  expiring-card warnings only.** The direction (owner ask A, 2026-10-30, in the own-invoices plan) is that customers read
  OUR documents, not Stripe's; that program's Stage 5 and 6 are not built. Until then: Stripe's **receipts ON** (accounting
  and the Ontario copy rule need one), **expiring cards ON**, **upcoming renewals OFF** (so the Terms promise no reminder,
  Q-L5), **trial ending and card payment failures OFF** (ours are sent). Each Stripe email is switched off on the day our own
  version ships; our own receipt, card-expiring and renewal emails are recorded in the own-invoices plan.
  **Still open on the same page — "Payment method updates" (where the button in Stripe's expiring-card email leads):** it
  was the legacy mix pointing at the homepage. Recommendation: first restrict Settings → Billing → Customer portal (the
  DEFAULT portal, which our app never uses) to **Payment methods + Invoice history only**, everything else off, then choose
  **"Link to a Stripe-hosted page"**. Live and sandbox.

- **Q-S1 — Should plan checkouts offer Klarna? (found on the owner's sandbox screenshot 2026-11-06; no row blocked)**
  **✅ RULED by the owner 2026-11-06:** (addendum) on the Stripe emails page the owner found all five customer emails off; trial-ending and card-failure stay off (ours), bank-debit failure stays off (we take none).
  **✅ RULED by the owner 2026-11-06: Klarna turned off.** Recommended next on the same page, in live AND the sandbox:
  Affirm off (same pay-later reasoning); MB WAY, Bancontact, BLIK, EPS and Pix off (other countries' local methods that
  never apply to CAD prices); keep Cards, Apple Pay, Google Pay and Link; enable nothing new (a Canadian bank debit takes
  days to clear and our plan billing has not been checked for a payment that sits pending). This page governs payments TO
  FieldLogicHQ only; clubs' family payments use their own connected accounts.
  The sandbox Checkout for Premium Coaches Portal offered **Card** and **Klarna** (plus Apple Pay and Link). Klarna is a
  pay-later lender; offering it on a $29 a month plan adds a higher-fee method and a second company in the buyer's
  billing relationship for no gain. Recommendation: **turn Klarna off for plan payments** (Stripe dashboard → Settings →
  Payments → Payment methods → Klarna → off), and check the same page in **live**, which may differ from the sandbox.
  Route through `/accounting` if the fee comparison matters. Also seen on that screenshot, no action needed: the HST 13%
  line works in the sandbox (live waits on the GST/HST promote, A2); Stripe's own "you authorize … according to the terms"
  line links to no terms (Q-L1); the old, longer product description is cut off with "…" (Q-M2's shorter draft fixes it).

- **Q-D1 — May the Pay button be olive? (blocks D5, D6 and D10; D9, D11, D18 and D20 are judged against the answer)**
  **✅ RULED by the owner 2026-11-06: olive `#57651E` accepted**, judged from the real sandbox Checkout (Subscribe button
  olive with a white label, cream panel, olive tile). The dark-brown fallback is not needed.
  Stripe gives us ONE accent colour, and it paints the Pay button, every link and the focus ring around a field you are
  typing in. So the choice is not "button colour", it is "the colour of everything clickable on Stripe's pages".
  - **Lime `#D9F99D` is not possible.** Dark text on a lime button is fine (14.15:1), but lime as a link on white is
    1.17:1 and on cream 1.06:1, and a lime focus ring or selected-card edge on white is 1.17:1 (the minimum for a ring
    is 3:1). Links and focus rings would be close to invisible. This is a readability failure, not a taste call.
  - **The rule you made on 2026-07-22** (design decisions log, "Warm portal: olive is a TEXT/BORDER/tint accent ONLY,
    NEVER a button FILL"): *olive may be used for text, borders, focus rings and faint tints, never as a solid button
    fill; the warm primary button is ink-on-lime everywhere.* Its written reason: *"olive fills read muddy/unappealing on
    cream and collapse the button hierarchy."* It came from you rejecting an olive "Open day-of check-in" button
    ("don't like this olive color"), and it is written for the **warm portal**'s own buttons.
  - **My ruling: the ban does not travel to Stripe's pages, and olive `#57651E` is the accent.** Its two reasons do not
    hold there. "Collapses the button hierarchy" needs a second button to collapse into: a Stripe page has one primary
    button. "Muddy on cream" is about olive on the cream paper; Stripe's Pay button and links sit on a white panel, where
    olive is the same colour as the logo tile and the links beside it. Numbers: white label on olive **6.39:1**, olive
    link on white **6.39:1**, olive on cream **5.83:1**, olive focus ring against white **6.39:1**. Everything passes.
  - **What it costs:** the first solid olive button a customer sees is Stripe's, and you have said you dislike that look.
    It is also one step off the product's own button (ink on lime). The next screen (our success page) shows the lime
    button again; that hand-off is the cost, and it is small.
  - **The honest fallback if you dislike it on screen: ink `#241E15`.** White label on ink 16.52:1, links and rings
    maximum contrast, no olive fill. It costs the link: a link the colour of body text is told apart only by its underline.
  - **Please decide after seeing the real Pay button (D10) in the test sandbox, not from this paragraph.** Recommendation:
    olive.

- **Q-D2 — Ship the icon and colours now and the wordmark logo later, or wait for the logo? (blocks D2, D3)**
  **✅ RULED by the owner 2026-11-06:** settled by action: icon and colours shipped in live and the sandbox; Logo slot empty and the logo switch off until the wordmark (C-D1) exists.
  Recommendation: **ship now.** The icon swap retires the old dark tile with the lime FL today and carries most of the
  brand. The logo slot (invoice, receipt, PDF) is the one place the NAME needs to appear as artwork, so it wants a
  wordmark image that does not exist yet (Code follow-up C-D1). Until it does, leave the logo empty (D2) and keep the
  "use the logo" switch off (D3): Stripe then shows the olive tile beside the business name typed in Stripe's own font,
  which is correct and on brand.

- **Q-D3 — Whose colours should a family see when it pays its CLUB through Stripe? (blocks D32 only)**
  Clubs connect their own Stripe account; a family paying the club's dues uses Stripe Checkout on THAT account. I believe
  (not sure) Stripe shows it with the club's business name and our platform's icon and colours, because our code sets no
  branding on a club's account. So a family paying "Riverdale Minor Ball" sees FieldLogicHQ's olive tile. Our own product
  rule is the opposite for email (owner 2026-10-23: family emails wear the CLUB; FieldLogicHQ sits in the footer), so a
  family may expect the club's identity here too. Recommendation: **accept FieldLogicHQ's frame for launch** (it is
  consistent, safe and costs nothing), and treat per-club colours on Stripe as a later project (C-D3), not a launch item.
  Please confirm by opening one family test payment in the sandbox (D32) so we are ruling on what it really shows.

- **Q-D4 — Is the brief's premise right that Brand colour should be the cream? (no row blocked; I agree, with one warning)**
  **✅ RULED by the owner 2026-11-06:** settled by action: brand colour #F8F4ED set in live and the sandbox and accepted on the real Checkout.
  I agree with `#F8F4ED`: ink on it is 15.06:1, olive on it 5.83:1, and it matches the Checkout and the product's paper.
  The warning: cream against a white email or invoice is only **1.10:1**, so the "brand band" will barely read as a band.
  The olive tile in the middle of it does the branding, not the band. If the band looks washed out beside a white page,
  that is expected, not a mistake. **Do not** switch the brand colour to olive to "fix" it: the olive tile would vanish
  into an olive band.

- **Q-M1 — Drop the "FieldLogicHQ - " prefix from the Stripe product names? (blocks M25 to M29. Recommendation: yes, drop it.)**
  The setup guide (Step 9) proposed this on 2026-11-06 and left it for you; the read-only audit accepts both spellings
  until you rule. Why drop it: Checkout, the receipt and the invoice already put "FieldLogicHQ" at the top, so a
  prefixed name reads "FieldLogicHQ" then "FieldLogicHQ - Club" one line below; the app's Plan & billing page, the pricing
  page and the help all say plain "Club", so the prefix is the only place the two differ; and there is one business on this
  Stripe account, so the prefix tells you nothing in your own dashboard either. Names to type, exactly: `Premium Coaches
  Portal`, `Tournament Plus`, `League Plus`, `Club`, `Club · Association` (the free Tournament and League floors have no
  Stripe product). If you say yes, rename in Test and Live, then ask Claude to re-run the read-only audit.

- **Q-M2 — Premium Coaches Portal description. DRAFT — owner to approve. (blocks M25)**
  `Everything one competitive team runs on: roster, schedule, lineups, documents and team money, plus a tournament to host.` (120 characters)
  Built from the pricing card's own inclusion list ("one competitive team", roster, lineup builder, schedule, team budget
  and dues, documents, the one included tournament). Left out on purpose: price, trial, seat counts, "plus taxes", and the
  Founding Season (closed).

- **Q-M3 — Tournament Plus description. DRAFT — owner to approve. (blocks M26)**
  `For events teams register for: public registration, fee tracking, check-in, volunteers and schedule tools.` (106 characters)
  Built from the card's lead line (registration, payment tracking, check-in, volunteers, generators). It says "fee
  tracking" because the platform records what teams paid and never takes the money. Left out: "unlimited", the 14-day trial,
  prices.

- **Q-M4 — League Plus description. DRAFT — owner to approve. (blocks M27)**
  `Run house league seasons: registration, divisions, standings and a public league page. Includes Tournament Plus.` (112 characters)
  Built from the card ("Everything in Tournament Plus", house league registration, divisions, seasons and standings, the
  public organization page). League Plus is not on sale until the Club release (Facts doc, 2026-11-06), so nobody sees
  this text until then; typing it now is harmless.

- **Q-M5 — Club description. DRAFT — owner to approve. (blocks M28)**
  `For clubs with up to 15 teams: tournaments, house league, rep teams, accounting and Premium Coaches Portal for every team.` (122 characters)
  Built from the card ("the complete operating system for established clubs", dropped as jargon). **This one pins a
  number**: "up to 15 teams" is the Facts doc's Club band and the only thing that tells a buyer on Checkout that Club
  and Club · Association are different. If that band ever moves, this and Q-M6 are the two descriptions to retype.
  Left out: the 90-day trial (Checkout shows its own trial line), price.

- **Q-M6 — Club · Association description. DRAFT — owner to approve. (blocks M29)**
  `Everything in Club, for associations with up to 30 teams.` (57 characters)
  The card says "up to 30 on Club · Association"; the Facts doc says "15–30 teams (custom > 30)". I used "up to 30" so the
  two bands never both claim 15. Above 30 teams is a custom plan set by platform admin, not a Stripe product.

- **Q-M7 — Bank-statement name. My ruling differs from the old brief. (blocks M22 and M23)**
  **✅ RULED by the owner 2026-11-06:** statement descriptor FIELDLOGICHQ (12 characters), shortened FIELDLOGIC (10 characters). Not FLHQ.
  The archived PM brief said full `FIELDLOGICHQ`, short `FLHQ`. **I recommend `FIELDLOGICHQ` (12 characters) and
  `FIELDLOGIC` (10 characters) instead.** Reason: "FLHQ" is not recognisable. A coach or a club treasurer who sees four
  letters on a statement cannot tie them to a product they signed up for online, and "I don't recognise this charge" is
  the commonest reason for a card dispute, which costs us a fee and a lost sale. "FIELDLOGIC" is the longest recognisable
  stem that still fits the 10-character short form. Stripe's rules as I recall them (it will refuse a bad value and say
  why): 5 to 22 characters, letters, numbers and spaces only, at least one letter, none of `< > \ ' " *`. A new
  descriptor changes new charges only.

- **Q-M8 — Support email on Stripe: `hello@fieldlogichq.ca`, not the Gmail address. (blocks M17)**
  **✅ RULED by the owner 2026-11-06:** support email on Stripe is hello@fieldlogichq.ca (an inbox the owner reads). The support@ stray in C-M4 stays a code follow-up.
  The brief says the admin inbox is `fieldlogichq@gmail.com`. That is the platform's internal inbox. The branded address
  already exists in the code: `hello@fieldlogichq.ca` is the sender and reply-to of every email the product sends, the
  account page's support link, and `PLATFORM_CONTACT_EMAIL` (the address printed on our own invoices). Putting the Gmail on
  Stripe's receipts would show a customer two different addresses for one company. **Please confirm that
  `hello@fieldlogichq.ca` is an inbox you read.** One stray: the "organization closed" email types
  `support@fieldlogichq.ca` (C-M4); tell me if that alias exists.

- **Q-M9 — Support phone number? (blocks M18; recommendation: leave it blank)**
  **✅ RULED by the owner 2026-11-06:** settled by action: support phone left blank.
  I found no phone number anywhere in the repo (the Terms draft has a `[TELEPHONE NUMBER]` placeholder, and /legal's
  Ontario note says the Terms should carry one). Stripe's field is optional. A number typed here prints on every receipt, so
  add one only if a real person will answer it. Same answer as the Terms: decide once.

- **Q-M10 — Mailing address on Stripe's public details? (blocks M20; recommendation: leave it blank)**
  **✅ RULED by the owner 2026-11-06:** settled by action: mailing address left blank on Stripe.
  FieldLogicHQ is a sole proprietor; an address typed here prints on receipts and may be a home address. Leave it off
  unless there is a business mailing address you are happy to publish. Whatever /accounting needs for the tax registration is
  a separate matter and may print on invoices on its own: /accounting should say where.

- **Q-M11 — Switch on Stripe's "upcoming renewal" reminder email? (blocks M14; recommendation: yes, at least for yearly plans)**
  **✅ RULED by the owner 2026-11-06:** no Stripe renewal reminder for now (see Q-S2). The upcoming-renewals switch stays OFF, and the Terms promise no renewal reminder until our own email exists.
  Nothing of ours reminds a customer that a plan is about to renew (we email at trial end, on failure and on cancel). A
  yearly plan charging $390 or more with no warning is the classic cause of a dispute. /legal should say whether Ontario
  consumer rules or the card networks require the reminder; until they answer, my recommendation is on, 7 days before.

- **Q-M12 — Confirm: the failed-payment and trial-ending emails are OURS, so Stripe's are switched off. (blocks M11, M12)**
  **✅ RULED by the owner 2026-11-06:** ours. Our app sends the failed-payment and trial-ending emails; Stripe's versions are switched off. Stripe keeps receipts, card-expiring and renewal reminders.
  Our webhook already tells a club's owners when a subscription payment fails (in the app, plus an email by default for
  owners and admins) and emails the owner three days before a trial ends. If Stripe's own versions stay on, the customer
  gets two. Ours wins because it goes to the club's current owners (Stripe's goes to whoever the Stripe customer email
  was at checkout) and follows our pause rules. Stripe's receipts, card-expiring and renewal reminders stay Stripe's, because
  we send none of those. Say so if you would rather Stripe send the failed-payment email: then ours must be turned off in
  code, and that is a separate change.

- **Q-M13 — Confirm: "plus applicable taxes" is typed nowhere in Stripe. (affects M2 only)**
  The brief expected a price-line row. I do not think one belongs. When tax is on, Stripe prints its own tax line and total on
  Checkout, the invoice and the receipt, which is true for every buyer (13% for Ontario, 0% for a verified US buyer). A
  sentence in a product description would be wrong for the US buyer and wrong everywhere until the tax ships. The product's
  own pages keep the sentence (Facts doc, T4); only Stripe's pages go without it.

- **Q-M14 — /design rows D17 and D18 name buttons the product does not have. (no row blocked)**
  D17 says "Billing page → **Manage billing**". There is no such button. The door that opens the portal is labelled
  **Payment method & invoices** in the app, the coach billing screen and the help (`lib/plan-billing-words.ts`); "Manage
  Billing" appears only as the button in the trial-ending email (C-M2). D18's button names ("Update", "Cancel plan", "View
  invoice history") are Stripe's own words from memory, as /design said; I list what I believe a customer sees in M6, from
  the features our code turns on. Please follow the real label in the walk; I did not edit /design's rows.

- **Q-A1 — Is `FieldLogicHQ` on your CRA account as the operating name, and is it registered with ServiceOntario? (blocks nothing; affects A13)**
  **✅ RULED by the owner 2026-11-06:** yes, add FieldLogicHQ as the operating name on the CRA business account (owner action; pairs with Q-L3).
  Documents may lawfully show a trading name, but a club treasurer who checks our number on the CRA's online checker sees
  whatever name the CRA holds. If only your personal name is there, they see a mismatch. Check My Business Account; if the
  trading name is missing, ask CRA to add it. Separately, a sole proprietor trading under another name generally has to
  register it in Ontario (Business Names Act); the facts file still says unconfirmed. Recommendation: do both before the
  first live invoice; `/legal` to say what the missing registration costs.
- **Q-A2 — Which address (if any) prints on our documents? (A14)** Recommendation: none on the Public details page, and look
  **✅ RULED by the owner 2026-11-06:** settled by action: no address on Stripe's Public details (Q-L2: phone and address go on the Terms page later).
  at what the first live invoice prints anyway. Not a tax requirement.
- **Q-A3 — Invoice prefix `FLHQ` and one count for the whole account? (A4)** Recommendation: yes to both, before the first live
  **✅ RULED by the owner 2026-11-06:** invoice number prefix FLHQ, one running count for the whole account, set before the first live invoice.
  invoice. Say so if you would rather `FIELDLOGIC`.
- **Q-A4 — One footer sentence on all our invoices (disagreement with M8). (A5)** The code already prints
  **✅ RULED by the owner 2026-11-06:** the footer on every invoice is `Questions: hello@fieldlogichq.ca.` (the words the fee invoices already print from our code). Template only, no code change. M8 superseded.
  `Questions: hello@fieldlogichq.ca.` on fee invoices and that overrides the dashboard template. Recommendation: type those
  exact words in the template. If /marketing prefers the longer sentence, the code must change instead and that is a promote.
- **Q-A5 — Reword the fee-invoice memo now, or wait for D1? (A16; recommendation: now.)** The memo says Stripe's fees "are
  passed on to every club", but we tax the fee as consideration for our own payment service, and the accounting finding
  (`RECOVERED_STRIPE_FEES_TAX.md`) is that a true pass-through (agency) does not apply here. A club's accountant who reads
  "passed on" and then sees GST/HST has a fair question. A neutral line that is true under either answer: "Stripe fees on
  {club}'s online payments, billed at the fee Stripe charged us." Needs /marketing's wording and a code change (C-A1).
  Whether the payment service is taxable at all (D1) is still open: Stripe itself treats its own processing as exempt, which a
  professional should weigh. You ruled no professional gate; this stays your call.
- **Q-A6 — Statement descriptor (no row).** No accounting objection to `FIELDLOGICHQ` / `FIELDLOGIC` (Q-M7): it matches the name
  **✅ RULED by the owner 2026-11-06:** settled: statement descriptor FIELDLOGICHQ / FIELDLOGIC entered (Q-M7).
  on the invoice, so a treasurer can tie a statement line to a document. I agree with rejecting `FLHQ` there.

- **Q-L1 — Must the Terms and Privacy pages be live before the first live sale? (blocks L1, L2, L5 and C-L1; recommendation: yes, publish both first.)**
  **✅ RULED by the owner 2026-11-06:** yes, publish Terms and Privacy at https://www.fieldlogichq.ca/terms and /privacy before any further live sale. A /legal + /plan session finishes the drafts and builds the pages.
  Plainly: **no statute stops you taking the money, but I would not take the first one without the pages.** Why, from what the
  product does today. (1) **Privacy** is owed now, not at the sale: PIPEDA already expects a published, findable policy for the
  account holders you hold information on, and none exists (the draft is v0.1, owner items P1 to P6). (2) **Terms** are what
  make a coach's purchase lawful in Ontario. A coach buying Premium is a consumer; the online-sale rules want the cancellation
  and refund terms shown in a form the buyer can keep, an express "I accept", and a copy within 15 days. Today there are no Terms,
  no tick-box and no copy email, so each coach would hold a statutory right to cancel and be refunded (30 days from the sale if
  no copy is sent). That is a refund exposure, not a ban. (3) **Premium checkout is already open on production** (live since
  2026-07-24, no trial, $29 a month or $290 a year) with no Terms behind it and, until the tax promote, no tax line (A2). That is the
  single riskiest thing in this checklist, and it does not need a Stripe setting to fix. (4) A **club** buying a plan is an
  organization, so the consumer rules do not apply; for clubs the Terms are strongly advisable (liability, renewal) rather than
  legally required. **Before publishing:** owner items O1 to O6. *(Corrected by the orchestrating session 2026-11-06: the Terms
  draft's note that its renewal-date cancel paragraph "cannot be published until the renewal-date behaviour ships" is stale.
  Cancel-at-the-renewal-date reached production in the 2026-11-05 promote (release history), so that precondition is met and
  the draft's own note should be updated when the Terms are next edited.)* **URLs to type once live, on
  the one canonical site (`www.fieldlogichq.ca`; `.com` redirects to it):** `https://www.fieldlogichq.ca/terms` and
  `https://www.fieldlogichq.ca/privacy` (both words are already reserved so no club can take them, `lib/reserved-slugs.ts` line 33).
  The pages must open without signing in and show the version and effective date.
- **Q-L2 — Phone number and mailing address for the Terms (blocks the Terms; settles Q-M9, Q-M10, Q-A2). Recommendation: a number with voicemail you check, and a commercial mailbox with a street address, not your home.**
  **✅ RULED by the owner 2026-11-06:** do NOT hold the Terms for this. Publish both pages with the email address as the contact now; add a phone number and a mailing address later. Known gap, accepted: for a coach buying as an individual in Ontario, /legal reads the online-sale rules as asking for a phone and a business address too, so the coach's cancellation right is narrowed but not fully closed until they are added (the Terms session confirms against the regulation text). Clubs and the Privacy page are complete with email.
  The online-sale rules for a consumer ask the seller to give a telephone number and a business address; I could not fetch the
  regulation's text this session (the topic file says so), so treat "phone and address" as the safe reading. They go on the **Terms
  page and in the purchase email (C-L2), not on Stripe's pages**, so /marketing and /accounting are right to keep them off the
  receipt and the Public details. A bare PO box may not count as an "address" (I am not certain), so a mailbox with a street address
  is the safer choice and it also keeps a home address off a public record. The same address is likely to be asked for when you
  register the name (Q-L3) and by CASL for any commercial email. This is where I would ask a lawyer one question, not before the pages go up.
- **Q-L3 — Register "FieldLogicHQ" with ServiceOntario before the first live sale? (answers Q-A1's "what does a missing registration cost"; recommendation: yes, it takes minutes.)**
  **✅ RULED by the owner 2026-11-06:** yes, register FieldLogicHQ with ServiceOntario before the first live sale (owner action; pairs with Q-A1).
  **✅ DONE 2026-11-06:** registered as a business name for a sole proprietorship (Ontario Business Registry; number in the
  owner's records and the accounting facts). Stripe: Legal business name = the owner's own legal name as on the CRA account
  (A12); Public business name (and "doing business as", if offered) = `FieldLogicHQ` (A13). Still owed: the CRA operating name (Q-A1).
  From my memory of Ontario's Business Names Act (not re-read this session): a sole proprietor trading under a name that is not
  his own full legal name has to register it; not doing so is an offence with a fine, and an unregistered business can be
  barred from suing to enforce its contracts until it registers. The risk in practice is small but one-sided: it matters on the
  day a customer disputes a charge. The registration is a public record. It also makes the Terms' "seller" line true (the owner,
  trading as FieldLogicHQ). Do it with the CRA operating-name check (Q-A1).
- **Q-L4 — Add a required tick-box at Checkout? (blocks C-L1; recommendation: yes, on every subscription Checkout, not just Premium.)**
  Stripe can show a required "I agree to the Terms" box (`consent_collection.terms_of_service`) and records on the session that it was
  accepted. That is the cheapest honest way to give a coach the "express chance to accept or decline" the rule asks for, and it is the
  only acceptance step that exists anywhere in the product (signup has none). Stripe's other setting, the line "by confirming you
  agree to the terms" beside the Pay button, is **implied** agreement and does not meet "express"; use it only as a stop-gap. Two
  limits: Stripe records "accepted" but **not which version**, so our code must store our own Terms version on the purchase (C-L1);
  and the box is not a substitute for the signup acceptance in the Terms draft (a separate product item). I would use it for clubs too: one code path, and it gets
  the club's agreement to the liability and renewal terms.
- **Q-L5 — How many days before a renewal do we remind, and who sends it? (rules on Q-M11; recommendation: Stripe sends it, 30 days for yearly plans if Stripe allows that number, otherwise change the Terms to the number Stripe can send.)**
  **✅ RULED by the owner 2026-11-06:** no renewal reminder is sent for now (Q-S2), so the Terms draft's section 8 promise of 30 days' notice on yearly plans must come OUT before the Terms are published (the Terms session does it). Re-add it on the day our own reminder ships, with the timing it actually sends.
  Not required by Ontario's current consumer law for an online subscription, and not required by CASL (it is a message about an
  existing paid account). Advisable for three reasons: Ontario's newer Consumer Protection Act, 2023 (passed, in-force date not
  confirmed) is expected to bring renewal and easy-cancel rules; Québec law already has them; and an unannounced $290 charge is the
  textbook chargeback. I also understand the card networks expect a reminder before a yearly renewal or a trial turning into a charge, but I have not read their rules this session. Sender: **Stripe's**
  is fine, because we send none, and it keeps one sender for the money emails. Two cautions: Stripe sends to the email on the Stripe customer, not necessarily
  today's owner; and the Terms draft currently promises "at least [30] days before ... the account owner", so **the Terms must
  say the number and recipient that are actually sent** (a promise the product cannot keep is a defect). /marketing wrote 7 days; I
  would rather be inside 7 to 30 days than at the edge, but both are lawful. Pick one number and tell /legal so the Terms match.
- **Q-L6 — The club payments terms are an empty placeholder (no row; flagged for /plan and you).** A club treasurer ticks a box
  before "Set up payouts" and we record the version, person and time, but the text is "[PAYMENTS TERMS — counsel to write]" and the
  recorded version is `placeholder-counsel-pending` (`lib/online-payment-words.ts`, lines 37 to 41). That records agreement to nothing.
  It is not a gate (owner 2026-11-04) and it does not block a plan sale, but it blocks nothing only because nobody is taking online
  payments yet. Backlog L3 in the legal index; write it before the first club takes a real payment.

---

## What the dashboard does NOT control (found before the pass)

- **The customer portal ignores its dashboard settings.** Our app creates its own portal configuration ("FieldLogicHQ
  portal v2") and names it on every session, so the portal's headline, its privacy and terms links, and its features
  come from our code. The dashboard's Customer portal page only matters for a portal nobody opens. Today our
  configuration sets features only, with **no headline and no privacy or terms link**.
- **Checkout shows no terms consent and no custom text.** None of our Checkout sessions asks for terms acceptance or
  adds wording of its own.
- **There is no public Terms of Service or Privacy Policy page in the product.** Drafts exist in the legal folder only.
  Stripe's public details, Checkout and the portal can link to them only once they are published.
- **Product names are checked by the read-only audit** against the plan labels in the app.
- **(design) Our code never sets colours, icon or logo on any Stripe page.** No Checkout, portal or connected-account
  call passes branding. Everything on Stripe's pages therefore comes from Settings → Branding (and, for clubs, the Connect
  branding page), so the whole look is settable from the dashboard in a few minutes. Nothing here needs a code change
  except the wordmark image (C-D1).

---

## 1. Settings → Branding (icon, logo, colours)

I am working from my knowledge of Stripe's Branding page, not from a live look. The field names below may be worded a
little differently on your screen. Where I am unsure I say so in the row.

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D1 | Settings → Branding → **Icon** | Upload `C:\Users\b2cow\AppData\Local\Temp\claude\1d2dc0e6dffa49eb\b7287313-b9ae-4baa-9527-c6ce30f185f8\scratchpad\stripe-brand\fieldlogichq-icon-512.png` (olive rounded tile, cream FL). This **replaces the old dark tile with the lime FL**: after saving, the preview must show an olive square, not a dark one. Keep the 512 px size. Why the tile and not the bare mark: the tile stays visible on any band (olive on cream 5.83:1, and the cream FL on olive the same), and it survives Stripe cropping it to a circle (I checked: the FL's corners sit inside a circle drawn on the tile). The bare mark would be small and unframed on a cream band. **Look for:** the corners outside the rounded tile show cream or white, never black; if a black or white corner shows anywhere, tell me and I will ask for a full-square export. | /design | ☑ | ☑ |
| D2 | Settings → Branding → **Logo** | **Leave empty for now, and remove any old logo that is in there** (the old typewriter "FIELD·LOGIC·HQ" or the dark mark). The wordmark logo is Code follow-up C-D1; when it exists, upload it here. See Q-D2. **Look for:** nothing from the retired look left anywhere in this panel. | /design | ☑ | ☑ |
| D3 | Settings → Branding → the switch that shows the **logo instead of the icon** (I believe it reads "Use logo instead of icon", unsure of the exact label) | **Off** until the wordmark logo from C-D1 is uploaded; **On** after. With it off, Stripe shows the tile and the plain business name. With it on and the logo uploaded, the lockup replaces both. **Look for:** if the switch does not exist on your screen, Stripe is choosing by itself (logo wins when there is one); then simply keep D2 empty. | /design | ☑ | ☑ |
| D4 | Settings → Branding → **Brand color** | `#F8F4ED` (the cream paper). Agrees with the starting recommendation. Contrast on it: ink 15.06:1, olive 5.83:1. Against a white page it is only 1.10:1, so expect a faint band (Q-D4). | /design | ☑ | ☑ |
| D5 | Settings → Branding → **Accent color** | `#57651E` (olive). Paints the Pay button, every link and the focus ring (one colour for all three). Numbers: white label on it **6.39:1**; link on white **6.39:1**; link on cream **5.83:1**; ring against white **6.39:1**. Stripe picks the label colour by itself; it should pick white. Blocked on **Q-D1**. | /design | ☑ | ☑ |
| D6 | Settings → Branding → anything that sets the **button colour, background colour, font or corner shape** for Checkout separately (newer Stripe screens have a "Checkout" customize panel; I am not sure yours does) | **If a separate Button colour exists:** olive `#57651E`, the same as D5. I considered lime for the button and olive for links, and rejected it: a lime button on Stripe's white panel is 1.17:1 against its surroundings, and the product only gets away with lime because its buttons carry a 1px olive edge that Stripe cannot draw. **Background:** the cream `#F8F4ED`. **Font:** Inter if offered, otherwise leave Stripe's default. **Corners:** "rounded" (the product's buttons are 10px corners), not "pill" and not "sharp". **If none of these exist,** skip the row and say so. | /design | ☐ | ☐ |

## 2. Checkout (and our own success and cancel pages)

Our app opens a Checkout from five places: a plan purchase (club or tournament), a Coach Premium purchase, saving a card
without a purchase, bringing a team in, and choosing next season's plan. Look at **one of each kind** at least once; they
are different screens (D13 is the card-save one).

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D7 | A Coach Premium Checkout (start one from the coaches portal; stop before paying) → the **top of the page** | **Look for:** the olive tile (and the business name beside it) at the top, on a cream area. No dark tile, no lime FL. On a phone the tile and name must still fit on one line without being cut. | /design | ☐ | ☑ |
| D8 | Same page → the **left or top summary panel** (product name, price, trial line) | **Look for:** a cream ground with dark brown text, readable at a glance (the text should be near-black brown on cream, 15.06:1). The plan's name and the price are the two biggest things on the panel. If Stripe shows the summary on pure white instead of cream, that is Stripe's layout, not a mistake (the brand colour only reaches part of the page). | /design | ☐ | ☑ |
| D9 | Same page → the **links** ("Add promotion code", any terms or privacy link, "Back") | **Look for:** olive text, noticeably different from the dark body text, with an underline or hover underline. If a link looks the same as plain text, the accent has gone wrong (D5). | /design | ☐ | ☐ |
| D10 | Same page → the **Pay / Subscribe button** | **Look for:** a solid olive button with a **white** label, readable without squinting. This is the row that answers **Q-D1**: take the screenshot and decide. The button should read as the same olive as the tile at the top. | /design | ☐ | ☑ |
| D11 | Same page → click into the **card number field** and tab through the fields | **Look for:** an olive ring or edge around the field you are in, clearly visible against the white. Also select a payment method card (if more than one is offered): the selected one should show an olive edge. A faint or missing ring means the accent is too light. | /design | ☐ | ☐ |
| D12 | Same page → the **tax and total lines**, and any red error | **Look for:** the dim grey text for tax and "billed after trial" is still readable against its ground (Stripe chooses these greys; I cannot check them from here). Error messages stay Stripe's red, which is correct and not ours to change. | /design | ☐ | ☐ |
| D13 | A **card-save** Checkout (Billing page → add or update a card; it has no price) | **Look for:** the same icon, band, olive button and links as D7 to D11, with a "Save" style button and no product or price panel. It is the plainest Checkout we have, so it shows the branding most clearly. | /design | ☐ | ☐ |
| D14 | **Our success page after a Coach Premium purchase** (we send the buyer to our own "Premium is on for your team" page) | **Look for:** cream paper and the warm card, the same family of look as the Stripe page they just left, so the jump from Stripe to us feels like one product. The only visible difference is the button: Stripe's was olive, ours is ink on lime. That difference is accepted (Q-D1). **Do not redesign this page.** | /design | ☐ | ☐ |
| D15 | **Our return after a club or tournament plan purchase, a team bring-in, a card save and a next-season choice** (each sends the buyer back to a billing or admin page with a green notice) | **Look for:** the notice appears on the billing page ("plan is active", "card saved", "next season set"). These pages are the product's own screens; they need no match to Stripe beyond being in the same cream-and-olive family. If any of the four lands on a plain or dark page that looks unrelated to the Stripe page just left, note which one. | /design | ☐ | ☐ |
| D16 | **The cancel return** from any Checkout (click Stripe's back arrow) | **Look for:** you land back on the screen you started from, with no error and no success notice. | /design | ☐ | ☐ |
| M1 | Any Checkout (Coach Premium, club or tournament plan) → the **summary panel**, the product name and the line under it | **Type nothing here; look.** The name is the product name from M25 to M29, the line under it is the description from the same rows. The price, billing period, trial line and tax lines are Stripe's own, built from our price and our trial setting, so there is no price or trial wording of ours to check. **Look for:** exactly the approved name and description, no "FieldLogicHQ - " prefix, no leftover wording from an old product. | /marketing | ☐ | ☐ |
| M2 | Same page → the **price and tax lines** | **Type nothing: "plus applicable taxes" goes nowhere in Stripe (Q-M13).** When our code turns tax on, Stripe prints its own tax line and total. **Where that code stands (checked 2026-11-06):** GST/HST Stage 2 (automatic tax and the business tax-ID box) is committed and walked on dev, so the **Test sandbox** should already show a tax line and a business tax-ID box (Stripe's labels). I found no record that Stage 2 is on production (its migrations are still owed, and the Facts doc says the phrase and the tax reach production together). **So in Live, before that promote, expect NO tax line, and that is correct.** **Look for:** Test = a tax line and the tax-ID box; Live = tick this row only after the Stage 2 promote, with the tax line present. | /marketing | ☐ | ☐ |
| M3 | The **page you land on** after Checkout, and after pressing Stripe's back arrow | Nothing to type. Coach Premium: the tab reads "Premium Coaches Portal — FieldLogicHQ", the same name as the Stripe product (M25). Plan or tournament purchase: the green notice reads "Your plan is active. Everything it includes is open now." Card save: "Your payment method is on file." None of them names a plan or a price, so they cannot disagree with the Stripe page. **Look for:** the notice shows; back arrow shows no notice (D15, D16). | /marketing | ☐ | ☐ |
| A1 | **Test sandbox**, any subscription Checkout started from the dev site (Stage 2 code) → the **price and tax lines** | **Look for:** Stripe's own tax line between the subtotal and the total, named for the buyer's province (Ontario reads "HST - Canada" with 13%; Alberta, BC, Saskatchewan and Manitoba 5% GST; Nova Scotia 14%; New Brunswick, Newfoundland and PEI 15%), a total equal to price plus tax, and the box where a buyer enters a business tax number. A **0% line for a Canadian address is a defect: stop and tell me.** No Branding setting (D1 to D6, D32) can hide, reorder or recolour this line; if it is missing in a screenshot, the cause is the code or the Canada registration, never the branding. I **agree with Q-M13**: nothing typed about tax in Stripe. | /accounting | ☐ | ☐ |
| A2 | **Live** Checkout, **before the Stage 2 promote** | **Look for (do not buy anything real):** this row is a rule, not a screenshot. The live Canada registration, the exclusive setting and our number on the invoice template are set (2026-11-06), but the production code does not yet ask Stripe to work out tax, so a live subscription bought today shows **no tax line and is charged $0 tax, and the GST/HST on it is owed by us out of pocket.** Do not complete a real live purchase, and do not let a comped plan convert to a paid one, until the promote. After the promote: tick this row when a live Checkout (stopped before paying) shows the tax line from A1. | /accounting | ☐ | ☐ |
| L1 | Settings → Business → Public details → **Terms of service** and **Privacy policy** link fields (Test and Live). This is where Checkout, receipts and the invoice page get their links. | **Blank until the pages are live (agrees M21).** Then: Terms `https://www.fieldlogichq.ca/terms` · Privacy `https://www.fieldlogichq.ca/privacy` (Q-L1). **Do this before L2, L3 and C-L1**, because Stripe refuses a required Terms tick-box until the Terms link exists. **Look for:** both links open without signing in, in a private window, and show the version and effective date. Never type the draft's file path or a page that 404s. | /legal | ☐ | ☐ |
| L2 | Settings → Checkout (the Checkout customisation page) → **Legal policies** on; and the setting **Display agreement to legal terms** | **Legal policies: On** once L1 is done, so the two links show on every Checkout. **Display agreement to legal terms: On only as a stop-gap, and Off once C-L1 ships the real tick-box** (Q-L4): that setting only prints "by confirming you agree", which is implied agreement, and Ontario's rule for a coach buying as an individual asks for an express chance to accept. **Look for:** a "Legal policies" link at the foot of the Checkout page that opens the two pages. | /legal | ☐ | ☐ |
| L3 | Settings → Checkout → **Return and refund policies** | **Off.** Our refund position lives in one place, the Terms (section 8), and Stripe's refund panel is a second copy that would drift. Checkout's own subscription line and our one-sentence submit text (C-L1) say what a buyer needs at the button. **Look for:** no "Returns" or "Refunds" panel on Checkout. | /legal | ☑ | ☑ |
| L4 | Settings → Checkout → **Contact information** | **On**, showing the support email from M17 and the website from M19. Show a telephone number here only if Q-L2 gives one that also appears on the Terms page; never one on Stripe that the Terms lack. No address (agrees M20): the address belongs on the Terms page and the purchase email (Q-L2). **Look for:** the contact dialog on Checkout shows the email and website, and nothing the Terms do not also say. | /legal | ☑ | ☑ |
| L5 | **CODE, not a dashboard click (C-L1).** Any subscription Checkout → **just above the Pay button**, and the **checkbox** | Test/Live check after C-L1 ships: a **required, unticked** box reading `I agree to the Terms of Service and have read the Privacy Policy` (both linked), and the renewal sentence above the button (exact words in C-L1). **Look for:** the Pay button cannot be pressed until the box is ticked; the box is absent from the card-save Checkout (no price, no agreement being made). | /legal | ☐ | ☐ |

## 3. Customer portal ("Payment method & invoices")

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D17 | Billing page → **Manage billing** → the portal's **top** | **Look for:** the olive tile and business name on a cream band (the portal reads the same Branding page, not a separate one; the portal's own dashboard settings are ignored by our code). Headline and wording belong to /marketing. | /design | ☐ | ☐ |
| D18 | Portal → the **buttons and links** ("Update", "Cancel plan", "View invoice history", "Return to FieldLogicHQ") | **Look for:** the primary action in olive with a white label and the quieter links in olive text. "Cancel plan" must not look louder than the actions around it; if Stripe paints every button the same olive, that is Stripe's, and I would not fight it. | /design | ☐ | ☐ |
| D19 | Portal → **Return to FieldLogicHQ** | **Look for:** it brings you to the billing page without a notice or an error, and the billing page looks like the same family as the portal you just left. | /design | ☐ | ☐ |
| M4 | The door in the app that opens the portal (club Plan & billing, and the coach billing screen) | **Nothing to type.** The button is labelled **Payment method & invoices** (and reads "Opening payment portal…" while it opens). /design's D17 calls it "Manage billing"; that button does not exist (Q-M14). **Look for:** the label above, then the portal opening. | /marketing | ☐ | ☐ |
| M5 | Portal → the **headline** under the business name | **CODE, not a dashboard click (C-M1).** Words: `Payment method & invoices` (25 characters), the same words as the door that opened it. Until C-M1 ships there is no headline, which is acceptable. **Do not type anything into the dashboard's Customer portal page** (headline, links, features): our code passes its own portal configuration on every session, so the dashboard page does nothing for a customer and would only look like a setting that holds. **Look for:** the headline under the olive tile, once C-M1 has shipped. | /marketing | ☐ | ☐ |
| M6 | Portal → every **section and button** a customer sees. These are Stripe's own words, from my memory of Stripe's portal; your screen may word them a little differently. | From our features (`lib/stripe-portal-settings.ts`), a customer sees, top to bottom: **Current subscription** (plan name, price, renewal date, a **Cancel plan** button; once a cancel is waiting, **Renew plan** instead); **Payment method** (add or update a card); **Billing information** (name, email and tax ID can be changed; the address is shown but cannot be changed here on purpose, it is changed in our Plan & billing window); **Invoice history** (view and download); **Return to FieldLogicHQ**. **Must be absent:** any "Update plan" or plan-switch button (plan moves are the app's own). **Look for:** exactly those sections and no plan switch. | /marketing | ☐ | ☐ |
| M7 | Portal → **Cancel plan** → the confirmation page | Stripe's words, ours to accept, not change. Stripe calls it "Cancel plan" and spells it "canceled" (one L); the app says "Cancel and suspend {club}…" or "Cancel Premium…" and "cancelled". The spelling gate cannot reach Stripe's pages, so this one mismatch stays. **What must agree is the date:** Stripe says the plan ends on the renewal date (we set cancel-at-period-end), and the billing page must then show the same "Ends on" date. **Look for:** the two dates match. | /marketing | ☐ | ☐ |
| L6 | **CODE (C-L3).** Portal → the **privacy and terms links** under the headline | Same configuration version as the headline (C-M1): `business_profile.privacy_policy_url` = `https://www.fieldlogichq.ca/privacy`, `terms_of_service_url` = `https://www.fieldlogichq.ca/terms`. **Do not type them in the dashboard's Customer portal page** (our code overrides it, as M5 says). **Timing rule (answers C-M1's question):** the live account has no portal configuration yet, so bump the version once, in the promote that publishes the pages; if the pages slip, ship the headline alone and bump again later (cheap: a new configuration, the old one switched off). Do not hold a promote for this. **Look for:** two links at the foot of the portal that open the pages. | /legal | ☐ | ☐ |
| L7 | Portal → **Cancel plan** (the whole flow), compared with the Terms draft section 8 | **What the product does:** cancel at period end, no proration (`lib/stripe-portal-settings.ts` line 30); a cancel waiting can be reversed with **Renew plan**. **The Terms promise the same** (plan stays active to the end of the paid period, no charge after, change your mind with one click, no refund of the unused part), so the wording is honest **once the renewal-date behaviour is on production**; today production ends access at the moment of cancelling, which contradicts "stays fully active until the end". **Look for (Test, then Live after the promote):** cancel, then confirm the app still shows full access and an "Ends on" date equal to the renewal date. Do not publish the Terms before this passes. | /legal | ☐ | ☐ |

## 4. Hosted invoice page and invoice PDF

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D20 | Open an invoice's **hosted page** (Stripe invoice link from the dashboard or the email) | **Look for:** the olive tile (or, once C-D1 exists, the wordmark) at the top, an olive "Pay" button with a white label when the invoice is unpaid, and olive links ("Download invoice", "Download receipt"). Amounts and line items in dark text on white. A paid invoice shows no button. | /design | ☐ | ☐ |
| D21 | **Invoice PDF** (download it) | **Look for:** the logo slot at the top of the page shows the olive tile (small and square) while the logo is empty. That works but is plain; it is the main reason C-D1 exists, because on paper the NAME is what a customer recognises. Check that the olive prints as a flat solid with no fringe, and that the accent colour appears only on a few small items (Stripe uses it sparingly on the PDF; I am not certain which). | /design | ☐ | ☐ |
| D22 | Invoice PDF → **black-and-white print** (print preview in greyscale) | **Look for:** the tile still reads as a dark square with a light FL, and no text is lost. Olive converts to a mid-dark grey, which is fine. | /design | ☐ | ☐ |
| M8 | Settings → Billing → Invoice template → **Footer** (the path may differ on your screen) | `Questions about this invoice? Email hello@fieldlogichq.ca.` (58 characters, plain letters only). Leave **Memo** empty. What the law requires on an invoice (the GST/HST registration number and the like) is /accounting's; this line is only the help line. **Look for:** the footer on the hosted invoice and the PDF, and the same address as M17. | /marketing | ☐ | ☐ |
| A3 | Settings → Billing → Invoice template (may be Settings → Billing → Invoices) → **Account tax IDs** (I believe the field is called "Default account tax IDs"; label unsure) | Select the **Canada GST/HST** number so it prints on every invoice, receipt and credit note: your CRA number as printed on the CRA letter, nine digits then `RT` then four digits (normally `RT0001`). I do not write the number in the repo by rule. The owner set it on 2026-11-06 (`STRIPE_TAX_SETUP.md`), but nobody has yet seen it print on a **live** document. **Do not also type it into the footer, the memo or a custom field:** two copies can disagree, and Stripe prints the real one in its own place. One check: my notes only say the number "ends 002"; that could be the last digits of the nine-digit business number, but if the whole number ends `002` and not `0001`, compare it with the CRA letter character by character. **Look for:** the number under the business name on the invoice PDF, the hosted page and a credit note, and still legible in the greyscale print preview (D22). | /accounting | ☑ | ☑ |
| A4 | Same page → **Invoice numbering** (prefix and numbering scheme) | Prefix `FLHQ`; scheme **one running number for the whole account**, not a separate count per customer. Invoices then read `FLHQ-0001`, `FLHQ-0002`, and the books and a CRA reviewer see one unbroken sequence (per-customer numbering gives every club its own "0001"). Set it **before the first live invoice**: changing a prefix later starts a new count and leaves a gap that has to be explained. `FLHQ` is fine here although /marketing rejected it for the bank statement (Q-M7): the invoice prints the full business name beside it, so nobody has to recognise four letters. Acceptable alternative: `FIELDLOGIC` for consistency with M23. Test and Live count separately. | /accounting | ☑ | ☑ |
| A5 | Same page → **Footer** | **I disagree with the M8 wording.** Our own code already puts `Questions: hello@fieldlogichq.ca.` as the footer of every fee invoice, invoice by invoice, and that overrides the template. So M8's `Questions about this invoice? Email hello@fieldlogichq.ca.` would show on subscription invoices and a different sentence on fee invoices. Type the code's exact words in the template: `Questions: hello@fieldlogichq.ca.` (no code change, no promote). No tax wording, registration number or "plus taxes" in the footer (see A3, Q-M13). See Q-A4. | /accounting | ☐ | ☐ |
| A6 | Same page → **Memo** and **Custom fields** | **Both empty on the template (agree with M8).** The memo is for a one-off note; the fee invoices carry their own memo from code (see A16, Q-A5). Custom fields: none. | /accounting | ☑ | ☑ |
| A7 | Same page → any switch that changes how **tax** or **line items** are shown ("Amount tax display", "show tax", line-item grouping; labels unsure) | Leave Stripe's default: tax as its **own line under the items, with the rate and the amount it applies to**. Do not choose any option that shows only a total, or folds tax into the item price. Our prices are tax-exclusive. **Look for** on the first Test invoice: each taxed line, then "HST - Canada (13% on CA$...)" with the tax amount, then the total in **CA$**. | /accounting | ☑ | ☑ |
| A8 | **Live** invoice PDF: the whole-document check | **Never finalise a Dashboard invoice in Live just to look** (a finalised invoice is a real taxable sale and uses a number). Make a **draft** to yourself, view its preview, delete the draft; the preview shows everything except the final number. Then repeat on the first real invoice. **Must show (CRA's tiers since 2021: under $100 name, date, total; $100 and over add the tax charged and our registration number; $500 and over add the buyer's name, a description and the payment terms; our $30/$150 note in the brief is the old tiers):** (1) the word Invoice and its `FLHQ-` number; (2) the date; (3) `FieldLogicHQ` top left; (4) our GST/HST number (A3); (5) the buyer under "Bill to": the club's name, or the person who paid for it (both are lawful); (6) each line named by plan and billing period (the product name plus period is a sufficient description, so M25 to M29 must not be blank); (7) the tax line with rate and base (A7); (8) the total in CA$; (9) status "Paid" for a card plan, or the due date for a fee invoice (that is the payment term). | /accounting | ☐ | ☐ |
| A9 | The **first real credit note** (refund of a taxed invoice) | Already checked in the sandbox: it prints "Credit Note", its number, the original invoice number, the date, our name and GST/HST number, the buyer, and the tax reversed, which is everything the credit-note rule requires. **Look for:** the same on the live one, and that the number from A3 is present (the sandbox has it; live has never been seen). | /accounting | ☐ | ☐ |

## 5. Emails Stripe sends customers

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D23 | A **payment receipt email** (send yourself one in the sandbox) | **Look for:** a cream header band with the olive tile in it, then a white body. The band is only 1.10:1 against the white body (Q-D4), so it will look like a very pale strip with the tile on it; that is correct. Link and button in olive. | /design | ☐ | ☐ |
| D24 | An **invoice email** and a **payment-failed email** | **Look for:** the same header; the "Pay invoice" or "Update payment" button in olive with a white label. These are the emails where a customer must click, so check the button is the loudest thing in the email. | /design | ☐ | ☐ |
| D25 | Any of these emails opened in a **phone mail app and in dark mode** (Gmail or Apple Mail with dark mode on) | **Look for:** the olive tile still visible and the text still readable. Some mail apps invert pale backgrounds; a cream band can turn dark brown and the olive tile can look dim. If it becomes unreadable, report it. This is outside what Stripe lets us control; I am only flagging it so you are not surprised. | /design | ☐ | ☐ |
| D26 | The same emails with **images turned off** | **Look for:** the business name still appears as text. (Our own emails draw the name as text in Arial for this reason; Stripe's emails depend on its image.) | /design | ☐ | ☐ |
| M9 | Settings → Customer emails (may be under Settings → Emails) → **Successful payments** | **On.** The one receipt a customer gets for a plan charge. The app sends no receipt of its own for FieldLogicHQ plans (it does send family receipts for club dues, which is a different thing). | /marketing | ☑ | ☑ |
| M10 | Same page → **Refunds** | **On.** I found no plan-refund email of ours. | /marketing | ☑ | ☑ |
| M11 | Settings → Billing → Subscriptions and emails → the failed-payment email ("send an email when a card payment fails", exact label unsure) | **Off (Q-M12).** Ours goes instead. When Stripe reports a failed plan payment, the webhook tells the club's owners in the app and by email: title "Subscription payment failed", body "Your subscription payment could not be processed. Please update your billing information.", linking to Plan & billing. Both on = two emails for one failure. How many times Stripe retries is /accounting's. **Look for (M16):** exactly one failure email. | /marketing | ☑ | ☑ |
| M12 | Same page → the **trial ending** reminder, if the switch exists | **Off (Q-M12).** Ours goes instead: "Your trial ends soon", to the owner, when Stripe's trial-will-end event arrives (three days before by Stripe's default). | /marketing | ☑ | ☑ |
| M13 | Same page → **expiring cards** | **On.** The app sends nothing about an expiring card. | /marketing | ☑ | ☑ |
| M14 | Same page → **upcoming renewal** reminder | **SUPERSEDED by the owner 2026-11-06 (Q-S2): OFF until our own reminder exists.** Was: On, 7 days before, at least for yearly plans (Q-M11, /legal to confirm).** I found no renewal reminder of ours. | /marketing | ☑ | ☑ |
| M15 | Stripe emails → **who they are from** | The sender name is the public business name, `FieldLogicHQ`; replies go to the support email (M17). Our own mail shows as "FieldLogicHQ" from `hello@fieldlogichq.ca`, so a customer sees the same name from both. **Leave the custom email domain feature off**: it needs more DNS records beside our mail provider's and risks our own email delivery for no gain at launch. | /marketing | ☐ | ☐ |
| M16 | Test sandbox: **one failure, one email** | Fail a plan payment with the test card that fails after a trial (`4000 0000 0000 0341`, setup guide) and let the next charge succeed. **Look for:** exactly ONE email about the failure (ours, from `hello@fieldlogichq.ca`), none from Stripe, and exactly ONE receipt (Stripe's) for the success. For the trial reminder, use a trial in the sandbox and check only ours arrives. | /marketing | ☐ | ☐ |
| A10 | A **receipt for each kind of charge** (test sandbox first): Coach Premium, a club or tournament plan, a team bring-in, next season's plan | Every one of these is a subscription Checkout, so each makes a real **invoice**, and Stripe's receipt email (M9) links to both the invoice PDF and a receipt PDF. The **invoice PDF is the tax document** (it carries our GST/HST number and the tax line; a club needs it to claim its input tax credits). **Look for:** the email arrives; its "Download invoice" opens the PDF from A8. I could not confirm that the receipt PDF repeats our GST/HST number; if it does not, nothing is wrong, the invoice PDF is the one to give an accountant. The card-save Checkout charges nothing and needs no receipt. | /accounting | ☐ | ☐ |
| A11 | A **refund** made from platform admin (test sandbox) | Our code issues the refund as a credit note and asks Stripe to email it (`email_type: credit_note`), so the customer gets the s.232 document with the tax adjusted. Stripe's refund email (M10, on) may also arrive; two emails for one refund is fine because only the credit note is the document for the books. **Look for:** the credit note email, its PDF, the tax reversed. | /accounting | ☐ | ☐ |
| L8 | Settings → Billing → Subscriptions and emails → **upcoming renewal** reminder (agrees with M14 that it is **On**; this row sets the number) | **SUPERSEDED by the owner 2026-11-06 (Q-S2): OFF until our own reminder exists.** Was: **On, for yearly plans, at the number of days chosen in Q-L5** (recommendation 30 if Stripe offers it; otherwise the largest number Stripe offers up to 30, and the Terms are edited to say that number). The Terms draft section 8 promises 30 days; **/marketing's 7 days contradicts it.** Whatever is chosen must be the number the Terms print. **Look for (Test):** a yearly test subscription produces the reminder on the right day, from `FieldLogicHQ`, with the renewal date, the amount and a way to cancel or manage. Monthly plans: no reminder is needed (the charge itself is the notice, and each receipt arrives). | /legal | ☑ | ☑ |
| L9 | **CASL check on every Stripe email** (receipt, refund, failed payment if left on, expiring card, upcoming renewal, invoice): Settings → Customer emails and Settings → Billing → Subscriptions and emails | **Ruling: none of these is a commercial message, so none needs the recipient's consent or an unsubscribe link.** Each only confirms or completes a purchase already made, or gives factual information about an existing paid account, so on its face it does not encourage anyone to buy anything (the Act's test, s.1(2)); and if one were ever treated as commercial, s.6(6) lifts the consent requirement for exactly these kinds of message. I lean on the first reason, not the second: s.6(6) lifts consent only, and whether it also lifts the form rules is arguable (my own CASL topic file reads it narrowly), so the safe course is that none of them sells. **The one condition: no selling inside them.** Keep every promotional or "upgrade" switch in Stripe off and never add a marketing line to the invoice footer or custom text; a receipt that advertises another plan becomes a commercial message needing consent and an unsubscribe. **Sender identification:** it is satisfied in practice by the public business name `FieldLogicHQ` as the sender, the support email (M17) and the website (M19); the full mailing-address block CASL asks of a commercial message is not required of these, but the mailbox from Q-L2 would satisfy it if it ever were. **Look for:** open one of each; the sender reads `FieldLogicHQ`, a reply reaches `hello@fieldlogichq.ca`, and there is nothing promotional in it. | /legal | ☐ | ☐ |

## 6. Public details and the bank-statement name

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D27 | Settings → Business → Public details → **public business name** (as shown on Checkout, receipts and the portal) | **Look for:** it shows exactly `FieldLogicHQ`, one word, capital F, L and HQ, matching how the product writes it. Stripe cannot colour "HQ" olive in plain text, so the typed name is plain. The wording and statement descriptor are /marketing's and /accounting's rows; this row is only the spelling and casing. | /design | ☑ | ☑ |
| M17 | Settings → Business → Public details → **Support email** | `hello@fieldlogichq.ca` (Q-M8). Not the Gmail admin inbox. It is already the reply-to on all our mail. **Look for:** a reply to a Stripe receipt reaches the inbox you read. | /marketing | ☑ | ☑ |
| M18 | Same page → **Support phone** | **Leave blank** unless Q-M9 gives you a number a person will answer. | /marketing | ☑ | ☑ |
| M19 | Same page → **Website** | `https://www.fieldlogichq.ca` (the address the app itself treats as canonical; the setup guide uses it too). **Look for:** it opens the home page. | /marketing | ☑ | ☑ |
| M20 | Same page → **Support address** / business address shown to customers | **Leave blank** until Q-M10 is answered. | /marketing | ☑ | ☑ |
| M21 | Same page (or Branding) → **Privacy policy and Terms of service links**, and the same two fields on the Customer portal page | **Leave blank for now.** There is no published Privacy or Terms page yet (drafts only, in the legal folder). A link to a page that 404s is worse than none. Add both when /legal says the pages are live; the portal's two links are code (C-M1). | /marketing | ☑ | ☑ |
| M22 | Settings → Business → Public details → **Statement descriptor** | `FIELDLOGICHQ` (12 characters). See Q-M7. **Look for:** Stripe accepts it with no error. | /marketing | ☑ | ☑ |
| M23 | Same place → **Shortened descriptor** (the screen may ask for it only when you use dynamic suffixes) | `FIELDLOGIC` (10 characters). If the field does not exist on your screen, skip it and say so. **Look for:** the preview, if Stripe shows one, reads `FIELDLOGICHQ`. | /marketing | ☑ | ☑ |
| M24 | Each product (M25 to M29) → any **statement descriptor** on the product itself | **Leave empty on all five.** A product-level value overrides the account's and would put a second name on statements. | /marketing | ☑ | ☑ |
| A12 | Settings → Business → Business details → **Legal business name** (not the Public details page) | The owner's own legal name exactly as on the CRA GST/HST account (a sole proprietorship has no separate legal name; `FieldLogicHQ` is a trading name). This is for Stripe's identity checks and payouts; the documents print the public name (A13). **Look for:** it matches the bank account and the CRA letter. | /accounting | ☑ | ☑ |
| A13 | Settings → Business → Public details → **Public business name** | `FieldLogicHQ` (agree with D27). The rules accept it: an invoice needs "the supplier's name or trade name", and a credit note the same. Two things to settle first, neither blocks typing it: (a) the CRA's number checker shows the name on the CRA account, so `FieldLogicHQ` should be on that account as the operating name or a club treasurer validating our number sees a stranger (Q-A1); (b) a sole proprietor trading under a name other than his own generally must register it in Ontario; the facts file still says "unconfirmed" (Q-A1, /legal). | /accounting | ☑ | ☑ |
| A14 | Same page → **address** (and Business details → address) | Agree with M20 (blank on the Public details page). The law does not require our address on an invoice or a credit note, so a blank is lawful. **Look for:** on the first live invoice and credit note, what the header prints: the sandbox's note printed a PEI sandbox address, and the live account's head office address (set for Stripe Tax) may print instead. If it prints an address you do not want public, change it before the first live invoice. If Stripe will not leave it blank, a business mailing address or PO box is fine on the supplier's side. | /accounting | ☑ | ☑ |
| L10 | Settings → Business → Public details → **address** and **phone** (legal angle on M18, M20, A14) | **Agree: both blank on Stripe's Public details page, as long as the Terms page and the purchase email carry them (Q-L2).** The Ontario online-sale rule is met by what the buyer can see, keep and print before paying and in the copy afterwards, not by what is printed on Stripe's receipt. **If Stripe makes you enter an address** (its identity form, Business details, is separate and not public), use the commercial mailbox from Q-L2, never a home address. A home address on a public receipt is also a personal-safety and privacy cost with no legal gain. **Look for:** what the first live receipt prints; if a home address appears, change it before the first sale. | /legal | ☑ | ☑ |
| L11 | Same page → **Statement descriptor** `FIELDLOGICHQ` / `FIELDLOGIC` (legal angle on M22, M23) | **No legal objection; I agree with Q-M7 and Q-A6.** The test that matters is that the customer recognises the name that charged them, and the card-network rules ask for the business or trading name. `FIELDLOGICHQ` is the trading name; `FLHQ` would not be recognisable. It reads best once "FieldLogicHQ" is registered (Q-L3), so the name on the statement, the receipt and the Terms is the same one. A descriptor change affects new charges only. | /legal | ☐ | ☐ |
| L12 | Settings → Business → Public details → **Public business name** (legal angle on D27, A13) | `FieldLogicHQ`. No objection. Legal condition, not a blocker for typing it: register the name (Q-L3) and make the Terms' seller line read "the owner, trading as FieldLogicHQ, Ontario" exactly as `ACCOUNTING_FACTS.md` has it. | /legal | ☑ | ☑ |

## 7. Product names and descriptions

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D28 | Product catalogue → each product's **image** | **Leave empty.** A product image shows beside the line item on Checkout; none is needed, and an old-brand image there would undo the pass. If any product still carries an image from before October 2026, remove it. **Look for:** the Checkout summary (D8) shows text only. | /design | ☑ | ☑ |
| M25 | Product catalogue → **Premium Coaches Portal** → Name, Description | Name: `Premium Coaches Portal` · Description: `Everything one competitive team runs on: roster, schedule, lineups, documents and team money, plus a tournament to host.` **DRAFT — owner to approve (Q-M1, Q-M2).** Name order matters: never "Coaches Portal Premium" or "Coach Portal". | /marketing | ☐ | ☐ |
| M26 | Product catalogue → **Tournament Plus** → Name, Description | Name: `Tournament Plus` · Description: `For events teams register for: public registration, fee tracking, check-in, volunteers and schedule tools.` **DRAFT — owner to approve (Q-M1, Q-M3).** | /marketing | ☐ | ☐ |
| M27 | Product catalogue → **League Plus** → Name, Description | Name: `League Plus` (never "League Starter" or "Starter") · Description: `Run house league seasons: registration, divisions, standings and a public league page. Includes Tournament Plus.` **DRAFT — owner to approve (Q-M1, Q-M4).** Not on sale until the Club release; nobody sees it before then. | /marketing | ☐ | ☐ |
| M28 | Product catalogue → **Club** → Name, Description | Name: `Club` · Description: `For clubs with up to 15 teams: tournaments, house league, rep teams, accounting and Premium Coaches Portal for every team.` **DRAFT — owner to approve (Q-M1, Q-M5).** Pins the 15-team band from the Facts doc. Not on sale yet. | /marketing | ☐ | ☐ |
| M29 | Product catalogue → **Club · Association** → Name, Description | Name: `Club · Association` (never "Club Large", "Enterprise" or "top tier") · Description: `Everything in Club, for associations with up to 30 teams.` **DRAFT — owner to approve (Q-M1, Q-M6).** The dot is a middle dot (U+00B7) with one ordinary space each side; see M30. Not on sale yet. | /marketing | ☐ | ☐ |
| M30 | After saving M29, reopen the product → **look at the dot** | The product name must show a small raised dot between the words. **Mojibake warning:** if the dot was pasted from a terminal or an old text editor it can arrive as `Â·`, a question mark, or a bullet `•`, and the read-only audit then reports a name mismatch against the app's label. **Safest ways to type it:** copy it from this page in your browser, or hold Alt and type 0183 on the number pad (Windows). A bullet (U+2022) or a centred dot from a different font is wrong even if it looks close. The middle dot is in the basic Latin-1 range, so Stripe's invoice PDF and emails draw it correctly. **Look for:** the name on the Checkout summary (M1) and on an invoice line reads `Club · Association`. | /marketing | ☐ | ☐ |
| M31 | After M25 to M30, in **both** Test and Live | Ask Claude to re-run the read-only Stripe audit; it compares each product name to the app's plan label. **Look for:** no product-name warning. | /marketing | ☐ | ☐ |

## 8. Our own emails and billing screens (only where they must match Stripe)

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| D29 | Coach Premium success page (the "Premium is on for {team}" card) | **Nothing to change.** Already on the warm paper chrome. Only check the hand-off in D14. | /design | ☐ | ☐ |
| D30 | Billing page notices and the Manage billing screen (club and coach versions) | **Nothing to change.** They are product screens in the product's own look. Only check the return in D15 and D19. | /design | ☐ | ☐ |
| D31 | Our own receipt and billing emails | **Nothing to change for this pass.** They use the warm envelope with the name as plain text. Stripe's emails show the tile and ours show text; they do not need to be identical, only both warm and olive. | /design | ☐ | ☐ |
| M32 | Plan & billing (club) and the coach billing screen → the **plan name** on the plan card | **Nothing to change in the app.** The app reads its plan names from its own plan labels; Stripe's are typed by hand (M25 to M29). They match only if the typing matches. **Look for:** the plan named on Stripe's Checkout summary and in the portal's Current subscription is the same word-for-word as the plan card. | /marketing | ☐ | ☐ |
| M33 | The **trial-ending email** (ours) → its button | Today the button reads "Manage Billing", a third name for the screen the app calls "Plan & billing", and the door inside it is "Payment method & invoices". **Words for C-M2:** button `Plan & billing`. Not a dashboard step. **Look for:** nothing until C-M2 ships. | /marketing | ☐ | ☐ |

## 9. Surfaces the brief did not list

<!-- Agents add any customer-facing Stripe surface found outside 1-8 here, e.g. what a club sees when it connects its
     own Stripe account for family payments, and the fee invoices FieldLogicHQ sends clubs. -->

| # | Where | Enter | Ruled by | Live | Test |
|---|---|---|---|---|---|
| S1 | Settings → Payments → **Payment methods** | **On:** Cards, Apple Pay, Google Pay, Link. **Off:** Klarna, Affirm, MB WAY, Bancontact, BLIK, EPS, Pix and any other local or pay-later method. Enable nothing new without checking our billing handles a payment that sits pending (Q-S1). | owner (Q-S1) | ☑ | ☑ |
| S2 | Settings → Billing → **Customer portal** (the DEFAULT portal; our app's own "Payment method & invoices" button never uses it) | **On:** Payment methods, Invoice history. **Off:** Customer information (it allowed billing-address edits, against the 2026-11-04 ruling that the address changes only in our window), cancel, plan switching, pause. | owner (Q-S2) | ☑ | ☑ |
| S3 | Settings → Billing → Subscriptions and emails → **Payment method updates** | **"Link to a Stripe-hosted page"** (was the legacy mix pointing every button at the homepage). The button in Stripe's expiring-card email opens the restricted portal from S2. | owner (Q-S2) | ☑ | ☑ |
| S4 | Settings → Business → Customer emails → **Debit** mandate and initiation emails | **Leave on.** They send only when a bank debit is used (none today) and the debit rules require them then. | orchestrator | ☑ | ☑ |
| D32 | **Connect branding** — Settings → Connect → Branding (the page may be called "Connect settings → Branding"; it is separate from Settings → Branding and has its own icon and colours) | **Set it to the same values as D1, D4, D5:** Icon = the same `fieldlogichq-icon-512.png`; brand colour `#F8F4ED`; accent `#57651E`; platform name `FieldLogicHQ`. **Two screens read it:** (1) a club treasurer's Stripe sign-up ("Set up payouts") and Express dashboard ("Open Stripe"), where the club sees FieldLogicHQ's identity because we are the platform, which is right; (2) possibly, the Checkout a **family** sees when it pays the club (Q-D3: I believe it shows the club's name with our icon and colours, but I am not sure). **Look for:** start a connected-account sign-up in the sandbox, and open one family payment page, and write down which tile, band and button colour each one shows. If the family page ignores the Connect branding and shows plain Stripe, tell me, because then D32 only affects the treasurer's sign-up. | /design | ☑ | ☑ |
| D33 | The **fee invoices FieldLogicHQ sends clubs** (Stripe-hosted invoices and their emails) | Same branding as D20 to D24; they read Settings → Branding, nothing extra to set. Mentioned so the owner checks one in D20 and D21 as well. | /design | ☐ | ☐ |
| M34 | **Fee invoices** FieldLogicHQ sends clubs → the email | Stripe's own invoice email is deliberately off for these (the code finalizes them with no Stripe email); the email a club gets is ours. **Look for:** a club receives ONE email about a fee invoice (ours, with the link to Stripe's hosted page), not two. The hosted page itself is D33. | /marketing | ☐ | ☐ |
| M35 | A **family paying a club** → the name on the bank statement | Our code sets no statement name on a club's payments, so the family's statement shows whatever the club's own Stripe account is set to, not `FIELDLOGICHQ` (M22). It cannot be seen in the test sandbox. **Look for:** write down what the first real family payment shows, and tell me; C-M6 is an optional fix if it is unrecognisable. | /marketing | ☐ | ☐ |
| A15 | A **family paying a club** (receipt) and **our online-payment fee** | The family's receipt is the club's, not ours, and FieldLogicHQ issues **no invoice for the online-payment fee yet** (Club Stage 5; Stripe Tax does not tax a connected account's application fee, so the invoice has to come from our own process). Nothing to set in Stripe for this pass. Recorded so nobody expects a tax document for that fee to exist. | /accounting | ☐ | ☐ |
| A16 | A **fee invoice** ("Stripe fees on {club}'s online payments"; Test sandbox, then the first Live one) | Our invoices too, and they **do carry GST/HST**: the code turns on automatic tax and tags every recovered fee `txcd_90050001` ("Platform Fee"), which Stripe places by the **club's province** (13% Ontario, 5% Alberta, 14% Nova Scotia, 15% New Brunswick; a US club 0%). This is the owner's ruling (T2, Ask 3), not a settled legal answer (D1, Q-A5). **Look for:** the memo, the footer `Questions: hello@fieldlogichq.ca.`, the fee lines before tax, a tax line, a total equal to fees plus tax, a due date 30 days out (the payment terms), our GST/HST number, the club's name, CA$. A fee invoice with **no tax line** for a Canadian club is a defect. | /accounting | ☐ | ☐ |
| A17 | A **credit note on a fee invoice** (an answering-fee credit; Test sandbox) | The code creates this note with Stripe's email **off** (`email_type: none`), so Stripe does not send it to the club and I found no email of ours that does. The note is the document that lets the club reduce the tax it claimed. **Look for:** whether the club's hosted invoice page shows the note with a download link. If it does not, see C-A2. | /accounting | ☐ | ☐ |
| L13 | **A club connecting to Stripe** ("Set up payouts"), then the sign-up pages Stripe shows | **What the code does:** it creates the club's account with Stripe's hosted sign-up and **passes no terms acceptance of its own** (`lib/stripe-connect.ts` lines 33 to 54; nothing sets `tos_acceptance`), so Stripe itself puts its Connected Account Agreement in front of the person who signs up, which is correct: we must not tick it for them. **What is missing:** our own "payments terms" tick-box (recorded in `app/api/admin/payouts/route.ts` around line 197) holds a placeholder text, and nothing in it tells the club that Stripe's agreement also applies and that Stripe, not us, holds the money and the card data (Q-L6, backlog L3). **Look for (Test):** run a sandbox club through the sign-up and note that a Stripe agreement or terms step does appear before the account can take payments. If none appears, tell /legal; that would be a defect. | /legal | ☐ | ☐ |

---

## Code follow-ups (not dashboard clicks)

<!-- Anything that can only change in our code. Each is a separate unit of work; nothing here is built by this pass. -->

- **C-D1 — Export the wordmark logo for Stripe's Logo slot (blocks D2, D3 turning on).** Specified so it can be drawn
  without guessing; it is the product's own lockup (P9, drawn in one place in the app) exported as a picture.
  - **Mark:** the bare olive joined-FL (no tile), filled `#57651E`, square, **1.1 × the type size** on each side.
  - **Name:** "FieldLogic" in **Inter 700**, colour `#241E15`, letter-spacing −0.018 em; "HQ" immediately after in **Inter
    600**, colour `#57651E` (not 500: the product uses 600 whenever the name is shown small, and Stripe shows this
    logo small), letter-spacing −0.01 em, full strength, no fade.
  - **Spacing:** **0.45 × the type size** between the mark and the name; mark vertically centred on the text line
    (line-height 1), exactly as the product's lockup does it.
  - **Size:** draw it with the type size at **120 px**: mark 132 × 132 px, gap 54 px. Canvas **200 px tall** (34 px clear
    space above and below the mark) and as wide as the artwork plus 34 px each side, which comes to roughly 1000 to
    1050 px wide (about 5:1). The exact width is whatever the text measures at export; do not stretch it.
  - **Background: transparent.** It must sit on a white invoice, a white email and a cream Checkout, and ink-on-white
    16.52:1, ink-on-cream 15.06:1, olive-on-white 6.39:1, olive-on-cream 5.83:1 all pass. A baked-in cream rectangle would
    show as a box on white paper.
  - **Format:** PNG, sRGB, well under 512 KB (Stripe's limit, as I recall it). Minimum legible: when Stripe shows it
    about 28 px tall, the name is about 16 px type; below that the "HQ" weight is lost. Keep a copy beside the other brand
    exports.
  - **Do not substitute** the email rule ("name as Arial text, no image"): that rule is for OUR emails; Stripe's logo slot
    only accepts a picture.
  - **Where the source is:** the mark's shape is in `lib/brand-mark.ts` (the bare-mark viewBox `10 10 44 44`), the lockup's
    spacing in `components/shared/BrandLockup.module.css`, the colours in `lib/brand-mark.ts`. One small doc drift:
    `docs/agents/brand/VISUAL_IDENTITY.md` §4 says the mark is "about 1.4 times the capitals' height"; the component draws it
    at 1.1 em, which is about 1.5 times Inter's capitals. Follow the component.
- **C-D2 — Record the rulings in the design decisions log** once the owner accepts Q-D1 and Q-D2. Proposed text: "Stripe
  Branding: icon = olive tile; brand colour = cream; accent = olive on Stripe's pages, because Stripe has one accent for
  button, links and focus rings; the 2026-07-22 no-olive-button rule is scoped to the product's own buttons." Not logged
  yet, because nothing is accepted.
- **C-D3 — (only if Q-D3 says clubs should wear their own colours)** set a club's own icon and colour on its connected
  account at sign-up time. A separate project, not part of this pass.
- **C-M1 — The portal's headline (and later its two links) in our own portal configuration (M5, M21).** The headline is set
  in our code, not the dashboard: `lib/stripe-portal-config.ts` creates the configuration with `features` only. Add
  `business_profile: { headline: 'Payment method & invoices' }` (the words are the door's own label), kept as a constant
  beside `PORTAL_FEATURES` in `lib/stripe-portal-settings.ts`. **⚠ Changing the portal requires bumping `PORTAL_CONFIG_VERSION`**
  (`'2'` to `'3'`): a configuration is never edited in place; a new version is created and the old one switched off. The
  read-only audit asserts against those same constants, so its expected values change in the same unit of work (the audit is
  on the watched-automation list: change it only when the owner asks for that in the conversation). **Timing:** the live
  Stripe account had no portal configuration at the 2026-11-05 read (the app creates one on the first live portal open), so
  bumping before the first live open means live never holds a v2. **Do not bump twice:** the portal's `privacy_policy_url` and
  `terms_of_service_url` belong in the same version, so ask /legal first whether the Privacy and Terms pages will exist in
  that promote; if they will, ship headline and links together.
- **C-M2 — The trial-ending email's button says "Manage Billing" (M33).** `trialEndingHtml` in `lib/email.ts` (button
  `Manage Billing`, and "visit your billing settings") should say `Plan & billing`, the screen's name
  (`PLAN_BILLING_TITLE`). Check whether a stored override of the `trial_ending` template in platform admin carries the old
  wording too.
- **C-M3 — Two names for the portal on one screen.** `lib/plan-billing-words.ts` says "Opening payment portal…" while it
  opens, the help line beneath says "secure billing portal", and the emails say "the billing portal". Change "Opening
  payment portal…" to `Opening billing portal…` so the house name is one.
- **C-M4 — `support@fieldlogichq.ca` typed in one email.** `app/api/platform-admin/orgs/[id]/delete/route.ts` line 172 gives
  `support@fieldlogichq.ca` as the contact; everything else uses `hello@fieldlogichq.ca` (`PLATFORM_CONTACT_EMAIL` in
  `lib/online-payment-words.ts`). Use the constant unless Q-M8 says the alias exists.
- **C-M5 — Retire the audit's prefix allowance after the rename (only if Q-M1 is yes).** `scripts/audit-stripe-billing.mjs`
  line 111 accepts both the plain label and `FieldLogicHQ - {label}`; once Test and Live are renamed it should accept only the
  plain label so a prefixed name warns. A watched automation path: not to be changed without the owner's explicit ask.
- **C-M6 — (optional, look at M35 first) a recognisable statement name on a family's payment to a club.** If the first real
  family payment shows an unrecognisable name, pass the club's short name as the statement suffix on its payments. A
  separate project; nothing here is built by this pass.
- **C-M7 — (low) "billing details" in the door's help line.** `lib/plan-billing-words.ts` `paymentHelp` says "payment
  methods, invoices, and billing details". The portal changes name, email and tax ID but not the address, which has its own
  window. Proposed: `Open the secure billing portal to update your card, download invoices, and change your name, email or tax ID.`
  Change it only if a customer is seen looking for the address there.
- **C-M8 — Record the approved words.** The 2026-11-06 product descriptions drafted in another chat were never written down
  in the repo. After the owner approves Q-M2 to Q-M6, write the final descriptions, the statement name and the support
  address into `docs/agents/brand/PRICING_PAGE_COPY.md` (a dated section) and add "Stripe product descriptions match" to the
  Facts doc's drift checklist, since the Club descriptions pin a team count.
- **C-A1 — Fee-invoice memo wording (A16, Q-A5).** `STRIPE_FEE_WORDS.memo` in `lib/online-payment-words.ts` (line 1156)
  ends "Stripe's fees are passed on to every club." Replace with wording that does not claim a pass-through (draft in Q-A5);
  /marketing words it, /plan ships it. Update any test or help text that quotes the old sentence.
- **C-A2 — Fee credit notes are not emailed (A17).** `lib/platform-stripe-fees.ts` line 354 creates the answering-fee credit
  note with `email_type: 'none'`. A credit note must be issued to the club for it to adjust its tax (ETA s.232), and the club's
  own invoice email is ours (Stripe's is off on purpose, M34). Either send the note with `email_type: 'credit_note'` or add the
  note's link to our own email; route to `/plan`. A watched-automation path is not involved. Verify first whether the hosted
  invoice page already offers the note (A17).
- **C-L1 — Terms tick-box and renewal sentence on every subscription Checkout (L5, Q-L4). Route to `/plan`; build after the Terms and
  Privacy pages are live.** The five places that open a Checkout: `app/api/billing/create-checkout/route.ts` (line 410),
  `app/api/billing/create-team-checkout/route.ts` (336), `app/api/billing/choose-next-season/route.ts` (189),
  `lib/team-org-billing.ts` (825), and the card-save in `lib/billing-setup.ts` (138, setup mode: gets the submit sentence only, no tick-box).
  None sets any consent or custom text today. Add to the four subscription sessions:
  - `consent_collection: { terms_of_service: 'required' }`
  - `custom_text.terms_of_service_acceptance.message`: `I agree to the [Terms of Service](https://www.fieldlogichq.ca/terms) and have read the [Privacy Policy](https://www.fieldlogichq.ca/privacy).`
  - `custom_text.submit.message` for a **plan with no trial**: `Your plan renews automatically every [month|year] at the price shown above until you cancel. Cancel any time in Plan & billing; your plan then runs to the end of the period you have paid for. We do not refund the unused part of a period. Questions: hello@fieldlogichq.ca.`
  - `custom_text.submit.message` for a **plan with a trial** (Club): `Your free trial ends on the date shown above. Unless you cancel before then, your card is charged the plan price that day and the plan renews automatically every [month|year] until you cancel. Cancel any time in Plan & billing. Questions: hello@fieldlogichq.ca.`
  - Card-save only: `This saves your card for your FieldLogicHQ plan. Nothing is charged today.`
  The code picks "month" or "year" from the price. Keep each under Stripe's 1,200 character limit (these are about 300). Stripe warns that
  custom text must not conflict with its own generated text or the law, so **do not add "no refunds" with no qualifier elsewhere**; the
  Terms (section 16) already keep a consumer's legal rights. **Record the acceptance ourselves:** put `terms_version` in the session's
  metadata when creating it, and on `checkout.session.completed` write `consent.terms_of_service` (`accepted`) with that version into the
  billing event log, because Stripe records the tick but not which text it was. Premium: the words must not say "free trial" (no trial).
  The billing webhook and its tests are in the working tree with other changes, so schedule this on its own commit.
- **C-L2 — A purchase-confirmation email from us (Ontario's copy rule; Q-L2). Route to `/plan`.** Stripe's receipt alone does not
  carry what the rule asks the seller to deliver within 15 days. Send, to the buyer, on every plan purchase: what was bought and the
  plain description; price, taxes, total (or the amount and frequency for a subscription); how and when it is billed; the start date;
  how to cancel and the refund position (one sentence); the seller's name, `hello@fieldlogichq.ca`, telephone and mailing address; the
  buyer's name and the date; and a link to **the version of the Terms accepted**, which must stay reachable permanently (keep each published version's page). Sender:
  `FieldLogicHQ <hello@fieldlogichq.ca>`, the same as all our mail. It is a transactional message (CASL: not commercial); put no upsell in it.
  Build it once for all plans (coach purchases are the ones the rule reaches).
- **C-L3 — Portal links with the headline (L6).** Add `privacy_policy_url` and `terms_of_service_url` to the same `business_profile` as
  C-M1's headline, in one `PORTAL_CONFIG_VERSION` bump (see L6 for timing). Not to be built before the pages are live.
- **C-L4 — Edit the Terms draft to match what is actually sent (owner approval first).** Section 8's yearly-reminder paragraph
  must name the reminder's real number of days and say it goes to "the billing contact on the account" if Stripe sends it (Q-L5); section
  6's "receipts and invoices are emailed to the account owner" is true only of the email on the Stripe customer. Also two drifts the draft already flags, for /marketing: the
  Club pricing card says "No credit card required" though Club's trial takes a card. Terms and Privacy become the product's pages
  (`app/**/terms`, `app/**/privacy`); once they exist, the draft files are deleted and replaced by a pointer in the legal index.

---

## Agent sign-off

<!-- One short paragraph per agent: what it checked, what it found, what it could not verify without a screenshot. -->

**/design (2026-11-06).** I re-computed every contrast figure the brief gave and they are all correct; I added cream
against white (1.10:1) and white on ink (16.52:1). I read the product's lockup, its token file, the brand identity doc and
the design decisions log, and checked that our code sets no branding on any Stripe call, so the dashboard controls
everything except the wordmark image. **I could not verify, without seeing real screenshots:** (1) exactly what Stripe
paints in the accent colour on each page (button, links and focus ring I am confident about; the invoice PDF and the
emails less so); (2) whether Stripe chooses a white label on the olive button (the numbers say it should); (3) whether
your Branding screen has a separate button colour, font and corner setting (D6) and the exact name of the logo-over-icon
switch (D3); (4) how Stripe crops the tile in each slot (my check of the circle crop is from the 512 px file only);
(5) what a family sees when it pays a club (Q-D3); (6) how the cream band behaves in dark-mode mail apps (D25). I did not
open Stripe, call it, or change any file but this one.

**/marketing (2026-11-06).** I read the brand voice, the plan labels in `lib/plan-config.ts`, the Facts doc, the pricing
cards, both billing-word files, the portal and Checkout code, the billing webhook and the email templates. Product names
are the five plan labels with no prefix (Q-M1). The five descriptions are fresh drafts, not recoveries of the lost ones
(Q-M2 to Q-M6). **The statement name is `FIELDLOGICHQ` / `FIELDLOGIC`, not the old brief's `FLHQ`** (Q-M7). The support
address is the branded `hello@fieldlogichq.ca`, not the Gmail inbox. The portal headline is `Payment method & invoices`
and is a code change with a version bump (C-M1). **Who sends what:** Stripe sends the plan receipt, refund, expiring-card and
renewal-reminder emails; **we** send the failed-payment and trial-ending emails and every cancel email, so Stripe's two
versions go off (M11, M12), and a test must show one email each (M16). **Tax wording:** nothing is typed in Stripe; Stage 2
(tax) is on dev only, so Live Checkout correctly shows no tax line until it ships (M2). I disagree with the brief's idea of a
price-line row (Q-M13) and with /design's name for the portal door (Q-M14). **Could not verify without a screenshot:**
the exact labels and paths of Stripe's email and portal switches (I wrote them from memory and said so), whether the
shortened-descriptor field exists on your screen, whether Stripe's portal says "Renew plan" and "Billing information" as I
wrote, and what a family sees on its statement (M35). Stripe's own pages will say "canceled"; that is Stripe's, not ours.
I changed no file but this one and did not call Stripe.

**/accounting (2026-11-06).** I read the facts file, the index, and the topic files on invoices, credit notes, Stripe Tax set-up
and recovered fees (all inside their re-verify windows, so I did not re-research), and checked the code's Checkout, fee-invoice
and credit-note calls. **What a document must show** is in A8 (the current thresholds are $100 and $500, not the brief's old
$30 and $150). **Today versus after the promote:** today the live account has the Canada registration, exclusive pricing and
our number on the template, but production code does not yet ask for tax, so a live purchase now would show no tax line and
cost us the GST/HST (A2); after the promote Checkout, invoice, receipt and credit note all carry the province's tax line and
the number (A1, A8). No branding setting hides or reorders a tax line. **Fee invoices carry GST/HST** by the owner's ruling,
destination-sourced by province; whether the payment service is taxable at all is still the open D1 (Q-A5). I agree with
Q-M13 (nothing typed about tax in Stripe), Q-M7 (statement name) and M20 (no address); I disagree with M8's footer wording
(Q-A4) and with the fee memo's "passed on" language (Q-A5). **Could not verify without a screenshot of a real live
document:** whether our GST/HST number prints on live invoices and credit notes (never seen), what address the live header
prints, whether Stripe's receipt PDF repeats the number, the exact labels of the invoice-template switches (written from
memory), and whether the club's hosted invoice page shows a fee credit note. I did not call Stripe or change anything but
this file.

**/legal (2026-11-06).** I read the legal facts, index, the Terms and Privacy drafts, the Ontario internet-agreements topic file
(inside its window, but its primary text was never fetched, so the phone-and-address and 15-day-copy items rest on a law-firm
pointer and need the regulation read before the Terms publish), and the code for Checkout, the portal configuration and Connect
sign-up. I read Stripe's own Checkout documentation for the tick-box, custom text (1,200 characters, Markdown links) and the portal's
privacy and terms fields. **Findings:** no Terms or Privacy page exists, no Checkout sets consent or custom text, the portal sets no
links, and the club payments terms are a placeholder. **Is the first live sale blocked?** Not by any statute, but a sale to a
coach as an individual without the pages, the tick-box and the confirmation email gives that coach a legal right to cancel and be
refunded, and Premium checkout is already open on production; publish the pages first (Q-L1). I disagree with /marketing's 7-day
reminder (the Terms say 30) and with leaving the phone and address off everything (they must appear on the Terms and in the
purchase email). I agree with the statement name, the blank Public-details address, and the Stripe-sent reminder. **Could not
verify:** Ontario's regulation text, the Business Names Act penalties (from memory), the card networks' reminder rules, the exact
Stripe dashboard labels, and whether Stripe's reminder email lets us choose 30 days. Not legal advice; a lawyer's brief look is worth
having at the phone-and-address rule and the renewal wording, and you decide when. I called nothing on Stripe and changed no file but this one.
