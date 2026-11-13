# The "details of your purchase" email (GST/HST 6.4 Part A) — CASL, "paid", every owner
**Last verified:** 2026-11-13 (applies the CASL text read 2026-11-06 — s.1(2), s.6(1), s.6(6) — see `CASL_MEMBER_INVITE_EMAILS.md`; no new source opened)
**Re-verify by:** the email gains any promotional line, price-offer or sign-up link; Bill C-36; first Québec customer
**Depends on facts:** `LEGAL_FACTS.md` § Consent and email mechanics; the Terms draft §8, §16 (v0.2)

## Question(s) this answers
A narrow pass on the build (the §6 words were reviewed 2026-11-13 and are not re-read): the new fallback names, the two template
descriptions, the "paid" conflict, what changed for a returning club, "Bought by" going to every owner, and CASL.

## Finding
1. **CASL: transactional, fine as built.** The email confirms a purchase the person made and gives factual information about an
   ongoing purchase (price, renewal date, cancel and refund lines). That is the s.6(6) class (confirming a transaction the person
   agreed to; factual information about an ongoing subscription), so it needs no consent. (Corrected 2026-11-13: s.6(6) lifts only the consent requirement. The email needs no unsubscribe link only because it is most likely not a commercial electronic message at all, as it encourages no purchase; see `CASL_LATE_BILL_EMAIL.md`.) It holds only
   while the email carries **no offer, upsell or sign-up/pricing link**: today the links are the invoice, the billing page and the
   Terms. "Renews on {date} at {price}" is a fact about their own plan, not an offer. **One soft spot:** the opening and closing
   are operator-editable, so a staff edit could add promotion. Staff are trusted, but the template's description (platform-admin
   only) does not say "keep this transactional". Owner question 1.
2. **"Paid": fine as is.** The rule's reason is that the invoice, not this email, is the receipt (never "payment received",
   never "receipt"). "The period you've paid for" says nothing about a payment received; it is the same phrase the Terms draft
   uses (§8, "the period you have already paid for", and §20's accept lines). "Your first payment" and "when the payment is taken"
   describe a **future** charge. So the conflict is in the rule's wording, not the email's: say the rule as "never say a payment was
   received and never call this email a receipt". Owner question 2 (a one-line wording fix in the build prompt, not the email).
3. **The new fallback names ("your plan", "your Coaches Portal"):** no legal angle. They only stand in for a name we cannot read, in
   the opening line; the invoice and the fixed block carry the record. Product copy only ("Thanks for choosing your plan for your
   Coaches Portal" reads awkwardly; owner's taste).
4. **The two template descriptions:** staff-only, no customer reads them. The `yearly_renewal_reminder` one states a rule
   ("30 to 37 days before … once per charge date") that is built in Part B; until then a template row exists with no sender.
   Not a customer promise, but **the Terms' 30-day yearly notice (§8) is only true once Part B is live**: unchanged item for the
   Terms publish, already on the plan.
5. **A returning club now gets only the purchase email** (the old welcome-back carried the count of restored tournaments and a
   dashboard link). Product-only: no law requires telling them. If the owner wants the restored-tournaments line back, it is a
   build item (`/plan`), and it would have to stay out of the fixed block's "no upsell" rule.
6. **"Bought by {name or email}" to every active owner of the organization:** acceptable. Owners already administer the same
   account and see who its people are; telling them who bought is within the purpose of the information (administering the
   subscription), so no new consent. Checked: the buyer id is stamped server-side from the signed-in user at the four customer
   doors only (create-checkout, create-team-checkout, choose-next-season, move); no staff-console door stamps one, so a staff
   member's name is not sent to a customer through this row. **One edge:** a buyer later removed from the account is still named
   to the remaining owners on an email sent just after the purchase; that is the same account at that moment, so fine. The
   privacy draft §5 may list "who bought a plan" among what a club's owners see; light, optional (owner question 3).

## What the product does today
Read from the build prompt §6 and `lib/purchase-details.ts` / `lib/purchase-details-server.ts` (2026-11-13). The Terms draft's
"the account owner" means every owner (build prompt §8 note, already queued).

## Recommendation
No change to the email. Three owner questions: (1) add a "keep this transactional: no offers or links" line to the template's
description; (2) reword the build prompt's "never paid" rule as above; (3) optionally one clause in the privacy policy §5.

## Sources
- [Canada's Anti-Spam Legislation — s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — accessed 2026-11-06 (via `CASL_SECOND_PARENT_EMAIL.md`)

## Lawyer's eye needed?
No for this email. (Not a gate; the owner decides.)
