# FieldLogicHQ Terms of Service — DRAFT

| | |
|---|---|
| **Version** | 0.2 (draft) |
| **Status** | draft — not owner-approved, not published, **not reviewed by a lawyer** |
| **Effective date** | — (set on publication; the version then becomes that date, `YYYY-MM-DD`) |
| **Last reviewed** | 2026-11-08 |
| **Backlog** | L1 (with L8 and L12 folded in); Québec (L7) answered by not selling there (§17); payments terms (L3) left out until written |

**Change log**
- 0.1 · 2026-11-05 · First draft by `/legal`, written against the product as ruled on 2026-11-05.
- 0.1 · 2026-11-08 · Owner notes only: the renewal-date cancel is on production; the Stage 6 plan holds the truth table.
- **0.2 · 2026-11-08 · The legal pass (GST/HST Stage 6 step 6.1), owner rulings O1–O8 of 2026-11-08 applied.** §1 names
  FieldLogicHQ as a registered business name, with no personal name (O1′ ruled the same day: the owner did not rule his
  personal name in, then chose to leave it out everywhere, accepting a consumer's cancel right), and drops the Payments Terms sentence (returns with L3). §3: 18 or
  older for **every** account holder (O5), and a new part **"If you joined through an organization"** (O7). §6: the receipts
  line is the one marked Stripe choice. §8: the yearly reminder is a promise (O2, built in 6.4), the failed-payment paragraph
  is written so it holds whatever Stripe's retry setting is, and the refund when we end a plan is ruled (O3). §9: the warning
  is "we will try", and the export sentence is cut (no export covers everything). §16: the purchase email waits on 6.4. §17:
  not offered in Québec (O4). New §20 **"How you accept these Terms"** with the exact words the product shows (O8). Every
  stale note struck (production cancel; business-name registration).

> **How to read this draft.** `[square brackets]` = a fact the owner must supply (only the phone and mailing address are left
> — no personal name, by ruling O1′ — and the one Stripe choice in §6). A `> NOTE` block is for the owner and is deleted before publication.
> Everything else is the customer-facing text, in plain Canadian English so a club treasurer can follow it.
> **Facts marked** [V] were opened in the 2026-11-08 session; [H] were handed over by the Stage 6 plan.

---

## 1. Who we are and what these terms cover

**FieldLogicHQ** is a business name registered in Ontario, Canada, by its owner, a sole proprietor ("FieldLogicHQ", "we",
"us"). You can reach us at:

- Email: **support@fieldlogichq.ca**
- Telephone: **[phone]**
- Mail: **[mailing address]**

These Terms of Service ("Terms") are the agreement between us and you when you create an account, use FieldLogicHQ, or
buy a plan. "You" means the person accepting these Terms and, if you accept them for a club, league, association or
other organization, that organization too. If you accept for an organization, you confirm you are allowed to bind it.

Our [Privacy Policy](/privacy) explains how we handle personal information.

> NOTE — **⚖ O1′ RULED 2026-11-08 (owner): option 2 — the owner's name appears nowhere** (not in the Terms, the checkout or
> the purchase email), and no home address is published. **A known, accepted gap:** O. Reg. 17/05 s. 32 item 1 asks a
> sole-proprietor supplier for "the name of the supplier", which is the owner's own name; leaving it out lets a **consumer**
> buyer (a coach buying for themselves, over $50) cancel until 7 days after receiving the copy and be refunded what they paid
> for that purchase — a yearly plan in full, not a part-month (remedy per the law-firm pointer; the Act's ss. 40 and 96 not
> read). The owner accepts it: rare and small at this scale. Revisit if incorporating (L14 — the corporation's name would
> then fill item 1 with no personal name), or if consumer sales grow. Detail: `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md` §
> "The seller's identity without personal details". Clubs are not consumers; nothing changes for them. Still owed: a phone
> line (a VoIP number is fine) and a mail service's street address in Ontario (item 2's "premises" wording is a weaker fit
> for a mailbox — same accepted remedy). **support@fieldlogichq.ca must exist before publication**
> (forwarding into the business Gmail is enough). The product already uses **hello@fieldlogichq.ca** as its reply-to and
> contact address [V `lib/email-sender.ts:194`, `lib/online-payment-words.ts:1129`] — make sure it receives mail too, or
> point those at support@ in 6.2. **Do not put any owner name, phone or address in this repo**; they go in the product at 6.7.
> The Payments Terms sentence is cut until they exist (backlog L3); it returns with them as a minor version.

## 2. What FieldLogicHQ is

FieldLogicHQ is online software for running sports organizations and teams: tournaments, house leagues, rep and
competitive teams, registrations and tryouts, schedules, rosters, communications, team money and, where switched on,
online payments. What each plan includes is shown on our [pricing page](/pricing). We may improve, change or retire
features over time; if we remove a core feature of a paid plan you are part-way through, §8 applies.

You need a current web browser and an internet connection to use FieldLogicHQ.

## 3. Accounts

- **Age.** You must be **18 or older, or the age of majority where you live**, to hold a FieldLogicHQ account. You confirm
  this when you create your account.
- **Be accurate.** Give us true information when you sign up and keep it up to date.
- **Keep your sign-in safe.** You are responsible for what happens under your account. Tell us straight away at
  support@fieldlogichq.ca if you think someone else has used it.
- **People you invite.** An organization's owner and administrators can invite other people (coaches, staff,
  officials, treasurers, volunteers, parents and others) and decide what they can see and do. The organization is
  responsible for the people it invites and for removing access when someone leaves.
- **The owner controls billing.** Only an organization's or portal's owner can buy, change or cancel its plan.

### If you joined through an organization

If a club, league, tournament or team gave you access — as an administrator, coach, staff member, official, volunteer, or a
parent or guardian — these Terms apply to you too, with these differences:
- **The organization decides your access.** It chooses what you can see and do, and can change or remove your access at
  any time. Questions about your access go to the organization.
- **You pay us nothing.** The sections on plans, prices, trials, renewal and what happens when a plan ends (§6 to §9) are
  between us and the organization's owner, not you. If the organization's plan ends, your access to its space can end with
  it.
- **Acceptable use applies to you in full** (§5), and so does keeping your sign-in safe (above).
- **What you enter is the organization's.** Information you put into the organization's space is its Customer Data (§4).
  Your own account details are covered by our Privacy Policy.
- §15 (organizations covering our costs) does not apply to you personally.

If you also buy a plan yourself, the billing sections apply to that purchase.

> NOTE — O5 (ruled 2026-11-08): one age line for everyone, confirmed by the tick at account creation (§20), at every door
> that makes an account, the "follow this tournament" nudge included (Stage 6 plan §5.3). Existing accounts confirm it in
> the same tick on their next sign-in. Nothing at any door checks a date of birth; the tick is an attestation, and §8 of the
> Privacy Policy says "we do not knowingly". The guardian draft's "no child holds a login" (`GUARDIAN_CONSENT_STAGE4.md`
> follow-through) still reads true beside this. O7 (ruled): this part is what lets a family account, an invited coach or a
> volunteer accept the Terms at all.

## 4. Your organization's information

**It is yours.** Everything your organization or team puts into FieldLogicHQ — rosters, player and family details,
registrations, tryout results, documents, schedules, messages, money records ("Customer Data") — belongs to you. We do
not claim ownership of it.

**We handle it for you.** For Customer Data, we act as your service provider: we store and process it only to run
FieldLogicHQ for you, to keep it secure, to support you when you ask, and as the law requires. We do not sell it and we do
not use it to advertise to anyone. The Privacy Policy (§5) explains this role in detail, including that the companies that
run FieldLogicHQ for us store it **outside Canada, mainly in the United States** (Privacy Policy §6 and §7). Your members
should know this too; your own privacy notice is the place to tell them.

**Your responsibilities for it.** You decide what you collect about your members, and you are responsible for:
- having a lawful reason, and any consent the law requires, to collect and share the information you put in —
  including **consent from a parent or guardian for information about children**;
- telling your members how you use their information (you can link your own privacy policy on your forms);
- the accuracy of what you enter and what you publish; and
- the waivers, rules and agreements between your organization and your members. FieldLogicHQ is not a party to them.

**Public pages.** Some features publish information on the open web — for example a tournament's schedule, standings
and team pages. You choose what to publish. Do not publish personal information about a child beyond what those
features are designed to show.

**Licence to us.** You give us permission to host, copy, process and display Customer Data only as needed to provide
FieldLogicHQ to you and to carry out your instructions.

## 5. Acceptable use

You agree not to:
- break the law, or use FieldLogicHQ to harass, threaten, discriminate against or harm anyone;
- send messages through FieldLogicHQ that the recipient has not agreed to receive where the law requires that agreement,
  including commercial email that does not meet Canada's anti-spam law;
- upload anything you do not have the right to share, or anything containing malware;
- try to get into another organization's space or anyone's account, test our security without our written
  permission, or get around a plan's limits;
- overload, scrape, copy or resell FieldLogicHQ, or use it to build a competing product.

We may suspend access that puts other customers, children, or the platform at risk (see §11).

## 6. Plans, prices and taxes

- **Free plans.** Some plans are free. A free plan has the limits shown on the pricing page.
- **Paid plans** are billed **monthly or yearly**, in advance, in **Canadian dollars**, as shown on the pricing page and
  at checkout. The price you agree to at checkout is the price for that billing period.
- **Taxes.** Prices are **plus applicable taxes** (such as GST/HST). We work the tax out from the billing address you give
  us, and show it as its own line before you pay. If you change your billing address, or a tax rate changes, the tax on your
  next invoice changes with it. A change in a tax rate is not a price change under §8.
- **Payment.** Payments are processed by Stripe. We do not see or store your full card number. Your card stays on file
  with Stripe so your plan can renew.
- **[STRIPE CHOICE — keep one line, delete the other]**
  - *(A — Stripe's receipt and invoice emails are on)* **Receipts and invoices** are emailed to the account owner. Your
    invoices, which show the tax charged, are always available from your billing page.
  - *(B — they are off)* **Your invoices**, which show the tax charged, are always available from your billing page. We also
    email the account owner the details of each purchase (§16).

> NOTES —
> 1. **No price appears in this document on purpose**: prices have one home (the pricing page, kept matched to the Plan &
>    Pricing Facts).
> 2. **"Shown before you pay" is true only where taxed checkout runs** — GST/HST Stage 2, on dev [H]. Publication rides the
>    release that carries taxed checkout to production (Stage 6 plan §6.7), or this line says less.
> 3. **The Stripe choice** (the only one left in this draft): the owner reads Stripe Dashboard → Settings → Business →
>    Customer emails ("successful payments" and "finalized invoices") before 6.7, and keeps line A or B. Either way the
>    second half is already true: our billing page opens Stripe's portal with **invoice history switched on** in our own
>    portal settings [V `lib/stripe-portal-settings.ts` on production: `invoice_history: { enabled: true }`]. Line B leans on
>    the §16 purchase email, which 6.4 builds.
> 4. `/accounting` read §6–§8 and §16 on 2026-11-08 — see "From the `/accounting` read" at the bottom.

## 7. Free trials

Some paid plans start with a free trial. The length of the trial, and the date your first payment will be taken, are
shown at checkout before you confirm. **Unless you cancel before the trial ends, your card is charged the plan's price, plus
applicable taxes, on that date** and the plan continues under §8. Each organization gets one trial per plan; a returning customer does not
get a second trial.

> NOTE — the trial length and one-trial rule are set at checkout and enforced [H]. Still `/billing`'s check before
> publication: no pricing card on a plan whose trial needs a card says "No credit card required" (`/marketing` owns the card
> wording).

## 8. Renewal, cancelling and changing plans

**Automatic renewal.** A paid plan **renews automatically** at the end of each billing period, for the same length of
period, at the then-current price, and the card on file is charged — until you cancel.

**Yearly plans.** For a yearly plan, we will email the account owner **at least 30 days before** it renews, with the
renewal date and the amount, plus applicable taxes.

**Price changes.** If the price of your plan is going up, we will email the account owner **at least 30 days before**
the renewal at which the new price applies. If you do not want to continue at the new price, cancel before that renewal.

**Cancelling.** The owner can cancel at any time from the billing page. When you cancel:
- your plan **stays fully active until the end of the period you have already paid for**, and then ends;
- you will not be charged again;
- until that date you can change your mind and keep your plan with one click.

**No refunds for part-periods.** Because your plan keeps running to the end of the period you paid for, **we do not give
refunds or credits for the unused part of a period**, whether you cancel, downgrade, or stop using the service. This does
not affect any right to a refund you have under the law (see §16), and we may choose to give a refund in a particular
case.

**Upgrading** takes effect straight away. You pay the difference for the rest of the current period, plus applicable
taxes, shown before you confirm.

**Downgrading** to a lower plan or to a free plan takes effect at your **next renewal date**, with no credit for the
current period. If the lower plan has smaller limits (for example, fewer tournaments), you choose what to keep when you
downgrade.

**If a payment fails,** we tell the account owner straight away, and your plan keeps working while the payment is tried
again. Update your card from the billing page. If the payment still can't be taken, the plan may end; if it does, it ends
as if you had cancelled, and §9 applies.

**When we end or change a plan.** If we stop offering your paid plan, or remove a core feature of it, we will give the
owner **at least 30 days' email notice**. If we end your plan for a reason that is not your fault, we will **refund the
unused part** of the period you paid for, including the tax on it, and send you a credit note showing it.

> NOTES for the owner —
> 1. **Cancel** — on production since the 2026-11-05 release; Stripe's portal opens with our own configuration (cancel at the
>    period end, no proration, no plan switches), so it holds on every door [H, Stage 6 plan §3 L-c]. Comped, Founding Season
>    and free-time accounts have no paid period and end at once on cancel; they pay nothing, so "the period you paid for"
>    does not apply and no clause is needed. Founding Season comps are honoured on the terms they were sold.
> 2. **Yearly reminder (O2, ruled 2026-11-08)** — nothing sends it yet; Stage 6 step 6.4 builds it as a step of the daily
>    ending-reminder job. **This paragraph is not published before that build ships.**
> 3. **Price-rise email** — no build; a written hand procedure (Stage 6 plan §6.4). A price change must never happen silently.
> 4. **Failed payment** — written to hold whatever Stripe's live retry setting is (F2, still unread): a failed payment marks
>    the plan past due and tells the owners [V `lib/billing-webhook-handler.ts:887–935`], a past-due plan keeps working
>    [V `lib/org-billing-access.ts:30–33`], and only Stripe giving up ends it. "May end" stays true if the live setting leaves a
>    plan past due. Read F2 anyway before 6.7: in test mode Stripe's retries ended a plan earlier than the date we had told the
>    customer [H].
> 5. **Refund when we end a plan (O3, ruled)** — by hand at this scale, through platform admin's refund tool, which issues the
>    credit note. **Never a bare card refund in Stripe's dashboard**: without a credit note our own GST/HST is not reduced
>    (`/accounting`, `CREDIT_NOTES_ON_REFUNDS.md` §Finding and closeout 1 [V]). How "the unused part" is worked out is
>    `/accounting` owner question A below.

## 9. What happens to your information when a plan ends

When a paid plan ends, your organization's space closes to new activity and we **keep your information for a period so
you can come back** and pick up where you left off:
- **a Premium Coaches Portal: 365 days** from the date the plan ended;
- **every other organization: 90 days.**

We will try to email the owner a warning before that period ends. If you resubscribe within that period, everything comes
back. **After that period we may permanently delete it.** If there is anything you want to keep, download or print it
before your plan ends.

> NOTE — (a) The periods are the product's [V `lib/billing-cancellation-policy.ts:6,8`]. (b) The warning email (30 / 14 days
> before) goes out only when staff run the retention step by hand [V, Stage 6 plan §1 row 9], so the Terms say "we will try";
> it becomes a promise when the step is scheduled, with the automatic purge (privacy finding 2). (c) Nothing deletes
> automatically, so "may", never "we delete". (d) The sentence promising the export tools is **cut**: the club export is
> incomplete (L10), and a Coaches Portal has no export on cancel by ruling (2026-06-25). Add a sentence back only naming
> what an export actually includes.

## 10. Our intellectual property

FieldLogicHQ — the software, design, name, logo and help content — belongs to us. These Terms let you use it while your
account is in good standing; they do not transfer any ownership to you. If you send us ideas or feedback, we may use them
without owing you anything.

## 11. Suspension and ending your account

We may suspend or end an account, or remove content, if:
- you seriously or repeatedly break these Terms;
- it is needed to protect children, other people, other customers or the platform;
- a payment is reversed or disputed as fraud; or
- the law requires it.

Where it is reasonable, we will tell you first and give you a chance to fix the problem. If we end a paid plan because you
broke these Terms, no refund is due.

> NOTE — this is the written basis for the platform-admin-only "End now" door (abuse, fraud, chargeback).

## 12. Availability and support

We work to keep FieldLogicHQ available and your information safe, but we do not promise it will be uninterrupted or
error-free. We may take it offline briefly for maintenance. Support is by email at support@fieldlogichq.ca; we do not
promise a response time.

**Demo sandboxes.** Our public demos show fictional organizations. Anything you enter in a demo can be seen by anyone and
is regularly wiped. Do not enter real personal information in a demo.

## 13. Other companies' services

FieldLogicHQ relies on other companies — for example Stripe for payments and the hosting and email providers named in our
Privacy Policy. Your use of Stripe's checkout and, if you take payments online, your Stripe account, is also governed by
Stripe's own terms. We are not responsible for another company's service outside our control, but we choose them
carefully and hold them to protect your information (Privacy Policy §6).

## 14. Disclaimers and limits on our responsibility

**FieldLogicHQ is a tool; your organization runs its own activities.** We are not responsible for your events, games,
tryouts, team selections, the safety of your participants, or decisions you make using information in FieldLogicHQ —
including schedules, standings, money figures and reports. Check anything that matters before you rely on it.

To the extent the law allows:
- FieldLogicHQ is provided **"as is" and "as available"**, without promises beyond those written in these Terms;
- we are **not liable for indirect or consequential losses**, such as lost profits, lost revenue, lost data you could have
  saved yourself, or harm to reputation; and
- our **total liability** to you for all claims connected with FieldLogicHQ is limited to **the amount you paid us in the
  12 months before the claim arose**, or **$100** if you have paid us nothing.

These limits do not apply to anything the law does not allow to be limited — including our liability for our own fraud
or wilful misconduct, and any rights you have as a consumer that cannot be waived (§16).

## 15. Your responsibility to us (organizations)

If you use FieldLogicHQ for an organization, the organization agrees to cover our reasonable costs (including legal
fees) arising from a claim by someone else about:
- information the organization put into or published through FieldLogicHQ without the right or consent to do so;
- the organization's events and activities; or
- the organization breaking these Terms or the law.

This section does not apply to an individual buying for personal use (§16), or to a person who joined through an
organization (§3).

## 16. If you are buying as an individual (consumers)

If you buy a plan for yourself — for example a coach buying a Premium Coaches Portal — rather than for an organization, you
may be a **consumer** under your province's consumer protection law. **Nothing in these Terms takes away a right that law
gives you**, and if a section of these Terms conflicts with it, the law wins. In particular, §14's limits and §15 apply to
you only as far as that law allows.

When you buy a plan, we email you a copy of these Terms and the details of your purchase: what you bought, the price, each
tax by name and rate, the total, how often you will be charged, when the plan starts and renews, and how to cancel.

> NOTE — **not published before Stage 6 step 6.4 ships the purchase email** [V: no plan-purchase email kind exists]. It is
> the largest exposure in these Terms: Ontario's Consumer Protection Act, 2002 (internet agreements over $50) wants the
> disclosures before purchase, an express chance to accept, decline and correct, and **a copy within 15 days** — miss the copy
> and the consumer may cancel within 30 days (`ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`). The list in the paragraph above is
> the Act's list as that topic file records it (the primary text was not fetched — read it before publication). Build it once
> for every plan. Whether a link to the accepted version's page plus the listed items is "a copy", or the text itself must be
> in the email, is settled in 6.6. The business address and phone in §1 are part of the same disclosure list.

## 17. Where you are

FieldLogicHQ is offered to organizations and individuals in **Canada**. It is **not currently offered in Québec**: we do not
accept a billing address in Québec.

> NOTE — O4 (ruled 2026-11-08, logged in `BUSINESS_DECISIONS.md` 2026-11-08). True only once checkout refuses a Québec
> billing address (Stage 6 step 6.4); the address step already captures the province [H `lib/billing-location.ts`]. Existing
> Québec accounts: none known. When Québec opens, L7 comes first (French-first contracts, Québec's Consumer Protection Act
> limits on §8 and §14, Law 25). **The US:** the Plan & Pricing Facts say US customers can buy once the GST/HST US work ships;
> when it does, this section and the Privacy Policy §14 change first (a minor version is not enough — new buyers, new law).

## 18. Changes to these Terms

We may update these Terms. We will post the new version with its effective date, and **email the account owner at least
30 days before a change that reduces your rights or increases what you pay**. For a change like that, we will ask you to
accept the new Terms the next time you sign in, before you continue. If you do not agree, you can cancel under §8 before
the change takes effect. Smaller changes (for example, fixing a typo or naming a new service provider) take effect when we
post them.

> NOTE — this matches the build's two values per document (Stage 6 plan §6.2): "current version" moves on every change; "oldest
> version still accepted" moves only for a significant one, which brings the §20 screen back. The earlier "if you keep using
> it, the new Terms apply" is dropped for significant changes — the re-accept replaces it, which is what courts prefer.

## 19. Legal matters

- **Governing law.** These Terms are governed by the laws of **Ontario** and the federal laws of Canada that apply there.
  Except where consumer protection law lets you bring a claim where you live, the courts of Ontario decide any dispute.
- **Talk to us first.** If you have a problem, email support@fieldlogichq.ca and give us 30 days to try to fix it before
  starting a legal claim. This does not stop either of us seeking urgent relief.
- **Whole agreement.** These Terms and the Privacy Policy are the whole agreement between us about FieldLogicHQ.
- **If part is invalid,** the rest still applies.
- **Not giving up rights.** If we do not enforce a term straight away, we can still enforce it later.
- **Transfer.** You may not transfer your account or these Terms without our agreement. We may transfer them to a business
  that takes over FieldLogicHQ, and will tell you if we do.
- **Language.** These Terms are written in English.

## 20. How you accept these Terms

You accept these Terms by ticking the box when you create your account. If you already had an account when we published
these Terms, or when we make a change under §18 that needs your agreement, we ask you once, the next time you sign in.
Before you start or change a plan, we check that you have accepted the current version. We keep a record of which version
you accepted and when.

### The words the product shows

> NOTE — **these are the customer-facing words the build copies exactly** (Stage 6 plans 6.2–6.4). Customer-facing words come
> from this draft, not from the build. When the product renders them, the product's copy becomes the single source and this
> part is replaced by a pointer. Links in `[brackets]` open the published version's page. "Privacy Policy" is capitalized
> as a document title, matching "Terms of Service", in the Terms and on every surface below (one spelling); the product
> shows the phrase nowhere today [V: no match in `app/`, `components/`, `lib/`].

**(1) Account creation — every door that makes an account** (sign-up pages, the staff invitation's set-password step, the
tournament registration that makes the coach's account, the "follow this tournament" nudge). One box, required, not
pre-ticked; the server refuses without it:

> ☐ I'm 18 or older (or the age of majority where I live). I agree to the [Terms of Service] and have read the [Privacy Policy].

**(2) The sign-in screen — existing accounts (O8), and again after a significant change (§18).** One required screen before
anything else opens; one box, not pre-ticked; the button stays off until it is ticked.

First publication:
> **We've published our Terms**
>
> FieldLogicHQ now has [Terms of Service] and a [Privacy Policy]. Please read them and tick the box to keep using your account.
>
> ☐ I'm 18 or older (or the age of majority where I live). I agree to the [Terms of Service] and have read the [Privacy Policy].
>
> [Continue]

After a significant change:
> **We've updated our Terms**
>
> We've changed our [Terms of Service] since you last agreed to them. Please read them and tick the box to keep using your account.
>
> (same box) · [Continue]

If the version changes while the screen is open:
> The terms changed while this window was open. Read them again.

**(3) Beside every button that starts, renews into or changes a paid plan** (our button that leads to Stripe's checkout, the
plan move and next-season choice). A line, not a second box — the account already agreed at (1) or (2):

> Your plan renews automatically until you cancel. You can cancel any time from your billing page, and your plan runs to the
> end of the period you've paid for. By continuing, you agree to the [Terms of Service].

For a plan with a trial, add before it:
> Your trial ends on the date shown at checkout, and your card is charged then unless you cancel.

> NOTES —
> 1. The age is in the same box as the agreement on purpose: O8 ruled "one tick", and O5 ruled every account holder confirms
>    the age line. Two separate boxes would be equally lawful if the build or `/design` prefers them; the words stay.
> 2. **The prompt's draft line read "Privacy policy" (lowercase p).** Changed to "Privacy Policy" to match the title used across
>    this document. If the owner prefers sentence case, change it here and everywhere in both drafts together.
> 3. A comped or Founding account goes through (1)/(2) like everyone else; (3) appears only where a price is shown.
> 4. Platform-admin staff accounts are exempt (they are us); demo sandbox users never see (2) (Stage 6 plan §5.3).
> 5. What the record keeps (document, version, person, email as text, time, door — no IP address) is Stage 6 plan §5.3; the
>    Privacy Policy §3 names it.

---

## Before this can be published (owner — delete this section on publication)

**Product must do first** (Stage 6 plan, steps 6.2–6.5):
1. **6.2** the legal pages, each version readable at its own address, linked from the footer, account menu, account page,
   sign-in and sign-up cards and our own account emails.
2. **6.3** acceptance at every door, with the words in §20.
3. **6.4** the purchase email (§16), the yearly reminder (§8), the Québec refusal at checkout (§17).
4. **6.5** deleting an organization removes its stored files (the Privacy Policy rests on it).
5. Taxed checkout on production (§6 "shown before you pay").

**Owner, before 6.7:**
- O1 · the phone and mailing address (§1; the seller's identity is ruled — O1′, no name); support@fieldlogichq.ca working;
  hello@ receiving too.
- The two Stripe dashboard reads: customer emails (the §6 choice) and the retry setting (F2, §8 note 4).

## From the `/accounting` read (2026-11-08)

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

## For a lawyer's eye

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
- **§16 consumer carve-out** — the internet-agreement disclosure and copy rules; whether the confirmation email as designed
  satisfies them.
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
