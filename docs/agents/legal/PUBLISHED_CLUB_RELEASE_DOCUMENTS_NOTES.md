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
