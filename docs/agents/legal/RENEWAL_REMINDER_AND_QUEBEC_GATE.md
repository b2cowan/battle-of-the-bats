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

## The review before hand-off (Stage 6 step 6.6, 2026-11-16)
- **Finding 3 re-checked: unchanged.** The `yearly_renewal_reminder` template still has no fixed block, and the save route checks
  nothing for `{{lead}}` or the cancel line; the built-in words are used until an operator customises the template, and from
  then on the date, amount and cancel line are operator text. → `/plan` (recommended: the purchase email's pattern — the date and
  amount paragraph and the cancel sentence rendered by code outside the editable body; the template description gains "keep
  this transactional: no offers or links"). Owner call: build before publication (recommended, small) or accept the risk with a
  hand rule "never customise this template". Today no operator has customised it.
- **Terms 0.3 applied:** §17 "no new purchase, upgrade or plan choice with a billing address in Québec; an account whose billing
  address is already in Québec keeps the plan it has"; §8 the confirmation email is the notice for a yearly first payment chosen
  under 38 days ahead (`/accounting`'s wording, which covers decision (a)); §3 "the account owner" = every owner.
- **Decision (b), late send:** unchanged — an operating failure; the Terms keep "at least 30 days". The owner's refund-on-complaint
  call stays open (not a 6.7 blocker).

## The 6.6 fixes, Part A (owner ruling 1, 2026-11-16) — light review of the build, uncommitted at review
Read: the build prompt `GST_HST_STAGE6_6_FIXES_BUILD_PROMPT.md` §6, mig 490 and the reminder's code as built (the session's own
diff); no new statute text (CASL s.6(6) as read 2026-11-06).
- **Finding 3 closed by the build** (committed `a9d559062` 2026-11-16): the date-and-amount paragraph, the move-down line,
  the keep-or-stop sentence and the billing button are rendered by code after a customised template's words, and a customised
  row's own button is dropped (one button). Uncustomised, the email is unchanged (pinned by a test). The §8 promise no longer
  rests on an operator not editing the template.
- **Seeded body "A note about {{orgName}}’s yearly plan." — change (low, wording):** a hand-built possessive reads "The Hawks’s"
  for a name ending in s (the product's own rule is `possessive()`, which a template cannot call). Use **"A note about the yearly
  plan for {{orgName}}."** Transactional either way.
- **Description line — OK, one clause to fix (accuracy, staff-only):** the existing "{{lead}} is the app's sentence with the date,
  the price and the tax" now invites an operator to insert it, and it would then show twice. Reword to **"{{lead}} repeats the
  app's sentence with the date, the price and the tax, which the app adds below your text anyway."** The subject and heading stay
  operator-editable; "Keep this email transactional" covers them (a promotional subject would make the email a CEM).

## Sources
- [Canada's Anti-Spam Legislation, s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — accessed 2026-11-06 (via `CASL_SECOND_PARENT_EMAIL.md`)

## Lawyer's eye needed?
Flag, owner decides: (1) whether a renewing Québec-address account brings the Québec CPA and the French-language rules onto an English contract, and whether §17's "not offered" is enough; (2) the Terms §8 "at least 30 days" promise against the `late` path, and whether a yearly renewal notice is required for a consumer buyer in either Ontario or Québec (not re-read).
