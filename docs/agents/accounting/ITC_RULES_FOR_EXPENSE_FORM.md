# Input tax credits on our own expenses: the rules the Bookkeeping expense form applies
**Last verified:** 2026-11-06
**Re-verify by:** 2027-11-06; or before the first return is filed; or if CRA answers the backdate request; or if we buy a passenger vehicle or real property; or if the quick method is elected
**Depends on facts:** registered for GST/HST, effective 2026-09-26 (backdate to 2026-05-01 pending), annual filer, regular method (ACCOUNTING_FACTS.md); sole proprietor, Ontario. Builds on GST_HST_RETURN_LINES.md §3–§4 (same day) for the base rules; this file holds only the form's answers (GST/HST Stage 4a, Session A Part 0).

## Question(s) this answers
- (a) Equipment bought before the registration date and still used: how the form says so, and whether it computes anything. Do services before the date get nothing?
- (b) Meal or entertainment × business use: the exact formula.
- (c) Is counting a supplier whose registration is "Not checked" safe for a Canadian supplier with a printed number?
- (d) The sentence for tax charged under CRA's simplified registration.
- Confirm the operating / capital thresholds and the $100 tier's base. What happens when a "Not registered" supplier charged tax (not asked; found).

## Finding
**(a) Capital property held at registration (ETA s.171(1); Memo 8-5, June 2026).** CONFIRMED: on becoming a registrant, property held for commercial use is deemed bought then, with tax paid equal to its **basic tax content** (¶13). Basic tax content is computed "after accounting for any depreciation of the property's fair market value" (¶17; Appendix A element C = the lesser of 1 and **fair market value at registration ÷ the price paid**). The ITC arises in the **first reporting period ending after registration** (¶38), and it needs documentary support for the calculation (¶32). So the credit is **not** the receipt's tax: it needs the item's market value on the registration date, which the form does not hold. The memo states no "more than 50%" test for this deemed credit (the >50% capital rule is for purchases after registration); UNCONFIRMED how the two interact.
**Services before the date (Memo 8-5 ¶19–22, Example 4).** CONFIRMED: tax on services supplied **before** registration is not claimable. Tax on a **prepaid** service (or rent) that covers time **after** the date is apportioned: the after-date part is claimable, for commercial use after that time. A yearly plan paid in August 2026 is partly claimable; a monthly charge dated before the date is not. Inventory held at registration also gets the deemed credit; we hold none worth tracking.
**(b) Meals.** CRA "ITC eligibility percentage": meals and entertainment get a 50% ITC. ETA s.236 reaches it as an add-back of 50% of the ITC otherwise claimed, so the ITC "otherwise claimed" is the operating-expense one first. Formula: **credit = tax × operating factor(business use) × 50%**, where the operating factor is 1 at ≥90%, 0 at ≤10%, use% between. Reasoned from s.236's structure; UNCONFIRMED by a CRA page that states the combination in words. Claiming 50% directly means nothing goes on line 104.
**(c) Not checked.** Simplified registration is for **non-resident** digital suppliers and platforms not carrying on business in Canada. A Canadian supplier is on the normal regime, so counting it is safe. The risk is a **foreign online seller** left "Not checked": its tax may be on the simplified registry and not claimable. Counting it as a working figure is safe **only because** it is listed before filing (4b) and its sentence says so.
**(d) Simplified registration.** Per GST_HST_RETURN_LINES.md §4: no ITC, no rebate; the fix is to give the seller our number and ask for a refund. A refund is the seller's choice, not a right, and it lowers the cost as well as the tax.
**Confirmations.** Operating: ≥90% → 100%, ≤10% → 0, between → tax × use%. Capital personal property: >50% → 100%, ≤50% → 0, no proration (GST_HST_RETURN_LINES.md §3, CRA 2026-02-03). The $100 / $500 tiers are on the **invoice total** (amount paid, tax included); the form uses the receipt's CAD total.
**Found: "Not registered" with tax charged.** Only a registrant's GST/HST is an ITC, and the ≥$100 tier needs a valid number. Tax charged by a supplier marked Not registered gets **no credit**.

## Recommendation
The form's rules and sentences ({supplier}, {date}, {amount}, {tax} are filled in):
1. **Equipment you keep, dated before the registration date:** credit **$0**, state `not_claimable` (amber). Sentence: "Bought before your GST/HST registration began on {date}. Equipment you still used for the business on that date may qualify for a credit based on its value then. It isn't counted here; ask your accountant." Never compute it.
2. **Everyday cost or meal, dated before the date:** credit **$0**. Sentence: "Bought before your GST/HST registration began on {date}." Second line: "If it paid for time after that date, such as a yearly plan, that part may be claimed. Ask your accountant." (This adds one line to the drawing's sentence; it is money on a yearly plan bought between May 1 and Sept 26 if the backdate is refused.)
3. **Meals:** tax × operating factor × 50%, rounded once at the end.
4. **Not checked:** count it; sentence "Counted for now. Check the supplier's registration before you file."
5. **Simplified:** "{supplier} charged {tax} under CRA's simplified registration, which can't be claimed on your return. Give {supplier} your GST/HST number (usually in its billing settings) so it stops charging it, and ask for a refund of the {amount}. If you get one, correct this expense: remove the tax line and lower the amount by the refund."
6. **Not registered, tax charged:** credit $0, amber. "{supplier} is marked as not registered for GST/HST, so the tax it charged can't be claimed. Check its number on CRA's registry, or ask it for a refund."
7. The date the rules read is the **incurred date** (for legacy rows, the recorded expense date).

## Sources
- [CRA Memo 8-5, Becoming and ceasing to be a registrant](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/8-5/becoming-and-ceasing-to-be-a-registrant.html) — accessed 2026-11-06 (¶13, ¶17, ¶19–22, ¶32, ¶38, Example 4, Appendix A)
- [CRA, ITC eligibility percentage](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit/calculate-eligibility-percentage.html) — via GST_HST_RETURN_LINES.md, accessed 2026-11-06
- [CRA, Confirming a simplified GST/HST account number](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/confirming-simplified-gst-hst-account-number.html) — via GST_HST_RETURN_LINES.md, accessed 2026-11-06

## Professional sign-off needed?
Yes, before the first return: (a) any deemed credit on equipment held at registration (needs its market value on that date); (b) the meals × business-use combination; (c) apportioning a prepaid plan that spans the registration date. The form's rules otherwise need none.
