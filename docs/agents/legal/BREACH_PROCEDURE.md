# Breach procedure and record — FieldLogicHQ (internal, not customer-facing)

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | draft — not owner-approved, **not reviewed by a lawyer** |
| **Last reviewed** | 2026-11-08 |
| **Re-verify by** | 2027-11-08, or a trigger: Bill C-36 passes; the first Québec customer (Law 25's confidentiality-incident register); a second person joins the business |
| **Rests on** | PIPEDA s. 2 (definition), ss. 10.1–10.3, s. 28; Breach of Security Safeguards Regulations SOR/2018-64 ss. 2–6; OPC guidance (sources below) |
| **Ruled by** | owner P6, 2026-11-08: `/legal` drafts, the owner approves. Stage 6 plan §3. |

**Change log:** 0.1 · 2026-11-08 · First draft (GST/HST Stage 6 step 6.1). Statute and regulation text read this session [V].

**No incident data in this repo, ever.** The record itself lives outside it (§6). This file holds the procedure and the
record's shape only.

---

## 1. What counts as a breach

A **breach of security safeguards** is "the loss of, unauthorized access to or unauthorized disclosure of personal information
resulting from a breach of an organization's security safeguards … or from a failure to establish those safeguards" (PIPEDA
s. 2(1)). It covers mistakes, not only attacks. For us, for example:
- one club's records shown to another club, or a coach seeing a child on a team they don't coach (an access-rule bug);
- an email with a roster, a medical note or a sign-up sent to the wrong address;
- an export (Renewals, sales, a members list) sent to or opened by the wrong person;
- a leaked key or password (Supabase service key, Stripe key, the Gmail account);
- a page showing a child's date of birth, medical note or home address publicly;
- a lost or stolen device holding exports or a signed-in session;
- **a breach at a provider** (Supabase, AWS, Resend, Stripe, Google) that touches our data.

**Not a breach:** an outage where nobody got the information; a phishing email that got nothing; a club admin seeing what the
club authorized them to see.

**Which role are we in?** (Privacy Policy §1)
- **Our own information** (account holders, buyers, tax records, our inbox): we are in control. We decide, report and notify.
- **A club's information** (players, families, registrants): OPC's guidance treats the organization that gave the information to a
  processor as in control — "reasonable to interpret the principal organization as having control". **The club reports and
  notifies.** Our job: tell the club straight away (the Privacy Policy §10 promises it), give it everything in §4's report list,
  help it notify, and fix our side. **We still write a record entry** — it costs nothing and shows what we did.

## 2. Who decides

The **Privacy Officer** (the owner — the only person in the business) decides, for our own information, whether there is a
**real risk of significant harm** (RROSH). For a club's information, the club decides; we give it our assessment.

**Significant harm** includes bodily harm, humiliation, damage to reputation or relationships, loss of employment, business or
professional opportunities, financial loss, identity theft, a negative effect on a credit record, and damage to or loss of
property (s. 10.1(7)). **The two factors** (s. 10.1(8)): how **sensitive** the information is, and how **probable** misuse is.

For us, **treat as sensitive by default:** anything about a child; medical notes and health confirmations; dates of birth;
emergency contacts; signed waiver and medical files; home addresses (a coach buying as a person — the tax record); card
country with a name and address. **Probability goes up when:** the person who got it is unknown or hostile; it was taken on
purpose; it was out for a long time; it was not encrypted; it cannot be confirmed deleted. **It goes down when:** it reached one
known, trusted person who confirms in writing that it is deleted, and nothing suggests it was copied.

Write the reasoning down either way (§5, column 9). "No RROSH" with no reason is the weakest possible record.

## 3. Steps, in order

1. **Contain** (first hours): revoke the key or password, end the session, fix or switch off the feature, pull the page, ask
   the recipient to delete. Do not wait for the assessment.
2. **Open the record entry** the same day (§5), even if it later proves not to be a breach.
3. **Assess** (§2). Find out what information, whose, how many people, when it started and ended.
4. **Club information?** Email the club's owner straight away with what you know (the report list below). Keep going on our
   side; the club decides its own report.
5. **Our information with RROSH →** as soon as feasible after deciding the breach happened:
   - **Report to the Privacy Commissioner** in writing, using the OPC's PIPEDA breach report form (priv.gc.ca). It must give
     (SOR/2018-64 s. 2): the circumstances and cause if known; when it happened (or the approximate period); the information
     involved, as far as known; how many people (or about how many); what we did to reduce harm; how we are notifying people;
     and a contact who can answer the Commissioner's questions. More can follow later.
   - **Notify each person** directly — email, phone, mail or in person (s. 4) — conspicuously, with (s. 3): what happened; when;
     what information; what we did to reduce the risk; what **they** can do to reduce it; and how to reach us. Notify
     indirectly (a public notice that can reasonably reach them) only when direct notice would cause further harm, would cause
     undue hardship, or we have no contact details (s. 5).
   - **Tell any other organization that can reduce the harm** — a bank, Stripe, a provider, the police, the club (s. 10.2).
6. **No RROSH →** no report or notice is required. The record entry is still required.
7. **Close** the entry: what changed so it does not happen again, and the date closed.

Knowingly failing to report, notify or keep the record is an offence: a fine up to **$10,000** on summary conviction or
**$100,000** on indictment (PIPEDA s. 28).

## 4. The record — the law's part

- **Every** breach of security safeguards of information under our control gets an entry, **whether or not there was RROSH**
  (s. 10.3(1); OPC: "there must be a record of every breach").
- Each entry is kept **24 months after the day we determined the breach occurred** (SOR/2018-64 s. 6(1)).
- It must hold enough to let the Commissioner check we reported and notified when we had to (s. 6(2)). OPC's minimum: the date
  or estimated date; a general description of the circumstances; the nature of the information; whether it was reported and
  people were notified.
- The Commissioner can ask for it, and we must give access or a copy (s. 10.3(2)).
- An entry about a breach of a **club's** information is our own working record; the club keeps its own.

## 5. The record's columns

One row per breach.

| # | Column | What goes in it |
|---|---|---|
| 1 | Entry number | B-2026-01, B-2026-02 … |
| 2 | Opened | The date the entry was written |
| 3 | Breach date | When it happened, or the approximate period |
| 4 | Determined date | When we decided a breach occurred — **the 24-month clock starts here** |
| 5 | Whose information | Ours (account holders) / a club's (name the club) / both |
| 6 | What happened | Circumstances and cause, in a few sentences. **No names of affected people** |
| 7 | Information involved | Kinds only (e.g. "child's date of birth, medical note") — never the information itself |
| 8 | How many people | A number or an estimate |
| 9 | RROSH? and why | Yes / No, with the sensitivity and probability reasoning (§2) |
| 10 | Contained | What was done, and when |
| 11 | Reported to OPC | Date and the OPC's file number, or "not required" |
| 12 | People notified | Date, how (direct / indirect), or "not required" |
| 13 | Others told | The club (date), Stripe, a provider, police … |
| 14 | Fix | What changed so it does not happen again |
| 15 | Closed | Date |
| 16 | Keep until | Column 4 + 24 months. Delete the row after that date (PIPEDA 4.5.3) unless something still needs it |

**An empty record is a record.** Start it now, with a heading line "No breaches as of [date]", and re-date that line at each
review.

## 6. Where the record lives — **owner question**

Not in this repo (version-controlled, and read by every assistant). Not in the product's database (a product breach could be the
incident itself, and staff screens read that database). It needs: only the owner can open it; it survives a lost laptop; it can
be shown to the Commissioner.

Options: (a) a spreadsheet in the business Google account, two-step sign-in on, shared with no one; (b) a secure note in a
password manager; (c) an encrypted file kept with the business's own records on AWS. **Recommend (a)** — the columns above fit a
sheet, and it is the account the owner already watches. Owner to choose and record **where** (not its contents) in
`LEGAL_FACTS.md`.

## Sources
- [PIPEDA, S.C. 2000, c. 5 — s. 2 definition](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-1.html) — accessed 2026-11-08
- [PIPEDA ss. 10.1–10.3](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-3.html) — accessed 2026-11-08
- [PIPEDA s. 28](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-5.html) — accessed 2026-11-08
- [Breach of Security Safeguards Regulations, SOR/2018-64](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-64/FullText.html) — accessed 2026-11-08
- [OPC, What you need to know about mandatory reporting of breaches of security safeguards](https://www.priv.gc.ca/en/privacy-topics/business-privacy/safeguards-and-breaches/privacy-breaches/respond-to-a-privacy-breach-at-your-business/gd_pb_201810/) — accessed 2026-11-08

(The quotes came through a page-reading tool, not a raw copy; re-read the sections before relying on exact wording.)

## Lawyer's eye needed?
Yes, briefly — (1) the control question for club information: we design the product and our staff can open club records, so
whether a breach on our side is "under our control" for some of it (Privacy Policy lawyer's-eye §1/§5); (2) what our
notice duty to a club should be in a data-processing addendum (none exists yet); (3) once a Québec customer is real, Law 25's
incident register and "risk of serious injury" test replace parts of this.
