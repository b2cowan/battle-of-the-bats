# GST/HST Stage 6 · step 6.1 — the legal pass: both drafts to v0.2 (kickoff prompt)

> Written 2026-11-08 by the Stage 6 planning session, after the owner ruled the whole decision sheet. Run it as a **`/legal`
> session on Opus**. Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — §3's **RULED** block is
> binding; §5 step 6.1 is this session's brief. PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md).

## What this session is

A **drafting** session. It brings the Terms of Service and the privacy policy from v0.1 to **v0.2** with every owner ruling
applied, writes the customer-facing acceptance wording the build will copy, and writes the breach procedure. **No product code.**
The drafts stay drafts: status "draft — not owner-approved". Nothing is published, nothing is marked approved.

## Read first (in this order — and only these until a question needs more)
1. `docs/agents/legal/LEGAL_FACTS.md`, `docs/agents/legal/LEGAL_INDEX.md` (the `/legal` activation set) and
   `docs/agents/accounting/ACCOUNTING_FACTS.md` § Structure / Jurisdiction / Registrations.
2. The plan: §0 (what the audit corrected), §1 (Terms truth table), §2 (privacy edits and findings), **§3 RULED block**, §5 step
   6.1, §5.3 (acceptance — what the build will record and where the words appear).
3. `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` and `docs/agents/legal/drafts/PRIVACY_POLICY.md` in full — you are editing them.
4. `docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md` L55–65 — it parked a Terms line "until the Terms say who a family
   account holder is"; O7 now says.
5. Topic files only as a section needs them: `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md` (§1 seller facts, §8 renewals,
   §16 the copy within 15 days), `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (breaches, providers, retention),
   `STAFF_CROSS_CLUB_BILLING_LISTS.md` (§5/§6 staff lists, the accountant).

Mark each fact you rely on **[V]** (opened this session) or **[H]** (handed over by the plan or a helper). Broad reading goes to
a helper (`Explore`) with "return path:line and a verdict"; open the cited lines yourself before a sentence rests on one.

## The rulings to apply (owner 2026-11-08, all option A)

**Terms**
- **O1 Seller.** "[owner's full legal name], carrying on business as FieldLogicHQ" — a sole proprietor's legal name is the
  owner's personal name. Contact block: a support@ address on our domain, a phone number, a mailing address in Ontario (a
  mail service's street address, not the home address). **The owner has not supplied these yet: keep them as named brackets**
  (`[owner's full legal name]`, `[mailing address]`, `[phone]`). Never put them in this repo before the owner hands them over.
- **O2** The Terms promise **one email 30 days before a yearly plan renews** (built in 6.4, before publication).
- **O3** When **we** end a plan through no fault of the customer: 30 days' notice and **a refund of the unused part** (by hand).
- **O4** **"Not currently offered in Québec"**, and checkout declines a Québec billing address (6.4). Logged in
  `BUSINESS_DECISIONS.md` 2026-11-08.
- **O5** **18 or older (or the age of majority where you live) for everyone who holds an account**, confirmed at sign-up. Check
  the guardian draft's "no child holds a login" still reads true beside it.
- **O6** Liability cap: **what the customer paid in the 12 months before the claim, or $100 if they paid nothing.**
- **O7** **One set of Terms for every account holder**, with a short section **"If you joined through an organization"**
  (staff, coaches, volunteers, parents): the organization controls their access; acceptable use applies to them; they pay
  nothing; the billing sections do not apply. Then write the line the guardian draft parked, and un-park it there.
- **O8** Existing accounts accept on their next sign-in: one required screen, "We've published our Terms", one tick.

**Privacy**
- **P1** "Privacy Officer, FieldLogicHQ", privacy@ on our domain, the O1 mailing address (bracketed until supplied).
- **P3** Accept each supplier's standard data-processing terms. Read **each supplier's own site** (Supabase, AWS, Resend) for
  how its terms are accepted — click-through, part of the service terms, or a request — and record the mechanism in
  `LEGAL_FACTS.md`. The owner records each date on accepting. §6 names all three honestly either way.
- **P4** §6 names the free Gmail inbox now. It stays the inbox; support@ and privacy@ can forward into it.
- **P6** Write the **breach procedure and the record's shape** as a one-page internal document (not customer-facing) at
  `docs/agents/legal/BREACH_PROCEDURE.md`: what counts as a breach of security safeguards, who decides on real risk of significant
  harm, the report to the Commissioner and the notice to people, the record kept 24 months, and the record's columns. The owner
  approves it. **No incident data in the repo** — the record itself lives outside it; say where it should live as a question.
- **P7** The policy may say that **deleting an organization removes its stored files**, because 6.5 fixes that before
  publication. Note the dependency next to the sentence.

**Lookups already answered (§3) — write them in**
- Supabase production: **United States (AWS us-east-2), Pro plan.** Before §10 says "encrypted at rest", read Supabase's own
  security page and use its wording.
- Stripe's billing page: opened with **our own** settings (cancel at the period end, no refund, no plan switches). §8's cancel
  paragraph is true on every door.
- **Not yet known (owner reads the live Stripe dashboard before 6.7):** the retry setting (F2) and whether Stripe emails
  receipts and invoices. Write §8's failed-payment paragraph and the receipts line so they do not depend on the answer, or leave
  a single marked choice with both versions. Do not guess.

## Also in this pass
- Apply **§1's truth table** and **§2.1's edits** (Stage 14's one child record across seasons; the tax record's full billing
  address — a home address for a coach buying as a person; the staff lists of who owes money; our own bookkeeping on AWS; the
  accountant; retention, including "until the club deletes it" now being misleading). The §2.2 findings stay findings: the
  policy says what the product does, never what we wish it did.
- Strike every stale note (the production cancel; the business-name registration, L13).
- Add a short **"How you accept these Terms"** section to the Terms draft, holding the exact words the build copies: the sign-up
  tick-box line ("I agree to the Terms of Service and have read the Privacy policy", plus O5's age line), the sign-in screen's two
  sentences (O8), and the line beside a purchase button. **Customer-facing words come from this draft, not from the build.**
- **`/accounting` reads** Terms §6–§8 and §16 (price, tax, refunds, invoices, what the purchase email must say about tax).
  Apply what it finds, or record it as an owner question.
- One spelling rule: `npm run check:spelling` on both drafts (installment; "8:00 a.m."; Canadian English). No price restated —
  point at the plan facts. No lawyer gate: the "For a lawyer's eye" lists stay and gain anything new.

## Done when
- Both drafts are at **v0.2**: change log line, Last reviewed 2026-11-xx, status "draft — not owner-approved".
- Every [bracket] is filled **except** the O1/P1 owner facts and the one marked Stripe choice; the notes are cut to what still
  needs the owner.
- `BREACH_PROCEDURE.md` exists and is linked from the index.
- `LEGAL_INDEX.md` rows, `LEGAL_FACTS.md` (supplier mechanisms), the plan's §5 6.1 progress line, the TODO line and the Claude
  memory (`project_gst_hst_collection.md`) are updated to say what happened, with positive facts and dates.
- **Ask before committing.** On `dev`, explicit pathspecs only; other sessions share this working copy.

## Hand-over
Next is **6.2** (legal pages, versioning and links, built dark behind one switch). Route it to `/plan` for the build prompt;
6.5 (deleting an organization removes its files) can start any time, in parallel. End with a short product-owner summary:
what changed in each document, what still needs the owner, and the next step.
