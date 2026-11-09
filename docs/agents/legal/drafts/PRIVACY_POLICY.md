# FieldLogicHQ Privacy Policy — DRAFT

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Status** | draft — not owner-approved, not published, **not reviewed by a lawyer** |
| **Effective date** | — (set on publication) |
| **Last reviewed** | 2026-11-07 |
| **Backlog** | L2 (with L9 findings); children's consent wording (L5) and CASL lawful basis (L6) are referenced, not settled |

**Change log**
- 0.1 · 2026-11-05 · First draft by `/legal`, written from a code census of what the product collects, stores and sends
  (2026-11-05). Every statement below was checked against the code; the owner notes say where the product falls short.
- 0.1 · 2026-11-05 (later) · §3 billing row widened: a club now gives its billing address when it turns on online payments
  (GST/HST Stage 2 Part 2b), also for a club that pays no plan, and it is used to bill and tax the club's Stripe fees.
- 0.1 · 2026-11-06 · §5 and §12: other people’s email addresses (a second parent typed on a house-league sign-up) and the
  "Stop these emails" link (Signed-in family accounts Stage 3b). Written from the shipped behaviour, not a plan.
- 0.1 · 2026-11-07 · GST/HST Stage 3 closeout (`/legal` on what each sale keeps): §3 billing row and §9 say each sale keeps a
  copy of the billing address and card country it was taxed on, and that closing an account or asking for deletion does not
  remove it before the tax period ends; §11's delete right now names that exception. New §9 finding 6: those records
  never end today (a live one cannot be deleted at all).

> **How to read this draft.** `[SQUARE BRACKETS]` = a fact the owner fills in. `> NOTE` blocks are for the owner and are
> deleted before publication. The law this is written to is **PIPEDA** (Canada's federal private-sector privacy law,
> still in force — its proposed replacement, Bill C-36, was introduced in June 2026 and is not law). Ontario has no
> separate private-sector privacy law for this business. Québec's Law 25 is **not** covered (see §14).

---

## 1. About this policy

This policy explains how **FieldLogicHQ** ([OWNER'S FULL LEGAL NAME], a sole proprietor carrying on business as
FieldLogicHQ in Ontario, Canada — "we", "us") handles personal information.

FieldLogicHQ is software that sports clubs, leagues, tournaments and coaches use to run their organizations. That means
we hold personal information in **two different roles**, and this policy keeps them apart:

| | **We decide** (we are responsible) | **The club decides** (we are its service provider) |
|---|---|---|
| **Whose information** | People who have a FieldLogicHQ account, buy a plan, contact us, or visit our website | Players, parents and guardians, registrants and members that a club, league, tournament or coach puts into FieldLogicHQ |
| **Who to ask about it** | Us | The organization that collected it — and us, if you can't reach them |
| **Covered in** | §3, §4 | §5 |

## 2. Our privacy contact

**[OWNER'S FULL LEGAL NAME], Privacy Officer, FieldLogicHQ** is responsible for this policy and for how we handle personal
information.

- Email: **[PRIVACY CONTACT EMAIL]**
- Mail: **[BUSINESS MAILING ADDRESS, ONTARIO]**

Questions, requests and complaints go here (see §11).

## 3. Information about account holders

**Who:** people who sign up to run an organization or a team, people a club invites (administrators, coaches, staff,
officials, treasurers), and people who buy a plan.

| What we collect | Why |
|---|---|
| Name, email address and password | To create your account, sign you in and contact you about it. Your password is stored by our sign-in provider in a protected (hashed) form; we never see it. |
| The organizations and teams you belong to, your role and title | To show you the right screens and let the club control who sees what. |
| For the account owner who buys a plan, or who turns on online payments for a club: the billing address, and (when a card is used) the card's brand, last four digits and country | To bill you — for your plan, and for the Stripe fees a club's online payments cause — to work out the sales tax that applies, and to show you which card is on file. Each sale keeps a copy of the address and card country it was taxed on, as our tax record of that sale (see §9). Your full card number goes to Stripe, never to us. |
| Purchase, plan and invoice history | To run your subscription and keep the business and tax records the law requires. |
| Settings you choose (for example light or dark display, reminders you have dismissed) | To remember your preferences. |
| What you send us — support emails, feedback you submit in the product, a request to delete your organization | To answer you and improve FieldLogicHQ. Feedback submitted in the product also records your internet (IP) address, your browser type and the page you were on, so we can find and fix the problem. |

**Your use of the product.** We keep records of changes made in an organization's space (for example, who changed a
roster or a schedule) so clubs can see what happened and we can support them. We do not use advertising trackers or
third-party analytics tools.

**Our emails to you.** We send account holders emails about their account, their organization and their plan — for
example sign-in links, invitations, receipts, renewal and payment notices. These are part of the service. We only send
promotional emails (news about features or offers) in line with Canada's anti-spam law, and every one has an unsubscribe
link.

> NOTE — finding (L6): signup today records an **opt-out**, not an express opt-in, for promotional email. Under CASL, an
> account holder who has bought a plan gives **implied** consent (an existing business relationship) for two years after
> the purchase; a free-plan signup is weaker footing. Before any promotional email goes to free-plan users, settle the
> basis under L6. The sentence above is true either way — it promises only what the law allows. → `/legal` L6.

## 4. Information about website visitors and the public

- **Cookies.** We use only the cookies needed to run FieldLogicHQ: keeping you signed in, remembering a choice such as
  which division you were looking at, and marking a visit to one of our public demos. **We do not use advertising or
  tracking cookies**, and we do not use third-party analytics. Your browser's own storage also holds a few preferences on
  your device (for example, teams you choose to follow on a tournament site); they stay on your device.
- **Tournament score alerts.** If you turn on alerts on a public tournament site, your browser gives us a notification
  address so we can send them. We don't ask for your name or email. You can turn alerts off at any time in your browser.
- **Early-access and contact forms.** If you fill in a form on our website, we keep what you entered and your browser type,
  to reply to you.
- **Error reports.** If a page fails, we record technical details (including your browser type) to fix it. These reports
  are deleted automatically after 30 days.
- **Server logs.** Like any website, our hosting keeps technical logs that can include internet (IP) addresses, for
  security and to keep the service running.

## 5. Information that clubs put into FieldLogicHQ

Clubs, leagues, tournaments and coaches use FieldLogicHQ to manage their members. **They decide what to collect** —
through their registration and tryout forms, rosters and records — and they are responsible for it under privacy law. **We
process it for them, as their service provider**, and only to provide FieldLogicHQ to them.

**What a club may keep in FieldLogicHQ**, depending on the features it uses:
- **About players, many of whom are children:** name, date of birth, team and roster details, jersey size and position,
  medical notes and health confirmations, emergency contacts, tryout results and evaluations, attendance, development
  notes, awards, and documents the club asks for (for example signed waivers, medical consent forms and codes of conduct).
- **About parents and guardians:** name, email addresses, phone number, relationship to the player, registration and
  consent records, payments and amounts owed, and messages.
- **About registrants:** what the registration or tryout form asks for, and a record of the consents given — including
  when, and the internet (IP) address it was given from.

**Other people’s email addresses.** A parent can type another person’s email address on a sign-up — for example the
other parent’s — and that person has not given it to us or to the club themselves. Every email we send to that address
about the sign-up carries a **Stop these emails** link at the bottom (the club’s group emails carry their own unsubscribe
link instead), and the first email says who added them. The link opens a page with one button and needs no sign-in.
Pressing it takes the address off every sign-up that club has, for every season, and the club can no longer add it again.
To keep it stopped we keep that address on a short list for that club for as long as the club’s account exists. Nobody is
emailed about the stop; the club’s registrar can see that the address was stopped and when. Receipts and refunds go to the
person who paid, not to the second address.

> NOTE — checked against the code 2026-11-06 (Stage 3b, built; migration 448 on dev, prod owed before the promote). Open
> flags the owner decides, recorded in `CASL_SECOND_PARENT_EMAIL.md`: the "reply to the club" fallback on the stop page’s
> error states reaches nobody when a club has no public contact email; the stop matches the exact address (a `+alias` of the
> same mailbox is not caught). Until the first is settled, do not add a promise about how fast a reply is answered here.

**What we do with it:** store it, keep it secure, display it to the people the club authorizes, send the emails the club
asks us to send, and help the club when it asks for support. **We do not sell it, we do not use it for advertising, and
we do not use it for our own purposes.**

**What we don't do:** FieldLogicHQ does not show a player's name, date of birth or roster on any public page. A club can
publish its schedules, standings, team names, and the names of coaches who choose to show theirs.

**Who can see it.** The club controls which of its people can see which records. A small number of FieldLogicHQ support
staff can view a club's records when it is needed to support the club, investigate a problem or a payment dispute, or
keep the platform safe. Every change our staff make is permanently recorded, and every record they open is logged. We
have no way to sign in as a customer.

**If you are a parent, guardian or member** and have a question about information a club holds about you or your child —
including asking to see, correct or delete it — **please contact the club first.** It decides what is collected and kept.
If you can't reach the club, contact us (§2) and we will pass your request on and help.

> NOTES —
> 1. "Every change our staff make is permanently recorded" and "every record they open is logged" are both true today
>    (the audit log cannot be edited; opened-record entries are kept 90 days). If either changes, this sentence changes.
> 2. The service-provider role is the right one in law **only while we do nothing with club data for ourselves**. The day
>    club data is used for our own purpose (product analytics across clubs, a marketing list, a "players in your area"
>    feature), we become responsible for that use, and this section has to change first. → `/legal` before any such build.
> 3. The club's own privacy policy link already shows on its forms; that is how the club meets its own openness duty.

## 6. Who we share personal information with

We share personal information only with the companies that run parts of FieldLogicHQ for us, and only what each one
needs. We do not sell personal information, and we do not share it with advertisers.

| Company | What it does for us | What it receives | Where it processes data |
|---|---|---|---|
| **Supabase** | Database, sign-in and file storage | Everything stored in FieldLogicHQ | **[SUPABASE REGION]** |
| **Amazon Web Services (AWS)** | Hosts the website | Everything that passes through the website | United States (Ohio) |
| **Resend** | Sends our emails, and the emails clubs send through FieldLogicHQ | Recipient's name and email address, and the message | United States |
| **Stripe** | Card payments for our plans and our invoices for Stripe fees; and, when a club takes payments online, the club's own payment account | For our plans and invoices: the owner's email, the club's billing address and card. For club payments: the payer's email, card, what is being paid for and the player names on the payment | Canada, the United States and other countries |
| **Google** | Our business email inbox | Messages people send us, which can include contact details | [Google — region not chosen] |
| **Your browser's push service** (for example Google, Apple or Mozilla) | Delivers notifications you turn on | A notification address and the alert text — no name or email | Varies |

We hold each company to protect personal information to a standard comparable to ours, by contract.

**When a club takes payments online,** the payment is between the family and the club: the club is the merchant, and the
payment is processed in the **club's own Stripe account**. Stripe handles that information under its own terms with the
club.

**Other reasons we may disclose information:** if the law requires it (for example a court order); to protect someone's
safety; or as part of selling or transferring FieldLogicHQ's business, in which case the buyer must continue to protect it
as this policy says, and we will tell account holders.

> NOTES — must be closed before publishing:
> 1. **Supabase region — answered 2026-11-08:** the production project is in AWS us-east-2 (Ohio, United States), on the Pro
>    plan (Supabase Management API). Fill §6's row with "United States" in v0.2 (Stage 6 step 6.1).
> 2. **Contracts (data-processing terms)**: Stripe's is in place. **Supabase, AWS and Resend are unconfirmed.** All three
>    offer standard data-processing terms (AWS's is part of its service terms; Supabase and Resend publish theirs). Confirm
>    each — the "by contract" sentence must be true. (PIPEDA principle 4.1.3: we stay responsible for information a
>    provider processes for us.)
> 3. **Gmail** — finding: requests to delete an organization (owner email and reason), and other alerts, go to a personal
>    Gmail inbox. A free Gmail account isn't covered by Google's business data-processing terms. Either move the business
>    inbox to a business email service with data-processing terms (Google Workspace or similar), or keep Gmail and list it
>    honestly as above. I recommend the move — it's the one row in this table we can't stand behind. **Owner decision.**
> 4. **Players' full names in the payment description** — finding: online payments send the children's full names into
>    the payment description and first names onto the line items, so they appear in the club's Stripe account and on the
>    family's receipt. It is the club's own account and the club needs to know who paid for whom, so this is defensible —
>    but first names or a player number would do the same job with less. → `/plan` (low priority, data minimization).

## 7. Information stored outside Canada

FieldLogicHQ is run from Ontario, but **the companies in §6 store and process personal information outside Canada,
mainly in the United States.** While it is there, it is protected by our contracts with them, but it is also subject to
the laws of that country, and **the courts, law enforcement and national-security authorities there may be able to
obtain it** under those laws.

> NOTE — this is the notice the Privacy Commissioner's 2009 cross-border guidelines ask for: say plainly that information
> may be processed in another country and may be reachable by its authorities. It isn't optional to soften it. Clubs
> should know this too, because **they** are telling their families — a line in the Terms §4 / a future data-processing
> addendum for clubs (backlog) should say the same.

## 8. Children

FieldLogicHQ is not designed for children to use on their own, and we do not knowingly let a child create an account.
Children's information comes into FieldLogicHQ **through a club** (§5), which is responsible for getting the consent of a
parent or guardian where the law requires it — generally for any child under 13.

We treat children's information, and health information about anyone, as **sensitive**: it is never shown on public pages,
uploaded documents open only through short-lived private links, and our error logs strip out dates of birth, phone numbers
and email addresses.

> NOTES —
> 1. There is **no age check** at account signup today; "we do not knowingly" is the honest wording and pairs with the
>    18+ line in the Terms §3. If guardian accounts (family sign-in) ship with a child age band, revisit this section with
>    L5 — the guardian-consent wording in the product is still a placeholder.
> 2. "Under 13" follows the Privacy Commissioner's meaningful-consent guidance ("in all but exceptional circumstances,
>    anyone under the age of 13"). Québec is under 14 — out of scope until §14 is resolved.

## 9. How long we keep information

- **Your account** is kept while it is open. When it is closed, we delete it, except where we must keep records (below).
- **When a paid plan ends,** the organization's information is kept so the club can come back: **90 days** for an
  organization and **365 days** for a Premium Coaches Portal, with an email warning before that period ends. After that,
  it **may be permanently deleted**.
- **Billing, tax and invoice records** are kept as long as Canadian tax law requires — generally **six years** after the
  end of the tax year they relate to. They include, for each sale, the name, billing address and card country it was taxed
  on. Closing your account, deleting an organization, or asking us to delete your information does not remove these
  records before that period ends.
- **Error reports** are deleted after 30 days; logs of which records our staff opened, after 90 days; performance
  measurements, after one year.
- **Information a club keeps while its plan is active** is kept until the club deletes it or closes its organization. The
  club decides how long to keep its members' information.

> NOTES — findings, the most important in this draft (L9):
> 1. **Nothing is deleted automatically at the end of a retention period.** The step that moves expired data along is run
>    by hand, and its final state ("pending purge") still holds the data. The policy therefore says "may be deleted" —
>    true, but weak. PIPEDA principle 4.5.3 expects us to have **guidelines and procedures for destroying information we no
>    longer need**. → `/plan`: a real purge at the end of the window, and a written retention schedule.
> 2. **There is no retention rule for player information at all**, and a club "removing" a player marks them inactive
>    rather than deleting them. That fits "the club decides how long", but a club has no way to actually delete a player or
>    a family record today. → `/plan`: a club-side delete for players and families. Until it exists, a parent's request to
>    delete their child's record can only be done by us by hand.
> 3. **Deleting an organization does not appear to delete its uploaded files** (signed waivers, medical forms) — the
>    deletion step touches the database only. → `/plan` (high: these are children's medical documents). Until fixed, this
>    policy must not say an organization's information is "deleted" on closure.
> 4. **"When it is closed, we delete it"** — true: staff delete accounts permanently. There is no self-serve delete, so it
>    happens by request (§11), which PIPEDA allows.
> 5. Six years: the general CRA books-and-records rule. Confirm with `/accounting` (its records-retention topic) — that
>    agent owns the number; this line points at it. (`/accounting` 2026-11-07: required, and a deletion request does not
>    override it — CREDIT_NOTES_ON_REFUNDS.md closeout §7.)
> 6. **The tax records never end (GST/HST Stage 3, 2026-11-07).** Each sale's record keeps the buyer's name and billing
>    address as it stood (for a coach buying as a person, a HOME address) and card country. It survives a club or person
>    delete and a Stripe customer delete, which is what the law requires. But a live record **cannot be deleted at all**
>    (a database guard refuses it), so nothing ends it after six years. PIPEDA 4.5.3 (and Québec's private-sector Act,
>    s. 23, once a Québec buyer is real) expects information to be destroyed or anonymized once its purpose and legal
>    period are over. → `/plan`: at six years after the tax year, blank the name and address on old records (keeping the
>    amounts, tax and province the return needs), as a written step. Not urgent (the first record expires after 2032), but
>    the policy's "six years" is only true once it exists. Support staff see these addresses to answer tax questions
>    (owner ruled 2026-11-07, need-to-know); no policy line promises otherwise.

## 10. How we protect information

- Access to each organization's information is limited to the people it authorizes, and enforced on our servers.
- Sensitive records can only be read through our server, never directly from a browser.
- Uploaded documents are private and open only through links that expire after one hour.
- Links in our emails (unsubscribe, calendar feeds, pay links) are signed so they can't be guessed or altered, and
  sign-in-free links are stored only in a scrambled (hashed) form.
- Information is encrypted in transit and stored by our database provider with encryption at rest.
- Our staff's changes are permanently recorded, and the records they open are logged.

No system is perfectly secure. If a breach of our safeguards creates a **real risk of significant harm** to you, we will
tell you, and the Privacy Commissioner of Canada, as soon as possible, and tell you what you can do to protect yourself.
If the breach affects information a club holds, we will tell the club straight away so it can notify its members.

> NOTES —
> 1. **No two-step sign-in (MFA) exists** — not claimed, deliberately. For accounts that can open children's medical
>    notes, MFA is the single strongest safeguard missing. → `/plan` (recommendation).
> 2. **Breach record-keeping** — PIPEDA requires a record of **every** breach of safeguards, kept **24 months**, reported or
>    not (Breach of Security Safeguards Regulations s. 6). Nothing in the repo shows one exists. A one-page breach
>    procedure and a register (even a private document) closes it. **Owner action.**
> 3. "Encrypted at rest" is Supabase's platform default, not something in our code — confirm it on the Supabase plan in
>    use before publishing.

## 11. Your rights and how to use them

For information **we** are responsible for (§3, §4), you can:
- **ask what we hold** about you, how we use it, and who we have shared it with, and get a copy;
- **ask us to correct** it if it's wrong — including your name or email address, which you can't change yourself in the
  product yet;
- **withdraw your consent** — for example, unsubscribe from promotional email, or close your account — subject to
  information we must keep by law or contract;
- **ask us to close your account and delete your information**, except the records the law makes us keep (§9).

Email **[PRIVACY CONTACT EMAIL]**. We will answer within **30 days** and tell you if we need longer. We may need to confirm
who you are first. There is no charge.

For information **a club** holds about you or your child, see §5 — contact the club first.

**If you're not satisfied** with our answer, you can complain to the **Office of the Privacy Commissioner of Canada**
(priv.gc.ca, 1-800-282-1376).

> NOTE — 30 days is PIPEDA's deadline for answering an access request (s. 8(3)); it can be extended by up to 30 more days
> in set cases, with notice. There is no in-product access or delete path; requests are handled by hand, which the law
> allows. Name/email correction is staff-only today (finding — a self-serve edit is a small `/plan` item).

## 12. Unsubscribing from emails

Every promotional email from us, and every non-essential email a club sends through FieldLogicHQ, has an unsubscribe
link. You can unsubscribe from one organization's emails or from all of them. Emails needed to run your account or a
registration you made (sign-in links, receipts, schedule changes for your team) are sent regardless.
A second parent whose address a parent typed on a sign-up has a **Stop these emails** link at the bottom of every sign-up
email instead; it works for that club for every season (see §5).

> NOTE — finding (L6): the per-family opt-out does not cover the free Coaches Portal's emails today. Under CASL a
> **commercial** message needs an unsubscribe; a transactional one (a game time change) does not. Whether every free-team
> email is transactional is exactly the L6 question. The sentence above says "every non-essential email … has an
> unsubscribe link" — confirm under L6 before publishing, or narrow it.

## 13. Changes to this policy

We will post any change here with a new effective date. If a change means we will use your information in a new way, or
share it with a new kind of company, we will tell account holders by email **before** it takes effect, and ask for your
consent where the law requires it.

## 14. Where this policy applies

This policy is written for Canada.

> NOTE — **Québec** (L7, owner decision shared with Terms §17). Québec's Law 25 adds duties this draft does not meet: a
> named person in charge of protecting personal information **published on our website**, a privacy impact assessment
> **before** any information leaves Québec (our providers are in the US), privacy-by-default settings, a confidentiality
> incident register, and French. If the owner chooses "not offered in Québec yet", say so here. If a Québec customer is
> planned, L7 comes first.

## 15. Contact

[OWNER'S FULL LEGAL NAME], Privacy Officer, FieldLogicHQ · [PRIVACY CONTACT EMAIL] · [BUSINESS MAILING ADDRESS, ONTARIO]

---

## Before this can be published (owner — delete this section on publication)

**Fill in / confirm (owner):**
- P1 · Name, privacy contact email, mailing address (PIPEDA 4.8.2 requires the accountable person's name or title **and
  address**).
- P2 · The Supabase region (§6).
- P3 · Data-processing terms with Supabase, AWS and Resend (§6 note 2).
- P4 · Gmail: move the business inbox, or list it (§6 note 3).
- P5 · Encryption at rest on the Supabase plan in use (§10 note 3).
- P6 · A one-page breach procedure and breach register (§10 note 2).

**Product findings → `/plan`** (the policy is written to be true without them, but each is a real gap):
1. **High** — deleting an organization leaves its uploaded files (children's medical and waiver documents) in storage.
2. **High** — no automatic purge at the end of a retention window; no written retention schedule (PIPEDA 4.5.3).
3. **Medium** — a club cannot delete a player or a family record; "remove" keeps them.
4. **Medium** — signup acceptance of the Terms and this policy (shared with the Terms' list).
5. **Medium** — two-step sign-in for accounts that can see children's medical information.
6. **Low** — players' full names in the online-payment description.
7. **Low** — self-serve correction of name and email.
8. **Low** — feedback keeps IP address and browser type unredacted (disclosed in §3; consider whether the IP is needed).

## For a lawyer's eye

- **§1 / §5 — the two-role split.** The whole policy rests on FieldLogicHQ being a service provider for club data. Worth a
  read of whether anything the product does (staff access for disputes, the family file, cross-club "one player" work in
  Stage 14) puts us in the organization role for some of it.
- **§8 — children's information.** Consent sits with the club; we design the forms that collect it. The guardian tier
  (switched off) will collect a child's age band and a consent ledger directly — that moves part of this onto us.
- **§7 — cross-border notice.** Sufficient for PIPEDA; not sufficient for Québec (no transfer assessment).
- **§10 — breach notice to clubs.** Our duty to the club as its service provider is contractual; it belongs in a
  data-processing addendum for clubs (backlog), which doesn't exist yet.
- **§9 — retention.** "May be deleted" is honest but is the clause a regulator would test against PIPEDA 4.5.3.
