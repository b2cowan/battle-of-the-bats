# Suppliers' certifications on our pages, and answering "are you SOC 2?"
**Last verified:** 2026-11-21
**Re-verify by:** 2026-11-21 + 12 months, or: the Supabase plan changes; the business inbox moves off free Gmail; a supplier is added; the security brief or sub-processor list is published
**Depends on facts:** `LEGAL_FACTS.md` — Supabase production = Pro plan (Management API, 2026-11-08); the supplier census in `BOARD_READY_DATA_TERMS_REVIEW.md`

## Question(s) this answers
A prospect asked whether FieldLogicHQ has a SOC 2 report (it has none). Should the security brief's "Who handles it"
table carry each supplier's certifications, and say how we use their security?

## Finding
1. **Quoting a supplier's certification is fine; letting it read as ours is the risk.** Competition Act s. 52 / 74.01
   (false or misleading representations, "general impression" test) is the exposure, plus the board's reliance. The
   brief and the sub-processor list already follow the rule (W6): a supplier's certification is always followed by
   "These are their certifications, not ours." Logos and badges, "SOC 2 compliant infrastructure", "bank-level
   security" and "enterprise-grade" all read as our own claim. Leave them out.
2. **Supabase: the audit covers the platform, but we cannot hand over the report.** Supabase states SOC 2 Type 2 and
   ISO 27001 for the platform. The report is downloadable only by **Team and Enterprise** customers ("You must be at
   least on Team plan to get access to our SOC2 Report"). Production is on **Pro**, so if a board asks to *see* the
   report, the answer today is no. Supabase's SOC 2 guide also says its report covers Supabase's controls, not the
   customer's application (shared responsibility).
3. **AWS: Amplify is in scope.** AWS's "services in scope" list for SOC and for ISO 27001 includes AWS Amplify (read
   by search 2026-11-21; generally available features are in scope unless excluded). This closes the 2026-11-18 gap
   ("scope could not be read"), so the AWS row may now say it. Re-read the live page on the day of publication.
4. **Stripe** (PCI Service Provider Level 1; SOC 1 and SOC 2 Type II yearly) and **Resend** (SOC 2 Type II): unchanged
   from 2026-11-18.
5. **ImprovMX** states none. **Google (Gmail)** is a free consumer account: no business data-processing terms, no
   certification that applies to us. **This is the weak link a reviewer will find**: privacy@ requests land in a free
   Gmail inbox. Moving to Google Workspace (Google states SOC 2 and ISO 27001 for Workspace, with business data-processing
   terms) would close it, and it lines up with the business-email project (Gmail Send-As ends January 2027).

## What the product does today
Unchanged from `MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` (true on production `f12aad4d9`). Our own controls that
may be stated are the brief's "How it is protected" lines, as already narrowed. Do **not** state: a SOC 2, ISO or audit
of our own; a penetration test; "Canadian hosting"; point-in-time recovery (owner step A4 still open); that the database
itself keeps every club apart (the server does; the database's member test let a suspended member's browser read venues
and teams until migration 505); a backup of uploaded files.

## Recommendation
- Add a **"Its certification"** column to the brief's table (Supabase: SOC 2 Type 2, ISO 27001 · AWS: SOC 2, ISO 27001,
  for the hosting service we use · Resend: SOC 2 Type II · Stripe: PCI Service Provider Level 1, SOC 2 Type II ·
  ImprovMX and Google: none stated). Put "These are each company's own certifications, not ours. FieldLogicHQ has no
  certification or independent audit of its own." directly under the table.
- Take the certifications bullet out of "The checks we run ourselves". It is not a check we run, and leaving it there
  blurs whose audit it is.
- "How we use their security" stays in "How it is protected", one clause per supplier, saying only what the code does
  (passwords never reach us; AES-256 at rest by the host; card numbers typed on Stripe's page).
- Do not offer a supplier's report. Supabase's needs a Team plan; the others come under each company's own terms.
- **Applied 2026-11-21 (owner "go ahead with the three changes"):** security brief 0.3, republished to the same link.
- Owner calls: (a) move the inbox to Google Workspace (**owner 2026-11-21: leave it for now, consider later**); (b) whether a prospect's request to see Supabase's report is
  worth the Team plan (a `/strategy` cost question, not a legal one).

## Sources
- [Supabase — SOC 2 Compliance and Supabase](https://supabase.com/docs/guides/security/soc-2-compliance) — accessed 2026-11-21
- [Supabase — Security](https://supabase.com/security) — accessed 2026-11-21
- [Supabase — SOC2 request form](https://forms.supabase.com/soc2) — accessed 2026-11-21
- [Supabase — Pricing](https://supabase.com/pricing) — accessed 2026-11-21
- [AWS — Services in scope, SOC](https://aws.amazon.com/compliance/services-in-scope/SOC/) — accessed 2026-11-21 (via search)
- [AWS — ISO certified](https://aws.amazon.com/compliance/iso-certified/) — accessed 2026-11-21 (via search)
- Stripe and Resend: as cited in `BOARD_READY_DATA_TERMS_REVIEW.md` (2026-11-18)

## Lawyer's eye needed?
No for the column as worded. Yes only if a board makes the brief part of a contract (it is a description, not a term).
