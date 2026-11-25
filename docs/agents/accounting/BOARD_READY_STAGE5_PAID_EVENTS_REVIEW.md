# Paid club events (Board Ready Stage 5, drawing round 2): our books, the club's books, ticket tax, the receipt
**Last verified:** 2026-11-24 (CRA pages read today; the ETA text read through Justice Laws, the place-of-supply text for an admission NOT read)
**Re-verify by:** before event card payments go live; Stage 5's per-fee record built; D1 answered; a Québec or US club opens; a priced Champs day is built; the owner rules on tax-included vs tax-added prices
**Depends on facts:** registered for GST/HST, annual filer, regular method; R1 (tax inside our fee); Canada first. Builds on `BOARD_READY_STAGE7_CAMPS_REVIEW.md` (read it first; this file only says what is different).

## Question(s) this answers
- Does a paid club event (banquet, hosted dinner, adult $40 / child $15) change FieldLogicHQ's own books?
- (Product research, NOT our books) Books heading, default tax class and hint words, receipt, refunds, who pays the card fee.

## 1. Our books: nothing changes except one record kind
Same R1 fee on the club's payout (base = our application fee only, tax inside it, place of supply = the CLUB's billing-address province), no `automatic_tax` on the session, our name and GST/HST number never on a club document, a club refund does not refund our fee. The one build item: the per-fee record needs a source kind for event tickets (a new kind, `event`; camps keep `camp`; the CHECK on the kind list changes, so a migration). A ticket table that skips the record drops fee revenue and tax from lines 101 and 103. Cash and e-transfer at the door write no record (no fee). The fixed fee falls on every charge, so one charge per sign-up (question 5).

## 2. The club's books
- **Separate heading, chosen by the event's kind, not by a switch.** Camp and Clinic stay under "Camps and clinics" (ruled). Banquet, Champs day, AGM and Other priced events go under a new money-in heading **"Club events"**: item **"Event tickets"**, its own **"Payment processing"**, and, for a taxable event, **"GST/HST collected"** (cash basis, as sponsorship and camps). Reasons: the two have different default tax classes (question 3), different receipts, and a club wants "what did the banquet make" apart from "what did camps make". One heading per kind keeps the choice off the club.
- Each line names the event and its date ("Year-end banquet 2026"), never a person. A passed-on card fee follows Stage 6 and camps.
- Costs of the dinner (caterer, room) are ordinary expenses. Worth one quiet sentence in the build, not a feature: when the ticket is Taxable the club can usually claim the tax it paid the caterer as an input tax credit; when Exempt it cannot. A public service body rebate on the unclaimable part is the club's accountant's call.

## 3. Tax on a ticket for a club registered for GST/HST
**What I found (CRA RC4081 for non-profits, RC4082 for charities, Memo 5-1, ETA Sch. V read on Justice Laws).**
- A dinner ticket is an admission (intangible personal property) plus a meal. RC4081 lists "restaurant meals" and "banquet facilities" as taxable and lists NO exemption for admission to a fundraising dinner for an ordinary non-profit. The non-profit fundraising exemption (Part VI s.4) is only volunteer-sold goods at $5 or less. Part VI s.9 (admission of $1 or less) and s.11 (spectator at an athletic or competitive event where 90% or more of participants are unpaid) do not reach a dinner.
- The fundraising-dinner admission exemption is written for charities: ETA Sch. V Part V.1 s.2 (charities; RC4082: "exempt where you are permitted to issue a donation receipt for part of the admission price", the $100 ticket with $75 receiptable is entirely exempt, no receipt need actually be issued) and Part VI s.3 (public institutions). It needs a real gift element in the price. CRA's receipting rule: the advantage (meal, entertainment) is deducted, and when the advantage is more than 80% of the value of the gift there is generally no gift, so no receipt. A year-end banquet priced near cost has no gift element, so that exemption does not fit it. A registered charity's genuine fundraising dinner may still be exempt (also Part V.1 s.3, fundraising activity sales, unless sold regularly or continuously).
- Direct cost (Part VI s.6 for non-profits, Part V.1 s.5.1 for charities): admissions are NOT covered (Memo 5-1 examples 28 and 30); a meal resold in the form bought at no more than the caterer's cost might fit, but a bundled ticket (room, programme, entertainment) is not "resold as is". Rarely fits; accountant.
- Small supplier: a non-profit with $50,000 or less of taxable revenue in a quarter and the last four quarters is a small supplier and needs no registration; the product shows the tax setting only to a club that says it is registered, as in round 1.
- A registered club that fails to collect tax it should have owes it out of its own funds. A club that collects tax it need not have is over-collecting from families. Under-collecting is the costlier mistake, so the default follows what is usually true.

**Recommended default: Taxable** (for Banquet, AGM and Other when priced), for a registered club only. This is deliberately the opposite of camps (Exempt), because the camp exemption (Part VI s.12) has no dinner counterpart. The default is chosen by the event's kind (Camp and Clinic: Exempt, ruled; Banquet, AGM, Other: Taxable), not by "has a price".

**Hint words, verbatim (under the tax switch, default Taxable):**
"Dinners and event tickets are usually charged tax, even by a non-profit club. Choose Exempt only if your accountant says this one is not."
Optional second line: "A registered charity's fundraising dinner may not be charged tax. Ask your accountant before choosing Exempt."
For a priced Champs day (kind default Exempt): "Admission to watch games where the players are not paid is usually not charged tax. Choose Taxable only if your accountant says this one is." (basis: Part VI s.11 and RC4081's 90% unpaid test; read at summary level, lower confidence).
Safe words: "usually", "choose Exempt only if your accountant says". Not safe: "you must charge", "tax receipt", "donation", "charity", "gift" in the ticket words.

**No donation element in this version.** A ticket must not carry a "part of this is a donation" split, a tip-style donation add-on, or any receipt word like "official" or "charitable". Only a registered charity or amateur athletic association can issue a donation receipt, and only after the advantage is worked out; a club that is one handles that itself. A payment with more than nominal value in return is not a donation (RC4081).

**Rate and place of supply.** A ticket is an admission, which CRA treats as intangible personal property (Memo 3-3-6-2, example 18), not the personal-service rule the camp used. I did not read the text of the admission rule in Schedule IX; the expected answer is the province where the event is held, which for a club's own dinner is the club's province, so the answer is the same in every case the product will see today. Re-read it before a club holds an event outside its own province (an away banquet, a tournament-weekend dinner). Alcohol, if sold, is taxable and is a licensing question for `/legal`; raffles or 50/50 at the dinner are gambling, out of scope.

## 4. The receipt
Title **"Receipt for event tickets"** (never "official receipt", "tax receipt", "donation receipt"). Fields: paid by (the payer's name); the event's name, date, start time and venue; the lines "2 adults at $40.00, 3 children at $15.00" (counts and prices, NOT names of the people, a child's name is not needed for any tax purpose); amount paid for tickets (net of refunds; the card-fee line shown apart); date paid and "Paid by card" or "Paid by bank debit"; the club's name and address; the issue date; a named issuer. For a Taxable event also: the club's GST/HST number, "Includes $X.XX HST (13%)" (the amount and the rate, worked out once on the total, not per person), and the same on the card-fee line.
Footer, verbatim: "This is a receipt for tickets you bought. It is not a donation receipt and it is not an income tax receipt."
Do not use "tax credit" in the footer: a business that buys a table may claim the tax on a taxable receipt.
**Invoice tiers ($30 / $100 / $500, SOR/91-44 s.3):** these are what a BUYER needs to claim an input tax credit; a family is a consumer. But a taxable ticket receipt should always print the full over-$100 set (club name, GST/HST number, date, total, tax amount and rate, description, the payer's name, the payment terms "paid in full"), because a business or sponsor may buy a table of ten ($400) or more ($500 and over also needs the buyer's name and a description sufficient to identify). It costs nothing to always print it. An Exempt event's receipt carries no tax lines and no number. Reissue after a refund, never edit.

## 5. Adult and child prices, a family of 5
Confirmed: **one charge per sign-up**, the total of all lines ($40 x 2 + $15 x 3 = $125, before any card-fee surcharge). The fixed fee falls once, not five times. Tax, if any, is worked out once on the total. Recommend pay-in-full at sign-up only for tickets (no part payments), so it stays one charge; "add a person later" is a second charge and a second fixed fee, acceptable. A free price ($0 infant) is a line, not a charge. State the pricing rule once for the whole product (tax-included like a menu price, or tax added at the end): a family should see the price it pays; the build must show the all-in total before paying, and `/legal` should confirm the all-in price requirement for consumer sales. Match whatever camps already ruled.

## 6. Refunds and a cancelled event
- **Taxable ticket refund: a credit note, as Stage 6 and camps** (ETA s.232; SOR/91-44 s.3; `CREDIT_NOTES_ON_REFUNDS.md`), dated the refund day so line 107 lands in the right period, tax proportional to the part refunded (one child's $15 refunded = $15 plus its share of the tax back, rounded to the nearest cent, not above). Exempt: income reduced, no note needed (keep one for the family). Receipt reissued net.
- "Can't come anymore" is a request; the refund is the club's call (as ruled for camps).
- **A club-cancelled event:** refund every sign-up in full (a failure to deliver; `/legal` for consumer rules, I did not research them). The club's card fees on those charges are not returned by Stripe, and our application fee is not refunded (as camps, question 1); if the owner thinks that is wrong when the CLUB cancels, it is a `/strategy` call, not an accounting one. Beyond refunds: a taxable event cancelled after the club paid a caterer deposit keeps the expense; tax on a forfeited deposit and on rebooking is the club's accountant's. A rescheduled event with payments carried over is not a refund and needs no note; keep the original receipts.

## 7. Who pays the card fee
**Follow the club's registration choice on Payouts; no third choice.** A ticket buyer is a family, the same payer as house league and camps, so the same default ("families pay" or "the club pays") fits and one rule is fewer to explain. If the family pays, the surcharge line follows the event's tax class: on a Taxable event it carries the club's tax (the safe reading, as Stage 6: GI-200 says a pure card surcharge is outside GST/HST but ours includes platform consideration); on an Exempt event it carries none, because it is part of the consideration for an exempt supply. Our side is unchanged either way.

## What must change in the drawing's shape
1. The default tax class follows the event's KIND (Banquet, AGM, Other: Taxable; Camp, Clinic, Champs day: Exempt), not "a camp is an event with a price". One shared "Exempt by default" would under-collect on every dinner.
2. Books heading follows the kind: "Club events" for non-camp events. Camps keep theirs.
3. A new per-fee source kind and its migration.
4. A separate receipt template for tickets (counts, no names, no "child care" words) from the camp receipt.
5. No donation split, no donation words, no raffle or alcohol selling in this version.
6. State the tax-included or tax-added rule once and show the all-in total before paying.

## Sources
- [GST/HST Information for Non-Profit Organizations (RC4081)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4081/gst-hst-information-non-profit-organizations.html) — 2026-11-24 (first 100,000 of 141,085 characters)
- [GST/HST Information for Charities (RC4082)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4082/gst-hst-information-charities.html) — 2026-11-24 (first 100,000 characters)
- [Excise Tax Act, Schedule V (Justice Laws, version of 2026-03-26)](https://laws-lois.justice.gc.ca/eng/acts/E-15/section-sched200860-20260326.html) — 2026-11-24 (Part V.1 ss.2, 3, 5.1; Part VI ss.3, 3.1, 4, 6, 9, 11, 12; last 3,226 characters not read; "public institution" definition not located on the page)
- [GST/HST Memorandum 5-1, Direct Cost Exemption](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/5-1/direct-cost-exemption.html) — 2026-11-24
- [CRA, Fundraising events, issuing receipts](https://www.canada.ca/en/revenue-agency/services/charities-giving/charities/operating-a-registered-charity/issuing-receipts/fundraising-events-issuing-receipts.html) — 2026-11-24
- [Memorandum 3-3-6-2, Place of Supply, special cases](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-3-6-2/plc-spply-prvnc-spcfc-rls-fr-srvcs-spcl-css.html) — 2026-11-24 (search summary only: an admission is intangible personal property; conclusion for the province not read; Memorandum 3-3-5 is the place to check)
- Existing: `BOARD_READY_STAGE7_CAMPS_REVIEW.md`, `BOARD_READY_STAGE6_SPONSOR_PAYMENT_FEE_REVIEW.md`, `CLUB_SPONSOR_INVOICE_REVIEW.md`, `CREDIT_NOTES_ON_REFUNDS.md`, `PLATFORM_FEE_TAX_COLLECTION_METHOD.md`; BOARD_READY_PLAN.md §5 Stages 5 and 7, §9

## Professional sign-off needed?
Our books: no new item. A club's accountant: whether a given club is a registered charity, a non-profit or neither; whether a charity's dinner has a gift element and so is exempt; the admission place-of-supply rule for an event outside the club's province; meals at cost (Part VI s.6); tax on a forfeited caterer deposit; PST provinces and Québec; the rebate on tax the club cannot claim. `/legal`: all-in price rule, refund duty on a cancelled event, alcohol and raffles at a dinner.
