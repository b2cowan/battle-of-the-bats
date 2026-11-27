# Club release documents (2026-11-23): the owner-only notes

**What this is.** At the Club release (publish day 2026-11-23, frozen 2026-11-22) the four customer documents became the
product's own text, one frozen file each: `lib/legal-documents/terms/2026-11-23.md`, `privacy/2026-11-23.md`,
`data-terms/2026-11-23.md` and `subprocessors/2026-11-23.md`. The drafts in `drafts/` were deleted so the customer text has
one home. Each draft's owner-only tail ("Before this can be published", the release-day steps, "For a lawyer's eye") is kept
below word for word for the next `/legal` pass. The sentences held for the Payments Terms version were published in version
2026-11-24 (section below); the held file was deleted then. The inline `> NOTE` blocks, change logs and "How to read" blocks are not copied:
read them in the last commit that holds the drafts, e.g.
`git show 422d55a35:docs/agents/legal/drafts/TERMS_OF_SERVICE.md` (and `PRIVACY_POLICY.md`, `DATA_TERMS_FOR_ORGANIZATIONS.md`,
`SUBPROCESSOR_LIST.md`).

**A later change.** Write a new draft in `drafts/` (start from the published file, then add the notes), set the document's
`draftPath` in `lib/legal-documents.ts`, and publish it as a new dated version. Never edit a published file: the build fails.
The Data Terms change only with a Terms version; the list changes with a new dated copy adding one dated row.

---

# The Payments Terms version (2026-11-24; frozen 2026-11-23, promoted the same day)

**What was published.** One date for four texts (owner 2026-11-23, "one promote, one date"): `lib/legal-documents/payments/
2026-11-24.md` (new: the Payments Terms, served at `/legal/payments` and `/legal/payments/2026-11-24`), and new versions of
the Terms, the Privacy Policy and the Data Terms carrying the held sentences. The list of companies is unchanged. Terms,
Privacy and Data Terms: a minor change; `current` moved to 2026-11-24, `oldestAccepted` stays 2026-11-22, nobody accepts again.
**Dated 2026-11-24 though promoted on 2026-11-23** (owner's choice, 2026-11-23): 2026-11-23 was already the served Club
release version and a served date is never reused, so the texts were posted a few hours before their effective date.

**The Payments Terms text** is v0.2 (owner-approved 2026-11-18, O4, with the ruling (e) narrowing approved the same day) run
through the draft filter, with ONE amendment: §3 "Your owners can open it from the Payouts card" became "The person who set
up payouts signs in to it from the Payouts card" (/legal 2026-11-23: the dashboard button is any owner's, but only the
person who set up payouts gets through Stripe's sign-in, `app/api/admin/payouts/list/route.ts:38`; §7 already said so).
**Owner APPROVED that sentence 2026-11-23 ("I approve"), before the commit.** The draft, its
NOTE blocks and change log are in git: `git show 5e350e26c:docs/agents/legal/drafts/PAYMENTS_TERMS.md` (v0.2 as
approved, before the §3 amendment); `drafts/HELD_FOR_PAYMENTS_TERMS_VERSION.md` likewise from the Club release commits.

**The held sentences, as published.** Terms §1, §13 and §19 and Data Terms §11 word for word. Privacy §3 row and the §9
record bullet word for word. **Privacy §9 organization-deleted bullet re-fitted** (the held text was copied from 0.1; the
published 2026-11-23 bullet had since become "except our own tax records (above) and our record that the deletion happened"):
published as "except our own tax records (above), the record of the Payments Terms its owners agreed to (above), and our
record that the deletion happened (…)". Same meaning; no new data or use.

**The product.** `PAYMENTS_TERMS_VERSION` is `'2026-11-24'` (a test holds it equal to the newest registered text); the
placeholder text is gone. The Payouts card's "Read the terms" in "Before you set up payouts" and in the new-terms window opens
that exact version in a new tab; on the agreed row it opens the version that owner agreed to. Production on 2026-11-23
(counts only): 0 payout accounts, 0 with a recorded version, 0 agreement rows, so the daily notice job tells nobody. Dev: 2
connected clubs agreed to the placeholder; their owners get the item and the email on dev's next daily run.

## Before this could be published (the draft's list, corrected 2026-11-23)

The draft's list had gone partly stale: items 6 and 7 named `drafts/TERMS_OF_SERVICE.md` and `drafts/PRIVACY_POLICY.md`,
both deleted 2026-11-22 at the Club release. Corrected:
- O1–O5: ruled as recorded in the draft (O5, the default payer setting, is a before-switch-on call).
- 0. v0.1 never published — held.
- 1. **Tax on our fee** — NOT a publishing gate (owner 2026-11-23): §4 says any tax on our fee is included, which is true
  whether the fee is taxable or not. It is a **before-switch-on** item (`/accounting` D1, GST/HST Stage 5).
- 2. L4 money services — researched (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`); a lawyer's-eye flag, not a gate.
- 3. The six-year record — DONE (mig 497).
- 4. **A rate-change notice procedure** — owed before a rate ever changes (not before publishing; no rate change is planned).
- 5. The refund policy required — DONE.
- 6. The Terms' next version — DONE: Terms 2026-11-24 carries §1, §13, §19.
- 7. The Privacy version naming the record — DONE: Privacy 2026-11-24, in force from the same date as the Payments Terms (the
  build fails if the Privacy version in force is older than the Payments Terms in force).

## Before online payments switch on in production (the owner's own commit)

1. Tax on our fee decided and, if taxable, recorded (`/accounting` D1; GST/HST Stage 5).
2. Our fee coming back on a bank debit that fails before it clears, seen on a live payment (§4's exception rests on Stripe;
   seen in test mode only; no code of ours reverses it).
3. **Sponsorships (Board Ready Stage 6 Part 3b):** if sponsors can pay by card, the Payments Terms need a minor version saying
   so (owner 2026-11-23: publish without it, add it with 3b) — §2 and §9 name only "registrations, programs, team fees and
   tournament entries", and the payer can be a business. ⚠ Every new version asks every connected club to agree again, so
   **publish that version before switch-on** while no club is connected; after it, every club re-agrees and gets two emails.
4. L17: whether the refund policy must show open on the pay page (the club's consumer-law exposure; not researched).
5. O5: the default payer setting.

## For a lawyer's eye (flags, not gates; owner decides when)

1. **The passed-on card fee (§9, O2)** — the card networks' surcharge cap, the advance-notice rule, Québec's ban, whether a fee
   on both cards and bank debits at different rates is a surcharge or a service fee; and, since v0.2, whether our margin inside
   the processing fee counts toward the club's "cost of acceptance" (`CARD_SURCHARGE_PAYER_FEE.md`).
2. **Money-services status (L4)** — whether our Stripe API calls are "initiation", and whether the per-payment fee is a
   distinct payment service (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`).
3. **The indemnity (§12)** — its reach over regulator and card-network claims, from a club that may be a volunteer
   non-profit; and how it sits with the Terms §14 cap.
4. **Acceptance by continuing (§13)** — whether keeping payments on after a material change binds an organization that never
   ticked the new version.
5. **"Not a party to the sale" (§2)** with receipts we send in the club's name — that the receipt, the pay page and §2
   together make the club the seller to a consumer payer under Ontario's consumer protection law.
6. **Children's information on the pay page** — a parent pays for a child; the payment description names the player (the Low
   finding on file).

---

# From the Terms of Service draft (0.5)

## Before this can be published

1. ~~Owner approves the T5 wording and the §18 call~~ **Done 2026-11-22:** approved as drafted; minor change, on the publish-day count in step 2 of the release-day steps.
2. **Same day, same promote:** the Data Terms page (frozen as `lib/legal-documents/data-terms/<this version's date>.md`, registered in
   `DATA_TERMS_VERSIONS`), the list of companies (`lib/legal-documents/subprocessors/<date>.md`, registered in
   `SUBPROCESSOR_LIST_VERSIONS`), and a **new Privacy Policy version that names ImprovMX** (the build fails if the list in
   force names a company the Privacy Policy in force does not: `tests/unit/legal-data-terms-and-list.test.ts`). The pages are built and answer
   "not found" until those files exist. If any of the three is not ready that day, publish this version WITHOUT T1–T4 (§4's
   "Our Data Terms" paragraph out; §13, §18 and §19 back to the published words); T5 and 0.3 still go; T1–T4 ride the next version.
3. **The version date is later than 2026-11-22** (the published version holds that name). Never rename it once production serves it.
4. **Minor change, no fresh acceptance** (unless T5 is called significant): `current` moves to the new date, `oldestAccepted` stays
   2026-11-22. T1–T4 add duties to us only (`DATA_TERMS_ACCEPTANCE_NOTE.md`). Keep it that way: any Data Terms clause that puts a new
   duty on a club makes this a §18 change.
5. **Publishing steps:** freeze the customer text as `lib/legal-documents/terms/<date>.md` with its sha256, add it to `published`,
   move `current`; delete this draft. ⚠ Do not set `draftPath` to this file before then without bringing back the "§20 words"
   subsection the earlier draft carried (`git show b891e6bbb:docs/agents/legal/drafts/TERMS_OF_SERVICE.md`): two unit tests read
   §20 from any draft that `draftPath` names, and this draft holds only customer text.
6. ~~Optional §9 free-time sentence~~ **Added 2026-11-22 (owner): T6, the last paragraph of §9.**

### Release-day steps for this document (in order; the full cross-document order is in `LEGAL_INDEX.md`)
1. The version date is the promote day and later than 2026-11-22; the Data Terms file, the list copy and the Privacy file carry the same date.
2. **Count the paying subscriptions on production (a count only).** 0: T5 ships as a minor change. Not 0 and a move is possible: stop; T5 is significant (30 days' email to the owners, then accept again); do not publish T5 as minor: ask the owner.
3. Freeze the customer text, register the sha256, move `current`, keep `oldestAccepted`.

### Held for the Payments Terms version (word for word from 0.1) — ✅ PUBLISHED in Terms 2026-11-24 (section at the top)
- §1, after the Privacy Policy sentence: "If your organization takes payments online through FieldLogicHQ, our
  [Payments Terms](/legal/payments) also apply to it." (the route does not exist until the Payments Terms publish).
- §13, after "Stripe's own terms": "; taking payments online is also covered by our Payments Terms (§1)".
- §19 Whole agreement: "These Terms (including our Data Terms) and the Privacy Policy, together with the Payments Terms for an
  organization that takes payments online, are the whole agreement between us about FieldLogicHQ."

## For a lawyer's eye

- (0.5) T5 removes a refund a coach could otherwise claim under §8's last paragraph, by a minor-change version with no fresh
  acceptance. Nobody holds a subscription today, so nobody loses it; whether a unilateral change under §18 binds a coach who
  bought under the earlier text is the question if a paying coach ever exists first. The Payments Terms' own "these win where
  they differ" (Payments Terms §1) is for the later version that adds them to §19.
- (0.2) The Data Terms come in by reference through the existing tick, with no signature (`DATA_TERMS_ACCEPTANCE_NOTE.md`
  § Lawyer's eye): the norm, and the record shows who ticked which version; worth a read for a club that is a non-profit
  corporation with a board. The Data Terms' own "For a lawyer's eye" list covers the cap (§14) over their §6 and §9.

---

# From the Privacy Policy draft (0.7)

## Before this can be published

> NOTE — Owner material from here to the end; the preview drops it.

**Owner decisions**
- **(b)** When it publishes — **RE-RULED 2026-11-22 (owner, "do the split now"):** with the Club release, the same day and the
  same date as the Terms, the Data Terms and the list of companies; no longer with the Payments Terms (online payments
  stays on the Canadian launch goal, not on the Club flip). The published 2026-11-22 version over-describes (it names a fee
  invoice we no longer send), which is the safe direction while online payments are off in production.
- **Out of this version (owner 2026-11-22):** the 90/120-day retention sentence for a club's sign-up files and health
  answers (item 8) stays out unless a sweep run is confirmed on release day.

**Release-day steps for this document** (the full order, with the Terms, Data Terms and list, is in `LEGAL_INDEX.md`)
1. Confirm one run of the invitation sweep succeeded on production (item 7). If not, cut the "Invitations nobody accepts" bullet.
2. Confirm the promote carries the save-for-later work (Bank check S7). If not, cut the §3 row and the §9 bullet "Work you save for later".
3. Confirm the sign-up form's Parts 1–3 are on production (item 8; they are as of 2026-11-22).
4. Confirm one run of the sign-up form's file sweep (migration 516) if the retention sentence is to be added; otherwise leave it out.
5. Freeze the text and register it (publishing steps below). The date equals the Terms version's date.

**Things that must be true first**
1. **The Terms version publishes the same day.** The Data Terms and the list of companies, which this policy's §5 and §6 point at, go with it.
2. The billing address is still asked for before payouts (Stage 4 owner call (a), built: `hasBillingLocation`). If that
   step is ever dropped, the §3 purpose changes again.
3. **(0.2)** ~~ImprovMX's pre-signed DPA is countersigned (owner Q4).~~ **Met 2026-11-18: the owner countersigned it**, so
   §6 "How we hold them to it" keeps its ImprovMX sentence.
4. **(0.2)** The sub-processor list (`drafts/SUBPROCESSOR_LIST.md`) is live at /legal/subprocessors, the address §6
   names. **If the list is not published by this version's day, cut that one sentence**; the ImprovMX row stays either way
   (the build also refuses a list naming a company this policy does not).
5. **(0.2)** The §5 Data Terms sentence stays only if the Data Terms publish the same day; otherwise cut it.
6. **(0.3, 2026-11-18, Board Ready trust close-out 13 call (b), owner "as recommended")** The §9 bullet "Invitations nobody
   accepts" stays ONLY IF, on the day this version publishes, (i) the run-out rule (30 days, a Resend restarts it) and the
   removal sweep (`lib/invitation-lapse.ts`, `lib/invitation-sweep.ts`) are on production (they are), AND (ii) the nightly
   schedule for `POST /api/platform-admin/invitation-sweep-nightly` is ON in production (migration 504, applied 2026-11-22
   after job 289), AND (iii) **one nightly run has succeeded: a release-day check**. If not, cut the whole bullet (the
   published text says nothing about invitations, so it is silent, not false). Soften "Thirty days after that" to "About
   thirty days after that" if the owner will not hold the sweep to the day (the sweep takes 200 rows a run, so a backlog
   can slip a night). Re-read the bullet against the sweep's keep rule if `lib/member-account-keep.ts` changes.
7. **(0.4, 2026-11-20, Board Ready Stage 4 Part 3)** The new §5 bullet about a club's own sign-up questions, files and
   ticks publishes no earlier than the day the club's side of the sign-up form (Parts 1–3 together) is on production
   (it is, 2026-11-22), and it is true as soon as Part 2 collects an answer. **The §9 retention sentence and any "within
   a day" sentence are NOT in this draft, and stay out of this release unless a run of the six-hourly sweep (migration 516,
   scheduled on production 2026-11-22) is confirmed (owner 2026-11-22).** If confirmed, the sentence then says: family
   files and health answers a club's sign-up form collected are removed 90 days after the season is marked finished, or
   120 days after its last day if it is never marked finished, and a file a family chose but never sent in with a
   sign-up is deleted within about 18 hours. Cut the 120-day half only if the finish-or-backstop rule changes. The
   sentence about the audit log in the §5 bullet is true now that Part 3 is on production (the log lists a file opening;
   `lib/member-audit.ts` `AUDIT_LOG_ACTIONS`).
8. **(0.7)** The §3 row and §9 bullet "Work you save for later" publish only with the promote that carries the save-for-later
   work (Bank check S7: committed on dev, not on production on 2026-11-22). Source: the carry-forward row in `LEGAL_INDEX.md`
   and the S7 Part 3 review (the work lasts through the whole of the day its card names; the person's name shown to others is
   the display name, or their email when they have none, hence "your name (or email)"). The sweep (migration 523) is on production.
9. **(0.7)** The "A request to delete an organization" bullet in §9 is true on production (migration 514 applied 2026-11-22).

**Publishing steps**
1. Freeze the text as `lib/legal-documents/privacy/<date>.md` (the filter's output), add `{ version, sha256 }` to
   `lib/legal-documents.ts`, set `current`, keep `oldestAccepted` (a minor change: no one accepts again), set `draftPath`
   back to null and delete this draft. `<date>` is the Terms version's date, later than 2026-11-22.
2. Delete the `LEGAL_INDEX.md` carry-forward rows for the fee invoice, the recorded deletion request and work you save for
   later (the Payments Terms record rows stay until the Payments version).

### Held for the Payments Terms version (word for word from 0.1) — ✅ PUBLISHED in Privacy 2026-11-24, the §9 organization-deleted bullet re-fitted (section at the top)
- **Publishing condition then:** this restoration needs a Privacy version live **before the first Payments Terms agreement is
  recorded on production** (the tick writes that record; the version without these words does not name it).
- §3, acceptance row: after "which version of our Terms of Service and this policy you accepted" add " (and, for an owner who
  sets up online payments for a club, which version of our Payments Terms you agreed to for it)".
- §9, the acceptance-record bullet: "The record of which version of our Terms of Service you accepted, and of which version of
  our Payments Terms an owner agreed to for a club (§3), is kept for at least six years after your account closes, …" (the rest
  of the bullet unchanged).
- §9, the organization-deleted bullet: after "except our own tax records (above)," add " the record of the Payments Terms its
  owners agreed to (above),".

## For a lawyer's eye

Nothing new: the five edits narrow a purpose, remove a retired email and invoice, and name an existing record. The 0.2
edits name a supplier already in use and state facts; the only exposure they touch (privacy requests reaching a free Gmail
account and a forwarder) is on file in `drafts/SUBPROCESSOR_LIST.md` § For a lawyer's eye.

---

# From the Data Terms draft (0.1)

## Before this can be published

> NOTE — Owner material from here to the end; the preview drops it.

**Owner decisions** — questions 1, 2, 3, 6, 7 and 9 in `BOARD_READY_DATA_TERMS_REVIEW.md`; each bracket above is one of them.

**Things that must be true first**
1. The sub-processor list is published at /legal/subprocessors (§6), with the privacy policy edits P1–P4 (ImprovMX) in
   force no later. Both pages are a `/plan` build (Board Ready plan 0a-5): they go live the day the held Terms version
   publishes, or this text waits for the Terms version after (the Terms draft's publishing note).
2. The Terms edits T1–T4 are in the Terms version that carries these Data Terms (the acceptance note).
3. ~~Two-step sign-in is on production (the §8 bullet)~~ **Met: on production since the 2026-11-22 promote.**
4. ~~Org deletion removes files on production (`45c134bea`)~~ **Met: `45c134bea` is in the 2026-11-22 promote.**
5. ~~The owner has a by-hand procedure for §10 and §11~~ **§11 confirmed 2026-11-22 (full copy by hand; Q9 answered).** §10 (a child's record and its files) stays by hand with the procedure note in `BOARD_READY_DATA_TERMS_REVIEW.md`.
6. **(2026-11-20, Board Ready Stage 4 Part 3)** The §12 sentence about sign-up answers and files is true once Parts 1–3
   of the club sign-up form are on production. **No retention or "within a day" sentence about those files and health
   answers goes into §10, §11 or §12 until migration 516 (the six-hourly sweep schedule; the owner's yes) has been applied
   on production and one run has succeeded.** Then add: family files and health answers collected by a club's sign-up
   form are removed 90 days after the season is marked finished, or 120 days after its last day if it never is.

**Out of this release (owner 2026-11-22):** the 90/120-day retention sentence of item 6 stays out unless one run of the
sweep (migration 516, scheduled on production 2026-11-22) is confirmed on release day.

**Held for the Payments Terms version (✅ PUBLISHED in Data Terms 2026-11-24, word for word):** §11, the keep-list bullet "What we keep after that": "the record of
the Terms and Payments Terms your owners agreed to" (today: "the record of the Terms your owners agreed to"). Data Terms change
only with a Terms version, so this rides the Terms version that adds the Payments Terms.

**Publishing steps** — as the Terms' (Stage 6 plan §6.7 shape): frozen as part of the Terms version, served beside it,
this draft deleted and the index pointed at the product's copy.

## For a lawyer's eye

- **§6 and §9 sit under the Terms' limitation of liability (§14).** A board may ask for breach costs to sit outside the
  cap. Whether the cap reaches these promises, and is enforceable against a club, is the clause with the most exposure.
- **§2 roles.** PIPEDA has no "controller"; it makes the organization that transfers information "for processing"
  responsible and asks it to secure comparable protection by contract (Principle 4.1.3). These terms are that contract.
  Whether FieldLogicHQ is ever "in control" of some club information — we design the forms, and our staff can open
  records — is the open question already on file (`BREACH_PROCEDURE.md` lawyer's eye 1).
- **§12 "we do not check" consent.** True and necessary, but it is the sentence a regulator would read first if a club
  had none; a lawyer should confirm it does not read as indifference.
- **Québec (only once FieldLogicHQ is offered there; Terms §17 says it is not).** The Act respecting the protection of
  personal information in the private sector asks for a written mandate that names the confidentiality measures, use
  only for the mandate, no keeping after it ends, notice of any breach or attempt, and the client's right to verify
  (s. 18.3), and an assessment before information leaves Québec (s. 17). §§3, 5, 9, 11 and 13 are drafted to that list
  from earlier reading; the statute's text could not be fetched on 2026-11-18 and must be re-read first.

---

# From the list-of-companies draft (0.1)

## Before this can be published

> NOTE — Owner material from here to the end; the preview drops it.

1. ~~Owner questions 1, 3 and 4 answered~~ **Met 2026-11-18** (all ruled; Q3 written into `AGENCY_RULES.md`; ImprovMX's
   DPA countersigned).
2. The Terms edit T3 (new-company notice) publishes the same day, and the privacy policy edits P1–P4 (ImprovMX named in §6
   and §7) publish no later — a list that names a company the policy does not is the drift this page exists to prevent.
3. ~~The owner subscribes to the sub-processor notices of Supabase, AWS and Stripe (owner question 8)~~ **Met 2026-11-18**
   (owner subscribed to all three), so a change in our own chain reaches us in time to pass it on.
4. Each "Its own pages" link and certification re-read on the day of publication.
5. The product renders it at /legal/subprocessors (Board Ready plan 0a-5, the same day as the held Terms version, or the
   Terms version after); then this draft is deleted and the index points at the product's copy.

## For a lawyer's eye

- **"We stay responsible to you for every company on this list"** — the right promise under PIPEDA Principle 4.1.3, but it
  sits under the Terms' limitation of liability (§14); a lawyer should confirm the cap reaches a supplier's breach as we
  intend.
- **Gmail holds privacy requests that can be about a child, without business terms.** Small in volume; it is our
  exposure, not a club's. The deferred own mailbox fixes it. (ImprovMX's half closed 2026-11-18: its agreement is
  countersigned.)

---

# The sponsorship version (2026-11-28; frozen 2026-11-27)

**What it is.** One date for four texts (O-S1, owner 2026-11-25; publish authorized 2026-11-27, "go ahead"): new versions of
the Payments Terms, the Privacy Policy, the Terms of Service and the Data Terms in
`lib/legal-documents/<kind>/2026-11-28.md`, each the whole 2026-11-24 text with its approved addendum applied word for word
(cut from the draft by script, not retyped). The list of companies is unchanged. Terms, Privacy and Data Terms: a minor
change; `current` moved to 2026-11-28, `oldestAccepted` stays 2026-11-22, nobody accepts again.
`PAYMENTS_TERMS_VERSION` is `'2026-11-28'`; `PAYMENTS_TERMS_SUMMARY` stays empty (no draft gave a "What changed" text).
The promote that carries them is planned for 2026-11-27 or 2026-11-28. The drafts, their change logs and owner notes:
`git show 1ce596dec:docs/agents/legal/drafts/<file>`.

**Changed after the literal apply (owner 2026-11-27, "fix both"; the Payments file and its sha256 only):**
- Payments §9: the added business "follow the law" bullet ended with a period in the middle of a semicolon list; it now ends
  with a semicolon. No word changed.
- Payments §11: "the payer is a business" reads "the payer is the sponsor", since §1 says a sponsor is a business or person.

**Where the addendum did not give a position, or reads awkwardly** (applied literally; a file production has not served may
still change, with its sha256):
- Payments §9: "replaces the second bullet, adds two". The published "follow the law ... If you choose to have the payer pay"
  bullet stays word for word, so two "follow the law and the card networks' rules" bullets sit together (sponsor, then
  payer).
- Payments §7: the draft calls the "gather the facts" sentence the "existing first bullet"; it is in the second. Changed by
  its quoted words. The new dispute bullet is last in §7. The §11 sentences are a new last paragraph.
- Privacy §5 names "a person or family who sponsors a club".
- Payments §4's replacement lists "registrations, team fees and tournament entries" and leaves out "programs", which §2 and
  §9 name.
- Not in this version: `/legal`'s 2026-11-26 note (Board Ready plan, Part B, open item (d)) that §10 of the next Payments
  Terms version should name "an open dispute (including a bank's question about a payment)". The approved 0.4 says no §10
  change.

## Release-day conditions (in order; production reads are counts only)
1. The version date is 2026-11-28. If the promote slips past it, rename the four files and every date string to the promote
   day first (same text, same sha256). If it promotes 2026-11-27, either ship as dated (the 2026-11-24 precedent, the
   owner's choice) or rename to 2026-11-27.
2. **Count connected clubs:** payout accounts and Payments Terms agreements (2026-11-25: 0 and 0). If any club has agreed to
   2026-11-24, stop: 30 days' email notice (O-S1, Payments Terms §13).
3. The migrations the release carries are on production first, in the order `MANUAL_PROD_STEPS.json` records, including 530
   to 534 (sponsor card), 542 (the Stripe-account refund; recount duplicate open notices first) and **555** (error summary
   details).
4. After 555, run the error clean-up once (platform admin, or wait for 08:15 UTC) and count 0 `error_groups` rows not seen
   for 30 days that still hold `sample_stack` or `sample_context`. The run removes them for good.
5. Demo removal: 543, then `scripts/retire-public-demos.mjs --prod --apply`, before the promote (Terms §12 loses its
   warning); count 0 demo organizations.
6. One successful production run of `club_form_files_sweep` stands behind Privacy §9 and Data Terms §11 (last read ok
   2026-11-25; read it again).
7. After the promote: /legal/terms, /legal/privacy, /legal/data-terms and /legal/payments show 2026-11-28 signed out;
   /legal/payments/2026-11-24 still answers; the Payouts card's "Read the terms" opens 2026-11-28.

---

# From the Payments Terms addendum (0.4)

## Before this can be published

> NOTE — Owner material from here to the end; the preview and the page drop it.

**0.4 was approved by the owner 2026-11-27. It goes only with the release that carries the refund made in the club's Stripe account** (migration 542, on dev): §6, §4's card-fee bullet and §11's last sentence about a Stripe refund describe that build. Released without it, they would be untrue.

**How this publishes (owner decision O-S1).** The product's Payments Terms are one frozen file per version (`lib/legal-documents/payments/<date>.md`, registered in `PAYMENTS_TERMS_VERSIONS` with its sha256; `PAYMENTS_TERMS_VERSION` in `lib/online-payment-words.ts` must equal the newest). The addendum is applied to a copy of the whole 2026-11-24 text and frozen as a new dated version; 2026-11-24 stays served at its own address (the card's "Read the terms" opens the version an owner agreed to). **Never edit the 2026-11-24 file** (the build fails).

**A new version is needed, and it is not just "clarifying".** The 2026-11-24 text names the seller's sale as "registration, program, team fee or tournament entry" (§2), limits what a club may take payments for to the same list (§9), and says the fee setting is "for the whole organization" (§4). A sponsor's card payment is outside all three. Moving `PAYMENTS_TERMS_VERSION` asks every connected club to agree again and emails its owners (the daily job), minor or not (`lib/online-payment-owner-notices.ts`, `lib/payments-terms-agreement.ts`).

**The ordering that costs nothing:** publish this version **before the first production club connects**, in the release that carries the sponsor's card payment. Online payments have been switched on in production since 2026-11-24, so a club can connect on any day; on 2026-11-25 production holds 0 payout accounts and 0 agreements (counts only), so today nobody would be asked twice and nobody has agreed to a text that leaves sponsorships out. **Count both again on release day.** If it publishes after clubs have agreed to 2026-11-24, treat it as a change that adds a new default cost (our fee on sponsor card payments, the club paying by default) and widens what the club may do, so under §13 it needs **30 days' email notice**, not "when we post". The reason is in the code: there is no separate sponsorship switch. A connected club whose account takes payments, with the launch switch on and a refund policy, gets the sponsor's card button on every deal without any step of its own (`lib/sponsor-card-server.ts` `sponsorCardFacts`).

**The Privacy and Terms versions move with it** (the build refuses a Privacy version older than the Payments Terms in force). Their drafts: `PRIVACY_POLICY_SPONSORSHIP_ADDENDUM.md` and `TERMS_SPONSORSHIP_ADDENDUM.md` (Terms §4 plus one Data Terms §11 bullet). **§3 of these terms needs no change:** the list of what a club sells is in §2 as published.

**Who accepts.** The club's owner, at the Payouts card (the "Before you set up payouts" tick, or the "new payments terms" window), as for 2026-11-24. **The business that pays by card accepts none of our terms**, and should not be shown them: FieldLogicHQ is not the seller, and a link to our terms on the club's page would suggest it is. The business sees the club's own refund policy and, if the club set one, the club's own privacy link (`components/public/SponsorDealContent.tsx` `RefundPolicy`, `Foot`); Stripe's page carries Stripe's own notice.

**Owner decisions.**
- O-S1. ANSWERED 2026-11-25: publish in the release that carries sponsor card payments and Offer again, with the Privacy, Terms and Data Terms versions on one date. Count connected clubs that day; if one has agreed to 2026-11-24, stop (30 days' email notice).
- O-S2. ANSWERED 2026-11-24 (owner, walk §564 call (b): "build a notice and the books reversal first"): the product records a sponsor's dispute, raises a notice, and books a loss; §7 now says so (0.2).
- O-S3. ANSWERED 2026-11-24 (owner: "do the O-S7 wording pass"): the product says "It can take 5 to 10 business days to appear, depending on the card company."; §6 says the same (0.3).
- O-S4. FALLS AWAY (0.2): §10 is no longer narrowed.

## For a lawyer's eye

- **§7, the dispute bullet (0.2).** The product now tells the club of a sponsor's dispute, and books a lost one, but does not promise to catch every case (a part dispute, an unrecorded payment): the bullet says so. A lawyer could read whether "we tell whoever at your organization opens Sponsorships" is a promise stronger than the product can keep when nobody holds that seat, and the GST/HST sentence ("we do not adjust the GST/HST on an invoice that has been issued") is a statement about the club's tax that the club's accountant owns.
- **§6, a refund that does not reach the card (0.2).** The cancelled credit note: the product keeps the note, marks it cancelled, never reuses its number, and tells the business. Whether that is the right way to withdraw a credit note that reduced GST/HST is for the club's accountant (see the topic file's 2026-11-24 addendum).
- **§4 and §9, the business-pays fee.** A processing fee passed to a business is the club's charge, and the card rate can exceed the card networks' surcharge ceiling if it is read as a surcharge (2.4%, no more than the cost of acceptance, none in Québec); GST/HST is charged on it. Whether it is a surcharge or a service fee is unsettled (`CARD_SURCHARGE_PAYER_FEE.md`). The default is "the club pays", which keeps it out of the common case.
- **§6, asking for refunded money again (0.4).** "They still owe it" follows a refund of everything the business paid on a payment, and then asks it for the invoice again, with no credit note. The product says so in the refund email and on the business's page. A lawyer could read whether the club may ask again for money it chose to refund, and what it must tell the business.
- **§4, a processing fee line on an invoice owing again (0.4).** The line stays and can be paid by cheque or e-transfer, so the club would collect a "Processing fee" on a payment with no card cost (a product question for `/plan`; `/accounting` flags it too).
- **§6, a refund from the deal beside another payment (0.4).** When one payment is refunded in full from the deal and what remains no longer covers the invoice, the deal reads owing again and a credit note is still issued. This is the opposite of the Stripe-account rule; an open follow-up for `/plan` (accounting topic file, 2026-11-26).
- **§6, no fee refund.** A business that paid a fee on a deal that is then fully refunded from the deal gets everything back but the fee (the club can include it only by refunding in its Stripe account), and the card page does not say so before it pays (it says so in the refund email). The exposure sits with the club (its own representation to its sponsor), not with us; whether the page should say it first is O-S5 in the topic file.
- **§2 and §6, an individual sponsor.** If the payer is a person, a family or a sole proprietor rather than a business, consumer rules for internet agreements may apply to the club (`ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`, backlog L17). The club's obligations, not ours; the draft puts the information duty on the club in §9.
- **§12 (unchanged), the cost-cover clause** now reaches claims by a sponsor about a sponsorship's refunds and the fee passed to it. Same language, wider cases.
- **Money-services status** is unchanged by this change (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`): a direct charge on the club's account, our fee taken at the payment, nothing held.

---

# From the Privacy Policy addendum (0.3)

## Before this can be published

> NOTE — Owner material from here to the end; the preview and the page drop it.

**When it publishes (owner 2026-11-25).** With the release that carries the sponsor's card payment and Offer again, on the same date as
the Payments Terms (the build refuses a Privacy version older than the Payments Terms in force). Three sentences are only
true from that release: the card, refund and dispute words in §5 and §6; Offer again's payment date; and "at every
address the club has on its record" in §12 (on production today an unsubscribe stops one address). The 0.2 words about a
refund made in the club's own Stripe account are true only from the release that carries that build (migration 542).

**True on production already (2026-11-25):** everything else here, including the sign-up clean-up (the six-hourly sweep
ran successfully on production on 2026-11-25; 0 sign-up files and 0 answers there, counts only).

**0.3's error-report words are true only once migration 555 is on production and the clean-up has run once** (the nightly
run, or the platform admin's own run). On 2026-11-27, 13 of production's 19 error summaries held details older than 30
days (counts only); that run removes them for good.

**A minor change under §13** (recorded as a judgement, not a certainty): it names records the product keeps for a club
and adds no company and no new use of an account holder's information. No notice email; nobody accepts again
(`oldestAccepted` stays 2026-11-22).

**Not in this version, because the product doesn't do it yet:** club events and camps, club website previews, player
photos. Each carries its own sentences with its own release.

**Product findings, for `/plan` (the text is written true without them):**
1. (Owner 2026-11-25: fix soon, as its own small fix.) **Private links in error reports: fixed in code (Part B-1,
   built on dev 2026-11-26; true on production once released).** Every private-link shape (the no-sign-in pages, their
   data routes, the calendar feeds, and a secret after `?`) and unsubscribe addresses are removed before an error report
   or feedback note is stored or logged. Dev's stored rows were cleaned; production held none (counted 2026-11-26).
   **The 30-day sentence and the grouped summary (`/legal` 2026-11-26; owner 2026-11-27 "yes to both").** Each group kept
   its latest sample (technical trace and context) until 90 days after it was resolved, with no end date while open or
   ignored. Migration 555 (written and trialled on dev 2026-11-27, rolled back) has the nightly job clear it 30 days after
   the group was last seen; 0.3 carries the matching words in §4, §8 and §9.
2. A logo that has been shown stays reachable by its address, and a withdrawn deal keeps the logo the business sent.
3. A club can't delete a business that ever had a deal, or its attached files; there is no screen for a removal request.
4. The sponsor page shows the club's privacy link only while the form is open, not on its later or closed states.

## For a lawyer's eye

- **§4, §8 and §9, error reports (0.3).** Naming the signed-in account in §4 and narrowing §8's claim correct a text
  that is live today; judged minor under §13. A lawyer could say whether correcting an overstated protection needs
  notice. The alert email we send ourselves on a serious error carried the error message, which stays in our own mailbox past
  30 days; the message was taken out of that email (owner 2026-11-27). Alerts sent before then are still in the mailbox.
- **§5 and §9, the offer record and the stop list** are deleted with the organization. CASL puts the burden of proving
  consent on whoever claims it (s. 13) and a violation can be pursued up to three years after a designated person learns
  of it (s. 23(1)); a deleted club leaves neither record behind. The private right to sue was repealed before it came
  into force. Whether FieldLogicHQ is itself a sender is the open question that decides if this is our exposure. Owner 2026-11-25: left as
  built; a lawyer looks when the owner chooses.
- **§5, a sponsor who is a person or a family** is outside the business-contact exemption (PIPEDA s. 4.01); the club's
  own openness duty then applies, met today by the club's privacy link where it set one.
- **§9, sign-up clean-up:** every other answer and the sign-up record stay with no time limit (backlog L9, "limited
  retention").
- **§13:** whether naming sponsors is a "new way" of using information that needs the notice email.

## Sources
- [CASL, S.C. 2010, c. 23, s. 13, s. 23(1), s. 91 footnote](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/FullText.html) — accessed 2026-11-25 (current to 2026-10-29)
- Everything else rests on `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md`, `BOARD_READY_STAGE6_PART3B_CARD_REVIEW.md` and the code

---

# From the Terms and Data Terms addendum (0.2)

## Before this can be published

> NOTE — Owner material from here to the end; the preview and the page drop it.

- **§12's removal publishes only after production's demo clubs are deleted** (the demo removal step of the same
  release). It takes away a warning about something that no longer exists, so it is minor too.
- **A minor change under §18.** The list already says "Everything your organization or team puts into FieldLogicHQ", so
  sponsors are inside it today; this names them. The Data Terms bullet states a clean-up the product has run on
  production since 2026-11-22, with 0 sign-up files and answers there on 2026-11-25. No notice email, nobody accepts
  again.
- **The Data Terms need only that bullet,** so this release writes a new Data Terms file at the same date. Their list of
  Customer Data points at Terms §4, so sponsors carry into them. The owner kept the clean-up sentence (2026-11-25).
- **The list of companies needs no change.** Sponsorships adds no company.
- **Left out on purpose:** the clubs' website preview paragraph for §3 (it belongs to the release that makes previews
  reachable) and whether one co-owner's confirmation is enough to delete an organization (not ruled).

## For a lawyer's eye

- **Data Terms §11.** An automatic removal of a club's records sits beside §2's "you decide how long to keep it". A
  lawyer could say whether naming it needs the §18 notice once a club holds such records.
- **§4.** A sponsor's logo is someone else's property that the club publishes. The sponsor page asks the business to
  confirm it may use the logo and allows the club to show it; §5 already bars uploading what the club has no right to
  share. A lawyer could say whether the club's licence from its sponsor should also be named in these Terms.
