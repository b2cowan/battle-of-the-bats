# Business email addresses — plan (QUEUED 2026-10-26, not started)

**Status:** queued by the owner for later; nothing built, no provider chosen. Start with Phase 0.
**Owner ask (2026-10-26):** investigate low-cost ways to run real mailboxes on our own domain
(`support@fieldlogichq.ca`, `hello@fieldlogichq.ca`, `noreply@fieldlogichq.ca`, …) that we can print
on the website, and set them up end to end on production so we can correspond with users.
Replaces the empty "Email Strategy Investigation" stub in TODO.md §5.

## 0. Owner rulings and sequence (2026-10-26)

- **It is a team of one.** No per-person mailboxes, no shared-inbox product. Several addresses
  (`support@`, `hello@`, `info@`, `feedback@`, `noreply@`, …) exist for different *purposes*, and they all
  land in the one inbox the owner already reads (`fieldlogichq@gmail.com`). The inbox tells them apart by
  the address each message was sent to (labels/filters). This shrinks the project to **forward + reply-as**.
- **Public addresses ruled 2026-10-26 (owner accepted the recommendation):**
  - `support@fieldlogichq.ca` — anything a customer needs help with; help centre, account page, app footer,
    product emails, feedback replies. The main one.
  - `hello@fieldlogichq.ca` — general, press, not-yet-customers; marketing site; campaign replies.
  - `privacy@fieldlogichq.ca` — printed only in the privacy policy and terms (Canadian privacy-contact expectation).
  - `noreply@fieldlogichq.ca` — real, send-only, never printed as a contact; every automatic email's reply
    address points at `support@`.
  - **Not created now:** `info@` (duplicates `hello@`), `feedback@` (feedback has its own in-product home),
    `billing@` / `security@` / `sales@` (nothing for them to do yet; adding one later is a free setting).
  - **Goal behind it: no customer ever sees `fieldlogichq@gmail.com`.** It appears in ~5 customer-visible
    places today (email footer fallback, account-deletion request, …); Phase 3 replaces each with `support@`.
- **Spend ceiling ruled 2026-10-26: close to zero.** No live clients and little mail expected; the aim is a
  professional look, not capacity. Free forwarding + Resend replies fits. A paid mailbox is out unless reply
  deliverability fails. Re-check Resend's free limits at Phase 1 rather than trusting memory.
- **Sequence: Support Console Stage 5 first, this project right after it.** Stage 5 (drawn 2026-10-26)
  has exactly one dependency on this work — Ask 5, replying to feedback from the console. As drawn, those
  replies are sent From "FieldLogicHQ support" at the no-reply address with Reply-To
  `fieldlogichq@gmail.com`, which works with no new mailbox. The owner agreed to build Stage 5 that way.
  Not before Stage 5, because nothing in Stage 5 needs a new mailbox and Stage 4b has a deadline.
- ⚠ **Do not rule Stage 5 Ask 5 as "replies go to `hello@fieldlogichq.ca`" until this project has
  created that mailbox** — today it receives nothing. (The drawing also says campaigns reply to `hello@`; same defect.)
- **Stage 5 build must read the reply address from ONE shared setting**, not a literal in the feedback-reply
  sender. That is what makes the flip in Phase 3 a one-line change instead of rework. Carry this into
  the Stage 5 build prompt.
- **Not blocking anything else.** Phases 0–2 are DNS and provider work with no app code, so they can be done
  at any quiet moment, even before Stage 5 ships. Phase 3 (point the product at it) waits for Stage 5 to land.

## 1. The question is narrower than the Google answer (verified in the repo 2026-10-26)

The Google comparison treats this as one problem — "get email on my domain". It is two, and one is
already solved:

| | State today | Evidence |
|---|---|---|
| **Sending** as `noreply@` / `hello@fieldlogichq.ca` | **Works.** Resend, domain `fieldlogichq.ca` verified (DNS in Route 53). `RESEND_FROM` = `FieldLogicHQ <noreply@fieldlogichq.ca>` in Amplify. | memory `project_email_stack`; `lib/email-sender.ts` |
| **Receiving** mail sent to those addresses | **Nobody receives it.** There is no mailbox or forwarder behind `hello@` or `support@`. The company's only real inbox is `fieldlogichq@gmail.com`. | memory `project_platform_admin_email` |

⚠ **This is a live defect, not a nice-to-have.** `hello@fieldlogichq.ca` is the Reply-To on every
product email and the account page's "contact support" link; `support@fieldlogichq.ca` is named in
the org-closed email. A customer who replies to us today is writing to a dead address. Found
2026-09-26, reported, deliberately **not** changed in code (that waits for this project, because the
right fix depends on which address actually gets a mailbox). Roughly five source files carry these
addresses — re-grep at Phase 3.

So the real project is **receive + reply as `support@` / `hello@`**, plus keeping `noreply@` honest.
Most rows in the Google table (Workspace, Zoho, WorkMail) answer "give me a full mailbox"; the
forwarding rows answer "receive only". Sending **from** a support address in a reply is the part
the table glosses over and the part customers will see.

## 2. Options to evaluate (prices are Google's, UNVERIFIED — re-check every one in Phase 1)

| Option | Receive | Reply as `support@` | Fit notes |
|---|---|---|---|
| **Google Workspace** (~$7/user/mo annual per the table) | Real mailbox | Native, best deliverability | Simplest and the industry default; the cost is the only con. One paid seat could host `support@` with `hello@` as an alias. |
| **Forwarding to `fieldlogichq@gmail.com`** (free) | Lands in the existing inbox | Gmail "Send mail as" via an SMTP relay — **Resend SMTP is the obvious relay, we already pay/use it** | Cheapest. Must test that replies don't land in spam and that SPF/DKIM/DMARC alignment holds with two senders on the domain. |
| **Cloudflare Email Routing** | Forwarding only | Same as above | ⚠ Needs Cloudflare to host the domain's DNS. Our DNS is in Route 53 and Amplify depends on it — likely a **non-starter** unless we want a DNS move. Confirm, don't assume. |
| **Amazon SES inbound + S3/Lambda** | Forwarding we'd build and own | Same as above | Cheap but it's software we maintain for a mailbox. Region support for inbound is limited. Prefer a hosted forwarder unless there's a reason. |
| **Zoho Mail** (free ≤5 users per the table) | Real mailbox | Native | Table says free tier has no IMAP/POP — verify; matters if we want to read it in Gmail/phone. |
| **AWS WorkMail** | Real mailbox | Native | The table's last row says AWS scheduled it for end-of-life (text cut off in the screenshot). **Do not choose it until that is read in full.** |

**Working hypothesis to test, not a decision (leading candidate now that it is one person):** forward every
purpose address into the existing inbox for free, reply through Resend SMTP so each reply leaves as the
address the customer wrote to, keep `noreply@` send-only. A paid Workspace seat is the fallback only if
reply deliverability fails. Cost is the tie-breaker; deliverability of the reply is the gate.
Expected effort: about an hour of setup plus testing.

## 3. Decisions the owner will need to make (Phase 0 asks)

1. ~~One shared inbox or per-person mailboxes?~~ **Ruled 2026-10-26: one person, one inbox.**
2. ~~Which addresses are public?~~ **Ruled 2026-10-26:** `support@`, `hello@`, `privacy@` (policy pages only); `noreply@` send-only. See §0.
3. **Is `fieldlogichq@gmail.com` still the platform-admin login and fallback contact?** Moving the
   admin account off Gmail is a separate, bigger change — out of scope unless the owner says so.
4. ~~Spend ceiling~~ **Ruled 2026-10-26: close to zero.** Anything above that needs a `/strategy` entry.

## 4. Phases

**Phase 0 — Frame (owner + agent, short).** Answer §3. Confirm where DNS lives (Route 53 vs. registrar)
and what MX/SPF/DKIM/DMARC records exist today. Read the WorkMail notice in full.

**Phase 1 — Investigate.** Verify each option's current price, limits and DNS requirements against the
provider's own pages (not the Google table, not memory). Pick one; write the choice + reason here.

**Phase 2 — Stand it up (staging first where possible).**
- Add the receiving DNS records without disturbing Resend's sending records (Resend's return-path
  uses its own subdomain — confirm it does not collide with root MX).
- Create the mailboxes/forwards; set up "send as" for each reply address.
- **Deliverability gate before any code change:** send to and reply from Gmail, Outlook and one other
  provider; headers must show SPF, DKIM and DMARC **pass and aligned**. A reply that lands in spam fails the phase.
- Tighten DMARC only after everything passes (start at monitor).

**Phase 3 — Point the product at it (code, then a promote).**
- Make every customer-visible address one of the real ones; remove the Gmail fallback from anything a
  customer reads where a real address now exists (`lib/email.ts`, `app/(consumer)/account/support.ts`,
  org-closed email, request-deletion route). One shared constant rather than five literals.
- Website footer/contact page/help centre list the support address.
- Shared automation rule applies: if any change touches hooks, `.claude/settings*`, or production-run
  scripts, it needs its own owner ask and its own commit. This project should not need to.
- Help docs (`/docs`) and the marketing copy (`/marketing`) get the new address in the same pass.

**Phase 4 — Prove it end to end on production.** From a real outside address: write to `support@` and
`hello@`, confirm arrival, reply, confirm the reply arrives un-spammed with a correct From/Reply-To;
trigger one real product email (invite) and reply to it. Add the addresses to `npm run health` only
if the owner asks (that is shared automation — own commit).

**Phase 5 — Operating it.** Where support mail is handled and how fast; hand-off to `/helpdesk`
(`docs` for its triage workflow). CASL note: commercial emails need a working contact address —
confirm the chosen setup satisfies it.

## 5. Out of scope

- Moving the platform-admin sign-in off `fieldlogichq@gmail.com`.
- Per-club custom sending domains (that is the Club tier's own-web-address work, Stage 4e).
- A ticketing system / shared-inbox product. Revisit only if volume says so.
- Inbound-email-to-product features (reply-by-email into chat, etc.).

## 6. Success criteria

- A customer can write to `support@fieldlogichq.ca` and we receive it; our reply arrives in their inbox, not spam, showing `support@`.
- No customer-visible page or email names an address that goes nowhere.
- Monthly cost within the owner's ceiling (§3 ask 4).
- SPF, DKIM and DMARC pass and align for both our product email (Resend) and our hand-written replies.

## 7. Follow-through owed when this is decided

- `/strategy`: log the provider choice + monthly cost if it is a durable spend decision.
- `/docs` + `/marketing`: new contact address in help and public copy.
- Update memory `project_email_stack` / `project_platform_admin_email` (the "dead address" note goes away).
