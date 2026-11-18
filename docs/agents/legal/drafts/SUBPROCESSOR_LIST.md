# DRAFT — FieldLogicHQ: the companies that handle your information (sub-processor list)

| | |
|---|---|
| **Version** | 0.1 (a living list: each change gets a dated line in "Changes to this list"; it is not accepted, it is notified) |
| **Status** | **owner-approved 2026-11-18** — not published, **not reviewed by a lawyer** |
| **Effective date** | — (published with the Data Terms, `drafts/DATA_TERMS_FOR_ORGANIZATIONS.md`) |
| **Last reviewed** | 2026-11-18 |
| **Backlog item** | `LEGAL_INDEX.md` Documents row "Subprocessor list"; Board Ready plan §0a/§0c |
| **Research** | `BOARD_READY_DATA_TERMS_REVIEW.md` (code census with path:line, each supplier page read 2026-11-18, the owner questions) |

**Change log**
- **0.1 (2026-11-18)** — first draft, from a code census of every outside service the product calls (2026-11-18) and each
  supplier's own security, sub-processor and data-processing pages, read the same day. Adds one company the privacy policy
  does not name today: **ImprovMX**, which forwards mail sent to our own @fieldlogichq.ca addresses into our inbox (live
  since the 2026-11-12 receiving fix; the domain's mail records point at it, checked 2026-11-18).
- **0.1, owner rulings 2026-11-18 (questions 1–11 as recommended; the text itself NOT yet approved)** — 30 days' notice
  filled in (Q1); ImprovMX listed and its DPA to be countersigned (Q4, owner step); the owner subscribes to Supabase's,
  AWS's and Stripe's notices (Q8, owner step). The privacy policy's ImprovMX edits are now in the held privacy draft (Q11).
- **0.1, owner-approved 2026-11-18, with the follow-through (Board Ready data terms Section 3)** — the owner's steps are
  done (ImprovMX's DPA countersigned, Q4; Supabase's, AWS's and Stripe's notices subscribed, Q8; server logs 90 days, Q7);
  the AI sentence widened to "is never given to an AI service" now the owner's rule is in `AGENCY_RULES.md` (Q3). The
  page's address is /legal/subprocessors (short link /subprocessors), `/plan` 2026-11-18.

**How to read this draft.** Customer text is everything after the first `---` line, up to "Before this can be
published". Owner notes are in blockquotes that start `> NOTE`. A `[text]` that is not a link is a fact still to fill.

---

## The companies that handle your information

FieldLogicHQ uses a small number of companies to run the service. This page names each one, what it does for us, whose
information reaches it, where it handles it, and where to read its own security and sub-processor pages.

**We do not sell personal information, and we do not share it with advertisers.** We don't use advertising trackers,
third-party analytics or an outside error-monitoring service, and the information organizations keep in FieldLogicHQ is
never given to an AI service.

> NOTE — The product calls no AI service (census 2026-11-18: no AI/LLM call at run time), and the owner's rule (Q3,
> 2026-11-18) that AI assistant sessions read production only as counts and schema, never rows holding a person's
> information, is written in `AGENCY_RULES.md` (Workflow Requirements). That is what makes "never given to an AI service"
> true of the owner's own tools too. If the rule is ever relaxed, the sentence goes back to "FieldLogicHQ sends nothing to
> an AI service" first, or the AI company joins the table above.

**Whose information we mean.** In the table:
- **Account holders** — people who sign in: owners, administrators, coaches, staff, volunteers.
- **Families and children** — players (many of them children), parents and guardians, registrants, and the people a club
  puts into FieldLogicHQ.
- **Payers** — the person paying a club online, and the owner who buys a FieldLogicHQ plan.

| Company | What it does for us | Whose information reaches it, and what | Where it handles it | Its own pages |
|---|---|---|---|---|
| **Supabase** | Our database, sign-in (including two-step sign-in) and file storage, and the live updates on screens such as scoring and chat | **Everyone's.** Everything stored in FieldLogicHQ: account holders, families and children (including medical notes and uploaded documents), payment records. Your browser connects to it directly, so it also sees your internet (IP) address | United States (Ohio) | [Security](https://supabase.com/security) (states SOC 2 Type 2 and ISO 27001) · [Sub-processors](https://supabase.com/legal/subprocessors) · [Data-processing terms](https://supabase.com/legal/dpa) |
| **Amazon Web Services (AWS)** | Hosts the website and runs its server; keeps the server's technical logs; holds our own business records (expenses, receipts, tax returns) | **Everyone's, in passing.** Every page and form passes through it. Its logs record internet (IP) addresses and technical details of errors. Our business records hold no family's or child's information | United States (Ohio) | [Compliance programs](https://aws.amazon.com/compliance/programs/) · [Sub-processors](https://aws.amazon.com/compliance/sub-processors/) · [Service terms, incl. data processing](https://aws.amazon.com/service-terms/) |
| **Resend** | Sends every email FieldLogicHQ sends: ours to account holders, and the emails clubs send to their families, coaches and board | **Anyone who gets an email from FieldLogicHQ:** the name and email address, and the whole message, which can name a child, a team, a schedule or an amount owed | United States | [Security](https://resend.com/security) (states SOC 2 Type II) · [Sub-processors](https://resend.com/legal/subprocessors) · [Data-processing terms](https://resend.com/legal/dpa) |
| **Stripe** | Card payments for FieldLogicHQ plans. When a club takes payments online, Stripe runs **the club's own Stripe account** — the club is the merchant — and takes FieldLogicHQ's fee from it | **Payers.** For our plans: the owner's name, email, billing address and card. For a club's payments: the payer's email and card or bank details, what is being paid for, the child's first name and division on the payment page, and the children's full names in the payment's description. Card and bank details go to Stripe, never to us | Canada, the United States and other countries | [Security](https://docs.stripe.com/security) (states PCI Service Provider Level 1, and SOC 1 and SOC 2 Type II reports yearly) · [Sub-processors](https://stripe.com/legal/service-providers) · [Data-processing terms](https://stripe.com/legal/dpa) |
| **ImprovMX** | Forwards email sent to our own addresses (support@, privacy@ and hello@fieldlogichq.ca) to our inbox | **Anyone who writes to us:** what the email says, which can include contact details or a request about a child | France (held only until delivered) and the United States | [Data protection](https://improvmx.com/transparency/gdpr-compliance/) · [Privacy policy](https://improvmx.com/transparency/privacy-policy/) (no certification stated) |
| **Google** (a Gmail account) | Our business inbox: mail to our addresses arrives there | **Anyone who writes to us:** what the email says | The United States and other countries | [Privacy policy](https://policies.google.com/privacy) (a free account: no business data-processing terms, no certification claimed) |

**What the certifications mean.** The certifications above are the ones each company states on its own page. They are
**that company's**, not FieldLogicHQ's: FieldLogicHQ holds no certification of its own.

> NOTE — Certifications are quoted only where the supplier's page states them, read 2026-11-18: Supabase "SOC 2 Type 2
> compliant" and "ISO 27001 certified" (it also states HIPAA, deliberately left out: a US health-law term reads as a claim
> about health data we don't make); Resend "SOC 2 Type II compliant"; Stripe "PCI Service Provider Level 1", "SOC 1 and SOC
> 2 Type II reports are produced annually". AWS: the per-service scope table (is Amplify in scope of SOC 2 / ISO 27001?)
> could not be read; the row links AWS's program page and claims nothing. ImprovMX and Google: none. Re-read each page
> before the list is published, and at every change.

## How we hold them to it

Supabase, AWS, Resend and Stripe each handle personal information for us under their standard data-processing terms,
which form part of our agreement with each of them. ImprovMX handles it under its data-processing agreement. Our Gmail
inbox is a free account that business data-processing terms don't cover, so we keep what arrives there to what people
send us. We stay responsible to you for every company on this list.

> NOTE — "ImprovMX handles it under its data-processing agreement" is true only once the owner countersigns ImprovMX's
> pre-signed DPA (its page: "pre-signed by us, so you just need to countersign"). Unlike the other three, it is NOT accepted
> with the service terms. Owner question 4. If not countersigned by publication, the sentence becomes: "ImprovMX is a mail
> forwarder that holds mail only until it is delivered."

## When a club takes payments online

The payment is between the family and the club. The club is the merchant, and the payment is processed in **the club's
own Stripe account**, under the club's own agreement with Stripe. FieldLogicHQ opens the payment page for the club and
passes Stripe what the payment needs; it never holds card or bank details.

## Services that are not on this list, and why

Some outside services touch FieldLogicHQ without handling your information for us:
- **Google Fonts.** Our server downloads the typeface files it uses to draw sharing images. The request carries no one's
  information, and your browser never contacts Google for our fonts.
- **Your browser's push service** (for example Google, Apple or Mozilla). If you turn on alerts, your own browser chooses
  the service that delivers them. Each alert is encrypted for your device, so the push service carries it without being
  able to read it; it sees only the device address it delivers to.
- **Your calendar service** (for example Google Calendar, Outlook or Apple Calendar). If you choose to subscribe to a
  team's calendar, your calendar service fetches the schedule from us under your own account.
- **Map links.** An address in FieldLogicHQ is a plain link. Nothing is sent to a map service unless you click it, and
  then your browser opens the map with that address.
- **Our professional advisers**, such as an accountant, see our business records only. Those name the organization that
  bought each plan and the province it was taxed in; they hold no family's or child's information.

> NOTE — Census backing (path:line in the review file): fonts `lib/share-card-fonts.ts:17-28` (server-side fetch; site
> fonts via next/font, self-served); push `lib/web-push.ts:80-90` (`web-push` with the subscription's p256dh/auth keys,
> which encrypts the payload, RFC 8291); calendar `lib/calendar-subscribe.ts:29-30`; maps `components/LocationLink.tsx:15`
> (link only, no embedded map). The push row is still in the privacy policy §6 table, worded as if the service reads the
> text: consistency edit P5.

## Changes to this list

**We will email the owners of every organization at least 30 days before a new company starts handling the
information organizations keep in FieldLogicHQ, and update this page with the date.** If we must replace a company
urgently to keep the service running or safe, we will tell you as soon as we can, and why. If you object to a new
company, tell us at privacy@fieldlogichq.ca; if we can't address your concern, you can end your plan before the change
takes effect (our Data Terms for organizations, §6, say what happens then).

> NOTE — The notice period and the objection remedy are owner question 1 (recommended: 30 days; ending the plan with the
> unused part refunded). This promise is NOT what the published Terms §18 says today ("Smaller changes (for example, ...
> naming a new service provider) take effect when we post them"): the Terms edit T3 must publish with this page, or this
> page must not promise notice. Our own suppliers give us: AWS 30 days (subscribers), Supabase 30 days (subscribers only,
> 5 days to object), Resend 14 days in writing, Stripe a list update with 30 days to object (subscribers). So 30 days to
> clubs is keepable for a change WE make, and for a supplier's own sub-processors only by linking their lists (as above).

| Date | Change |
|---|---|
| [date published] | First list published. |

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
