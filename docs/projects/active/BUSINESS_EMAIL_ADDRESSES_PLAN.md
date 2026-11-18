# Business email addresses — plan (STARTED 2026-11-12; Phase 0 + Phase 1 research done)

**Status:** on the board (Owner Morning Brief).
**History (not kept current):** Phase 0 + Phase 1 done 2026-11-12. **Owner ruled 2026-11-12 (below): free receiving now (Phase 2A);
our own domain mailboxes later, after a handful of paying clients (R1 deferred).** Phase 2A is owner steps in
the forwarder dashboard + Route 53; nothing else starts until R1 comes back.

**⚖ Owner rulings 2026-11-12:**
- **R2: yes.** Start with free receiving today.
- **R1: deferred.** The longer-term answer is "our own domain emails" (a real mailbox, §2b shape A), set up after
  a handful of paying clients. Reason given: few or no support enquiries are expected before then.
- ⚠ **Consequence, noted by the agent, not ruled:** until the mailbox exists, replies to mail that arrives this
  way go out from `fieldlogichq@gmail.com`. That is the address the 2026-10-26 goal said no customer would see.
  Accepted in practice by the deferral at expected volume. Suggested trigger: set up the mailbox before the
  first reply to a *paying* client, not only after "a handful".
- **R1 trigger: RULED 2026-11-18** (owner, `/brief do business-email`, choosing "Before 1st paying reply (Recommended)"):
  the real mailbox (§2b shape A) is set up **before the first reply to a paying client**, which replaces "after a handful".
  The owner had asked to drop the step because forwarding is in place; the agent noted that forwarding covers only
  incoming mail, and that after Gmail's send-as ends in January 2027 a reply from Gmail shows `fieldlogichq@gmail.com`.
**Owner ask (2026-10-26, restated 2026-11-12):** mail sent to our domain addresses (`hello@`, `support@`,
`privacy@fieldlogichq.ca`) forwards into `fieldlogichq@gmail.com`, and we can reply as those addresses.
PM brief: `BUSINESS_EMAIL_ADDRESSES_PM_BRIEF.md`.

## 0. Owner rulings (2026-10-26) — still standing unless §0b says otherwise

- **It is a team of one.** No per-person mailboxes, no shared-inbox product. Several addresses exist for
  different *purposes*, and they all land in the one inbox the owner already reads (`fieldlogichq@gmail.com`).
  The inbox tells them apart by the address each message was sent to (labels/filters).
- **Public addresses:**
  - `support@fieldlogichq.ca`: anything a customer needs help with. The main one.
  - `hello@fieldlogichq.ca`: general, press, not-yet-customers. ⚠ It **keeps forwarding forever**, because
    every product email already sent carries it as Reply-To (it is today's shared contact address).
  - `privacy@fieldlogichq.ca`: printed only in the privacy policy and terms.
  - `noreply@fieldlogichq.ca`: send-only. Never printed as a contact. Every automatic email's Reply-To is `support@`.
  - **Not created now:** `info@`, `feedback@`, `billing@`, `security@`, `sales@`. Adding one later is a free setting.
- **Goal behind it: no customer ever sees `fieldlogichq@gmail.com`.**
- **Spend ceiling: close to zero.** "A paid mailbox is out unless reply deliverability fails."
  ⚠ The reason behind this ruling changed on 2026-11-12. See §0b and R1.

## 0b. What changed since the 2026-10-26 plan (verified 2026-11-12)

1. ⚠⚠ **Gmail is removing the free way to reply as our address.** Google's page
   (support.google.com/mail/answer/17101213, read 2026-11-12) says:
   - "Send as" for third-party accounts ends **January 2027**, on Gmail web and the Gmail mobile apps.
     It goes together with Gmailify and POP fetching.
   - Q3–Q4 2026 is a transition period: existing setups keep working, but Gmail "may restrict new
     configurations."
   - Gmail-to-Gmail aliases and Google Workspace addresses are unaffected.
   - The Gmail **mobile app keeps access to third-party accounts** (IMAP).
   - Google's suggested replacements: send from the provider's own app, use a desktop mail client over
     IMAP/SMTP, use the Gmail mobile app, or move to Workspace.

   The old plan's working hypothesis, "forward into Gmail, reply from Gmail through Resend SMTP as
   `support@`", is exactly the feature being removed. Set up today, it would work for about two months.
   **Do not build it.**
2. **The code half is further along than the plan assumed.**
   - One shared contact address already exists. GST/HST Stage 6 step 6.2 created `lib/fieldlogichq-contact.ts`
     with `FIELDLOGICHQ_CONTACT_EMAIL = 'hello@fieldlogichq.ca'`.
   - About fifteen customer-visible places read it: Reply-To on product email, the account page, two-step
     sign-in, invoices, org-closed, held payments.
   - **Switching it to `support@` is owned by GST/HST step 6.7** ("once the owner confirms support@ works").
     That makes this project a **prerequisite of the Terms publication**, alongside the phone line and mailing address.
3. **Support Console Stage 5 shipped** (`83b658dfb`, 2026-10-26; walks §391–§393 ✅), so the sequencing gate
   in the old §0 is met. Its feedback-reply Reply-To reads `ADMIN_EMAIL` (`lib/email.ts:46`). That constant is
   the internal ops-alert recipient, shared with about six alert senders, so Phase 3 has to split it rather than edit it.

## 1. Where things stand today (DNS read 2026-11-12, public lookup)

| | State | Evidence |
|---|---|---|
| Nameservers | Route 53 (`ns-*.awsdns-*`) | NS lookup |
| **Root MX** | **None.** Mail to any `@fieldlogichq.ca` address is undeliverable: the sender gets a bounce, we get nothing. | MX lookup returns only the SOA |
| Root SPF / root TXT | None | TXT lookup |
| Resend sending | Separate subdomain: `send.fieldlogichq.ca` MX → `feedback-smtp.us-east-1.amazonses.com`, SPF `include:amazonses.com`; DKIM at `resend._domainkey` | lookups |
| DMARC | `v=DMARC1; p=none;` (monitor) | `_dmarc` TXT |

**Consequence:** adding a root MX and a root SPF for receiving **cannot collide with product email.**
Resend's bounce path lives on `send.` and its DKIM signs as `fieldlogichq.ca`, so DMARC aligns through DKIM
whatever the root SPF says. The old plan's worry about merging SPF records does not apply. There is nothing at
the root to merge with.

⚠ **Live defect, unchanged since 2026-09-26.** `hello@` is the Reply-To on every product email and is
printed on about fifteen screens and emails. Anyone who replies or writes in today gets a bounce.

## 2. Options, verified against provider pages 2026-11-12

### 2a. Receiving (forward into Gmail)

| Option | Verdict | Facts |
|---|---|---|
| **ImprovMX Free** | **Chosen** | 1 domain, 25 aliases, 500 forwards/day, SRS supported. DNS: root MX `mx1.improvmx.com` (10) / `mx2.improvmx.com` (20) + root SPF `v=spf1 include:spf.improvmx.com ~all`. No sending on free. |
| ForwardEmail.net Free | No | Free plan configures forwarding through a public DNS TXT record. Its FAQ warns forwarded addresses are "publicly searchable", which would publish the Gmail address and break the §0 goal. |
| Cloudflare Email Routing | No | "You must be using Cloudflare DNS." Our DNS is Route 53, and Amplify depends on it. |
| Resend Receiving | Not now | Real feature (MX → Resend, webhook or forward). The root MX would route *all* root mail into Resend, and forwarding is code we would own. It counts against the 3,000/month free plan, which product email shares. It is the right base only if R1 = C. |
| Amazon SES inbound (ca-central-1 supported) | No | No native forward-to-address action. Needs S3 + Lambda + SES sending: software we maintain for a mailbox. |
| AWS WorkMail | No | End of support 2027-03-31; no new customers since 2026-04-30. |
| Zoho Mail Forever Free | No (for receiving-into-Gmail) | Forwarding is paid-only; no IMAP/POP on free. |

### 2b. Replying as `support@` (the open question, R1)

The reply path decides what the customer sees in the From line. With Gmail "Send as" ending, there are three honest shapes:

| | Shape | Cost | Daily experience for the owner | Risk |
|---|---|---|---|---|
| **A** | **One cheap real mailbox** holding `support@` with `hello@` and `privacy@` as aliases. Mail arrives there and forwards a copy to Gmail. Replies go from that mailbox: its own app, or **added as a second account in the Gmail phone app** (Google keeps this). | A few dollars a month (prices being verified, §2c) | Read in Gmail as today. Reply from the phone's Gmail app with the From switched to support@, or from the provider's web page. | Lowest. Deliverability is the provider's job. Breaks the "close to zero" ceiling, so it needs an owner ruling + `/strategy`. |
| **B** | **Receive free (ImprovMX); reply from a desktop/phone mail client** (Apple Mail, Outlook, Thunderbird) through Resend SMTP as `support@`. | $0 | Two apps: read in Gmail, then open another app to reply. Replying from Gmail out of habit sends from `fieldlogichq@gmail.com`, which is the exact thing §0 forbids. | Human error leaks the Gmail address. Replies count against Resend's 100/day, 3,000/month (shared with product email). |
| **C** | **Reply from our own Support Console.** Inbound goes to Resend Receiving, which records it and copies it to Gmail. A "reply" in platform admin sends through Resend as `support@`, as feedback replies already do. | $0 in fees; a real build (inbound store, threading, attachments, spam) | Read and answer support mail inside our own admin. | Most work, and it is software we own for a mailbox. Plan §5 kept "inbound email into the product" out of scope. Worth it only if support volume grows. |

**Recommendation: A.** The 2026-10-26 ceiling assumed free reply-as worked from Gmail; Google has removed that.
- **B** costs nothing, but the failure mode is the goal: one reply from the wrong app shows a customer the Gmail
  address.
- **C** is building email software to save a few dollars a month for a team of one.
- **A** keeps the owner reading in Gmail, keeps replies honest, and the fee is the entire cost. With A, ImprovMX
  is not needed. The mailbox receives directly and forwards a copy to Gmail, which is one fewer moving part.

**If the owner rules A**, receiving moves to the mailbox provider and §2a's ImprovMX choice falls away. Phase 2A
on ImprovMX is still worth doing *now* if R1 will take more than a few days, because it fixes the bounce today.
Moving the MX later is a five-minute DNS edit.

### 2c. Paid mailbox prices (one user; before tax; providers' own pages, 2026-11-12)

| Provider | Price | Fit | Notes |
|---|---|---|---|
| **Zoho Mail Lite** | **C$1.25/mo (5 GB), annual only (≈ C$15/yr)** | **Recommended** | Large, long-standing operator; IMAP per Zoho's subscription help. ⚠ The pricing page does not show alias count or forwarding *per plan*. Confirm both in the trial before paying; if either is missing, take the fallback. |
| Purelymail | US$10/yr flat ("no hard limits") | Fallback | Cheapest. IMAP/SMTP per its FAQ. Very small operator, US-East servers, no native iOS push. Bus-factor risk for the company's support address. |
| Fastmail Standard | C$6.25/mo annual | Possible | Established; Basic tier excludes custom domains. |
| Google Workspace Business Starter | C$9.20/mo annual (promo C$4.60 for 3 mo from 2026-11-26) | Premium option | 30 free aliases, send-as first-class, unaffected by the Jan 2027 change. But it is a *second* Google account to sign in to. |
| ForwardEmail Enhanced | ~US$3/mo | Possible | IMAP + SMTP; its own FAQ calls Gmail Send-As deprecated. Encrypted mailbox: a lost password loses the mail. |
| Proton Mail Plus | US$2.49/mo intro | No | IMAP only through desktop Bridge, so it can't be added to the Gmail phone app. |
| Microsoft 365 Exchange Plan 1 | ~C$5.40/mo (not verified on page) | No | IMAP often off by default; not verified. |

**Recommended under R1 = A: Zoho Mail Lite, ≈ C$15 a year.** That is close enough to the 2026-10-26 "close to
zero" ceiling that the ruling's *intent* (no real spend before customers) survives; the owner still rules it.
⚠ `/legal`: support mail carries customers' personal information, so the provider and where it stores data
belong in the privacy policy's service-provider list before 6.7 publishes. Ask `/legal` at Phase 2B.

## 3. Owner asks

- **R1 — How do replies leave? DEFERRED 2026-11-12:** owner direction is A ("our own domain emails"), after
  a handful of paying clients. Provider pick (agent's recommendation: Zoho Mail Lite ≈ C$15/yr, Purelymail
  fallback) and the `/strategy` cost entry happen then. Re-verify §2c prices at that point, because they will be stale.
- **R2 — Fix the bounce now? RULED YES 2026-11-12.** Phase 2A below.
- ~~Is `fieldlogichq@gmail.com` still the platform-admin login and the internal alert inbox?~~ Assumed **yes**,
  out of scope (§5). Only the customer-facing uses move.

## 4. Phases

**Phase 0 — Frame. ✅ 2026-11-12.** DNS read (§1); provider facts verified (§2); WorkMail notice read (end of support 2027-03-31).

**Phase 1 — Investigate. ✅ receiving; R1 open for replies.**

**Phase 2A — Receiving on ImprovMX Free (owner in the AWS console + ImprovMX dashboard, ~20 minutes; no app code). RULED GO 2026-11-12.**
1. Sign up at improvmx.com with the Gmail inbox. Add domain `fieldlogichq.ca`. Create aliases `support`, `hello`,
   `privacy` → `fieldlogichq@gmail.com`. Remove or skip the default catch-all (`*`), because it invites spam and hides typos.
2. Route 53 → hosted zone `fieldlogichq.ca`. Create two records on the **root** (record name blank):
   - **MX**, TTL 300, value (two lines):
     ```
     10 mx1.improvmx.com
     20 mx2.improvmx.com
     ```
   - **TXT**, TTL 300, value `"v=spf1 include:spf.improvmx.com ~all"`.

   ⚠ **Do not touch** `send.fieldlogichq.ca`, `resend._domainkey` or `_dmarc`, which carry product email. There is no
   existing root MX or root SPF to merge with (§1). ImprovMX's dashboard turns green once it sees the records,
   usually within minutes.
   - *Undo* = delete those two records. Mail goes back to bouncing and product email is unaffected.
3. Gmail filters: one per address (`to:support@fieldlogichq.ca` → label "Support", and so on), never archived
   automatically. Check that forwarded mail isn't marked spam; add a "never send to spam" filter on the three addresses.
4. **Gate:** from an outside Outlook/Hotmail and one other provider, write to each address. All three arrive,
   labelled and not in spam, and a product email's Reply-To (an invite) lands too.

**Phase 2B — Replies (shape depends on R1).**
- *A:* create the mailbox; aliases; forwarding copy to Gmail; move the root MX to the provider (it replaces 2A's
  records); add its SPF include and its DKIM record. Then add the account to the Gmail phone app and set From = support@.
- *B:* set up one mail client with Resend SMTP (`smtp.resend.com`, user `resend`, an API key **scoped to sending
  only**, never the product's key); identities `support@`, `hello@`.
- *C:* becomes its own plan with a PM brief and drawings. Not part of this one.
- **Deliverability gate (every shape):** reply to Gmail, Outlook and one other provider. Headers show SPF, DKIM and
  DMARC **pass and aligned**, and the reply lands in the inbox. A spam-folder landing fails the phase.

**Phase 3 — Point the product at it (code, one promote).** Census done 2026-11-12, re-grep at build:
- **The switch** `FIELDLOGICHQ_CONTACT_EMAIL` → `support@` is GST/HST step 6.7's edit. This project ends by telling
  6.7 "support@ works". Do not make it twice. If this lands well before 6.7, the owner may rule to switch early.
- **Customer-visible Gmail exposures that bypass the shared constant:**
  - The billing "Contact us" links: `CONTACT_HREF` in `components/billing/PlanMoveDialog.tsx:47`, used by BillingBody,
    ClubUpgradeSetup and TeamCapDialog. Three unit tests pin the Gmail `mailto:`.
  - The email-body fallbacks `p.contactEmail ?? ADMIN_EMAIL` in `lib/email.ts` (registration, rejection, org-closed,
    family contact).
  - The feedback reply's Reply-To (`app/api/platform-admin/feedback/[id]/reply/route.ts:175`), and the staff window
    that displays it.

  These read the shared contact constant. **`ADMIN_EMAIL` stays** for the internal alert recipients (feedback
  notice, billing drift, tax record, webhook, observability, staff change, request-deletion). It is renamed so its
  purpose is obvious, never repointed.
- **Left alone:** the `RESEND_FROM` fallbacks (env-driven; prod is `noreply@`), `VAPID_EMAIL`, bookkeeping access,
  the platform-admin login.
  - `scripts/stack-health.mjs`'s From fallback is shared automation, so it changes only on an owner ask, in its own commit.
- `privacy@` reaches the product through the Terms/Privacy pages at 6.7 (it is in the legal drafts), not through this project.
- `/docs` (help), `/marketing` (public copy) and `/legal` (CASL: commercial emails need a working contact. This
  project is what makes that true) run in the same pass.

**Phase 4 — Prove it on production.**
1. From a real outside address, write to `support@`, `hello@` and `privacy@`, and confirm each arrives.
2. Reply as `support@` and confirm the reply arrives un-spammed with the right From.
3. Trigger one real product email (an invite), reply to it, and confirm the reply lands.
4. Add the addresses to `npm run health` only if the owner asks (shared automation, its own commit).

**Phase 5 — Operating it.**
- Where support mail is handled and how fast; hand-off to `/helpdesk`.
- Raise DMARC from `p=none` to `quarantine` only after a month of clean aggregate reports. Add a `rua=` report
  address first, or there is nothing to read.

## 5. Out of scope

- Moving the platform-admin sign-in or internal alerts off `fieldlogichq@gmail.com`.
- Per-club custom sending domains (Club tier Stage 4e).
- A ticketing system or shared-inbox product. Inbound-email-to-product features, unless R1 = C, which then gets its own plan.

## 6. Success criteria

- A customer can write to `support@`, `hello@` or `privacy@fieldlogichq.ca`, and it reaches the owner's inbox
  (today it bounces).
- Our reply lands in their inbox, not spam, from `support@`, and keeps working after January 2027.
- No customer-visible page or email names `fieldlogichq@gmail.com` or an address that goes nowhere.
- SPF, DKIM and DMARC pass and align for both product email and hand-written replies.
- Monthly cost is within whatever R1 rules.

## 7. Follow-through owed

- `/strategy`: log R1's provider + monthly cost if it is paid.
- GST/HST step 6.7: told "support@ works" when Phase 2 passes, so it can make the switch.
- `/docs` + `/marketing` + `/legal` (CASL contact) at Phase 3.
- Update memory `project_platform_admin_email` (the "dead address" note goes away) and the email-stack memory.
