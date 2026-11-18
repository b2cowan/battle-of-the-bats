# DRAFT — FieldLogicHQ Data Terms for organizations (data-processing terms for clubs)

| | |
|---|---|
| **Version** | 0.1 — has no version of its own once published: it is part of the Terms of Service and changes only with a new Terms version (`DATA_TERMS_ACCEPTANCE_NOTE.md`) |
| **Status** | draft — not owner-approved, not published, **not reviewed by a lawyer** |
| **Effective date** | — (the effective date of the Terms version that first includes it) |
| **Last reviewed** | 2026-11-18 |
| **Backlog item** | `LEGAL_INDEX.md` Documents row "Data-processing terms for clubs"; Board Ready plan §0a/§0c |
| **Research** | `BOARD_READY_DATA_TERMS_REVIEW.md` (census, supplier terms, Québec/PIPEDA fit, owner questions, lawyer's eye) |

**Change log**
- **0.1 (2026-11-18)** — first draft. Every statement of fact rests on the published Terms and Privacy Policy (version
  2026-11-17), `BREACH_PROCEDURE.md` (owner-approved 2026-11-17), `docs/agents/ops/BACKUPS_AND_RESTORE.md` (2026-11-18)
  or the 2026-11-18 code census. **Design rule: these terms add obligations to FieldLogicHQ and none to the club** that
  Terms §4 does not already set, so adding them is a change that does not reduce the club's rights (Terms §18): no
  30-day notice, no fresh acceptance.
- **0.1, owner rulings 2026-11-18 (all eleven questions as recommended; the text itself NOT yet approved)** — brackets
  filled: §6 30 days' notice, and a club that objects may end its plan with the unused part refunded (Q1; `/accounting`
  reads the partial-refund mechanics before publication); §9 within 72 hours of confirming (Q2); §11 a full copy within
  30 days, produced by hand (Q9). Q3 (AI rule) is ruled but the §4 AI line stays product-only until the rule is written
  where every session reads it. Q6: carried in the held next Terms version once this text is approved.

**How to read this draft.** Customer text is everything after the first `---` line, up to "Before this can be
published". Owner notes are in blockquotes that start `> NOTE`. A `[text]` that is not a link is a choice or fact still
to fill.

---

## 1. What these terms are

These Data Terms are **part of our Terms of Service**. They set out, as a commitment from FieldLogicHQ to your
organization, how we handle the information your organization keeps in FieldLogicHQ about its people — what the Terms
call **Customer Data** (Terms §4): rosters, players and families, registrations and tryouts, documents, schedules,
messages and money records.

They apply to every organization that keeps Customer Data in FieldLogicHQ: a club, league or tournament, and a coach who
runs a team's own Coaches Portal. "You" means that organization. Where these Data Terms and the rest of the Terms say
different things about Customer Data, these Data Terms apply.

Our Privacy Policy explains the same commitments to the people themselves, and covers the information we hold for our
own purposes (for example, account holders' sign-in and billing details). These Data Terms do not change it.

## 2. Who is responsible for what

**You decide.** Your organization decides what to collect about its people, why, who in your organization can see it,
and how long to keep it. You are responsible under privacy law for that information, including getting the consent the
law requires — for a child, from a parent or guardian — and telling your members how you use their information
(Terms §4).

**We act for you.** For Customer Data, FieldLogicHQ is your **service provider**. We handle it only to provide
FieldLogicHQ to you, on your instructions, and as the law requires.

## 3. Your instructions

You give us instructions by how you set up and use FieldLogicHQ — the features you turn on, the settings you choose, who
you invite and what you let them see — and by a written request from your organization's owner to
privacy@fieldlogichq.ca. If we believe an instruction would break the law, we will tell you and need not carry it out.

## 4. What we never do

- We **never sell** Customer Data.
- We **never use it to advertise**, to you or to anyone, and never share it with advertisers.
- We **never use it for our own purposes**, such as marketing or building profiles of people.
- **FieldLogicHQ sends no Customer Data to an AI service.**
- We **never join two organizations' records** of the same child; our system refuses it.
- We **never show** a player's name, date of birth or roster on a public page. You choose what your organization
  publishes (schedules, standings, team names, and the names of coaches who choose to show theirs).

> NOTE — Each line rests on: Terms §4 and Privacy §5/§6 (sell, advertise, own purposes); the 2026-11-18 census (no AI call
> in the product); Privacy §5 ("never across two clubs — our system refuses it"; "does not show a player's name, date of
> birth or roster on any public page"). The AI line says what the PRODUCT does. Owner question 3: if the owner rules that
> assistant sessions never read rows holding a person's information on production, it can become "Customer Data is never
> given to an AI service." Until then, do not widen it.

## 5. Confidentiality and our staff

We keep Customer Data confidential. Only FieldLogicHQ staff who need it can reach it, and only to support your
organization when you ask, investigate a problem or a payment dispute, or keep the service safe and running. Anyone who
works for us is bound to keep it confidential before they get access.

In our own support tools, every change our staff make is permanently recorded, and every page they open is recorded.
We have no way to sign in as one of your people. Direct access to the database, outside those tools, is kept for running
and repairing the service.

> NOTE — "In our own support tools" is deliberate: the staff-tools record (Privacy §5, §10) does not cover direct database
> access (the host's dashboard, the repo's read-only query runner). Do not let the brief or the Security page say "all staff
> access is logged" (review file, pack wording note). "Bound to keep it confidential before they get access" is true
> today vacuously (no employees, `ACCOUNTING_FACTS.md` § Staffing) and becomes an obligation the day someone joins.

## 6. The companies that help us (sub-processors)

We use a small number of companies to run FieldLogicHQ. **Our list of them** — what each does, whose information
reaches it, where, and its own security pages — is at [address of the sub-processor list].

- Each one may handle Customer Data only to provide its part of FieldLogicHQ. Except our Gmail inbox, which receives only
  what people send us, each is bound by data-processing terms with us. **We stay responsible to you for them.**
- **Before a new company starts handling Customer Data, we email your organization's owners at least 30 days ahead**
  and update the list. If we must replace a company urgently to keep the service running or safe, we tell you as soon as
  we can, and why.
- If you object to a new company on reasonable grounds, tell us. If we can't address your concern, you may end your plan
  before the change takes effect, and we will refund the unused part of what you paid in advance.

> NOTE — Owner question 1 (the notice period and the remedy). The bracketed refund is the recommendation; the alternative
> is "end your plan" alone. A refund here is outside Terms §8's refund rules, so `/accounting` reads the mechanics (a
> partial refund of a taxed sale) before it is promised. Terms edit T3 must remove "naming a new service provider" from
> §18's list of changes that take effect on posting.

## 7. Where Customer Data is handled

Customer Data is stored in **the United States (Ohio)**, with our database host, Supabase, on Amazon Web Services. The
companies on our list handle it mainly in the United States; Stripe also in Canada and other countries, and mail sent to
our own addresses passes through France on its way to our inbox. While it is outside Canada it is protected by our
agreements with those companies, and it is also subject to the laws of the country it is in, whose courts and
authorities may be able to obtain it.

We will not move where Customer Data is stored without telling you first, as in §6.

## 8. How we protect it

- Access to your organization's information is limited to the people you authorize, and that is enforced on our
  servers, not in the browser.
- Sensitive records can be read only through our server, never directly from a browser.
- Uploaded documents are private and open only through links that expire after one hour.
- Links in our emails (unsubscribe, calendar feeds, pay links) are signed so they can't be guessed or altered, and
  sign-in-free links are stored only in a scrambled (hashed) form.
- Information is encrypted in transit, and our database host encrypts everything it stores (AES-256).
- **Two-step sign-in** is available to everyone, and your organization can require it of its people.
- **Our database is backed up daily, and each backup is kept for 7 days.** Backups cover the database; uploaded files
  are not in them.
- Card and bank details are entered on Stripe's own page and never reach us.

> NOTE — Sources: Privacy §10 (bullets 1–5, word for word where possible); `supabase.com/security` read 2026-11-18 ("All
> customer data is encrypted at rest with AES-256 and in transit via TLS"); `BACKUPS_AND_RESTORE.md` (daily, 7 days,
> physical, no Storage objects; restore rehearsed 2026-11-18 — the brief may say "rehearsed", this contract need not);
> census: `lib/stripe-connect.ts:157-180` (hosted Checkout only, no Stripe.js). The two-step bullet is true only once
> two-step sign-in is on production (the release-history record); the board-pack line adds "FieldLogicHQ staff always use
> it", which is fine for the brief but is not a contract term here. Nothing aspirational: no uptime figure, no pen test,
> no certification of our own.

## 9. If something goes wrong (a breach)

If information your organization keeps in FieldLogicHQ is lost, or reached or disclosed without authorization, because
of a failure in our safeguards or a company on our list:
- we contain it straight away;
- **we email your organization's owners without delay, and within 72 hours of confirming that it touches your
  information**, with what we know: what happened and when, what information and about how many people, what we have
  done to reduce the harm, and who to contact — and we send more as we learn it;
- because the information is yours, **you decide** whether to report it to the Privacy Commissioner and tell the people
  affected; we give you what you need to decide and help you notify;
- we keep our own record of it, and fix what caused it.

> NOTE — Matches `BREACH_PROCEDURE.md` §1 (a club's information: the club reports and notifies; we tell it straight away,
> give it §4's report list, help, fix our side, keep a record entry) and §3 step 4 ("Email the club's owner straight
> away"). The bracketed 72 hours is owner question 2; if ruled, `BREACH_PROCEDURE.md` §3 step 4 gains the same number in
> the same unit of work. Supabase owes us notice "where feasible, within forty-eight (48) hours" (its DPA cl. 10); Resend
> "without undue delay" (its DPA §8.6).

## 10. Requests from your members and from authorities

- **A member's request** to see, correct or delete their information, or a child's, is yours to answer. If one reaches
  us, we pass it to you and help; we answer it ourselves only where the law requires us to.
- **We help you answer.** Your people can correct most records on the screens that hold them. A child's record can't be
  deleted from the screens today: your organization's owner asks us, and we delete the record and the documents
  uploaded about the child.
- **A demand from a court or authority** for Customer Data: we tell you before we answer, unless the law forbids it,
  and we give only what the law requires.

> NOTE — Privacy §5 ("A club can't delete a child's record itself today: a request to delete one comes to us"; "please
> contact the club first ... we will pass your request on"). "And the documents uploaded about the child" is a promise the
> owner keeps BY HAND: deleting one player or person in the product still leaves that item's files (`LEGAL_FACTS.md`, the
> privacy product findings). The by-hand step is in the review file's procedure note; the build stays a `/plan` item.

## 11. Getting your information out, and deleting it

- **While you use FieldLogicHQ**, you can download your records from the lists that offer it (for example members,
  registrations, payments). On a written request from your organization's owner, we will also give you a copy of your
  organization's information in a common format **within 30 days**.
- **When a paid plan ends**, we keep your organization's information so you can come back: 90 days for an organization
  and 365 days for a Premium Coaches Portal (Terms §9). After that we may delete it, and we will delete it sooner if your
  owner asks.
- **When your organization is deleted**, its information and the files uploaded to it are deleted with it. Copies in our
  database backups are gone within 7 days.
- **What we keep after that:** our own tax records of what you bought; the record of the Terms and Payments Terms your
  owners agreed to; and a record that the deletion happened (the organization's name and web address, who deleted it,
  when and why). None of these holds your members' information.

> NOTE — "Within 30 days" for a full copy: no complete export exists in the product (backlog L10: the club export's
> "everything" statement is untrue), so the owner produces it by hand; owner question 9. "Gone within 7 days": daily
> backups kept 7 days (`BACKUPS_AND_RESTORE.md`). The keep-list equals Privacy §9 (next-version draft, which adds the
> Payments Terms record). Org deletion removing files: `45c134bea`, shipped with the 2026-11-17 legal-pages release
> (`PUBLICATION_HANDOFF_REVIEW_6_7.md`); confirm in the release-history record before publishing. "None of these holds your
> members' information": the deletion record holds the deleter's identity (an account holder, our own information), the
> Payments Terms record an owner's email — both account holders, not members. Server logs on AWS are not mentioned because
> their retention is not set (owner question 7); add "and our server's technical logs after [N] days" once it is.

## 12. Children's information

FieldLogicHQ is built on the expectation that much of your information is about children. We treat it, and health
information about anyone, as sensitive: it is never shown on public pages, and uploaded documents open only through
short-lived private links. Children don't hold FieldLogicHQ accounts; everyone who does confirms they are 18 or older.
Getting a parent's or guardian's consent where the law requires it is your organization's responsibility (§2), and we
do not check it.

## 13. Checking our work

Once a year, on request, we will answer a reasonable written security questionnaire from your organization, and we will
tell you about anything that changes the commitments in these Data Terms. We do not offer on-site audits.

## 14. How long these Data Terms last

These Data Terms apply for as long as we hold Customer Data for your organization, including after your plan ends and
until it is deleted (§11). They change only with a new version of the Terms of Service, under Terms §18.

## 15. Contact

Privacy Officer, FieldLogicHQ · privacy@fieldlogichq.ca

## Before this can be published

> NOTE — Owner material from here to the end; the preview drops it.

**Owner decisions** — questions 1, 2, 3, 6, 7 and 9 in `BOARD_READY_DATA_TERMS_REVIEW.md`; each bracket above is one of them.

**Things that must be true first**
1. The sub-processor list is published at a fixed address (the §6 bracket), with the privacy policy edits P1–P4 (ImprovMX)
   in force no later.
2. The Terms edits T1–T4 are in the Terms version that carries these Data Terms (the acceptance note).
3. Two-step sign-in is on production (the §8 bullet), or the bullet is cut.
4. Org deletion removes files on production (`45c134bea`; the release-history record).
5. The owner has a by-hand procedure for §10 (a child's record and its files) and §11 (a full copy within 30 days).

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
