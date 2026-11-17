# Terms of Service and Privacy Policy, first published version: the owner-only notes

**What this is.** At GST/HST Stage 6 step 6.7 (2026-11-17) the owner-approved 0.3 text of both documents became the frozen
version `2026-11-17` (`lib/legal-documents/terms/2026-11-17.md`, `lib/legal-documents/privacy/2026-11-17.md`), and the drafts in
`drafts/` were deleted, so the customer text has one home: the product. The drafts' owner-only tail sections are kept below,
word for word, for the next `/legal` pass. The inline `> NOTE` blocks, the change logs and the "How to read" blocks are not
copied: read them in the last commit that holds the drafts, `git show b891e6bbb:docs/agents/legal/drafts/TERMS_OF_SERVICE.md`
(and `…/PRIVACY_POLICY.md`).

**A later change.** Write a new draft in `drafts/` (start from the published file, then add the notes), set the document's
`draftPath` in `lib/legal-documents.ts` so the dev preview reads it, and publish it as a new dated version (Stage 6 plan §6.7,
"A later change"). Never edit a published file: the build fails.

---

# From the Terms of Service draft (0.3)

## Terms · Before this can be published (owner — delete this section on publication)

**Product must do first** (Stage 6 plan, steps 6.2–6.5) — status at the 6.6 review, 2026-11-16:
1. **6.2** the legal pages, versions at their own addresses, the links — built, walked §500.
2. **6.3** acceptance at every door, with the words in §20 — built, walked §506; checked against the code in 6.6 (every
   account door refuses without the tick; no IP kept; the record is append-only).
3. **6.4** the purchase email (§16), the yearly reminder (§8), the Québec refusal (§17) — built, walked §525.
4. **6.5** deleting an organization removes its stored files — built `45c134bea`; must be on production before publication.
5. Taxed checkout on production (§6 "shown before you pay"), and the 6.4 migration applied there.

**Owner, before 6.7:**
- ~~O1 · the phone and mailing address~~ — **ruled 2026-11-17: email only** (§1 reworded; the seller's identity is ruled — O1′, no
  name). The purchase email already leaves both lines out. Revisit at the first coach buyer or the first promotional email.
- **support@fieldlogichq.ca receiving mail.** These Terms name support@ in five places; the product shows **hello@** everywhere
  today (ruling Q3), and one edit at 6.7 moves it to support@. If support@ is not working by then, these Terms say hello@ instead.
- ~~The two Stripe dashboard reads~~ — **done 2026-11-17:** the §6 choice is line B (walk call C1); the retry setting is read (F2, §8 note 4).
- ~~Approve `PRICE_CHANGE_NOTICE_PROCEDURE.md`~~ — approved 2026-11-16.
- Your own steps are one checkable walk: `docs/projects/active/GST_HST_STAGE6_7_OWNER_STEPS_WALK.html` (ledger §533).
- **"No contracts" on the marketing pages** (`/legal` 6.6, the item the 6.2 session left for it): the pricing page, the three
  segment pages and the pricing cards say "No contracts — cancel anytime" and, of yearly billing, "No contracts, no penalties",
  beside Terms that are a contract, a yearly plan paid in advance and a no-refund rule (§8). "Cancel anytime" is true; "no
  contracts" invites a consumer to argue the no-refund rule was hidden (a misleading-representation point under Ontario's CPA
  2002, low). → `/marketing` before 6.7, recommended "No long-term contract — cancel any time" and, for yearly, "Cancel any
  time; your plan runs to the end of the year you've paid for." The "Upgrade or downgrade at any time" line holds.

## Terms · From the `/accounting` read (2026-11-08)

Research, not an accountant's sign-off. Topic files fresh (verified 2026-11-05 to 11-07).

**Applied in 0.2:** §6 tax sentence (place of supply = the billing address; tax as its own line; a rate change is not a price
change; matches the product's one phrase "plus applicable taxes" [V `lib/billing-tax.ts:149`]). §6 choice lines promise only
that invoices show the tax — the Terms never print our GST/HST number. §7, §8 yearly reminder and §8 upgrade say "plus
applicable taxes". §8 O3 refund includes the tax and comes with a credit note. §16 names each tax by name and rate.
"Canadian dollars" stays (every price is CAD; a USD price would be a §18 change anyway). §20(3) unchanged.

**For 6.4 — what the purchase email shows:** the plan and billing period with the start and renewal dates; the price before
tax; **each tax by name, rate and amount** (e.g. "HST (ON) 13%"; a zero-rated sale "GST/HST 0%"); the total in CAD; for a
trial, $0 today and then the amount plus tax on the charge date; our business name and GST/HST number (not required on a
non-invoice, but it matches the invoice); a link to the Stripe invoice; how to cancel; the Terms version (§16). Figures come
from the Stripe invoice, never recomputed. Line B of §6 calls this email "the details of your purchase" — never a receipt or
an invoice.

**Owner questions:**
- **A** · How "the unused part" (O3) is worked out. `/accounting` suggests daily pro-rata of the last invoice; a part refund can
  land a few cents under the typed figure (Stripe's rounding, about 1 in 9 at 13%). Acceptable, or top up by hand?
- **B** · Stripe may show a trial's after-trial tax only as an estimate. Should the §16 email say "estimated tax, based on your
  billing address today"?
- **C** · (`/accounting`'s own file) `STRIPE_TAX_SETUP.md` still cites an old $30 invoice threshold; the subscriptions topic says
  $100. A fix to its topic file, not to the Terms.
- **D** · Before 6.7: check that a **live** invoice prints our GST/HST number and the Ontario business details (the test account
  reads a PEI sandbox address), and count production subscriptions made before 2026-11-06 (`STRIPE_TAX_SETUP.md`).

## Terms · From the `/accounting` review (Stage 6 step 6.6, 2026-11-16)

Research, not an accountant's sign-off. Topic files fresh (2026-11-05 to 11-07); no re-verify trigger fired. Read against the
code, and against the purchase email and the yearly reminder as they render (the 6.4 tests' fixtures; walk §525's figures).

**Holds, against the code:** §6 CAD only (a non-CAD price fails the catalog check), every live charging door taxes by the
billing address, invoices with tax on the billing page; §8 cancel at the period end with undo, upgrade charged now as a
prorated invoice with Stripe's figure shown first and re-checked at the press (Premium → Club nets the unused Premium as a
credit, walk E4: $218.61 − $28.95 + $24.66 HST = $214.32), move down at the renewal with no credit, failed payment tells every
owner and keeps the plan working, the end-a-plan refund goes through the console tool that issues a credit note. §16 the email
carries every listed item (plan, cycle, price before tax, each tax by name and rate, total in CAD, start and renewal, how to
cancel), our business name and GST/HST number, the invoice link, and never calls itself a receipt or an invoice; a zero-rated
sale reads "GST/HST 0%". The trial email's after-trial tax is labelled "Estimated tax, based on your billing address today" —
**question B above is answered by the build**. The reminder's figures are the plan's own lines of Stripe's preview (a queued
fee line never inflates them).

**Applied in this review:**
- **§7 trial rule.** The draft said "one trial per plan"; the product gives a trial only for an organization's **first** paid
  plan (any earlier subscription, on any plan, withholds it). Words changed to match the product (narrower promise; nothing
  to build).
- **§8 yearly reminder.** "At least 30 days" was untrue for a yearly first payment chosen under 38 days ahead (a Tournament
  Plus yearly trial is told about 14 days ahead, by the trial email only — the reminder skips it on purpose). One sentence
  added naming the confirmation email as the notice in that case. The remaining gap is a job outage, which sends late rather
  than never — an operating failure, not a promise to word around.
- **Price-change procedure step 5** (internal): moving every subscription on the notice day would charge a monthly plan
  renewing inside 30 days the new price. Step 5 now moves each subscription from its first renewal on or after step 1's date.
- **`STRIPE_TAX_SETUP.md`'s $30 tier** corrected to $100 (question C closed).
- **§17 Québec** confirmed untrue as worded ("we do not accept a billing address": one can be saved, and stored accounts
  renew) — `/legal`'s 0.3 edit, applied in the legal pass. A renewal billed to Québec carries 5% GST and no QST and still counts
  toward the $30,000 specified-system test (`GST_HST_ON_SUBSCRIPTIONS_CANADA.md`, already recorded).

**Ruled 2026-11-16 (owner):** A — daily pro-rata of the last invoice, rounding under accepted; E — send the details email for a
trial move up, built before 6.7. **Still open:** D (a **live** invoice and credit note print our GST/HST number
and Ontario details; the count of production subscriptions made before 2026-11-06, which renew **untaxed** until moved — the
tax on them is ours to remit).

**E closed by the 6.6 fixes build (2026-11-16, `/accounting` light review; committed `873fc7c76`).** Stripe test
mode: a trialing move up swaps the price at once, keeps the trial end, and makes a **$0 paid** `subscription_update` invoice
(`.probe/66fix/trial-move-up-run1.txt`); that invoice now sends "The details of your purchase" with the trial's figures: today's
rows are the $0 invoice's own record ($0.00 before tax, $0.00 tax, $0.00 total, charged today $0.00), and the first payment is
the **new** plan's price at send time plus Stripe's preview estimate, labelled as one (`trial-change-email-run1.txt`: $379.00
plus applicable taxes on December 16, 2026; HST 13% $49.27, $428.27 CAD). The date is the trial end read in Ontario time (the
charge lands at 9:12 p.m. on the 16th). **No bookkeeping or return issue:** a $0 record is the class the trial's own first
invoice already writes; it adds $0 to sales and to tax collected, and nothing to the $30,000 specified-system count. The move
window reads $0.00 due today for a trialing subscription (`amount_due` 0), so it has no defect.

## Terms · For a lawyer's eye

- **§1 the seller named only by its business name** (O1′, ruled 2026-11-08) — Ontario's internet-agreement rule asks a
  sole-proprietor supplier for its own name; the owner accepts the consumer's cancel-and-refund right as the cost. Worth a
  look at whether anything beyond that remedy follows (enforcement, or an argument that the contract's party is unclear).
- **§14 limitation of liability and disclaimer** — the cap (O6, ruled) and the consequential-loss exclusion carry the most
  exposure; a sole proprietor is personally liable, so this clause is protecting the owner's own assets. Enforceability
  against consumers is limited.
- **§4 and §15 — children's information and the indemnity** — whether placing consent for children's information on the
  club, plus an indemnity, holds up when the platform designed the forms that collect it.
- **§8 automatic renewal and no-refund** — against Ontario's CPA 2002 and the CPA 2023 once in force (not confirmed in
  force as of 2026-11-05).
- **§16 consumer carve-out** — the internet-agreement disclosure and copy rules; whether the confirmation email as built (the
  listed items, the buyer, the date, and a link to the frozen version rather than the text) is "a copy". O. Reg. 17/05 s. 33 was
  not read in the primary text (e-Laws and CanLII refused the fetch, 2026-11-08 and 2026-11-16).
- **§3 "If you joined through an organization"** (new in 0.2) — whether a parent or volunteer who pays nothing is bound by
  click-through Terms at all (consideration), and whether acceptable use is enforceable against them; and whether an age
  attestation with no check is enough where a teenage fan can reach the "follow" door.
- **§20 one box for age and agreement** (new in 0.2) — whether combining the attestation and the acceptance in one tick weakens
  either as evidence.
- **§17 Québec** — "not currently offered" plus a refused billing address: whether that is enough to keep Québec consumer law
  out when a Québec resident uses an out-of-province address, or joins through an Ontario club (§3).
- **§19 governing law and forum** — routine, but worth one look alongside §14.
- **§18 unilateral change** — v0.2 replaces "continued use = acceptance" with a re-accept for significant changes; check the
  minor-change path ("take effect when we post them") is narrow enough.

---

# From the Privacy Policy draft (0.3)

## Privacy · Before this can be published (owner — delete this section on publication)

**Owner, before 6.7:**
- P1 · privacy@fieldlogichq.ca working. (The mailing address was dropped by the 2026-11-17 email-only ruling — §2 note.)
- P3 · record the acceptance date of each supplier's terms in `LEGAL_FACTS.md` (mechanisms already recorded there).
- P6 · approve `BREACH_PROCEDURE.md`, choose where the record lives, and start it.
- (P2, P4, P5 are done: region, Gmail named, encryption wording read. P7 is built, `45c134bea`.)

**Product must do first** (Stage 6 plan):
- **6.5 (P7)** — deleting an organization removes its stored files: built, committed `45c134bea` 2026-11-15; publish once it
  is on production (§9 note 2).
- **6.3** — acceptance records exist (§3 row) and the age line is ticked at every door (§8).
- **6.4** — checkout refuses a Québec billing address (§14).

**Product findings → `/plan`** (the policy is written to be true without them, but each is a real gap):
1. **Closed for a whole organization** — built as 6.5 (`45c134bea`, 2026-11-15). **Still open, Medium:** deleting one tournament,
   rep team, player or person leaves that item's files; §9 says a child's record is deleted on request, and that delete
   probably leaves the child's signed documents (not checked against the code) → `/plan`.
2. **High** — no automatic purge at the end of a retention window; no written retention schedule (PIPEDA 4.5.3).
3. **Medium** — a club cannot delete a child's record (sharper with Stage 14's one record across seasons).
4. **Medium** — signup acceptance of the Terms and this policy. **In this stage as 6.3.**
5. **Medium** — two-step sign-in for accounts that can see children's medical information. **Reworded 2026-11-12, not closed:**
   two-step now exists (built, not yet on production); every club seat that can open children's medical notes is offered it,
   and it is required only where the club switches it on, so the safeguard depends on the club's choice.
6. **Low** — players' full names in the online-payment description.
7. **Low** — self-serve correction of name and email.
8. **Low** — feedback keeps IP address and browser type unredacted (disclosed in §3; is the IP needed?).
9. **Low** — the tax records never end (blank the name and address after six years).
10. **Low (new 2026-11-08)** — the staff page trail has no end date (prune at 90 days).
11. **Low to medium (new 2026-11-13; widened 2026-11-15 after Stage 4 was built)** — the in-app notices (the bell) keep a stored copy of
    what they were built from (`notifications.metadata`) with no retention clock: a notice stays until the person it was sent to
    deletes it (`app/api/notifications/route.ts:175-196`, own copy only) or their account or the club is deleted (the rows cascade,
    `101_notifications.sql:10-11`). "Cleared" and "settled" only set `cleared_at`; the row stays. With Stages 2–4 that copy holds, for
    about 28 kinds, names (a child's, a guardian's, a parent's, an invitee's), the invitee's and a scorekeeper's email address, amounts and dates; and
    **since 2026-11-15 a house-league withdrawal request holds the family's own note in full (up to 300 characters; the public form
    invites a reason, so it can hold health or family detail)** in every desk member's own copy. That is a second copy of what the
    registration already holds (`league_registrations.withdraw_request_note`), and it outlives the registration. The note is out of
    the line, so the push and the email do not carry it (checked in code 2026-11-15). Separately, no notification kind is hidden from a
    coach (or desk member) who has since been removed (`app/api/notifications/route.ts:55-96` reads by user and bell scope, not by
    membership). §9 now says both in plain words. **Fix at the root for every kind, not per kind (`/plan`):** (a) a retention clock on
    notification rows (the length is the owner's call; settled notices are the natural first class); (b) hide a removed member's
    old notices; (c) for the note alone, the one-home option, read it live from the registration and store no copy (`/legal`
    recommended it on 2026-11-15; the owner chose the copy, so (a) matters more).

## Privacy · For a lawyer's eye

- **§1 / §5 — the two-role split.** The policy rests on FieldLogicHQ being a service provider for club data. Worth a read of
  whether anything the product does (staff access for disputes, staff billing lists, the family file, Stage 14's
  suggestions that two records are one child) puts us in the organization role for some of it.
- **§8 — children's information.** Consent sits with the club; we design the forms that collect it. The guardian tier will
  collect a consent ledger directly — that moves part of this onto us. The age line is an attestation with no check.
- **§7 — cross-border notice.** Sufficient for PIPEDA; not for Québec (no transfer assessment).
- **§6 — the Gmail row.** Naming an inbox with no data-processing terms is honest; whether it meets PIPEDA 4.1.3 ("comparable
  level of protection … by contractual or other means") is the question.
- **§10 — breach notice to clubs.** Our duty to the club is contractual; it belongs in a data-processing addendum for clubs,
  which doesn't exist yet. `BREACH_PROCEDURE.md` treats the club as in control of its information (OPC guidance).
- **§9 — retention.** "May be deleted" is honest but is the clause a regulator would test against PIPEDA 4.5.3; the staff
  page trail with no end date is the same question.
- **§5 / §9 — parents' answers and notes (2026-11-13; updated 2026-11-14).** A free-text note about a child written by a parent, kept 30 days; the
  answer is now the player's attendance record, kept (the club's), with who set it and the answer before it removed 60 days after the season's last
  event. The periods are the owner's, not a statutory figure (PIPEDA 4.5), and a leaving parent's first name stays beside their answers until then
  and is still named on the coach's side after they leave. Whether both are reasonable, whether a tick-box consent covers the note, and whether a
  parent's answer becoming the club's attendance record needs saying in the consent box itself (0.2 does not; the answer sheet's hint now does) is the question.
- **§14 — a Québec family in an Ontario club.** Law 25 may reach that information even with no Québec customer.
