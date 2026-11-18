# Board Ready: data terms for clubs, the sub-processor list, and the policy consistency sweep
**Last verified:** 2026-11-18
**Re-verify by:** 2027-11-18, or a trigger: the product calls a new outside service; a supplier changes its sub-processor or
DPA terms; the owner answers questions 1–11; own-domain mailboxes replace ImprovMX/Gmail; the first Québec customer
**Depends on facts:** `LEGAL_FACTS.md` § Where data lives (updated 2026-11-18 from this file); `BACKUPS_AND_RESTORE.md`;
`BREACH_PROCEDURE.md`; published Terms and Privacy Policy 2026-11-17; `drafts/PRIVACY_POLICY.md` (next version)

## Question(s) this answers
1. Which outside companies actually receive personal information from FieldLogicHQ, and which only look as if they do?
2. What do the data terms for clubs promise, and can every promise be kept today?
3. Where do the privacy policy, the Terms and the new list disagree, and what must change?
4. What can the board pack's security brief and the public Security page say about suppliers and data location?

Deliverables: `drafts/SUBPROCESSOR_LIST.md`, `drafts/DATA_TERMS_FOR_ORGANIZATIONS.md`, `DATA_TERMS_ACCEPTANCE_NOTE.md`.

## Finding

### 1. The census (code read 2026-11-18; a helper's census, the load-bearing lines opened by `/legal`)

| Service | Personal information that reaches it | Where in the code | Sub-processor? |
|---|---|---|---|
| Supabase (database, Auth incl. TOTP, Storage, Realtime) | Everything stored; the browser connects directly (IP). Feedback stores IP and browser type (`app/api/feedback/route.ts:107-110`) | `lib/supabase.ts`, `lib/supabase-admin.ts`; Storage buckets: rep-team-documents (private), tournament-registration-files, org-permit-documents (private), org-logos, org-assets, resources (public) | **Yes** |
| AWS Amplify (us-east-2) + CloudWatch | All traffic; `console.error` lines reach CloudWatch (emails scrubbed from the observability line, `lib/observability/capture.ts:126-135`) | `amplify.yml`; `lib/amplify-domains.ts` | **Yes** |
| AWS S3 + Aurora DSQL (us-east-2) | Our bookkeeping: expenses and receipt files; no member data | `lib/bookkeeping-store.ts:3-4,25,37` | Yes (our own records; already in the policy's AWS row) |
| Resend | Recipient names, addresses and full message bodies, including auth links made by `auth.admin.generateLink` | `lib/email.ts:34,155`, `lib/email-sender.ts:28,183` | **Yes** |
| Stripe Billing | Buyer email and name, billing address, org id/name, user id; approver email in subscription metadata | `lib/team-org-billing.ts:798-818`, `app/api/billing/create-team-checkout/route.ts:329-352` | **Yes** (for our own sales) |
| Stripe Connect (the club's account) | Payer email; child's **first name + division** on the line items; children's **full names + season** in the payment description | `app/api/pay/league/[token]/route.ts:101-135`, `lib/stripe-connect.ts:157-180` (opened) | The club's own Stripe agreement; we pass it on the club's instruction. Listed, with that said |
| ImprovMX | Mail to support@/privacy@/hello@ (whatever people write) | not code: the domain's MX records → mx1/mx2.improvmx.com (resolved 2026-11-18) | **Yes — missing from the privacy policy** |
| Google (Gmail, free) | The same mail, delivered | `lib/email.ts:46`, `app/api/admin/org/request-deletion/route.ts:29`; VAPID contact `lib/web-push.ts:18` | Yes (already in §6) |
| Browser push services | Device endpoint; the payload is encrypted with the subscription's p256dh/auth keys by `web-push` (RFC 8291), so the service cannot read the alert | `lib/web-push.ts:80-90` (opened) | **No** — chosen by the person's browser |
| Google Fonts | None: our server fetches font files for share images; site fonts are self-served by next/font | `lib/share-card-fonts.ts:17-28` (opened); `app/layout.tsx:2` | **No** |
| Google Calendar / Outlook | The person's calendar service pulls the signed feed when they choose to subscribe | `lib/calendar-subscribe.ts:29-30` (opened) | **No** — the person's own service |
| Google Maps | A link; the venue address leaves only on click | `components/LocationLink.tsx:15` | **No** |
| Analytics, advertising, error monitoring, SMS, captcha, AI/LLM, embeds | **None found** (CSP is `frame-ancestors 'self'` only, so it is no cross-check) | — | — |

**Two findings that widen the question (both owner questions):**
- **AI.** The product sends nothing to an AI service. But AI assistant sessions on this repo can run read-only queries
  against the production database (`scripts/db-query.mjs:6,45,81`: `--prod` refuses writes, allows reads), and a query's
  rows land in the AI conversation. So "your club's information is never given to an AI service" is not yet a true
  sentence; "FieldLogicHQ sends nothing to an AI service" is. Separately, Resend's own sub-processor list names two AI
  companies (Anthropic, TypeSafe AI; resend.com/legal/subprocessors, updated 2026-11-05) — our list links it, and the pack
  must not imply the whole chain is AI-free.
- **The "password changed" email.** Turned on in production Auth 2026-11-18. Supabase's built-in mailer "will refuse to
  deliver messages to addresses that are not part of the project's team" unless a custom SMTP server is configured
  (supabase.com/docs/guides/auth/auth-smtp, read 2026-11-18). The product sends its own auth email through Resend by
  generating links, so a custom SMTP on production is not something the code proves. If there is none, the notice reaches
  no customer. If there is (Resend), the supplier list is unchanged.

### 2. Our suppliers' own terms (read on each supplier's site 2026-11-18)

| Supplier | New sub-processor notice to us | Breach notice to us | Certifications its page states |
|---|---|---|---|
| Supabase | 30 days, **only if subscribed**; 5 days to object (DPA cl. 6.3) | "without undue delay, and where feasible, within forty-eight (48) hours" (cl. 10) | SOC 2 Type 2; ISO 27001 (and HIPAA, deliberately not quoted) |
| AWS | page updated "at least 30 days before"; email if subscribed | (AWS DPA; not read this session) | per-service scope table unreadable; claim nothing service-specific |
| Resend | "at least fourteen (14) days in advance", in writing; object or discontinue (DPA §4.2–4.4) | "without undue delay" (§8.6) | SOC 2 Type II; "not HIPAA compliant"; "not an ISO 27001 certificate" |
| Stripe | list updated; email if subscribed; 30 days to object (DPA) | (not read) | PCI Service Provider Level 1; SOC 1 and SOC 2 Type II yearly |
| ImprovMX | no published list; names AWS, Scaleway, PhoenixNAP, Servers.com | (DPA not read) | none ("GDPR compliant", self-declared); inbound mail "stored transiently in France, in AWS's Paris region, and is deleted once delivered"; DPA "pre-signed by us, so you just need to countersign" |
| Google (Gmail free) | none | none | none claimed |

So 30 days' notice to clubs is keepable for a company **we** add, provided the owner subscribes to Supabase's, AWS's and
Stripe's notices (Supabase's 5-day objection window means we cannot pass a club's objection up the chain in time; we can
only end our own use, which is why the club's remedy is to leave, not to veto).

### 3. Consistency sweep — every edit the privacy policy needs (apply to `drafts/PRIVACY_POLICY.md`, the held next version)

| # | Where | Edit | Why |
|---|---|---|---|
| P1 | §6 table, new row after Resend | **ImprovMX** · "Forwards email sent to our own addresses to our inbox" · "Messages people send us, which can include contact details" · "France (held only until delivered) and the United States" | Live since 2026-11-12; the policy names every company but this one (the risky direction: an omission) |
| P2 | §6 Google row | "Our business email inbox — the addresses on this page arrive there" → "… arrive there, forwarded by ImprovMX" | P1 |
| P3 | §6 "How we hold them to it" | add "ImprovMX handles it under its data-processing agreement." (only once countersigned, Q4; otherwise "ImprovMX holds mail only until it is delivered.") | P1 |
| P4 | §7 | after "mainly in the United States." add "Email sent to our own addresses passes through France on its way to our inbox." | ImprovMX's page; the list and Data Terms §7 say it |
| P5 | §6 push row | "A notification address and the alert text, which can name a person, a child or a team, or give an email address (for example "New sign-up: Henry Kim")" → "A notification address, and the alert, encrypted so that only your device can read it" | Over-describes today (safe direction), but a board reads "names a child" as a leak; `lib/web-push.ts:80-90` encrypts |
| P6 | §6, after the table | "The full list, with each company's own security pages and how we tell organizations about a new one, is at [address]." | One list, one home; the list must not drift from §6 |
| P7 | §3 "Our emails to you" and §10 two-step bullet | "or your password is changed from inside FieldLogicHQ" → "or your password is changed" | **Only after Q5 confirms delivery.** The reset via "Forgot your password?" now gets the host's notice too; an in-app change gets two emails |
| P8 | §9, three bullets (organization deleted; friend requests; emails a club sends) | "age out on our database host's schedule" → "are gone within 7 days" | `BACKUPS_AND_RESTORE.md` (daily, kept 7 days) — now a fact, and the Data Terms say it |
| P9 | §5 "What we do with it" | add "Our Data Terms for organizations make these commitments to each club as part of our Terms of Service." | Ties the policy to the contract; optional |
| P10 | §4 "Server logs" | add "… and are deleted after [N] days." | **Only after Q7** sets a retention on AWS |

**Checked and consistent, no edit:** §6 Stripe row (the "player names on the payment" covers both the first names on the
page and the full names in the description); §6 AWS row (covers CloudWatch and our records); §6 Supabase row; §13
(account holders are told before a new **kind** of company; the Data Terms give organizations 30 days for **any** new
company — different audiences, no conflict); Terms 2026-11-17 §4's "outside Canada, mainly in the United States" (true
with P4).

**The Terms edits** T1–T4 are in `DATA_TERMS_ACCEPTANCE_NOTE.md`. T3 is required: today's §18 says naming a new service
provider takes effect on posting, which the list's 30-day promise contradicts.

### 4. The owed items

- **(a) The host's "your password has been changed" email.** The policy's email list is "for example" and §10 names a
  password-change email "from inside FieldLogicHQ", so nothing published is false; the list simply doesn't cover the new
  one. **Edit P7, after owner question 5** — if production has no custom SMTP the email reaches nobody outside the team,
  and P7 would then promise an email that doesn't arrive. CASL: a security notice about the person's own account, not a
  commercial message; nothing owed.
- **(b) Already done — nothing owed in the text.** The published privacy policy (version 2026-11-17) carries: friend
  requests §5 and §9 (§11 needs no sentence: §5 sends requests to the club and §9 says the registrar can delete); two-step
  sign-in §3, §5, §9 and §10; the coach and board group-email record §5 and its 12/24-month clock §9. Whether each
  feature is on production is the release-history record's question, already handled in
  `PUBLICATION_HANDOFF_REVIEW_6_7.md` (Club Communications and migs 492/493 ship with the switch, or the sentences are cut).
- **Stale research line (no customer impact):** `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md:47-48` lists "no MFA" and "three
  DPAs unconfirmed" as 2026-11-05 headlines; both are superseded (two-step built; DPAs read 2026-11-08). Historical; not
  edited.

### 5. Wording the pack can quote (brief and Security page)

| # | Line | Rests on |
|---|---|---|
| W1 | "Your club's information is stored in the United States (Ohio), with our database host, Supabase, on Amazon Web Services." | `LEGAL_FACTS.md` (Supabase Management API: us-east-2, read 2026-11-08); Privacy §6 |
| W2 | "Six companies help us run FieldLogicHQ. Our public list names each one, what it receives, where, and links its own security pages." | `drafts/SUBPROCESSOR_LIST.md` (publish it first) |
| W3 | "We never sell your information or use it to advertise. We don't use advertising trackers, third-party analytics or an outside error-monitoring service, and FieldLogicHQ sends nothing to an AI service." | Terms §4, Privacy §4/§6; census 2026-11-18. **Not** "never given to an AI service" until Q3 |
| W4 | "Card and bank details never reach us: families pay on Stripe's own page, into the club's own Stripe account. Stripe states it is certified PCI Service Provider Level 1." | `lib/stripe-connect.ts:157-180` (hosted Checkout, no Stripe.js); docs.stripe.com/security |
| W5 | "Information is encrypted in transit, and our database host encrypts everything it stores (AES-256)." | supabase.com/security, read 2026-11-18 |
| W6 | "Our database host states SOC 2 Type 2 and ISO 27001; our email provider states SOC 2 Type II. These are their certifications, not ours." | the two suppliers' pages, 2026-11-18. The second sentence is required wherever the first appears |
| W7 | "Our database is backed up daily, and each backup is kept 7 days. We have rehearsed a restore." | `BACKUPS_AND_RESTORE.md` (rehearsal passed 2026-11-18). Never "your files are backed up": uploaded files are not |
| W8 | "If something goes wrong with your club's information, we tell your club's owners [within 72 hours] and help you tell your families." | Data Terms §9; `BREACH_PROCEDURE.md`. Only after Q2 |
| W9 | "We'll email your club 30 days before a new company starts handling its information." | Data Terms §6. Only after Q1 and Terms T3 publish |
| W10 | "Every record our staff open in our support tools, and every change they make, is recorded." | Privacy §5/§10. Say "in our support tools": direct database access is not in that record |

**Two "do not say" lines for the pack:** "your club can export everything" (backlog L10 — say "download from the lists
that offer it, or ask us for a full copy"); "all staff access is logged" (W10's scope).

## What the product does today
Every row of the census table carries its path:line. Not checked from code: production Auth's SMTP setting (Q5), the
CloudWatch log group's retention (Q7), Amplify's delivery network (the list names Ohio only, as the policy does).

## Recommendation — owner questions (recommendation first)

**RULED 2026-11-18 (owner: "I agree with your recommendations on the 11 owner questions").** All eleven as recommended
below. This rules the questions, **not the draft texts** — the Data Terms and the list are still unapproved drafts.
Applied the same day: brackets filled in both drafts (Q1, Q2, Q9); `BREACH_PROCEDURE.md` §3 step 4 gains the 72 hours
(Q2); the held privacy draft becomes 0.2 with P1–P6, P8, P9 (Q11). **Left, by who:**
- **Owner steps:** countersign ImprovMX's DPA (Q4); check production Auth's SMTP and fix or switch off the notice (Q5); set
  the server-log retention to 90 days on AWS (Q7); subscribe to Supabase's, AWS's and Stripe's sub-processor notices (Q8);
  fill the four dates (Q10).
- **Q3 (the AI rule) is ruled but not yet written where sessions read it.** A ruling only `/legal`'s files hold binds no
  session. Recommended: one line in `AGENCY_RULES.md` (the owner's yes, its own commit). Until then the drafts' AI line
  stays product-only.
- **`/accounting`:** the partial-refund mechanics behind Q1, before the Data Terms publish.
- **Q6:** the Terms edits T1–T4 go into the held next Terms version once the Data Terms text is approved.
- **Q9 / P7 / P10:** wait on Q5 and Q7 as written.

1. **New-company notice: 30 days by email to every organization's owners; a club that objects may end its plan and get
   back the unused part of what it paid in advance.** Industry-normal, and keepable (§2). Needs Terms edit T3; the refund
   mechanics go to `/accounting` (a partial refund of a taxed sale). Alternative: notice, and "you may end your plan" with
   no refund.
2. **Breach notice to a club: "without delay, and within 72 hours of confirming it touches your information".** Supabase
   owes us 48 hours where feasible; 72 hours from *confirming* is keepable by one person. `BREACH_PROCEDURE.md` §3 step 4
   gains the same number. Alternative: "straight away", no number (weaker for a board).
3. **AI and production data: rule that AI assistant sessions read production only as counts and schema, never rows that
   hold a person's information.** Then the pack can say "never given to an AI service". Otherwise Anthropic is honestly a
   sub-processor of club data and belongs on the list. (Any guard on the query runner is shared automation — the owner's
   own call, in its own commit; `/legal` recommends only the rule.)
4. **ImprovMX: list it now (P1–P4) and countersign its pre-signed DPA**, recording the date beside the others. Accept the
   France transit until the own-domain mailbox (already deferred) replaces it; choose that mailbox with where it keeps
   mail in mind.
5. **Check production Auth's SMTP setting** (host dashboard › Authentication › SMTP). If it is not our sender, the
   "password changed" notice turned on today reaches no customer: point it at Resend's SMTP, or switch the notice off and
   record why. P7 waits on this.
6. **Carry the Data Terms in the held next Terms version** (the one publishing with the Payments Terms), if approved
   before that day; otherwise the version after. Route the two pages to `/plan` (acceptance note).
7. **Set a retention on the server logs** (CloudWatch log group for the Amplify app; recommended 90 days), so P10 can
   name a number. Until then nothing promises one.
8. **Subscribe to Supabase's, AWS's and Stripe's sub-processor notices** (owner steps). Without it, our 30-day promise
   can be broken by a supplier change we never heard of.
9. **Promise a full copy within 30 days on the owner's request**, produced by hand while no complete export exists (L10).
   Also by hand: a child's record deleted with its uploaded documents (the product leaves one player's files today).
   Alternative: no number ("promptly"), weaker.
10. **Fill the dates:** Supabase **[date]**, AWS **[date]**, Resend **[date]** (each account's acceptance of the
    supplier's terms, or the day the owner reads and accepts the current DPA), and ImprovMX **[date]** (countersigned).
11. **Fold P1–P6, P8 and P9 into the held privacy draft now** (P7 after Q5, P10 after Q7). They are factual and publish
    on the same day as the Payments Terms; the list cannot publish before P1–P4.

**By-hand procedure note (for Q9):** on a club owner's request to delete a child's record — delete the record through the
support path, then remove that child's files from the private documents store (and any registration attachments), and
note both in the reply. On a full-copy request — export every table keyed to the organization, plus a list of its
files, as CSV in one archive, sent by a link that expires.

## Sources
- [Supabase security](https://supabase.com/security), [Supabase sub-processors](https://supabase.com/legal/subprocessors),
  [Supabase DPA](https://supabase.com/legal/dpa), [Supabase Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp) — accessed 2026-11-18
- [AWS sub-processors](https://aws.amazon.com/compliance/sub-processors/), [AWS services in scope](https://aws.amazon.com/compliance/services-in-scope/) (table not readable) — accessed 2026-11-18
- [Resend security](https://resend.com/security), [Resend sub-processors](https://resend.com/legal/subprocessors), [Resend DPA](https://resend.com/legal/dpa) — accessed 2026-11-18
- [Stripe security](https://docs.stripe.com/security), [Stripe sub-processors](https://stripe.com/legal/service-providers) — accessed 2026-11-18
- [ImprovMX data protection](https://improvmx.com/transparency/gdpr-compliance/), [ImprovMX privacy policy](https://improvmx.com/transparency/privacy-policy/) — accessed 2026-11-18
- PIPEDA Principle 4.1.3 — via `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (verified 2026-11-05)
- Québec P-39.1 ss. 17 and 18.3 — legisquebec and CanLII both refused the fetch (403) on 2026-11-18; **not read this
  session**; re-read before Québec is offered

## Lawyer's eye needed?
Yes, for three things, none a gate: (1) whether the Terms' limitation of liability (§14) reaches the Data Terms' breach
and sub-processor promises, and is enforceable against a club — the clause a board will push on; (2) the control question
for club information (we design the forms and staff can open records), already on file in `BREACH_PROCEDURE.md`; (3)
Québec ss. 17 and 18.3 once Québec is offered — the Data Terms follow the s. 18.3 list from earlier reading, and an
assessment before information leaves Québec would be owed. Also brief: Data Terms §12's "we do not check" consent.
