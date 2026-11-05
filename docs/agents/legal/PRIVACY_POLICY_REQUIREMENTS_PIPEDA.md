# What FieldLogicHQ's privacy policy must say (PIPEDA, cross-border, breaches, children)
**Last verified:** 2026-11-05
**Re-verify by:** 2027-11-05, or a trigger — **Bill C-36 (Protecting Privacy and Consumer Data Act) passes** (introduced
2026-06-15, first reading only as far as found); the first Québec customer (Law 25 — separate topic, not written);
guardian accounts ship (children's consent moves partly onto us)
**Depends on facts:** `LEGAL_FACTS.md` § two privacy roles, § where data lives, § what does not exist

## Question(s) this answers
What a PIPEDA-compliant privacy policy for FieldLogicHQ has to contain; what to say about data processed outside Canada;
breach duties; the age line for children's consent. (Drafted into `drafts/PRIVACY_POLICY.md`.)

## Finding
- **Openness — Schedule 1, 4.8.2.** The policy must make available: the **name or title, and the address**, of the person
  accountable and to whom complaints go; how to get access to one's information; a description of the **types** of
  information held and a general account of its use; any brochures/codes; what is made available to related
  organizations. 4.8.1: "without unreasonable effort", "in a form that is generally understandable".
- **Accountability for providers — 4.1.3.** We stay responsible for information "transferred to a third party for
  processing" and "shall use contractual or other means to provide a comparable level of protection". → each provider
  needs data-processing terms.
- **Retention — 4.5.3.** Information no longer needed "should be destroyed, erased, or made anonymous"; organizations
  "shall develop guidelines and implement procedures" for destruction.
- **Access — 4.9, s. 8(3).** Individuals can learn what is held, how used and disclosed, get access, and challenge
  accuracy. Answer within **30 days** (extendable in set cases). 4.10: a way to challenge compliance with the accountable
  person.
- **Meaningful consent (OPC guidelines, 2018, revised).** Emphasize four things: **what** is collected, **who** receives it
  (with types), **why** (no vague "service improvement"), and **meaningful residual risks** of significant harm. Express
  consent for sensitive information. Parent/guardian consent for those who can't consent — the OPC's position: "in all
  but exceptional circumstances, this means anyone under the age of 13."
- **Cross-border (OPC guidelines, 2009-01-27).** A transfer to a provider is a *use*, not a disclosure needing fresh
  consent, but organizations must "make it plain to individuals that their information may be processed in a foreign
  country" and that it "may be accessible to law enforcement and national security authorities of that jurisdiction",
  in clear language, ideally at collection.
- **Breaches — PIPEDA s. 10.1 + Breach of Security Safeguards Regulations (SOR/2018-64).** Report to the Commissioner and
  notify individuals when a breach creates a **real risk of significant harm**, as soon as feasible. Report contents s. 2;
  notice contents s. 3 (what happened, when, what info, steps taken, steps the person can take, contact). **Keep a record
  of every breach for 24 months** (s. 6), reported or not. Knowingly failing to report, notify or keep records is an
  offence (fines up to $100,000).
- **Federal reform status.** PIPEDA is still the law. Bill C-27 died; **Bill C-36** (introduced 2026-06-15) would replace
  Part 1 of PIPEDA with administrative penalties up to the greater of $10M and 3% of global revenue (figures vary by
  source — check the bill text when it moves).

## What the product does today
Checked by a code census 2026-11-05; load-bearing lines opened directly: payment description carries children's names
(`lib/stripe-connect.ts:157-162`), feedback stores IP + user agent (`app/api/feedback/route.ts:107-110`), email via Resend
(`lib/email.ts:31`), organization delete touches no file storage (`app/api/platform-admin/orgs/[id]/delete/route.ts` — no
storage call). The full list of gaps is in the draft's "Product findings" block. Headlines: no automatic purge, no
player-retention rule, no club-side player/family delete, org delete leaves uploaded files, no MFA, no breach register
found, Supabase region and three DPAs unconfirmed, business inbox is a free Gmail account.

## Recommendation
Publish the policy only once the owner items P1–P6 in the draft are closed. Route the eight product findings to `/plan`,
the two **High** ones (orphaned children's documents on org delete; no purge) first. Write a one-page breach procedure
and register now — it costs nothing and the 24-month record duty already applies.

## Sources
- [PIPEDA, Schedule 1](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-7.html) — accessed 2026-11-05
- [Breach of Security Safeguards Regulations, SOR/2018-64](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-64/FullText.html) — accessed 2026-11-05
- [OPC, Guidelines for obtaining meaningful consent](https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/) — accessed 2026-11-05
- [OPC, Guidelines for processing personal data across borders (2009)](https://www.priv.gc.ca/en/privacy-topics/airports-and-borders/gl_dab_090127/) — accessed 2026-11-05
- Bill C-36 status: law-firm and commentary pointers only (e.g. [Gowling WLG, 2026](https://gowlingwlg.com/en/insights-resources/articles/2026/understanding-bill-c36)) — **re-check on parl.ca** when relying on it

## Lawyer's eye needed?
Yes — the two-role split (service provider vs organization) for children's data, given we design the forms and staff can
open records for disputes; and the breach-notice duty we owe clubs, which needs a data-processing addendum.
