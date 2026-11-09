# GST/HST Stage 6 — Terms of Service, privacy policy, acceptance: the plan

> Written 2026-11-08 by the Stage 6 planning session (kickoff: [GST_HST_STAGE6_KICKOFF_PROMPT.md](GST_HST_STAGE6_KICKOFF_PROMPT.md)).
> Parent plan: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 6. PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md).
> Agent: `/legal`. Drafts: `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` (v0.1), `drafts/PRIVACY_POLICY.md` (v0.1).
> **Not legal advice; not reviewed by a lawyer.** No lawyer gate (owner 2026-11-04): `/legal` flags, the owner decides when.
> Marks: **[V]** = opened this session (2026-11-08); **[H]** = handed over (a helper's report, a memory note or an earlier doc), not re-opened.

**Status:** PLAN WRITTEN 2026-11-08; owner sheet §3 RULED 2026-11-08; **6.1 drafts v0.2 written 2026-11-08** (progress line in
§5 6.1); **6.2 PLANNED 2026-11-08, six rulings (§5 6.2 RULED block); next the 6.2 drawing round + build Chunk 1**, 6.5 in
parallel; nothing built. No release timing in this plan (house rule): the
order below is by dependency and rework risk.

---

## 0. What the audit changed about the kickoff (read first)

The kickoff listed three things left. One of them is out of date, and two are wider than it said.

1. **The renewal-date cancel IS on production — the kickoff and the Terms draft are both out of date.** [V] `origin/master` is
   `d10261fdd` ("Release 2026-11-05"); the Plans-end-at-renewal Stage 1 and 2 commits are its ancestors (`git merge-base
   --is-ancestor` exit 0), and `origin/master:lib/plan-ending-server.ts` sends `cancel_at_period_end: true` [H, helper]. The
   in-app cancel keeps the plan to the end of the paid period; the Keep door undoes it. ⚠ Local `master` is stale (2026-08-10):
   "on prod" checks read `origin/master`. **What is genuinely left before §8 is true on every door** (all three are owed by the
   Plans-end-at-renewal project, not this one — this stage only lists them as publish prerequisites):
   - **G13(b): the LIVE Stripe customer portal's cancel mode.** The billing page's "Payment method & invoices" opens Stripe's
     portal; our portal configuration did not yet exist in live mode on 2026-11-05 [H, memory]. If the live portal offers an
     immediate cancel, §8 is false through that door. **→ Answered 2026-11-08 [V]: production always opens the portal with
     our own configuration, built from code with cancel at the period end and no proration (§3, L-c).**
   - **F2: Stripe's live retry setting.** In test mode Stripe's retries ended a past-due plan four weeks before the date we told
     the customer [H, memory]. §8's failed-payment paragraph depends on that setting.
   - F1 and F3 (two Club-only fixes for a cancel over a waiting cheaper move) are on `dev` only; unreachable on production while
     Club is not on sale [H].
2. **"Signup acceptance" is not one sign-up form — it is about eight doors, and two are silent.** [H, helper census, entry points
   below] Accounts are created by the club/fan sign-up, the coach sign-up, the team sign-up, **a tournament registration (an
   account made for the registering coach, no sign-up page)**, the staff invitation, **the "follow this tournament" nudge (a fan —
   possibly a teenage player)**, family claim (an existing account), and platform admin. None asks for anything today.
   Organizations are created by four routes; plans are bought or changed through about six. **And the Terms are written only for
   people who buy plans** — they say nothing about the invited coach, the volunteer or the parent who now hold accounts. The
   guardian-consent draft parks exactly this ("do not add a Terms line until the Terms say who a family account holder is",
   [V] `drafts/GUARDIAN_CONSENT_STAGE4.md` L59–60). Decision O7 below.
3. **The privacy policy is mostly still true, but four sections need sentences, and the two High findings are both still open.**
   [V] The organization-delete route has no storage call at all (grep `storage|\.remove\(` on
   `app/api/platform-admin/orgs/[id]/delete/route.ts`: no match); `pending_purge` is set in one place
   (`lib/billing-retention.ts:557`) and only ever read elsewhere — nothing deletes. Details §2.2.

The renewal-date cancel shipping turns the kickoff's "the drafts promise what production does not do" from the big blocker into a
short list of live-Stripe reads. The largest piece of work left is now **acceptance across every door**, and the largest
legal exposure is still the **§16 purchase-confirmation email** (Ontario's 15-day copy rule).

---

## 1. Terms of Service — truth table (dev and production, 2026-11-08)

Prod = `origin/master`. Evidence is the helper's [H] unless marked [V].

| § | The draft says | Dev | Prod | Evidence / note |
|---|---|---|---|---|
| 1 | Seller's name, email, phone, address | — | — | **O1** (owner facts). Business name registered 2026-11-06 (L13 done) — the §1 note's "registration unconfirmed" is stale. |
| 1 | Links Privacy Policy and Payments Terms | no | no | No `/terms`, `/privacy` or `/legal` route anywhere. Payments Terms unwritten (L3) → **cut that sentence from v1.0; add it back with L3** (a minor version). |
| 3 | 18 or older to manage an org or buy | no check | no check | No age field at any sign-up. **O5** widens: the follow nudge creates fan accounts. |
| 3 | Only the owner buys, changes or cancels | yes | yes | Cancel confirm refuses a non-owner. |
| 6 | CAD, monthly or yearly, in advance | yes | yes | |
| 6 | Tax added from the billing address, **shown before you pay** | yes | **no** | Taxed checkout is GST/HST Stage 2, dev only. ⇒ **publication rides the release that carries taxed checkout**, or §6 says less. |
| 6 | Card stays on file with Stripe | yes | yes | |
| 6 | Receipts and invoices emailed to the owner, on the billing page | partly | partly | No code of ours emails an invoice; Stripe's customer emails do, **if switched on in live** (unverified — owner lookup L-c). The billing page links Stripe's portal. → `/accounting` on what "invoice" may promise. |
| 7 | Trial length and first charge shown at checkout; one trial per org | yes | yes | Trial days set on the checkout session; one-trial rule enforced. The pricing-card "No credit card required" line on a card-required trial is still `/billing`'s check (the draft's §7 note). |
| 8 | Auto-renews; upgrade at once with the difference; downgrade at renewal | yes | yes | |
| 8 | **Cancel: stays active to period end, no further charge, one-click Keep** | yes | **yes** | [V] on prod since 2026-11-05. The Stripe portal door cancels at the period end too — our own configuration, from code (G13(b), 2026-11-08 [V]). Comped, Founding and free-time accounts end at once (no paid period) — correct per note 6. |
| 8 | 30-day email before a price rise | no | no | No email kind. Hand-sent meets it; record a procedure. |
| 8 | Yearly-renewal reminder | no | no | **O2.** Only ending and trial reminders exist. |
| 8 | Failed payment: Stripe retries, emails, then the plan ends | partly | partly | Rests on the live retry setting (F2). |
| 8 | 30 days' notice and a refund when *we* end a plan | no | no | Policy promise, no mechanism → **O3**; a hand procedure suffices at this scale. |
| 9 | Kept 365 days (Coaches Portal) / 90 days (others) after a plan ends | yes | yes | [V] `lib/billing-cancellation-policy.ts:6,8`. |
| 9 | Warning email 30 / 14 days before that ends | partly | partly | [V] sent only when staff press the platform-admin retention button (`processBillingRetentionExpiry` has one caller, the manual route). Either automate it or the Terms say "we will try to warn you". |
| 9 | "May permanently delete" after the period | yes | yes | Honest: nothing deletes automatically. Never "we delete". |
| 9 | "Download your records before your plan ends" | partly | partly | Members export only; the club export is incomplete (L10); a Coaches Portal has no export on cancel by ruling. **Name what each export includes, or cut.** |
| 11 | We may suspend or end for abuse | yes | yes | Platform-admin End now / Finish this ending. |
| 16 | **Purchase email with these Terms and the purchase details** | **no** | **no** | No such email kind ([V] `lib/email-kinds.ts` has `team_workspace_welcome`, no plan-purchase email). **Largest legal exposure** (Ontario CPA 2002: copy within 15 days or a 30-day cancel right). |
| 18 | 30-day email before a change that reduces rights or raises price; re-accept on next sign-in | no | no | Built by §5.3 below. |

---

## 2. Privacy policy — what must change (against dev, 2026-11-08)

No new third-party service, storage bucket or IP/device logging since 2026-11-05 [H]. The edits:

### 2.1 Sections
- **§3 (what we collect about account holders).**
  - Each sale's tax record keeps the invoice name, the **full billing address with postal code** (for a coach buying as a person
    that is a home address — say so), the card country, the US-declaration version and date, and a staff "needs a look" reason
    and note [H: dictionary L9754–9822, migration 451].
  - The staff "looked at" log keeps the staff member's email [H: migration 452] — covered in spirit by "staff changes are recorded".
  - **Acceptance records** (new with §5.3): which version of the Terms and privacy policy each person accepted, and when.
  - Family accounts: still true because Stage 4 is not built; the paragraph waits in `GUARDIAN_CONSENT_STAGE4.md`.
- **§5 (clubs' information, service-provider role).**
  - **Stage 14:** a club now keeps **one record per child across seasons**; the medical note and emergency contact live on that
    record as one current value; records join only on a fact (season roll, accepted tryout) or a head coach's yes; the matcher
    **suggests only**, from name, date of birth and guardian email, within the same team's earlier years; it **never crosses
    clubs** (the database refuses it); **a child with no entries is kept, and the club cannot delete a child** [H: migrations
    435/441, `lib/continuity-match.ts`].
  - "Every record they open is logged" is true only as "every club or person record they open" — lists (Clubs & portals,
    Online payments, Renewals) are not logged [H; `STAFF_CROSS_CLUB_BILLING_LISTS.md`].
  - Staff can see **which clubs and Coaches Portals owe money**; an individual coach's unpaid portal is personal information;
    need-to-know use; the two exports are audited [H].
- **§6 (providers).** AWS also holds **our own bookkeeping** (Aurora DSQL + an S3 bucket, us-east-2: receipts, encrypted backups,
  filed-return figures — no customer names or addresses) [H]. **Add the accountant** (or a "professional advisers" sentence): the
  accountant package names the buying club per invoice; an individual coach appears only as "Coach" [H]. Gmail inbox row stands
  (P4).
- **§9 (retention).** Tax records: kept six years, with no link to the club or person, so they survive deletion (finding 6). **Club
  player data "until the club deletes it" is now misleading** — a child's central record is never deleted.
- **§10 (security).** Unchanged; "encrypted at rest" still unverified (P5). Bookkeeping backups are encrypted archives.

### 2.2 The draft's product findings (status on dev)
| # | Finding | Status | Route |
|---|---|---|---|
| 1 | High — deleting an organization leaves its uploaded files (medical and waiver files included) | **open** [V] | **P7** — recommended fix before publication |
| 2 | High — no automatic purge after the retention window | **open** [V] | `/plan` (after publication; wording stays "may delete") |
| 3 | Medium — a club cannot delete a player or family (now sharper with Stage 14) | open [H] | `/plan` with Stage 14 (the club's own deletion duty as our service-provider promise) |
| 4 | Medium — no signup acceptance | open | **this stage, §5.3** |
| 5 | Medium — no multi-factor sign-in | open [H] | backlog; the policy must not imply it |
| 6 | Low — players' names in the payment description | not re-checked | unchanged |
| 7 | Low — no self-serve name/email correction | open [H] | backlog; the policy says "ask us" |
| 8 | Low — feedback form records IP | open [H] | policy names it |
| 9 | Tax-record addresses never expire | in draft §9 note 6 | `/accounting` sets the period |

---

## 3. The owner decision sheet (one sitting)

**Walk it here:** https://claude.ai/artifact/6AAhpPbe4pvzCacGo3215C (source [GST_HST_STAGE6_DECISIONS.html](GST_HST_STAGE6_DECISIONS.html);
answers saved in the owner's browser; the Send answers tab builds the paste-back).

Each has a recommendation; "as recommended" answers all. Facts the audit could not settle are **lookups**, listed after, not
questions.

> **⚖ RULED 2026-11-08 (owner, the sheet's paste-back) — all thirteen as recommended (option A each).**
> - **⚠ CORRECTION 2026-11-08 (owner, after the 6.1 pass): O1 did NOT rule that the owner's personal name or any home address goes
>   in the Terms.** The owner asked what the seller section requires, and asked for an explanation of a virtual address; the
>   answers below are those explanations, not a ruling, and 6.1 wrongly drafted them in. The owner would rather publish neither
>   his personal name nor his home address. **⚖ O1′ RULED 2026-11-08 (owner): option 2 — the owner's name appears nowhere** (not
>   in the Terms, the checkout or the purchase email). Accepted cost, in his words: "we can deal with a coach demanding a
>   refund … if it means leaving my name out of it. its a small cost and an expectedly very rare occurance". The real remedy is
>   a consumer's cancel until 7 days after the copy, refunding that whole purchase (a yearly plan in full). Options and the
>   rule's text: `docs/agents/legal/ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md` § "The seller's identity without personal details". What O1 did
>   rule stands: a domain contact address, a phone line that need not be personal, and no home address published.
> - **O1** A — and the owner asked two things, answered in the session (explanations, not rulings — see the correction above):
>   (1) **the legal name of a sole proprietor is the owner's personal legal name.**
>   A sole proprietorship has no separate legal name; "FieldLogicHQ" is the registered business name, so §1 reads
>   "<owner's full legal name>, carrying on business as FieldLogicHQ" (the Ontario internet-agreement rules ask for the
>   supplier's name *and* the name it trades under, `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md` §Finding 1). (2) **A virtual
>   address** is a mail service's street address with a unit number (a mailbox store, or a "virtual office" provider) where mail
>   is received and scanned or forwarded, so the home address is never published. Prefer a street-style address over a Canada
>   Post PO box: the rule asks for a *business address*. Check what address the ServiceOntario registration already shows — it
>   is a public record. **Owner steps owed before 6.7:** the mailing address, a phone line, and the domain addresses (support@,
>   privacy@ — forwarding into the Gmail is enough, P4).
> - **O2** A — build the 30-day yearly-renewal reminder (6.4). **O3** A — refund the unused part by hand when we end a plan.
> - **O4** A — not offered in Québec; checkout declines a Québec billing address (6.4). **A market decision → `/strategy` to log.**
> - **O5** A — 18+ (or the age of majority) for every account holder, ticked at sign-up. The guardian draft's "no child holds a
>   login" stays true.
> - **O6** A — cap: 12 months' fees, or $100. **O7** A — one set of Terms for every account holder, with the joined-through-an-
>   organization section. **O8** A — one-tick "We've published our Terms" on next sign-in, everyone.
> - **P1** A — "Privacy Officer, FieldLogicHQ", privacy@, the O1 address. **P3** A — accept each supplier's standard terms, record
>   the dates in `LEGAL_FACTS.md`. **P4** A — name the Gmail in §6 now. **P6** A — `/legal` drafts the procedure and record in
>   6.1, owner approves. **P7** A — fix before publishing (6.5 is IN the stage, not conditional).
>
> **Lookups — read by Claude 2026-11-08, read-only (Supabase Management API; live Stripe API, GET only) [V]:**
> - **L-a:** the **production database is in AWS us-east-2 (Ohio, USA)**. (The dev project is in ca-central-1, Canada — not what
>   the policy describes; noted only so nobody reads the wrong project.) §6 names the United States for Supabase.
> - **L-b:** the organization is on Supabase's **Pro** plan. `/legal` reads the encryption-at-rest wording off Supabase's
>   security page in 6.1 before §10 says it.
> - **L-c, part 1 — G13(b) answered, by the code rather than the dashboard:** production's portal route always opens Stripe's
>   portal with **our own** configuration (`origin/master:app/api/billing/portal/route.ts` → `ourPortalConfigurationId`; it
>   refuses to open the portal if ours can't be found or created), and ours is built from code — v2: **cancel ON, at the period
>   end, no proration; plan switches off** (`origin/master:lib/stripe-portal-settings.ts:30`). So §8 holds through that door.
>   The live read found only Stripe's own default configuration (created 2026-06-02, cancel off) — never used by our product —
>   and **ours does not exist in live yet**: the first live portal open creates it. Re-reading it after that first open (Health
>   → Watching Stripe already checks it) is a confirmation, not a prerequisite. No live subscription exists yet.
> - **L-c, parts 2 and 3 — NOT readable through Stripe's API:** the retry setting (F2; Dashboard → Settings → Billing → Revenue
>   recovery → Retries) and the customer emails for successful payments and finalized invoices (Dashboard → Settings →
>   Business → Customer emails). **Owner reads these two in the dashboard (~2 minutes)** — still a 6.7 prerequisite.

**Terms**
- **O1 — The seller's facts in §1.** Recommend: your legal name; a **domain contact address** (support@ — see P4) rather than the
  Gmail; a **VoIP or business line** (the Act asks for a telephone number, not a staffed one); a **PO box or virtual mailing
  address** in Ontario, so the home address is never published. (The registration part of the old O1 is done — L13.)
- **O2 — The yearly-renewal reminder.** Recommend **build it** (one email, the same daily job that already sends the ending
  reminders, 30 days before a yearly renewal). A silent yearly renewal is what card disputes cite, and Ontario's 2023 Act
  (not confirmed in force) and Québec move toward requiring it.
- **O3 — Refund the unused part when *we* end a plan through no fault of the customer.** Recommend **yes**, by hand at this scale.
  It is the fair mirror of "no refund when you cancel" and makes that clause much easier to defend.
- **O4 — Québec.** Recommend **"not currently offered in Québec"**, and make it true: **refuse a Québec billing address at
  checkout** (the address step already captures and checks the province, [V] `lib/billing-location.ts`). No Québec customer is on
  record. Note: this is also a market decision → `/strategy` logs it.
- **O5 — Minimum age.** The draft asks 18 for people who manage an organization or buy. **Widened:** the "follow" nudge lets
  anyone make an account, including a teenage player, while the guardian draft promises "no child holds a login". Recommend **one
  line for everyone: 18 or older (or the age of majority), ticked at account creation**. Alternative: 13+ for a follow-only
  account (then the privacy policy needs a young-person paragraph and the guardian draft's line changes).
- **O6 — Liability cap.** Recommend as drafted: **12 months' fees, or $100 if nothing was paid.**
- **O7 (new) — Who accepts the Terms.** Recommend **every account holder accepts one set of Terms**, which gains a short section
  for people who joined through an organization (staff, coaches, volunteers, parents): the organization controls their access,
  acceptable use applies, nothing to pay, billing sections don't apply to them. Alternative: buyers only — then acceptable use
  binds nobody who was invited, and a parent sees no FieldLogicHQ terms at all.
- **O8 (new) — Existing accounts.** Recommend a **one-screen "We've published our Terms" accept on next sign-in**, required
  before continuing, for everyone (one tick). Nothing has been sold, so the population is small, but building it once is what
  §18's re-accept needs anyway.

**Privacy**
- **P1 — Accountable person.** Recommend **"Privacy Officer, FieldLogicHQ"** (title, which PIPEDA allows), with a **privacy@**
  address and the O1 mailing address.
- **P3 — Data-processing terms with Supabase, AWS and Resend.** Recommend **accept each supplier's standard terms** and record
  the date each was accepted in `LEGAL_FACTS.md` (Stripe's is in place). `/legal` confirms each supplier's mechanism when you do
  it. Not a publication gate if §6 names them honestly; a gate for the subprocessor list and the club data-processing terms.
- **P4 — The business inbox (a free Gmail).** Recommend **list it in §6 now** (the standing "admin inbox is the Gmail" ruling
  holds), and treat a domain mailbox on a business plan as the cheap later upgrade. O1's public contact address is a separate,
  domain address either way.
- **P6 — Breach procedure and register.** **Not optional:** PIPEDA requires a record of every breach of security safeguards,
  kept 24 months, and a report to the Commissioner and notice to people for a real risk of significant harm. Recommend `/legal`
  drafts the one-page procedure and the register's shape in step 6.1; you approve.
- **P7 (new) — Deleted organizations' files.** Recommend **fix it before publication**: deleting an organization removes its
  stored files too. It is the one finding where the policy would have to admit we keep children's medical and waiver files after
  the club is gone. (The automatic purge waits; "may delete" stays honest.)

**Lookups (facts, not decisions — owner reads them off a dashboard; ~5 minutes)**
- **L-a (P2)** Supabase project region — Supabase dashboard → Project Settings → General. Not in the repo [H].
- **L-b (P5)** The Supabase plan in use (encryption at rest is then read from Supabase's security page by `/legal`).
- **L-c** In live Stripe: the customer portal's cancel mode (G13(b)), the retry setting (F2), and whether customer receipt/invoice
  emails are on. These are owed by the Plans-end-at-renewal project; this stage needs their answers before §6 and §8 publish.

---

## 4. Payments terms (backlog L3) — no work in this stage

[V] Online payments are locked off in production twice: `ONLINE_PAYMENTS_ENABLED` must be exactly `'true'` (production does not set
it) **and** a live key also needs the code constant `LIVE_PAYMENTS_ALLOWED`, which is `false` (`lib/online-payments-switch.ts:21–29`).
The tick-box text is a placeholder (`TERMS_PLACEHOLDER`, version `'placeholder-counsel-pending'`, `lib/online-payment-words.ts:37,41`).
**The placeholder can stay as it is**: no club can reach it in production. Before the owner switches payments on:
- **L3 drafted and approved** (club as merchant of record, the fee as our charge, tax on the fee → cite `/accounting`, fee not
  refunded, disputes, the monthly invoice for the club's Stripe costs, indemnity, event cancellation), published at its own page,
  with a dated version; the Terms §1 sentence returns in the same minor version.
- **L4 researched** — money-services status under direct charges (the one with statutory penalties).
- A small defect to fix in the same build [H, helper; lines 193–205 opened, V]: the payout **`connect`** action checks only
  that the box was ticked, not the version shown (the `agree_terms` action does, line 239). Harmless while the version is a
  placeholder; must match before a dated version exists.

---

## 5. The stage, in order (dependency and rework risk)

```
6.0 owner sheet + lookups ──► 6.1 refresh both drafts → v0.2 (+ breach one-pager, acceptance wording)
        │                          │
        └──► 6.2 legal pages + versioning + links (built dark) ──► 6.3 acceptance at every door ──┐
                                   │                                                             ├─► 6.6 reviews ─► 6.7 publish
                                   └──► 6.4 purchase email (+ yearly reminder, Québec refusal) ──┤
                       6.5 P7 org-delete removes files (independent) ───────────────────────────┘
```

### 6.0 — Owner sheet (§3) and lookups
Nothing else starts until O5, O7 and O8 are answered: they decide who sees the accept step and what it says. **Done 2026-11-08:
all thirteen ruled as recommended; L-a, L-b and G13(b) read — see §3. Left from 6.0: the owner's two Stripe dashboard reads
(F2 retries, customer emails) and the O1 contact facts, both needed only by 6.7. Next: 6.1.**

### 6.1 — Refresh both drafts to v0.2 (`/legal` session, Opus)
**Kickoff prompt:** [GST_HST_STAGE6_1_LEGAL_PASS_PROMPT.md](GST_HST_STAGE6_1_LEGAL_PASS_PROMPT.md) (written 2026-11-08).

> **Progress — 6.1 DRAFTED 2026-11-08 (`/legal`, Opus; drafts, not owner-approved).** Terms and privacy policy both at **v0.2**
> with O1–O8 and P1–P7 applied; the Terms gained §3 "If you joined through an organization" and §20 "How you accept these Terms"
> (the build's exact words: one sign-up box carrying the age line, the "We've published our Terms" sign-in screen and its
> "updated" variant, the purchase line). `/accounting` read Terms §6–§8 and §16: its wording applied (tax as its own line, "plus
> applicable taxes" on trial, yearly reminder and upgrade, the O3 refund includes tax with a credit note) and the list the
> **6.4 purchase email** must show is in the Terms draft; its owner questions A–D are there. `BREACH_PROCEDURE.md` v0.1 written
> (owner approval and the record's home owed). Supplier data-processing terms: Supabase, AWS and Resend are all part of their
> service terms, no signature — recorded in `LEGAL_FACTS.md`; the owner records each date. The guardian draft's parked Terms
> line is written. **Re-checked against the code, changing the plan's §2:** a club-wide "same child" queue also suggests and
> joins (Families access), not only the head coach; each season's roster keeps its own medical copy; the bookkeeping backups
> are a local file, not AWS; the accountant file is `invoices-and-credit-notes.csv`; **new finding 10 — the staff page-visit
> trail (every platform-admin page, staff email + address) has no end date** (→ `/plan`, prune at 90 days). The failed-payment
> paragraph is written to hold whatever the live retry setting is (a failed payment keeps the plan working and tells the
> owners; only Stripe giving up ends it). **Left for the owner before 6.7:** the phone and mailing address (O1/P1 — no personal name anywhere, O1′ ruled 2026-11-08); the
> one Stripe choice (customer emails); F2; support@ and privacy@ on fieldlogichq.ca (and hello@, which the product already
> uses as its reply-to). Next: 6.2 via `/plan`; 6.5 can start any time.
- Apply §1's truth table and §2's edits; strike every stale note (production cancel; L13).
- Apply O1–O8 and P1–P7. Add the **"If you joined through an organization"** section (O7). Add the **acceptance wording** as a
  short section of the Terms draft (the tick-box line, the sign-in screen's two sentences, the purchase-line), so the build copies
  it — customer-facing words come from the legal draft, not the build (house rule).
- Write the **breach procedure and register** one-pager (P6) under `docs/agents/legal/` (not a customer document).
- `/accounting` reads §6–§8 and §16 (price, tax, refund, invoice, the purchase email's tax lines). Apply, or record as an owner
  question.
- Done when: both drafts at v0.2, every [bracket] filled, notes reduced to what still needs the owner.
- **Why first:** every product piece renders this text or records its version; text settled first avoids re-cutting copy and
  re-bumping versions.

### 6.2 — Legal pages, versioning and links, built dark (build session, Sonnet; route to `/plan` for the build prompt)
**Kickoff prompt (for `/plan`):** [GST_HST_STAGE6_2_KICKOFF_PROMPT.md](GST_HST_STAGE6_2_KICKOFF_PROMPT.md) (written 2026-11-08) —
it raises two questions this section leaves open: where the page's words live without a second copy before 6.7, and how one
switch can be on in dev while production stays off.
**Build prompt:** [GST_HST_STAGE6_2_BUILD_PROMPT.md](GST_HST_STAGE6_2_BUILD_PROMPT.md) (two chunks, Sonnet) · **drawing round:**
[GST_HST_STAGE6_2_DRAWING_PROMPT.md](GST_HST_STAGE6_2_DRAWING_PROMPT.md) (`/legal` page words, then `/design`).

> **⚖ RULED 2026-11-08 (owner, "agree as recommended", the 6.2 `/plan` session) — six rulings; they amend the bullets below.**
> - **Q1 — the words' one home:** the drafts stay the one home until 6.7; the dev preview **reads the draft file itself**,
>   filtering out the owner parts (notes, change log, "before publishing", §20's product words; a blank `[fact]` shows a
>   "to be filled" mark), under a "Draft" banner. At 6.7 the approved text is written once as that date's frozen version file
>   and the draft is deleted. A published file is frozen by the build (content hash recorded). Neither a placeholder (no
>   walkable text) nor moving the text now (notes split from the sentences they qualify).
> - **Q2 — the switch:** two locks. Env `LEGAL_PAGES_PREVIEW` opens a preview only where the Stripe key is a test key (the
>   payments switch's production identity); code constant `LEGAL_PAGES_PUBLISHED` (false) is publication, flipped in its own
>   commit at 6.7, which fails the build unless both documents have a dated version.
> - **Q3 — contact:** one constant for the product's contact address; it stays **hello@** (support@ receives no mail yet).
>   At 6.7, once the owner confirms support@ works, support@ becomes the one public address (reply-to included); hello@ keeps
>   forwarding. The org-closed email's support@ (the only use, a dead mailbox today) moves to the constant in 6.2.
> - **Q4 — drawn first:** a short `/design` round (reading page, earlier version, preview, account menu, sign-in foot row,
>   footer, account row); the build's Chunk 2 waits on it. The kickoff's pointer to the public-page layout standard is to a
>   standard scoped to tournament and club pages: these are marketing-frame pages, borrowing its prose width and heading
>   levels by choice.
> - **Q5 — above the text:** title and "Effective {date}" only; no "last updated"; no "earlier versions" list until a second
>   version exists; an earlier version carries "in effect from {date} to {date}" and a link to the current one.
> - **Q6 — no link in our own emails:** the platform envelope keeps no footer (owner 2026-10-20); the 6.4 purchase email
>   carries the version link in its body. The "platform email envelope" bullet below is **struck**.
> - Also settled in the session: "Privacy Policy" is one constant, no spelling-gate rule (no ruling to widen it); the guardian
>   consent box's lowercase "the privacy policy" goes to `/legal` with closeout item 3(d) at 6.7; the `/docs` help line is
>   written at 6.7, not in 6.2 (help must not point at pages that are "not found" on production); for `/legal` at 6.6: the
>   pricing page's "No contracts — cancel anytime" beside a published Terms of Service.
>
> **Progress — 6.2 PLANNED 2026-11-08** (build prompt + drawing prompt written). **Drawing round done 2026-11-09:** `/legal`'s
> page words in the Terms draft §20 item (4); drawings round 2 (after `/design` review) at
> https://claude.ai/artifact/MWPQ7ZMos5js7gBCdrkjxr (source `GST_HST_STAGE6_2_DRAWINGS.html`). **⚖ Drawings APPROVED
> 2026-11-09, all seven asks as recommended (1A–7A; the rulings are written in the build prompt's Drawings line).** Next: the
> build, Chunk 1 then Chunk 2, as a Sonnet session from the build prompt. **BUILT 2026-11-09, dark:** Chunk 1 `9f27c527d`, Chunk 2 `5f6cc1b8f`; owner walk https://claude.ai/artifact/FAR1R1TUATP26Sipu7VdHb PASSED 21/21 2026-11-09 (ledger §500). **Simplify + review pass COMMITTED `7b8af5ccd` 2026-11-09** (see `GST_HST_STAGE6_2_REVIEW_PROMPT.md` Progress).
- **Pages:** `/legal/terms`, `/legal/privacy` (later `/legal/payments`), with `/terms` and `/privacy` redirecting. Each **published
  version stays readable at its own address** (`/legal/terms/<version>`): an acceptance record points at a version, so we must be
  able to show what someone agreed to.
- **Version** = the effective date (`YYYY-MM-DD`), the shape the payments terms already use. Two values per document: the current
  version, and **the oldest version that still counts as accepted** — a minor bump (a typo, a new provider row) moves the first
  only; a significant one moves both and triggers the §18 re-accept.
- **One switch:** a single "legal pages published" constant (the payments-switch pattern: a reversal that matters is a commit).
  Off: the routes 404, and no link, tick-box or sign-in screen renders. This lets 6.2–6.4 be built and walked on dev before the
  text is approved.
- **Links**, from the census [H]:
  - marketing footer's bottom row (beside "© FieldLogicHQ") — reaches the marketing pages, family app and account pages;
  - **the shared account menu** (one row reaches the admin, coach, consumer, tournament, club-bar, marketing and platform menus);
  - the account page row the 2026-07-20 comment reserves ([V] `app/(consumer)/account/page.tsx:68–72`) — installed-app users have
    no other path;
  - **inside the sign-in and sign-up cards** (those pages hide the footer on purpose);
  - ~~the **platform email envelope's** own footer, for FieldLogicHQ's own account emails only.~~ **Struck by Q6 (2026-11-08).**
  - **Not** on club and tournament public sites (they are the club's pages, and the club's own privacy link is a separate thing),
    except where a page creates a FieldLogicHQ account (the registration form, the follow nudge) — there the acceptance line
    carries the links.
- **Done when:** with the switch on in dev, every surface above links the pages; with it off, nothing renders.

### 6.3 — Acceptance at every door (build session; needs 6.2; split into two chunks if heavy)
**Kickoff prompt (for `/plan`):** [GST_HST_STAGE6_3_KICKOFF_PROMPT.md](GST_HST_STAGE6_3_KICKOFF_PROMPT.md) (written 2026-11-09, after the 6.2 walk passed) —
it raises eight questions this section leaves open, chiefly the record's shape, how the dev preview's `draft` version behaves, and the
required screen on an installed phone app.
**Build prompt:** [GST_HST_STAGE6_3_BUILD_PROMPT.md](GST_HST_STAGE6_3_BUILD_PROMPT.md) (three chunks, Sonnet) · **drawing round:**
[GST_HST_STAGE6_3_DRAWING_PROMPT.md](GST_HST_STAGE6_3_DRAWING_PROMPT.md) (`/legal` words, then `/design`). The build prompt's
census (B1, C1) **supersedes §7's 6.3 lines** — several §7 line numbers had moved, and it adds doors §7 lacked.

> **⚖ RULED 2026-11-09 (owner, "as recommended", the 6.3 `/plan` session) — ten rulings; they amend the bullets below.**
> - **R1 — the record:** one append-only table, one row per tick — person (link cleared on account deletion), email as text,
>   Terms version, Privacy Policy version, **the exact sentence ticked** (the family consent record's pattern), door, time. No
>   IP, no device; no separate age flag (the sentence records both promises). The Terms version is mirrored onto the auth
>   user's server-only metadata (the Founding Season lock's precedent) — **verified:** every layout already calls `getUser()`,
>   which returns it fresh, so the check costs no query. The table is the truth; the mirror is a cache.
> - **R2 — dev preview:** `'draft'` satisfies the check only in the preview and never a dated version; at 6.7 every dev account
>   accepts again. Production records nothing while off.
> - **R3 — the screen replaces the signed-in shell at the same address** (no redirect, no nav); Saving… / failed save keeps the
>   tick / "terms changed" un-ticks; Sign out always present.
> - **R4 — exempt:** exactly staff and the two demo accounts, one home, a test pins the list. Fixtures record, not exempt.
> - **R5 — every page where a person sets a password carries the box** (the four invitation doors included); no-person accounts
>   are recorded by their scripts, exempt, or caught by the screen.
> - **R6 — the paid-button line is 6.3's**; a stopped purchase opens a window and resumes with the same choices after one tick.
> - **R7 — three chunks:** A engine (invisible, fixtures ride here), B account doors + the screen, C organization/plan gates, the
>   line, the window, the full census.
> - **R8 — `/legal` words** (failed save, refusals, the window's title, a cancel door on the screen, retention) — drawing round.
> - **R9 — drawn first:** B and C wait on the round; A does not.
> - **R10 — only a Terms change brings the screen back;** the Privacy Policy version is recorded, never blocks.
> - **Disagreements with this section, argued from the code (accepted with the rulings):** (1) **six** signed-in shells — the
>   scorekeeper and check-in layouts were missing — and platform admin is exempt, not checked; (2) a layout check runs on a full
>   page load only (Next 16 partial rendering), so an app left open across the flip sees the screen at its next load — accepted,
>   because the organization and purchase routes check for themselves; (3) **cancel, downgrade, keep-my-plan and the billing
>   portal are never gated** (§18), and the census lists them so; (4) the staff invitation sets its password in the browser, so
>   the server refuses the join, and the screen catches anyone around it; (5) the risk sits where a person may never open a
>   signed-in shell (the follow nudge, the registration that makes an account) and at the organization/plan routes — every
>   other missed account door is caught by the screen.
>
> **Progress — 6.3 PLANNED 2026-11-09** (build prompt + drawing prompt written). Next: the drawing round and Chunk A, in either
> order or together; then B, then C; `/legal` review before C's hand-off; then the walk.
- **The record:** an append-only acceptance log per person — document, version, user, email kept as text (outlives a deleted
  user, the payouts shape [V]), time, and **which door** (sign-up, invite, registration, sign-in screen, checkout). **No IP
  address** (data minimisation; the account and time are the evidence) — `/legal` to confirm in 6.6. The accepted version is
  also mirrored onto the user's server-only metadata so a check costs no query [H, helper's suggestion — verify in the build].
- **Wording:** "I agree to the Terms of Service and have read the Privacy policy" (privacy is notice, not a contract), plus O5's
  age line. Final words from 6.1.
- **At account creation**, server-side refusal without it: club/fan sign-up, coach sign-up, team sign-up, the tournament
  registration that makes an account, the staff invitation's set-password step, the follow nudge. Platform-admin staff accounts
  are exempt (they are us).
- **Before an organization or a plan:** org create, league create, the coach-portal creation, every checkout route, plan move,
  next-season choice and payment-method set-up **refuse** when the person has not accepted the current version, with a code that
  opens the accept window instead of failing. (The webhook cannot ask; the check sits before checkout.) Comped and Founding
  accounts go through the same check — an agreement without a price is still an agreement.
- **Existing accounts (O8):** one shared server check, called by the five signed-in layouts (consumer/family, club and tournament
  admin, club coaches, coach portal, platform admin) [H: the helper's list]. Not the request proxy alone: it misses the club
  Coaches Portal and the family app, and magic-link and invite sign-ins skip the password-only redirect [H]. API routes are not
  blocked mid-session; the creation and purchase routes above carry their own check.
- **Demos and fixtures:** demo sandbox users and orgs are **exempt** (a shared demo user must never see the screen — the tour
  check would fail); seed and walk fixture scripts record acceptance so probes are not stopped.
- **Mid-window version change:** refused with "The terms changed while this window was open. Read them again." — the payouts rule.
- **Done when:** a census test lists every account-, org- and plan-creating route and fails when one lacks the check (the
  `HISTORY_ENDPOINTS` guard pattern), and the walk covers every door.

### 6.4 — The purchase-confirmation email, and its neighbours (build session; needs 6.2; `/accounting` on the tax lines)
- **On every first purchase and every paid plan change** (checkout completed, upgrade, next-season plan): an email to the owner
  with what was bought, the price, the taxes, the billing period, the renewal date, how to cancel, and **the exact Terms version
  — as a link to that version's page plus the text itself** (attached or inline; `/legal` settles which satisfies "a copy" in
  6.6 — the Ontario topic file's primary text was not fetched [H]). This closes §16. The Coaches Portal welcome email is the
  natural host for a coach's first purchase.
- **O2 (ruled yes):** the yearly-renewal reminder, as a step of the existing daily job.
- **O4 (ruled A):** checkout refuses a Québec billing address, with a plain line; existing Québec accounts (none known) stay.
- **§8 price rise:** no build — a written hand procedure in the legal folder (30 days' email; no silent change).
- **§9 warning emails:** either schedule the retention run or the Terms say "we will try to warn you". Recommend the wording
  change now and the scheduling with the purge (finding 2).

### 6.5 — P7: deleting an organization removes its files (build session; independent of the rest)
Route to `/plan`: the delete removes every storage object the organization owns, before or with the rows (signed medical and
waiver files, documents, logos). The other findings (purge, a club deleting a child, MFA, self-serve correction) are separate
`/plan` items; the policy states them truthfully meanwhile.

### 6.6 — Reviews before hand-off
- `/legal` on the v1.0 texts, the accept step (what is collected, what a customer agrees to, the record), every new email.
- `/accounting` on anything stating a price, a tax, a refund or an invoice (Terms §6–§8, §16 email).
- `/docs`: a help passage for the accept step and where the legal pages live; the billing articles' cancellation lines match §8.
- Demos: the build's tour check passes with the switch on (the demo exemption).
- Apply what they find, or record it as an owner question.

### 6.7 — Publication
- Prerequisites: lookups L-a/L-b answered and in §6/§10; L-c answered and §6/§8 match it; taxed checkout on production (or §6
  says less); 6.3 and 6.4 built and walked; P7 fixed (ruled 2026-11-08).
- The owner approves the v1.0 text. Set the effective date = the version. The product's copy becomes the single source: **the
  draft files are deleted and replaced by a pointer row in `LEGAL_INDEX.md`**; their "Before this can be published" and "For a
  lawyer's eye" sections move to a `/legal` topic file rather than into the product.
- Flip the switch in its own reviewed commit; it rides a release (`/release`), recorded in the release history. Existing
  accounts accept on next sign-in.
- **A later change:** minor → new current version, page updated, no re-accept. Significant (reduces rights or raises price) →
  30 days' email to account owners first (§18), then move "oldest still accepted" so everyone re-accepts at next sign-in.
- `LEGAL_FACTS.md` "What does NOT exist" is updated the same day.

---

## 6. What Stage 9 can and cannot start

Stage 9 (help, demos, dictionary, the `/accounting` review, the owner walk, production) **can start now** on everything that
describes the tax itself — the address step, the tax lines, the dictionary and snapshots, the demo check, the walk in test mode.
**It cannot finish** the parts that quote the Terms — a help line about refunds, cancellation rights or "what you agreed to",
and the **first paid subscription of a plan not yet on sale**, which the parent plan gates on Stage 6 (§5 of that plan) —
until 6.7. Help articles describe the product; the Terms must agree with them, not the other way round.

---

## 7. Entry points (for the build prompts) [H, helper census 2026-11-08 — open before building]

Account creation: `app/api/auth/signup/route.ts:51`; `app/api/auth/coach-signup/route.ts:44`; `app/api/auth/team-signup/route.ts:39`;
`app/api/register/route.ts:235` → `lib/registration-account.ts:31`; `app/api/admin/members/invite/route.ts:23` →
`accept-invite/route.ts:80`; `components/public/FollowAccountNudge.tsx:116`; `app/api/family/claim/[token]/route.ts:29` (existing
account); `app/api/platform-admin/company-users/route.ts:18` (exempt).
Organizations: `app/api/org/create/route.ts:40`; `app/api/league/create/route.ts:53`; `lib/team-workspace-provisioning.ts:279`;
`lib/portal-free-time-give.ts:232` (staff-made shadow org).
Plans: `app/api/billing/create-checkout/route.ts:71`; `create-team-checkout/route.ts:41`; `app/api/billing/move/route.ts:51`;
`choose-next-season/route.ts:49`; `setup-payment-method/route.ts:20`; `lib/team-org-billing.ts:716` (no callers found).
Signed-in layouts: `app/(consumer)/layout.tsx:38`; `app/[orgSlug]/admin/layout.tsx:61`; `app/[orgSlug]/coaches/layout.tsx:63`;
`app/coaches/layout.tsx:31`; `app/platform-admin/layout.tsx:30`.
Links: `components/Footer.tsx:160–163`; `components/shared/AccountMenu.tsx:260–305`; `app/(consumer)/account/page.tsx:68–72` [V];
`lib/email-envelope-warm.ts:246`.
Shape to reuse: `app/api/admin/payouts/route.ts:197–247` [V]; columns on `org_payment_accounts` (dictionary ~L8222).
