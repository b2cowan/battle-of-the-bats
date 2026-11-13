# The yearly renewal reminder and the Québec purchase gate (GST/HST 6.4 Part B) — CASL, the Terms §8 promise, Québec
**Last verified:** 2026-11-13 (code read: `lib/renewal-reminder.ts`, `lib/renewal-reminder-server.ts`, `lib/billing-location*.ts`, the purchase doors' diff, mig 478; no new statute text opened — CASL s.6(6) as read 2026-11-06, CPA/Québec CPA/Charter of the French language NOT re-read)
**Re-verify by:** the reminder gains a promotional line or link; Bill C-36; the first Québec account; Terms 0.3 drafted
**Depends on facts:** Terms draft §8 "Yearly plans", §17; `CASL_PURCHASE_DETAILS_EMAIL.md`; `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`

## Question(s) this answers
Are the built words the reviewed §6 words; is the reminder still transactional; does the editable template endanger the §8 30-day promise; do the build's six decisions contradict the Terms, the privacy position or consumer-protection rules.

## Finding
1. **Words:** every customer sentence matches build prompt §6 (`lib/renewal-reminder.ts:127-147`, `lib/billing-location.ts` `regionClosed` / `qcClosed`). New and harmless: tax labels joined with " and " when a preview carries two taxes (`:158`); the "your plan" fallback name (`renewal-reminder-server.ts:136`); the estimate sentence is dropped when the preview carries no tax (§6 allows). No new sentence needs review.
2. **CASL:** still transactional (s.6(6): factual information about an ongoing subscription). The only link is the billing page; no offer, no pricing link. "Cancel before {date}" is a fact, not a promotion.
3. **Editable template is a real gap, bigger than Part A's.** The `yearly_renewal_reminder` row (mig 478 :95-105) lets an operator edit subject, heading, body and button. The date and amount arrive only through `{{lead}}`, and the cancel sentence is typed into the body. An edit that drops `{{lead}}` or rewrites the cancel line means the email no longer carries "the renewal date and the amount, plus applicable taxes" (Terms §8, draft :195). That is a promise the product would break silently. In Part A the same rows are rendered by code outside the template; here they are not.
4. **The six decisions:**
   - (a) Trial under 38 days with a purchase email: consistent, because the purchase email states the date (and a failed purchase email leaves `purchase_email_at` null, so the reminder still goes — `renewal-reminder.ts:91`). Needs the Terms 0.3 §8 line already owed ("a trial's first payment date is in the purchase email").
   - (b) Late send: the right fallback (silence is worse), but the §8 words "at least 30 days" are then untrue for that customer. It is an operational failure, not a drafting one. Keep `late` visible to the owner; consider answering a customer who complains with a refund of that charge (owner call).
   - (c) Once per date, every owner, demos skipped: fine; matches "the account owner = every owner" (0.3).
   - (d)/(f) Québec refused only at new-charge doors: sound. It is the only way to keep fee invoices, cancel, move down and renewals working and still say "no new purchase". It makes Terms §17 as drafted (:344, "we do not accept a billing address in Québec") untrue; the replacement wording is already in build prompt §9 and must go into 0.3.
   - (e) The form notice with a still-saving address: fine and accurate. One tone risk: an existing Québec account on the billing page reads "not selling in Québec yet" next to a live plan. Owner's taste.
5. **Consumer protection / Québec:** an account that already holds Québec on file and renews is a consumer contract the Québec CPA and the French-language rules may reach (an English-only adhesion contract). Nobody is known to be in this position, and the gate closes the front door, but the back door (a buyer who later moves, or enters an Ontario address) is open by design. Not re-researched here.

## What the product does today
As above, from the cited lines.

## Recommendation
- **Fix 3 before the Terms publish (owner call):** render the `{{lead}}` paragraph and the cancel sentence from code, outside the editable body, as the purchase email's fixed block does (operator edits only an opening/closing line), or at minimum reject a save of this template whose body lacks `{{lead}}` and the cancel sentence, and add "keep this transactional: no offers or links" to the description (same as Part A owner question 1). Route to `/plan`.
- Terms 0.3: §17 and §8 as listed in build prompt §9; add a sentence that Québec accounts opened before the gate keep their plan.
- Tell `/accounting`: what tax a renewing account with a Québec address is charged is theirs to confirm; the reminder shows whatever Stripe's preview says.

## Sources
- [Canada's Anti-Spam Legislation, s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — accessed 2026-11-06 (via `CASL_SECOND_PARENT_EMAIL.md`)

## Lawyer's eye needed?
Flag, owner decides: (1) whether a renewing Québec-address account brings the Québec CPA and the French-language rules onto an English contract, and whether §17's "not offered" is enough; (2) the Terms §8 "at least 30 days" promise against the `late` path, and whether a yearly renewal notice is required for a consumer buyer in either Ontario or Québec (not re-read).
